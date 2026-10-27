"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialState } from "./seed";
import { randomDigits, randomId, randomUtr } from "./format";
import { makeDelivery } from "./webhook";
import type {
  AuditEntry,
  BanEntry,
  Branding,
  Customer,
  DemoState,
  ObserverChannel,
  ObserverEvent,
  Session,
  Settings,
  SessionStatus,
} from "./types";

const STORAGE_KEY = "youpi.demo.state.v1";
const PAY_WINDOW = 300;
const VERIFY_WINDOW = 30;

type SimOutcome = NonNullable<Session["simOutcome"]>;

interface CreateInput {
  amountPaise: number;
  method?: Session["method"];
  orderId?: string;
  note?: string;
  source?: Session["source"];
  simOutcome?: SimOutcome;
}

interface DemoApi {
  state: DemoState;
  ready: boolean;
  now: number;
  /* checkout */
  createSession: (input: CreateInput) => string;
  checkPayment: (id: string) => void;
  cancelSession: (id: string) => void;
  sendOtp: (phone: string) => string;
  verifyOtp: (code: string) => boolean;
  resetOtp: () => void;
  /* admin */
  adminConfirm: (id: string) => void;
  adminRefund: (id: string) => void;
  adminFail: (id: string) => void;
  injectTestPayment: (amountPaise: number, mode: "success" | "mismatch" | "suspicious") => void;
  clearQueue: () => void;
  setObserverStatus: (channel: ObserverChannel, status: "online" | "degraded" | "offline") => void;
  updateBranding: (patch: Partial<Branding>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  rotateSecret: (kind: "webhook" | "public") => string;
  unban: (id: string) => void;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoApi | null>(null);

function audit(state: DemoState, action: string, entity: string, detail: string, actor = "owner@merchant"): AuditEntry {
  return { id: randomId("aud", 8), at: Date.now(), actor, action, entity, detail };
}

function withAudit(state: DemoState, action: string, entity: string, detail: string, actor?: string): DemoState {
  return { ...state, audit: [audit(state, action, entity, detail, actor), ...state.audit].slice(0, 200) };
}

function markObserverSeen(state: DemoState, channel: ObserverChannel): DemoState {
  return {
    ...state,
    observers: state.observers.map((o) =>
      o.channel === channel ? { ...o, lastHeartbeat: Date.now(), status: "online" } : o,
    ),
  };
}

function observationEvent(session: Session, channel: ObserverChannel, amountPaise: number, verdict: ObserverEvent["verdict"], utr: string): ObserverEvent {
  const banks = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank"];
  const bank = banks[Math.floor(Math.random() * banks.length)];
  return {
    id: randomId("obs", 8),
    channel,
    receivedAt: Date.now(),
    amountPaise,
    utr,
    bank,
    raw: `${bank}: Rs.${(amountPaise / 100).toFixed(2)} credited to A/c XX4471 on ${new Date().toLocaleDateString("en-IN")}. UPI ref ${utr}.`,
    matchedSessionId: verdict === "matched" ? session.id : undefined,
    verdict,
  };
}

function patchSession(state: DemoState, id: string, patch: Partial<Session>): DemoState {
  return { ...state, sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

function blockingSessions(state: DemoState): Session[] {
  return state.sessions.filter((s) => s.status === "ACTIVE" || s.status === "PROCESSING");
}

function queuedSessions(state: DemoState): Session[] {
  return state.sessions
    .filter((s) => s.status === "QUEUED")
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Resolve a payment as paid: flips status, writes observation + webhook + audit. */
function resolveSuccess(state: DemoState, id: string, channel: ObserverChannel = "android"): DemoState {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return state;
  const utr = session.utr ?? randomUtr();
  let next = patchSession(state, id, {
    status: "SUCCESS",
    utr,
    reason: undefined,
    attempts: 1,
  });
  const resolved = next.sessions.find((s) => s.id === id)!;
  next = {
    ...next,
    events: [observationEvent(resolved, channel, resolved.amountPaise, "matched", utr), ...next.events].slice(0, 60),
    deliveries: [makeDelivery("SUCCESS", resolved, next.settings, { utr }), ...next.deliveries].slice(0, 60),
  };
  next = markObserverSeen(next, channel);
  return withAudit(next, "payment.success", resolved.orderId, `${utr} · ${channel} observer · amount matched exactly`);
}

function resolveFailure(state: DemoState, id: string, reason: string, channel: ObserverChannel = "gmail"): DemoState {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return state;
  let next = patchSession(state, id, { status: "FAILED", reason });
  if (reason.includes("amount")) {
    const observed = session.amountPaise + 100;
    next = {
      ...next,
      events: [observationEvent(session, channel, observed, "amount-mismatch", randomUtr()), ...next.events].slice(0, 60),
    };
    next = markObserverSeen(next, channel);
  }
  return withAudit(next, "payment.failed", session.orderId, reason, "system");
}

function resolveSuspicious(state: DemoState, id: string): DemoState {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return state;
  const ban: BanEntry = {
    id: randomId("ban", 8),
    fingerprint: randomId("fp", 10).replace("fp_", "fp_"),
    reason: "Session flagged by fraud heuristics — held for manual review",
    at: Date.now(),
    hits: 1,
  };
  let next = patchSession(state, id, {
    status: "SUSPICIOUS",
    reason: "Fraud heuristics held this attempt for manual review",
  });
  next = { ...next, bans: [ban, ...next.bans] };
  return withAudit(next, "security.session.held", session.orderId, "Fingerprint banned, session held for review", "system");
}

/** Promote the oldest queued session when the active slot frees up. */
function promote(state: DemoState): DemoState {
  if (blockingSessions(state).length > 0) return state;
  const [first] = queuedSessions(state);
  if (!first) return state;
  const now = Date.now();
  let next = patchSession(state, first.id, {
    status: "ACTIVE",
    queuePos: undefined,
    payDeadline: now + (state.settings.payWindowSeconds || PAY_WINDOW) * 1000,
  });
  next = withAudit(next, "queue.promote", first.orderId, "Slot released — first queued buyer promoted to ACTIVE", "system");
  const rest = queuedSessions(next).map((s, i) => ({ ...s, queuePos: i + 1 }));
  return {
    ...next,
    sessions: next.sessions.map((s) => rest.find((r) => r.id === s.id) ?? s),
  };
}

/** The whole state machine — safe to run every second, returns the same ref when idle. */
function tick(state: DemoState, now: number): DemoState {
  let changed = false;
  let next = state;
  const payWindow = (state.settings.payWindowSeconds || PAY_WINDOW) * 1000;
  const verifyWindow = (state.settings.verifyWindowSeconds || VERIFY_WINDOW) * 1000;

  for (const session of state.sessions) {
    if (session.status === "ACTIVE" && now > session.payDeadline) {
      next = patchSession(next, session.id, {
        status: "EXPIRED",
        reason: "Payment window elapsed — slot released to the queue",
      });
      next = withAudit(next, "payment.expired", session.orderId, "5:00 payment window elapsed", "system");
      changed = true;
      continue;
    }

    if (session.status === "PROCESSING") {
      const startedAt = session.verifyStartedAt ?? now;
      const elapsed = now - startedAt;
      const outcome = session.simOutcome ?? "success";

      if (outcome === "success" && elapsed >= 3400) {
        next = resolveSuccess(next, session.id, Math.random() > 0.45 ? "android" : "gmail");
        changed = true;
      } else if (outcome === "mismatch" && elapsed >= 4000) {
        next = resolveFailure(next, session.id, "Observed amount did not match session amount");
        changed = true;
      } else if (outcome === "suspicious" && elapsed >= 3000) {
        next = resolveSuspicious(next, session.id);
        changed = true;
      } else if (now > (session.verifyDeadline ?? now + verifyWindow)) {
        next = resolveFailure(next, session.id, "No matching bank observation inside the 30s verify window", "sms");
        changed = true;
      }
    }
  }

  if (changed) next = promote(next);
  return changed ? next : state;
}

function statsOf(state: DemoState) {
  const paid = state.sessions.filter((s) => s.status === "SUCCESS" || s.status === "REFUNDED");
  const volume = paid
    .filter((s) => s.status === "SUCCESS")
    .reduce((sum, s) => sum + s.amountPaise, 0);
  const refunded = state.sessions
    .filter((s) => s.status === "REFUNDED")
    .reduce((sum, s) => sum + s.amountPaise, 0);
  const active = blockingSessions(state).length;
  const queued = queuedSessions(state).length;
  return { paid, volume, refunded, active, queued, total: state.sessions.length };
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => initialState());
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed && Array.isArray(parsed.sessions) && parsed.settings) {
          setState(tick(parsed, Date.now()));
        }
      }
    } catch {
      /* storage disabled — demo keeps working in memory */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state, ready]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        setState(JSON.parse(event.newValue) as DemoState);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const stamp = Date.now();
      setNow(stamp);
      setState((prev) => tick(prev, stamp));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const createSession = useCallback((input: CreateInput): string => {
    const id = randomId("pay", 12);
    setState((prev) => {
      const stamp = Date.now();
      const blocked = blockingSessions(prev).length > 0;
      const queuePos = blocked ? queuedSessions(prev).length + 1 : undefined;
      const session: Session = {
        id,
        orderId: input.orderId ?? `YP-${Math.floor(1000 + Math.random() * 9000)}`,
        amountPaise: input.amountPaise,
        method: input.method ?? "UPI",
        status: blocked ? "QUEUED" : "ACTIVE",
        createdAt: stamp,
        payDeadline: stamp + (prev.settings.payWindowSeconds || PAY_WINDOW) * 1000,
        customer: prev.customer ?? undefined,
        note: input.note,
        source: input.source ?? "store",
        simOutcome: input.simOutcome ?? "success",
        queuePos,
        attempts: 1,
      };
      let next: DemoState = { ...prev, sessions: [session, ...prev.sessions], lastCreatedId: id };
      next = withAudit(
        next,
        blocked ? "payment.queued" : "payment.session.created",
        session.orderId,
        `${(session.amountPaise / 100).toFixed(2)} INR · ${blocked ? `queue #${queuePos}` : "slot allocated"}`,
        "system",
      );
      return next;
    });
    return id;
  }, []);

  const checkPayment = useCallback((id: string) => {
    setState((prev) => {
      const session = prev.sessions.find((s) => s.id === id);
      if (!session || session.status !== "ACTIVE") return prev;
      const stamp = Date.now();
      let next = patchSession(prev, id, {
        status: "PROCESSING",
        verifyStartedAt: stamp,
        verifyDeadline: stamp + (prev.settings.verifyWindowSeconds || VERIFY_WINDOW) * 1000,
      });
      next = withAudit(next, "payment.verify.started", session.orderId, "Poller watching observer stream for 30s", "system");
      return next;
    });
  }, []);

  const cancelSession = useCallback((id: string) => {
    setState((prev) => {
      const session = prev.sessions.find((s) => s.id === id);
      if (!session) return prev;
      let next = patchSession(prev, id, { status: "CANCELLED", reason: "Buyer cancelled checkout" });
      next = withAudit(next, "payment.cancelled", session.orderId, "Buyer closed checkout", "buyer");
      return promote(next);
    });
  }, []);

  const sendOtp = useCallback((phone: string): string => {
    const code = randomDigits(6);
    setState((prev) => ({
      ...prev,
      otp: { phone, code, sentAt: Date.now(), verified: false },
    }));
    return code;
  }, []);

  const verifyOtp = useCallback((code: string): boolean => {
    let ok = false;
    setState((prev) => {
      if (!prev.otp) return prev;
      ok = prev.otp.code === code;
      if (!ok) return prev;
      const customer: Customer = {
        name: prev.customer?.name ?? "Demo Buyer",
        phone: prev.otp.phone,
        verifiedAt: Date.now(),
      };
      return {
        ...prev,
        otp: { ...prev.otp, verified: true },
        customer,
      };
    });
    return ok;
  }, []);

  const resetOtp = useCallback(() => {
    setState((prev) => ({ ...prev, otp: null }));
  }, []);

  const adminConfirm = useCallback((id: string) => {
    setState((prev) => {
      const session = prev.sessions.find((s) => s.id === id);
      if (!session || session.status === "SUCCESS" || session.status === "REFUNDED") return prev;
      let next = resolveSuccess(prev, id, "android");
      next = withAudit(next, "payment.confirm.manual", session.orderId, "Confirmed by staff after UTR check", "owner@merchant");
      return promote(next);
    });
  }, []);

  const adminFail = useCallback((id: string) => {
    setState((prev) => {
      const session = prev.sessions.find((s) => s.id === id);
      if (!session) return prev;
      let next = resolveFailure(prev, id, "Marked failed by staff after reconciliation");
      next = withAudit(next, "payment.mark.failed", session.orderId, "Reconciliation found no credit", "owner@merchant");
      return promote(next);
    });
  }, []);

  const adminRefund = useCallback((id: string) => {
    setState((prev) => {
      const session = prev.sessions.find((s) => s.id === id);
      if (!session || session.status !== "SUCCESS") return prev;
      let next = patchSession(prev, id, {
        status: "REFUNDED",
        reason: "Refunded by staff through the payments module",
      });
      const updated = next.sessions.find((s) => s.id === id)!;
      next = {
        ...next,
        deliveries: [makeDelivery("REFUNDED", updated, next.settings, { utr: updated.utr }), ...next.deliveries].slice(0, 60),
      };
      return withAudit(next, "payment.refund", session.orderId, "Refund raised through payments module", "owner@merchant");
    });
  }, []);

  const injectTestPayment = useCallback((amountPaise: number, mode: "success" | "mismatch" | "suspicious") => {
    const id = randomId("pay", 12);
    setState((prev) => {
      const stamp = Date.now();
      const blocked = blockingSessions(prev).length > 0;
      const queuePos = blocked ? queuedSessions(prev).length + 1 : undefined;
      const session: Session = {
        id,
        orderId: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        amountPaise,
        method: "UPI",
        status: blocked ? "QUEUED" : "ACTIVE",
        createdAt: stamp,
        payDeadline: stamp + 300_000,
        note: "Injected from test-mode console",
        source: "admin-test",
        simOutcome: mode,
        queuePos,
        customer: prev.customer ?? undefined,
        attempts: 1,
      };
      let next = { ...prev, sessions: [session, ...prev.sessions] };
      next = withAudit(
        next,
        "dev.test_mode.inject",
        session.orderId,
        `Simulated ${mode} observation for ${(amountPaise / 100).toFixed(2)} INR`,
        "owner@merchant",
      );
      return next;
    });
    // auto-run the verification path so the demo shows a result in seconds
    window.setTimeout(() => {
      setState((prev) => {
        const session = prev.sessions.find((s) => s.id === id);
        if (!session || session.status !== "ACTIVE") return prev;
        return patchSession(prev, id, {
          status: "PROCESSING",
          verifyStartedAt: Date.now(),
          verifyDeadline: Date.now() + 30_000,
        });
      });
    }, 900);
  }, []);

  const clearQueue = useCallback(() => {
    setState((prev) => {
      const queued = queuedSessions(prev);
      if (queued.length === 0) return prev;
      let next: DemoState = {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.status === "QUEUED" ? { ...s, status: "CANCELLED" as SessionStatus, reason: "Queue cleared by staff" } : s,
        ),
      };
      next = withAudit(next, "queue.clear", "queue", `${queued.length} queued sessions cancelled`, "owner@merchant");
      return next;
    });
  }, []);

  const setObserverStatus = useCallback(
    (channel: ObserverChannel, status: "online" | "degraded" | "offline") => {
      setState((prev) => {
        let next: DemoState = {
          ...prev,
          observers: prev.observers.map((o) =>
            o.channel === channel ? { ...o, status, lastHeartbeat: status === "online" ? Date.now() : o.lastHeartbeat } : o,
          ),
        };
        next = withAudit(next, "observer.status", channel, `Observer set to ${status}`, "owner@merchant");
        return next;
      });
    },
    [],
  );

  const updateBranding = useCallback((patch: Partial<Branding>) => {
    setState((prev) => {
      let next: DemoState = { ...prev, branding: { ...prev.branding, ...patch } };
      next = withAudit(next, "branding.update", "settings", Object.keys(patch).join(", "));
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => {
      let next: DemoState = { ...prev, settings: { ...prev.settings, ...patch }, activeVpa: patch.vpa ?? prev.activeVpa };
      next = withAudit(next, "settings.update", "settings", Object.keys(patch).join(", "));
      return next;
    });
  }, []);

  const rotateSecret = useCallback((kind: "webhook" | "public"): string => {
    const value = kind === "webhook" ? `whsec_demo_${randomId("k", 20)}` : `ypk_live_${randomId("k", 16)}`;
    setState((prev) => {
      const settings =
        kind === "webhook"
          ? { ...prev.settings, webhookSecret: value }
          : { ...prev.settings, publicKey: value };
      let next: DemoState = { ...prev, settings };
      next = withAudit(
        next,
        kind === "webhook" ? "webhook.secret.rotate" : "merchant.key.rotate",
        kind,
        "New value generated, previous value valid for 24h",
      );
      return next;
    });
    return value;
  }, []);

  const unban = useCallback((id: string) => {
    setState((prev) => {
      const ban = prev.bans.find((b) => b.id === id);
      if (!ban) return prev;
      let next: DemoState = { ...prev, bans: prev.bans.filter((b) => b.id !== id) };
      next = withAudit(next, "security.unban", ban.fingerprint, "Fingerprint removed from ban list");
      return next;
    });
  }, []);

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState(initialState());
  }, []);

  const api = useMemo<DemoApi>(
    () => ({
      state,
      ready,
      now,
      createSession,
      checkPayment,
      cancelSession,
      sendOtp,
      verifyOtp,
      resetOtp,
      adminConfirm,
      adminRefund,
      adminFail,
      injectTestPayment,
      clearQueue,
      setObserverStatus,
      updateBranding,
      updateSettings,
      rotateSecret,
      unban,
      resetDemo,
    }),
    [
      state,
      ready,
      now,
      createSession,
      checkPayment,
      cancelSession,
      sendOtp,
      verifyOtp,
      resetOtp,
      adminConfirm,
      adminRefund,
      adminFail,
      injectTestPayment,
      clearQueue,
      setObserverStatus,
      updateBranding,
      updateSettings,
      rotateSecret,
      unban,
      resetDemo,
    ],
  );

  if (!ready) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-mute">
          <span className="h-2 w-2 animate-blink rounded-full bg-brand" aria-hidden />
          Loading the demo ledger…
        </div>
      </div>
    );
  }

  return <DemoContext.Provider value={api}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoApi {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}

export const selectors = {
  active: (state: DemoState) => state.sessions.find((s) => s.status === "ACTIVE"),
  processing: (state: DemoState) => state.sessions.find((s) => s.status === "PROCESSING"),
  queue: queuedSessions,
  blockers: blockingSessions,
  stats: statsOf,
  session: (state: DemoState, id: string | null) => state.sessions.find((s) => s.id === id),
};
