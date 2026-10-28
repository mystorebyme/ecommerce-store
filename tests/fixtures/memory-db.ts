// Purpose: Test data — in-memory `Db` implementation
//
// Unit tests ko Postgres ki zarurat nahi: wahi `Db` interface, bas memory me.
// Behaviour production jaisa rakha gaya hai (unique constraints, single ACTIVE slot,
// FIFO order, dedupe) taaki test ka matlab bana rahe.

import type {
  AuditLogRow,
  CreateAuditRecord,
  CreateDeliveryRecord,
  CreatePaymentLinkRecord,
  CreateObservationRecord,
  CreateOrderRecord,
  CreateSessionRecord,
  Db,
  DeliveryRow,
  MerchantRow,
  ObservationRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  OrderWithItems,
  PaymentLinkRow,
  PaymentLinkStatus,
  ProductRow,
  SessionRow,
  SessionStatus,
  SettingRow,
} from "../../apps/api/src/config/db";

export interface MemoryDb extends Db {
  seedProduct(product: Partial<ProductRow> & { id: string; pricePaise: number }): ProductRow;
  getOrder(id: string): OrderWithItems | undefined;
  getSession(id: string): SessionRow | undefined;
  observations: ObservationRow[];
  deliveries: DeliveryRow[];
  auditLogs: AuditLogRow[];
  links: PaymentLinkRow[];
}

export const TEST_MERCHANT: Omit<MerchantRow, "id"> = {
  name: "Demo Store",
  vpa: "demostore@okhdfcbank",
  payeeName: "Demo Store",
  webhookUrl: "https://merchant.test/api/youpi/webhook",
  webhookSecret: "whsec_test_secret_123456",
  payWindowSeconds: 300,
  verifyWindowSeconds: 30,
  slotConcurrency: 1,
};

export function createMemoryDb(options: { now?: () => Date } = {}): MemoryDb {
  const now = options.now ?? (() => new Date());
  const products = new Map<string, ProductRow>();
  const orders = new Map<string, OrderWithItems>();
  const sessions = new Map<string, SessionRow>();
  const observations: ObservationRow[] = [];
  const deliveries: DeliveryRow[] = [];
  const auditLogs: AuditLogRow[] = [];
  const links: PaymentLinkRow[] = [];
  const settings = new Map<string, string>();
  let merchant: MerchantRow | null = null;
  let sequence = 0;

  function id(prefix: string): string {
    sequence += 1;
    return `${prefix}_${String(sequence).padStart(4, "0")}`;
  }

  function persistSession(row: SessionRow): SessionRow {
    sessions.set(row.id, row);
    return row;
  }

  const db: MemoryDb = {
    observations,
    deliveries,
    auditLogs,
    links,

    // ---------------- merchant ----------------
    async getMerchant() {
      return merchant;
    },
    async upsertMerchant(input) {
      merchant = {
        id: merchant?.id ?? id("mch"),
        name: input.name,
        vpa: input.vpa,
        payeeName: input.payeeName,
        webhookUrl: input.webhookUrl !== undefined ? input.webhookUrl : merchant?.webhookUrl ?? null,
        webhookSecret: input.webhookSecret !== undefined ? input.webhookSecret : merchant?.webhookSecret ?? null,
        payWindowSeconds: input.payWindowSeconds ?? merchant?.payWindowSeconds ?? 300,
        verifyWindowSeconds: input.verifyWindowSeconds ?? merchant?.verifyWindowSeconds ?? 30,
        slotConcurrency: merchant?.slotConcurrency ?? 1,
      };
      return merchant;
    },

    // ---------------- catalog + orders ----------------
    seedProduct(product) {
      const row: ProductRow = {
        id: product.id,
        sku: product.sku ?? product.id.toUpperCase(),
        name: product.name ?? `Product ${product.id}`,
        pricePaise: product.pricePaise,
        stock: product.stock ?? 10,
        active: product.active ?? true,
      };
      products.set(row.id, row);
      return row;
    },
    getOrder: (orderId) => orders.get(orderId),
    getSession: (sessionId) => sessions.get(sessionId),

    async listProducts(limit) {
      return [...products.values()].filter((product) => product.active).slice(0, limit);
    },
    async findProductById(id) {
      return products.get(id) ?? null;
    },
    async upsertProductBySku(record) {
      const existing = [...products.values()].find((product) => product.sku === record.sku);
      if (existing) return existing;
      const row: ProductRow = {
        id: record.id ?? id("prod"),
        sku: record.sku,
        name: record.name,
        pricePaise: record.pricePaise,
        stock: record.stock,
        active: true,
      };
      products.set(row.id, row);
      return row;
    },
    async findProductsByIds(ids) {
      return ids.map((productId) => products.get(productId)).filter((product): product is ProductRow => Boolean(product));
    },
    async decrementStock(productId, qty) {
      const product = products.get(productId);
      if (!product || product.stock < qty) return false;
      product.stock -= qty;
      return true;
    },
    async incrementStock(productId, qty) {
      const product = products.get(productId);
      if (product) product.stock += qty;
    },
    async createOrder(record: CreateOrderRecord) {
      for (const existing of orders.values()) {
        if (existing.idempotencyKey === record.idempotencyKey) throw uniqueError();
      }
      const order: OrderWithItems = {
        id: id("order"),
        number: record.number,
        status: "PENDING_PAYMENT",
        amountPaise: record.amountPaise,
        currency: record.currency,
        customerName: record.customerName,
        customerPhone: record.customerPhone,
        idempotencyKey: record.idempotencyKey,
        linkId: record.linkId ?? null,
        createdAt: now(),
        items: record.items.map((item): OrderItemRow => ({ ...item })),
      };
      orders.set(order.id, order);
      return order;
    },
    async findOrderById(orderId) {
      return orders.get(orderId) ?? null;
    },
    async findOrderByIdempotencyKey(key) {
      return [...orders.values()].find((order) => order.idempotencyKey === key) ?? null;
    },
    async setOrderStatus(orderId, status: OrderStatus) {
      const order = orders.get(orderId);
      if (order) order.status = status;
    },

    // ---------------- sessions ----------------
    async createSession(record: CreateSessionRecord) {
      // Production constraint: ek merchant par ek hi ACTIVE slot
      if (record.status === "ACTIVE") {
        const activeExists = [...sessions.values()].some(
          (session) => session.merchantId === record.merchantId && session.status === "ACTIVE",
        );
        if (activeExists) throw uniqueError();
      }
      if ([...sessions.values()].some((session) => session.reference === record.reference)) throw uniqueError();

      const row: SessionRow = {
        id: id("ses"),
        orderId: record.orderId,
        merchantId: record.merchantId,
        amountPaise: record.amountPaise,
        currency: record.currency,
        status: record.status,
        reference: record.reference,
        upiString: record.upiString,
        vpa: record.vpa,
        queuePosition: record.queuePosition,
        payExpiresAt: record.payExpiresAt,
        verifyExpiresAt: null,
        utr: null,
        method: "upi",
        senderVpa: null,
        failureReason: null,
        settledAt: null,
        createdAt: now(),
      };
      return persistSession(row);
    },
    // ---------------- settings ----------------
    async getSettings(): Promise<SettingRow[]> {
      return [...settings.entries()].map(([key, value]) => ({ key, value }));
    },
    async setSetting(key: string, value: string) {
      settings.set(key, value);
    },
    async deleteSetting(key: string) {
      settings.delete(key);
    },
    async updateMerchantProfile(merchantId, patch) {
      if (!merchant || merchant.id !== merchantId) return null;
      merchant = {
        ...merchant,
        ...(patch.vpa !== undefined ? { vpa: patch.vpa } : {}),
        ...(patch.payeeName !== undefined ? { payeeName: patch.payeeName } : {}),
        ...(patch.merchantCode !== undefined ? { merchantCode: patch.merchantCode } : {}),
      };
      return merchant;
    },

    // ---------------- payment links ----------------
    async createPaymentLink(record: CreatePaymentLinkRecord) {
      const row: PaymentLinkRow = {
        id: record.id ?? id("lnk"),
        token: record.token,
        kind: record.kind,
        title: record.title,
        note: record.note,
        amountPaise: record.amountPaise,
        minAmountPaise: record.minAmountPaise ?? null,
        maxAmountPaise: record.maxAmountPaise ?? null,
        status: "ACTIVE",
        maxUses: record.maxUses ?? 1000,
        usedCount: 0,
        expiresAt: record.expiresAt ?? null,
        createdBy: record.createdBy ?? null,
        createdAt: now(),
      };
      links.push(row);
      return row;
    },
    async listPaymentLinks(limit: number) {
      return [...links].reverse().slice(0, limit);
    },
    async findPaymentLinkByToken(token: string) {
      return links.find((link) => link.token === token) ?? null;
    },
    async findPaymentLinkById(linkId: string) {
      return links.find((link) => link.id === linkId) ?? null;
    },
    async updatePaymentLink(linkId, patch) {
      const link = links.find((item) => item.id === linkId);
      if (!link) return null;
      if (patch.status !== undefined) link.status = patch.status as PaymentLinkStatus;
      if (patch.note !== undefined) link.note = patch.note;
      if (patch.expiresAt !== undefined) link.expiresAt = patch.expiresAt;
      return link;
    },
    async consumePaymentLinkUse(linkId: string) {
      const link = links.find((item) => item.id === linkId);
      if (!link || link.status !== "ACTIVE" || link.usedCount >= link.maxUses) return false;
      link.usedCount += 1;
      return true;
    },

    // ---------------- audit ----------------
    async appendAudit(record: CreateAuditRecord) {
      auditLogs.push({
        id: id("aud"),
        actor: record.actor,
        action: record.action,
        entity: record.entity,
        entityId: record.entityId ?? null,
        before: record.before ?? null,
        after: record.after ?? null,
        ip: record.ip ?? null,
        requestId: record.requestId ?? null,
        createdAt: now(),
      });
    },
    async listAudit(limit: number, action?: string) {
      return [...auditLogs]
        .filter((row) => (action ? row.action === action : true))
        .reverse()
        .slice(0, limit);
    },

    async findSessionById(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async listSessionsForOrder(orderId) {
      return [...sessions.values()]
        .filter((session) => session.orderId === orderId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async listSessionsByStatus(merchantId, status: SessionStatus) {
      return [...sessions.values()]
        .filter((session) => session.merchantId === merchantId && session.status === status)
        .sort((a, b) => (a.queuePosition - b.queuePosition) || (a.createdAt.getTime() - b.createdAt.getTime()));
    },
    async updateSession(sessionId, patch) {
      const session = sessions.get(sessionId);
      if (!session) return;
      if (patch.status) session.status = patch.status;
      if (patch.failureReason !== undefined) session.failureReason = patch.failureReason;
      if (patch.verifyExpiresAt !== undefined) session.verifyExpiresAt = patch.verifyExpiresAt;
      if (patch.utr !== undefined) session.utr = patch.utr;
      if (patch.senderVpa !== undefined) session.senderVpa = patch.senderVpa;
      if (patch.settledAt !== undefined) session.settledAt = patch.settledAt;
      if (patch.payExpiresAt !== undefined) session.payExpiresAt = patch.payExpiresAt;
    },
    async listSessionsByStatuses(merchantId, statuses, limit) {
      return [...sessions.values()]
        .filter((session) => session.merchantId === merchantId && statuses.includes(session.status))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, limit);
    },
    async findExpiredActiveSessions(at) {
      return [...sessions.values()].filter(
        (session) => session.status === "ACTIVE" && session.payExpiresAt.getTime() <= at.getTime(),
      );
    },
    async findExpiredProcessingSessions(at) {
      return [...sessions.values()].filter(
        (session) =>
          session.status === "PROCESSING" &&
          session.verifyExpiresAt !== null &&
          session.verifyExpiresAt.getTime() <= at.getTime(),
      );
    },

    // ---------------- observations ----------------
    async insertObservation(record: CreateObservationRecord) {
      const duplicate =
        observations.find((row) => row.utr === record.utr && row.amountPaise === record.amountPaise) ??
        observations.find((row) => row.deviceId === record.deviceId && row.messageId === record.messageId);
      if (duplicate) return { inserted: false, row: duplicate };

      const row: ObservationRow = {
        id: id("obs"),
        source: record.source,
        deviceId: record.deviceId,
        messageId: record.messageId,
        rawText: record.rawText,
        amountPaise: record.amountPaise,
        utr: record.utr,
        senderVpa: record.senderVpa,
        bankName: record.bankName,
        direction: record.direction,
        observedAt: record.observedAt,
        status: "RECEIVED",
        sessionId: null,
      };
      observations.push(row);
      return { inserted: true, row };
    },
    async findObservationByMessage(deviceId, messageId) {
      return observations.find((row) => row.deviceId === deviceId && row.messageId === messageId) ?? null;
    },
    async findObservationsByUtr(utr) {
      return observations.filter((row) => row.utr === utr);
    },
    async findLiveSessionsByAmount(merchantId, amountPaise) {
      return [...sessions.values()]
        .filter(
          (session) =>
            session.merchantId === merchantId &&
            session.amountPaise === amountPaise &&
            (session.status === "QUEUED" || session.status === "ACTIVE" || session.status === "PROCESSING"),
        )
        .sort((a, b) => {
          const rank = (status: SessionStatus) => (status === "ACTIVE" ? 0 : status === "PROCESSING" ? 1 : 2);
          return rank(a.status) - rank(b.status) || a.queuePosition - b.queuePosition;
        });
    },
    async updateObservation(observationId, patch) {
      const row = observations.find((candidate) => candidate.id === observationId);
      if (!row) return;
      if (patch.status) row.status = patch.status;
      if (patch.sessionId !== undefined) row.sessionId = patch.sessionId;
    },

    // ---------------- outbound webhooks ----------------
    async createDelivery(record: CreateDeliveryRecord) {
      const row: DeliveryRow = {
        id: id("dlvrow"),
        merchantId: record.merchantId,
        event: record.event,
        paymentId: record.paymentId,
        orderId: record.orderId,
        deliveryId: record.deliveryId,
        url: record.url,
        payload: record.payload,
        status: "PENDING",
        attempts: 0,
        lastStatusCode: null,
        lastError: null,
        nextAttemptAt: record.nextAttemptAt,
        createdAt: now(),
        deliveredAt: null,
      };
      deliveries.push(row);
      return row;
    },
    async dueDeliveries(at, limit) {
      return deliveries
        .filter((row) => row.status === "PENDING" && row.nextAttemptAt.getTime() <= at.getTime())
        .slice(0, limit);
    },
    async listDeliveries(status, limit) {
      return deliveries
        .filter((row) => row.status === status)
        .slice(-limit)
        .reverse();
    },
    async findDeliveryByDeliveryId(deliveryId) {
      return deliveries.find((row) => row.deliveryId === deliveryId) ?? null;
    },
    async recordDeliveryAttempt(deliveryId, result) {
      const row = deliveries.find((delivery) => delivery.id === deliveryId);
      if (!row) return;
      row.status = result.delivered ? "DELIVERED" : result.failed ? "FAILED" : "PENDING";
      row.attempts = result.attempt;
      row.lastStatusCode = result.statusCode;
      row.lastError = result.error;
      row.nextAttemptAt = result.nextAttemptAt;
      if (result.delivered) row.deliveredAt = now();
    },
  };

  return db;
}

function uniqueError(): Error & { code: string } {
  const error = new Error("Unique constraint failed") as Error & { code: string };
  error.code = "P2002";
  return error;
}
