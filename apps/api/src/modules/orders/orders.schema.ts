// Purpose: orders API-only schemas (shared rules packages/validation se import)
//
// Shared rules `@youpi/validation` me hain. Yahan sirf API-specific response
// shapes rakhte hain (jo frontend ko chahiye).

import { createOrderSchema } from "@youpi/validation";
import type { OrderWithItems } from "../../config/db";

export { createOrderSchema };

export interface OrderResponse {
  id: string;
  number: string;
  status: string;
  amountPaise: number;
  currency: string;
  customer: { name: string; phone: string };
  items: { sku: string; name: string; unitPricePaise: number; qty: number; lineTotalPaise: number }[];
  createdAt: string;
}

export function toOrderResponse(order: OrderWithItems): OrderResponse {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    amountPaise: order.amountPaise,
    currency: order.currency,
    customer: { name: order.customerName, phone: order.customerPhone },
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      unitPricePaise: item.unitPricePaise,
      qty: item.qty,
      lineTotalPaise: item.lineTotalPaise,
    })),
    createdAt: order.createdAt.toISOString(),
  };
}
