// Purpose: Test data — in-memory `Db` implementation
//
// Unit tests ko Postgres ki zarurat nahi: wahi `Db` interface, bas memory me.
// Behaviour production jaisa hi rakha gaya hai (idempotency conflict, webhook
// duplicate, atomic stock decrement) taaki test ka matlab bana rahe.

import type {
  CreateOrderRecord,
  CreatePaymentRecord,
  Db,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  OrderWithItems,
  PaymentRow,
  PaymentStatus,
  ProductRow,
  WebhookRecord,
} from "../../apps/api/src/config/db";

export interface MemoryDb extends Db {
  /** Test assertions ke liye seed helpers. */
  seedProduct(product: Partial<ProductRow> & { id: string; pricePaise: number }): ProductRow;
  getOrder(id: string): OrderWithItems | undefined;
  getPayment(id: string): PaymentRow | undefined;
  webhookEvents: { id: string; eventId: string; eventType: string; status: string }[];
}

export function createMemoryDb(options: { now?: () => Date } = {}): MemoryDb {
  const now = options.now ?? (() => new Date());
  const products = new Map<string, ProductRow>();
  const orders = new Map<string, OrderWithItems>();
  const payments = new Map<string, PaymentRow>();
  const webhookEvents: MemoryDb["webhookEvents"] = [];
  let sequence = 0;

  function id(prefix: string): string {
    sequence += 1;
    return `${prefix}_${String(sequence).padStart(4, "0")}`;
  }

  return {
    webhookEvents,

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
    getPayment: (paymentId) => payments.get(paymentId),

    async findProductsByIds(ids) {
      return ids.map((productId) => products.get(productId)).filter((product): product is ProductRow => Boolean(product));
    },

    async decrementStock(productId, qty) {
      const product = products.get(productId);
      if (!product || product.stock < qty) return false;
      product.stock -= qty; // atomic check-and-set — single-threaded test env
      return true;
    },

    async incrementStock(productId, qty) {
      const product = products.get(productId);
      if (product) product.stock += qty;
    },

    async createOrder(record: CreateOrderRecord) {
      for (const order of orders.values()) {
        if (order.idempotencyKey === record.idempotencyKey) {
          const error = new Error("Unique constraint failed on idempotencyKey") as Error & { code: string };
          error.code = "P2002";
          throw error;
        }
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
        createdAt: now(),
        items: record.items,
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

    async createPayment(record: CreatePaymentRecord) {
      for (const payment of payments.values()) {
        if (payment.idempotencyKey === record.idempotencyKey) {
          const error = new Error("Unique constraint failed on idempotencyKey") as Error & { code: string };
          error.code = "P2002";
          throw error;
        }
      }
      const payment: PaymentRow = {
        id: id("pay"),
        orderId: record.orderId,
        provider: record.provider,
        providerOrderId: record.providerOrderId,
        providerQrId: null,
        qrString: null,
        qrImageUrl: null,
        amountPaise: record.amountPaise,
        currency: record.currency,
        status: "CREATED",
        method: null,
        providerPaymentId: null,
        utr: null,
        failureReason: null,
        refundedPaise: 0,
        idempotencyKey: record.idempotencyKey,
        expiresAt: record.expiresAt,
        paidAt: null,
        createdAt: now(),
      };
      payments.set(payment.id, payment);
      return payment;
    },

    async findPaymentById(paymentId) {
      return payments.get(paymentId) ?? null;
    },

    async findPaymentByIdempotencyKey(key) {
      return [...payments.values()].find((payment) => payment.idempotencyKey === key) ?? null;
    },

    async findPaymentByProviderOrderId(providerOrderId) {
      return [...payments.values()].find((payment) => payment.providerOrderId === providerOrderId) ?? null;
    },

    async findPaymentByQrId(qrId) {
      return [...payments.values()].find((payment) => payment.providerQrId === qrId) ?? null;
    },

    async attachQr(paymentId, qr) {
      const payment = payments.get(paymentId);
      if (!payment) return;
      payment.providerQrId = qr.qrId;
      payment.qrString = qr.qrString;
      payment.qrImageUrl = qr.qrImageUrl;
      payment.status = "PENDING";
    },

    async setPaymentStatus(paymentId, status: PaymentStatus, extra) {
      const payment = payments.get(paymentId);
      if (!payment) return;
      payment.status = status;
      if (extra?.failureReason !== undefined) payment.failureReason = extra.failureReason;
      if (extra?.method !== undefined) payment.method = extra.method;
    },

    async markPaymentPaid(paymentId, paid) {
      const payment = payments.get(paymentId);
      if (!payment) return;
      payment.status = "PAID";
      payment.providerPaymentId = paid.providerPaymentId;
      payment.utr = paid.utr;
      payment.method = paid.method;
      payment.paidAt = paid.paidAt;
      payment.failureReason = null;
    },

    async recordRefund(paymentId, refund) {
      const payment = payments.get(paymentId);
      if (!payment) return;
      payment.refundedPaise = refund.refundPaise;
      payment.status = refund.status;
    },

    async expireStalePayments(at) {
      let count = 0;
      for (const payment of payments.values()) {
        if ((payment.status === "CREATED" || payment.status === "PENDING") && payment.expiresAt <= at) {
          payment.status = "EXPIRED";
          count += 1;
        }
      }
      return count;
    },

    async insertWebhookEvent(record: WebhookRecord) {
      const existing = webhookEvents.find((event) => event.eventId === record.eventId);
      if (existing) return { inserted: false, id: existing.id };
      const row = {
        id: id("evt"),
        eventId: record.eventId,
        eventType: record.eventType,
        status: "RECEIVED",
      };
      webhookEvents.push(row);
      return { inserted: true, id: row.id };
    },

    async markWebhookEvent(eventId, status) {
      const row = webhookEvents.find((event) => event.id === eventId);
      if (row) row.status = status;
    },
  };
}
