// Purpose: Database connection
//
// Yahan sirf ek chhota "domain repository" surface hai (Db interface) — services
// Prisma ke generated types par direct depend nahi karti, isliye:
//   * unit tests in-memory Db se chalte hain (Postgres ki zarurat nahi)
//   * `prisma generate` alag step hai, code usse pehle bhi typecheck hota hai
//
// Production me `createPrismaDb()` PrismaClient use karta hai (single instance).

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "FULFILLED";

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

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

export interface PaymentRow {
  id: string;
  orderId: string;
  provider: string;
  providerOrderId: string;
  providerQrId: string | null;
  qrString: string | null;
  qrImageUrl: string | null;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  providerPaymentId: string | null;
  utr: string | null;
  failureReason: string | null;
  refundedPaise: number;
  idempotencyKey: string;
  expiresAt: Date;
  paidAt: Date | null;
  createdAt: Date;
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

export interface CreatePaymentRecord {
  orderId: string;
  provider: string;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  idempotencyKey: string;
  expiresAt: Date;
}

export interface WebhookRecord {
  provider: string;
  eventId: string;
  eventType: string;
  payload: unknown;
}

/**
 * Jo bhi DB operations services ko chahiye — bas itna. Naya module aaye to
 * yahan methods add karo, phir `createPrismaDb()` aur test fixture update karo.
 */
export interface Db {
  findProductsByIds(ids: string[]): Promise<ProductRow[]>;
  /** Atomic: `UPDATE stock = stock - qty WHERE id = ? AND stock >= qty`. false = out of stock. */
  decrementStock(productId: string, qty: number): Promise<boolean>;
  incrementStock(productId: string, qty: number): Promise<void>;

  createOrder(record: CreateOrderRecord): Promise<OrderRow>;
  findOrderById(id: string): Promise<OrderWithItems | null>;
  findOrderByIdempotencyKey(key: string): Promise<OrderRow | null>;
  setOrderStatus(orderId: string, status: OrderStatus): Promise<void>;

  createPayment(record: CreatePaymentRecord): Promise<PaymentRow>;
  findPaymentById(id: string): Promise<PaymentRow | null>;
  findPaymentByIdempotencyKey(key: string): Promise<PaymentRow | null>;
  findPaymentByProviderOrderId(providerOrderId: string): Promise<PaymentRow | null>;
  findPaymentByQrId(qrId: string): Promise<PaymentRow | null>;
  attachQr(paymentId: string, qr: { qrId: string; qrString: string | null; qrImageUrl: string | null }): Promise<void>;
  setPaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    extra?: { failureReason?: string | null; method?: string | null },
  ): Promise<void>;
  markPaymentPaid(
    paymentId: string,
    paid: { providerPaymentId: string; utr: string | null; method: string | null; paidAt: Date },
  ): Promise<void>;
  recordRefund(paymentId: string, refund: { refundPaise: number; status: PaymentStatus }): Promise<void>;
  /** CREATED/PENDING attempts jo expire ho gaye — scheduler isse call karta hai. */
  expireStalePayments(now: Date): Promise<number>;

  /** Duplicate eventId par `{ inserted: false }` — webhook dedupe ka core. */
  insertWebhookEvent(record: WebhookRecord): Promise<{ inserted: boolean; id: string }>;
  markWebhookEvent(id: string, status: "PROCESSED" | "IGNORED" | "FAILED", error?: string): Promise<void>;
}

let cached: Db | null = null;

/**
 * Prisma-backed implementation. `@prisma/client` lazily require hota hai taaki
 * bina `prisma generate` ke bhi tests / typecheck chalte rahein.
 */
export function createPrismaDb(prismaClient?: unknown): Db {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const prisma: any =
    prismaClient ?? new (require("@prisma/client").PrismaClient as new () => any)();

  return {
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
    async createPayment(record) {
      const row = await prisma.payment.create({ data: record });
      return mapPayment(row);
    },
    async findPaymentById(id) {
      const row = await prisma.payment.findUnique({ where: { id } });
      return row ? mapPayment(row) : null;
    },
    async findPaymentByIdempotencyKey(key) {
      const row = await prisma.payment.findUnique({ where: { idempotencyKey: key } });
      return row ? mapPayment(row) : null;
    },
    async findPaymentByProviderOrderId(providerOrderId) {
      const row = await prisma.payment.findFirst({ where: { providerOrderId } });
      return row ? mapPayment(row) : null;
    },
    async findPaymentByQrId(qrId) {
      const row = await prisma.payment.findFirst({ where: { providerQrId: qrId } });
      return row ? mapPayment(row) : null;
    },
    async attachQr(paymentId, qr) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { providerQrId: qr.qrId, qrString: qr.qrString, qrImageUrl: qr.qrImageUrl, status: "PENDING" },
      });
    },
    async setPaymentStatus(paymentId, status, extra) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status, failureReason: extra?.failureReason ?? null, method: extra?.method ?? null },
      });
    },
    async markPaymentPaid(paymentId, paid) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "PAID",
          providerPaymentId: paid.providerPaymentId,
          utr: paid.utr,
          method: paid.method,
          paidAt: paid.paidAt,
          failureReason: null,
        },
      });
    },
    async recordRefund(paymentId, refund) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { refundedPaise: refund.refundPaise, status: refund.status },
      });
    },
    async expireStalePayments(now) {
      const result = await prisma.payment.updateMany({
        where: { status: { in: ["CREATED", "PENDING"] }, expiresAt: { lt: now } },
        data: { status: "EXPIRED" },
      });
      return result.count;
    },
    async insertWebhookEvent(record) {
      try {
        const row = await prisma.webhookEvent.create({
          data: {
            provider: record.provider,
            eventId: record.eventId,
            eventType: record.eventType,
            payload: record.payload as object,
          },
        });
        return { inserted: true, id: row.id };
      } catch (error) {
        // P2002 = unique constraint (eventId dobara) → duplicate delivery
        if (isUniqueViolation(error)) {
          const existing = await prisma.webhookEvent.findUnique({ where: { eventId: record.eventId } });
          return { inserted: false, id: existing?.id ?? "" };
        }
        throw error;
      }
    },
    async markWebhookEvent(id, status, error) {
      await prisma.webhookEvent.update({
        where: { id },
        data: { status, error: error ?? null, processedAt: new Date() },
      });
    },
  };
}

export function getDb(): Db {
  if (!cached) cached = createPrismaDb();
  return cached;
}

/** Tests / scripts ke liye — apna Db inject karo. */
export function setDb(db: Db | null): void {
  cached = db;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
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

function mapPayment(row: any): PaymentRow {
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    providerOrderId: row.providerOrderId,
    providerQrId: row.providerQrId ?? null,
    qrString: row.qrString ?? null,
    qrImageUrl: row.qrImageUrl ?? null,
    amountPaise: row.amountPaise,
    currency: row.currency,
    status: row.status,
    method: row.method ?? null,
    providerPaymentId: row.providerPaymentId ?? null,
    utr: row.utr ?? null,
    failureReason: row.failureReason ?? null,
    refundedPaise: row.refundedPaise ?? 0,
    idempotencyKey: row.idempotencyKey,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt ?? null,
    createdAt: row.createdAt,
  };
}
