// Purpose: Database connection
//
// Services Prisma ke generated types par depend nahi karti — sirf is chhote
// "repository" interface par. Fayda:
//   * `prisma generate` ke bina bhi typecheck + unit tests chalte hain
//   * tests in-memory Db use karte hain (Postgres ki zarurat nahi)
//   * DB badalna ho to sirf `createPrismaDb()` badalta hai

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "FULFILLED";

export type SessionStatus =
  | "QUEUED"
  | "ACTIVE"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "SUSPICIOUS";

export type ObservationSource = "ANDROID_SMS" | "GMAIL" | "MESSAGES" | "MANUAL";
export type ObservationStatus = "RECEIVED" | "MATCHED" | "DUPLICATE" | "UNMATCHED" | "SUSPICIOUS";
export type DeliveryStatus = "PENDING" | "DELIVERED" | "FAILED";

export interface MerchantRow {
  id: string;
  name: string;
  vpa: string;
  payeeName: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  payWindowSeconds: number;
  verifyWindowSeconds: number;
  slotConcurrency: number;
}

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  pricePaise: number;
  stock: number;
  active: boolean;
}

export interface OrderItemRow {
  productId: string;
  sku: string;
  name: string;
  unitPricePaise: number;
  qty: number;
  lineTotalPaise: number;
}

export interface OrderRow {
  id: string;
  number: string;
  status: OrderStatus;
  amountPaise: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  idempotencyKey: string;
  createdAt: Date;
}

export interface OrderWithItems extends OrderRow {
  items: OrderItemRow[];
}

export interface SessionRow {
  id: string;
  orderId: string;
  merchantId: string;
  amountPaise: number;
  currency: string;
  status: SessionStatus;
  reference: string;
  upiString: string;
  vpa: string;
  queuePosition: number;
  payExpiresAt: Date;
  verifyExpiresAt: Date | null;
  utr: string | null;
  method: string | null;
  senderVpa: string | null;
  failureReason: string | null;
  settledAt: Date | null;
  createdAt: Date;
}

export interface ObservationRow {
  id: string;
  source: ObservationSource;
  deviceId: string;
  messageId: string;
  rawText: string;
  amountPaise: number;
  utr: string;
  senderVpa: string | null;
  bankName: string | null;
  direction: string;
  observedAt: Date;
  status: ObservationStatus;
  sessionId: string | null;
}

export interface DeliveryRow {
  id: string;
  merchantId: string;
  event: string;
  paymentId: string;
  orderId: string;
  deliveryId: string;
  url: string;
  payload: unknown;
  status: DeliveryStatus;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: Date;
  createdAt: Date;
  deliveredAt: Date | null;
}

export interface CreateOrderRecord {
  number: string;
  amountPaise: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  idempotencyKey: string;
  items: OrderItemRow[];
}

export interface CreateSessionRecord {
  orderId: string;
  merchantId: string;
  amountPaise: number;
  currency: string;
  reference: string;
  upiString: string;
  vpa: string;
  queuePosition: number;
  payExpiresAt: Date;
  status: SessionStatus;
}

export interface CreateObservationRecord {
  source: ObservationSource;
  deviceId: string;
  messageId: string;
  rawText: string;
  amountPaise: number;
  utr: string;
  senderVpa: string | null;
  bankName: string | null;
  direction: string;
  observedAt: Date;
}

export interface CreateDeliveryRecord {
  merchantId: string;
  event: string;
  paymentId: string;
  orderId: string;
  deliveryId: string;
  url: string;
  payload: unknown;
  nextAttemptAt: Date;
}

export type SessionPatch = {
  failureReason?: string | null;
  verifyExpiresAt?: Date | null;
  utr?: string | null;
  senderVpa?: string | null;
  settledAt?: Date | null;
  payExpiresAt?: Date;
};

/**
 * Services ko bas itna chahiye. Naya module aaye to yahan methods add karo,
 * phir `createPrismaDb()` aur `tests/fixtures/memory-db.ts` update karo.
 */
export interface Db {
  // Merchant
  getMerchant(): Promise<MerchantRow | null>;
  upsertMerchant(input: {
    name: string;
    vpa: string;
    payeeName: string;
    webhookUrl?: string | null;
    webhookSecret?: string | null;
    payWindowSeconds?: number;
    verifyWindowSeconds?: number;
  }): Promise<MerchantRow>;

  // Catalog + orders
  findProductsByIds(ids: string[]): Promise<ProductRow[]>;
  /** Storefront catalog — sirf active products, newest pehle. */
  listProducts(limit: number): Promise<ProductRow[]>;
  findProductById(id: string): Promise<ProductRow | null>;
  /**
   * Catalog bootstrap (idempotent): SKU se product create karo, pehle se ho to
   * chhedo mat (stock/price kabhi overwrite nahi hote).
   */
  upsertProductBySku(record: {
    id?: string;
    sku: string;
    name: string;
    pricePaise: number;
    stock: number;
  }): Promise<ProductRow>;
  decrementStock(productId: string, qty: number): Promise<boolean>;
  incrementStock(productId: string, qty: number): Promise<void>;
  createOrder(record: CreateOrderRecord): Promise<OrderRow>;
  findOrderById(id: string): Promise<OrderWithItems | null>;
  findOrderByIdempotencyKey(key: string): Promise<OrderRow | null>;
  setOrderStatus(orderId: string, status: OrderStatus): Promise<void>;

  // Payment sessions
  createSession(record: CreateSessionRecord): Promise<SessionRow>;
  findSessionById(id: string): Promise<SessionRow | null>;
  listSessionsForOrder(orderId: string): Promise<SessionRow[]>;
  listSessionsByStatus(merchantId: string, status: SessionStatus): Promise<SessionRow[]>;
  /** Admin ops screen: ek se zyada status, sabse purane pehle. */
  listSessionsByStatuses(merchantId: string, statuses: SessionStatus[], limit: number): Promise<SessionRow[]>;
  updateSession(id: string, patch: Partial<SessionPatch> & { status?: SessionStatus }): Promise<void>;
  /** ACTIVE sessions jinka pay window nikal gaya. */
  findExpiredActiveSessions(now: Date): Promise<SessionRow[]>;
  /** PROCESSING sessions jinka verify window nikal gaya. */
  findExpiredProcessingSessions(now: Date): Promise<SessionRow[]>;

  // Bank observations
  insertObservation(record: CreateObservationRecord): Promise<{ inserted: boolean; row: ObservationRow | null }>;
  findObservationByMessage(deviceId: string, messageId: string): Promise<ObservationRow | null>;
  findObservationsByUtr(utr: string): Promise<ObservationRow[]>;
  /** Exact amount wale live sessions — attribution ka core. */
  findLiveSessionsByAmount(merchantId: string, amountPaise: number): Promise<SessionRow[]>;
  updateObservation(id: string, patch: { status?: ObservationStatus; sessionId?: string | null }): Promise<void>;

  // Outbound webhooks
  createDelivery(record: CreateDeliveryRecord): Promise<DeliveryRow>;
  dueDeliveries(now: Date, limit: number): Promise<DeliveryRow[]>;
  listDeliveries(status: DeliveryStatus, limit: number): Promise<DeliveryRow[]>;
  findDeliveryByDeliveryId(deliveryId: string): Promise<DeliveryRow | null>;
  recordDeliveryAttempt(
    id: string,
    result: {
      delivered: boolean;
      /** retries khatam — status FAILED */
      failed?: boolean;
      statusCode: number | null;
      error: string | null;
      nextAttemptAt: Date;
      attempt: number;
    },
  ): Promise<void>;
}

let cached: Db | null = null;

export function createPrismaDb(prismaClient?: unknown): Db {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const prisma: any =
    prismaClient ?? new (require("@prisma/client").PrismaClient as new () => any)();

  return {
    async getMerchant() {
      const row = await prisma.merchantAccount.findFirst({ orderBy: { createdAt: "asc" } });
      return row ? mapMerchant(row) : null;
    },
    async upsertMerchant(input) {
      const existing = await prisma.merchantAccount.findUnique({ where: { vpa: input.vpa } });
      const row = existing
        ? await prisma.merchantAccount.update({
            where: { id: existing.id },
            data: {
              name: input.name,
              payeeName: input.payeeName,
              webhookUrl: input.webhookUrl ?? existing.webhookUrl,
              webhookSecret: input.webhookSecret ?? existing.webhookSecret,
              payWindowSeconds: input.payWindowSeconds ?? existing.payWindowSeconds,
              verifyWindowSeconds: input.verifyWindowSeconds ?? existing.verifyWindowSeconds,
            },
          })
        : await prisma.merchantAccount.create({
            data: {
              name: input.name,
              vpa: input.vpa,
              payeeName: input.payeeName,
              webhookUrl: input.webhookUrl ?? null,
              webhookSecret: input.webhookSecret ?? null,
              payWindowSeconds: input.payWindowSeconds ?? 300,
              verifyWindowSeconds: input.verifyWindowSeconds ?? 30,
            },
          });
      return mapMerchant(row);
    },

    async listProducts(limit) {
      const rows = await prisma.product.findMany({
        where: { active: true },
        orderBy: [{ createdAt: "asc" }],
        take: limit,
      });
      return rows.map(mapProduct);
    },
    async findProductById(id) {
      const row = await prisma.product.findUnique({ where: { id } });
      return row ? mapProduct(row) : null;
    },
    async upsertProductBySku(record) {
      // `update: {}` — pehle se maujood product par kuch bhi overwrite nahi hota.
      const row = await prisma.product.upsert({
        where: { sku: record.sku },
        update: {},
        create: {
          ...(record.id ? { id: record.id } : {}),
          sku: record.sku,
          name: record.name,
          pricePaise: record.pricePaise,
          stock: record.stock,
          active: true,
        },
      });
      return mapProduct(row);
    },
    async findProductsByIds(ids) {
      const rows = await prisma.product.findMany({ where: { id: { in: ids } } });
      return rows.map(mapProduct);
    },
    async decrementStock(productId, qty) {
      // Atomic + concurrency-safe. Affected rows 0 => stock kam pad gaya.
      const affected = await prisma.$executeRaw`
        UPDATE "Product" SET "stock" = "stock" - ${qty}, "updatedAt" = NOW()
        WHERE "id" = ${productId} AND "stock" >= ${qty}`;
      return Number(affected) === 1;
    },
    async incrementStock(productId, qty) {
      await prisma.product.update({ where: { id: productId }, data: { stock: { increment: qty } } });
    },
    async createOrder(record) {
      const row = await prisma.order.create({
        data: {
          number: record.number,
          amountPaise: record.amountPaise,
          currency: record.currency,
          customerName: record.customerName,
          customerPhone: record.customerPhone,
          idempotencyKey: record.idempotencyKey,
          items: { create: record.items },
        },
      });
      return mapOrder(row);
    },
    async findOrderById(id) {
      const row = await prisma.order.findUnique({ where: { id }, include: { items: true } });
      return row ? { ...mapOrder(row), items: row.items.map(mapOrderItem) } : null;
    },
    async findOrderByIdempotencyKey(key) {
      const row = await prisma.order.findUnique({ where: { idempotencyKey: key } });
      return row ? mapOrder(row) : null;
    },
    async setOrderStatus(orderId, status) {
      await prisma.order.update({ where: { id: orderId }, data: { status } });
    },

    async createSession(record) {
      const row = await prisma.paymentSession.create({ data: record });
      return mapSession(row);
    },
    async findSessionById(id) {
      const row = await prisma.paymentSession.findUnique({ where: { id } });
      return row ? mapSession(row) : null;
    },
    async listSessionsForOrder(orderId) {
      const rows = await prisma.paymentSession.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } });
      return rows.map(mapSession);
    },
    async listSessionsByStatus(merchantId, status) {
      const rows = await prisma.paymentSession.findMany({
        where: { merchantId, status },
        orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
      });
      return rows.map(mapSession);
    },
    async updateSession(id, patch) {
      await prisma.paymentSession.update({ where: { id }, data: patch });
    },
    async listSessionsByStatuses(merchantId, statuses, limit) {
      const rows = await prisma.paymentSession.findMany({
        where: { merchantId, status: { in: statuses } },
        orderBy: [{ createdAt: "asc" }],
        take: limit,
      });
      return rows.map(mapSession);
    },
    async findExpiredActiveSessions(now) {
      const rows = await prisma.paymentSession.findMany({
        where: { status: "ACTIVE", payExpiresAt: { lte: now } },
      });
      return rows.map(mapSession);
    },
    async findExpiredProcessingSessions(now) {
      const rows = await prisma.paymentSession.findMany({
        where: { status: "PROCESSING", verifyExpiresAt: { lte: now } },
      });
      return rows.map(mapSession);
    },

    async insertObservation(record) {
      try {
        const row = await prisma.bankObservation.create({ data: record });
        return { inserted: true, row: mapObservation(row) };
      } catch (error) {
        if (isUniqueViolation(error)) {
          const row = await prisma.bankObservation.findFirst({
            where: { OR: [{ utr: record.utr }, { deviceId: record.deviceId, messageId: record.messageId }] },
          });
          return { inserted: false, row: row ? mapObservation(row) : null };
        }
        throw error;
      }
    },
    async findObservationByMessage(deviceId, messageId) {
      const row = await prisma.bankObservation.findUnique({
        where: { deviceId_messageId: { deviceId, messageId } },
      });
      return row ? mapObservation(row) : null;
    },
    async findObservationsByUtr(utr) {
      const rows = await prisma.bankObservation.findMany({ where: { utr } });
      return rows.map(mapObservation);
    },
    async findLiveSessionsByAmount(merchantId, amountPaise) {
      const rows = await prisma.paymentSession.findMany({
        where: { merchantId, amountPaise, status: { in: ["QUEUED", "ACTIVE", "PROCESSING"] } },
        orderBy: [{ queuePosition: "asc" }],
      });
      return rows.map(mapSession);
    },
    async updateObservation(id, patch) {
      await prisma.bankObservation.update({ where: { id }, data: patch });
    },

    async createDelivery(record) {
      const row = await prisma.outboundWebhook.create({ data: record });
      return mapDelivery(row);
    },
    async dueDeliveries(now, limit) {
      const rows = await prisma.outboundWebhook.findMany({
        where: { status: "PENDING", nextAttemptAt: { lte: now } },
        orderBy: { nextAttemptAt: "asc" },
        take: limit,
      });
      return rows.map(mapDelivery);
    },
    async listDeliveries(status, limit) {
      const rows = await prisma.outboundWebhook.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(mapDelivery);
    },
    async findDeliveryByDeliveryId(deliveryId) {
      const row = await prisma.outboundWebhook.findUnique({ where: { deliveryId } });
      return row ? mapDelivery(row) : null;
    },
    async recordDeliveryAttempt(id, result) {
      await prisma.outboundWebhook.update({
        where: { id },
        data: {
          status: result.delivered ? "DELIVERED" : result.failed ? "FAILED" : "PENDING",
          attempts: result.attempt,
          lastStatusCode: result.statusCode,
          lastError: result.error,
          nextAttemptAt: result.nextAttemptAt,
          deliveredAt: result.delivered ? new Date() : null,
        },
      });
    },
  };
}

export function getDb(): Db {
  if (!cached) cached = createPrismaDb();
  return cached;
}

/** Server/tests apna Db inject karte hain. */
export function setDb(db: Db | null): void {
  cached = db;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

function mapMerchant(row: any): MerchantRow {
  return {
    id: row.id,
    name: row.name,
    vpa: row.vpa,
    payeeName: row.payeeName,
    webhookUrl: row.webhookUrl ?? null,
    webhookSecret: row.webhookSecret ?? null,
    payWindowSeconds: row.payWindowSeconds ?? 300,
    verifyWindowSeconds: row.verifyWindowSeconds ?? 30,
    slotConcurrency: row.slotConcurrency ?? 1,
  };
}

function mapProduct(row: any): ProductRow {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    pricePaise: row.pricePaise,
    stock: row.stock,
    active: row.active,
  };
}

function mapOrder(row: any): OrderRow {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    amountPaise: row.amountPaise,
    currency: row.currency,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
  };
}

function mapOrderItem(row: any): OrderItemRow {
  return {
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    unitPricePaise: row.unitPricePaise,
    qty: row.qty,
    lineTotalPaise: row.lineTotalPaise,
  };
}

function mapSession(row: any): SessionRow {
  return {
    id: row.id,
    orderId: row.orderId,
    merchantId: row.merchantId,
    amountPaise: row.amountPaise,
    currency: row.currency,
    status: row.status,
    reference: row.reference,
    upiString: row.upiString,
    vpa: row.vpa,
    queuePosition: row.queuePosition ?? 0,
    payExpiresAt: row.payExpiresAt,
    verifyExpiresAt: row.verifyExpiresAt ?? null,
    utr: row.utr ?? null,
    method: row.method ?? null,
    senderVpa: row.senderVpa ?? null,
    failureReason: row.failureReason ?? null,
    settledAt: row.settledAt ?? null,
    createdAt: row.createdAt,
  };
}

function mapObservation(row: any): ObservationRow {
  return {
    id: row.id,
    source: row.source,
    deviceId: row.deviceId,
    messageId: row.messageId,
    rawText: row.rawText,
    amountPaise: row.amountPaise,
    utr: row.utr,
    senderVpa: row.senderVpa ?? null,
    bankName: row.bankName ?? null,
    direction: row.direction ?? "CREDIT",
    observedAt: row.observedAt,
    status: row.status,
    sessionId: row.sessionId ?? null,
  };
}

function mapDelivery(row: any): DeliveryRow {
  return {
    id: row.id,
    merchantId: row.merchantId,
    event: row.event,
    paymentId: row.paymentId,
    orderId: row.orderId,
    deliveryId: row.deliveryId,
    url: row.url,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts ?? 0,
    lastStatusCode: row.lastStatusCode ?? null,
    lastError: row.lastError ?? null,
    nextAttemptAt: row.nextAttemptAt,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt ?? null,
  };
}
