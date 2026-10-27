"use client";

import Link from "next/link";
import { Callout, EmptyState, Icon, StatusPill } from "@/components/ui";
import { formatPaise, mmss, relativeTime } from "@/lib/format";
import { selectors, useDemo } from "@/lib/store";

export default function QueuePage() {
  const { state, now, createSession, checkPayment, clearQueue, cancelSession } = useDemo();
  const active = selectors.active(state);
  const processing = selectors.processing(state);
  const queue = selectors.queue(state);

  const createBuyers = (count: number) => {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      ids.push(
        createSession({
          amountPaise: 100,
          note: `Queue demo ${i + 1}`,
          source: "admin-test",
          simOutcome: "success",
        }),
      );
    }
    if (ids[0]) window.setTimeout(() => checkPayment(ids[0]), 800);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Live queue</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">Single-slot FIFO arbiter</h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-ink-mute">
            UPI alerts carry an amount, not a merchant reference. Two identical amounts paying at the same moment
            could be attributed to the wrong order, so exactly one buyer may hold the active slot per VPA.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => createBuyers(3)} className="btn-dark !py-2 !text-[11.5px]">
            <Icon name="queue" className="h-3.5 w-3.5" /> Add 3 test buyers
          </button>
          <button onClick={clearQueue} className="btn-ghost !py-2 !text-[11.5px]">
            Clear queue
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <p className="label">Active slot</p>
            {active ? <StatusPill status={active.status} /> : processing ? <StatusPill status="PROCESSING" /> : <span className="chip !text-[10px]">free</span>}
          </div>
          {active || processing ? (
            <div className="mt-2">
              <p className="font-mono text-[13px] font-semibold text-ink">{(active ?? processing)?.orderId}</p>
              <p className="mono-nums mt-1 text-[20px] font-semibold text-ink">
                {formatPaise((active ?? processing)!.amountPaise)}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-mute">
                <Icon name="clock" className="h-3.5 w-3.5" />
                {active
                  ? `${mmss(Math.max(0, Math.ceil((active.payDeadline - now) / 1000)))} left to pay`
                  : `${mmss(Math.max(0, Math.ceil(((processing?.verifyDeadline ?? now) - now) / 1000)))} verifying`}
              </p>
              <div className="mt-2 flex gap-2">
                {active && (
                  <button onClick={() => checkPayment(active.id)} className="btn-primary !px-3 !py-1.5 !text-[11px]">
                    Mark paid
                  </button>
                )}
                <button
                  onClick={() => cancelSession((active ?? processing)!.id)}
                  className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                >
                  Release slot
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11.5px] text-ink-mute">
              Nobody is paying right now. The next buyer is promoted instantly.
            </p>
          )}
        </div>

        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="label">Waiting · FIFO order</p>
            <span className="font-mono text-[10.5px] text-ink-mute">{queue.length} waiting</span>
          </div>
          {queue.length === 0 ? (
            <p className="mt-2 text-[11.5px] text-ink-mute">
              Queue empty. Add test buyers to see promotion in action.
            </p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {queue.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="mono-nums grid h-6 w-6 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
                      {session.queuePos}
                    </span>
                    <span className="font-mono text-[11.5px] text-ink">{session.orderId}</span>
                    <StatusPill status="QUEUED" />
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="mono-nums text-[11.5px] font-semibold text-ink">
                      {formatPaise(session.amountPaise)}
                    </span>
                    <span className="text-[10px] text-ink-mute">{relativeTime(session.createdAt, now)}</span>
                    <button
                      onClick={() => cancelSession(session.id)}
                      className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[10px] text-ink-mute hover:text-bad"
                      aria-label={`Cancel ${session.orderId}`}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <Callout tone="info" title="Why this is not a limitation, it is the safety feature">
        Amount-only attribution is exact. The queue serialises buyers so there is never ambiguity, and the
        promotion is atomic — a cancelled, expired or verified session hands the slot to buyer #1 in the same
        transaction.
      </Callout>

      {state.sessions.length === 0 && (
        <EmptyState
          title="No sessions yet"
          copy="Create a checkout first, then return here to watch the queue."
          action={
            <Link href="/checkout" className="btn-primary">
              Open checkout
            </Link>
          }
        />
      )}

      <div className="card p-4">
        <p className="label">State transitions written by the arbiter</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-soft">
          {["QUEUED", "ACTIVE", "PROCESSING", "SUCCESS", "FAILED", "EXPIRED", "CANCELLED"].map((state, i, arr) => (
            <span key={state} className="flex items-center gap-1.5">
              <span className="rounded-md border border-line bg-paper px-2 py-1 font-mono">{state}</span>
              {i < arr.length - 1 && <Icon name="arrow" className="h-3 w-3 text-line-strong" />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
