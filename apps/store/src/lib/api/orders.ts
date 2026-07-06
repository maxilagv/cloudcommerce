import { trpc, type RouterOutputs } from "@/lib/trpc";
import type { Order, OrderStatus } from "@/lib/account-types";
import { PLACEHOLDER_PRODUCT_IMAGE } from "./catalog";

/**
 * Adapter: maps the storefront orders contract (apps/api) into the UI `Order`
 * shape. Used from client components behind AuthGuard.
 */

export type StoreOrderSummary = RouterOutputs["storefront"]["myOrders"]["items"][number];
export type StoreOrderDetail = RouterOutputs["storefront"]["orderDetail"];

const STATUS_MAP: Record<string, OrderStatus> = {
  DRAFT: "preparing",
  PENDING_CONFIRMATION: "preparing",
  CONFIRMED: "preparing",
  PREPARING: "preparing",
  READY_TO_SHIP: "preparing",
  SHIPPED: "in-transit",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURN_REQUESTED: "cancelled",
  RETURNED: "cancelled",
};

export function mapOrderStatus(status: string): OrderStatus {
  return STATUS_MAP[status] ?? "preparing";
}

export const SHIPPING_METHOD_LABEL: Record<string, string> = {
  STANDARD: "Envío estándar a domicilio",
  EXPRESS: "Envío express a domicilio",
  PICKUP: "Retiro coordinado",
};

function toPesos(amountMinor: number): number {
  return Math.round(amountMinor / 100);
}

export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

/** Summary → UI Order (the list view has no lines: itemCount only). */
export function mapSummaryToOrder(summary: StoreOrderSummary): Order {
  return {
    id: summary.id,
    status: mapOrderStatus(summary.status),
    date: formatOrderDate(summary.createdAt),
    items: [
      {
        productId: "",
        name: `Pedido #${summary.orderNumber} · ${summary.itemCount} ${summary.itemCount === 1 ? "producto" : "productos"}`,
        image: PLACEHOLDER_PRODUCT_IMAGE,
        qty: summary.itemCount,
        price: toPesos(summary.total.amountMinor),
      },
    ],
    subtotal: toPesos(summary.total.amountMinor),
    shipping: 0,
    discount: 0,
    total: toPesos(summary.total.amountMinor),
    address: SHIPPING_METHOD_LABEL[summary.shippingMethod] ?? summary.shippingMethod,
    paymentLast4: "",
  };
}

/** UI extras the list needs beyond the base Order shape. */
export type OrderListEntry = Order & { orderNumber: string; itemCount: number };

export function mapSummaryToListEntry(summary: StoreOrderSummary): OrderListEntry {
  return {
    ...mapSummaryToOrder(summary),
    orderNumber: summary.orderNumber,
    itemCount: summary.itemCount,
  };
}

export function mapDetailToOrder(detail: StoreOrderDetail): Order & { orderNumber: string } {
  const eta = detail.shipments.find((s) => s.eta)?.eta ?? undefined;
  return {
    id: detail.id,
    orderNumber: detail.orderNumber,
    status: mapOrderStatus(detail.status),
    date: formatOrderDate(detail.createdAt),
    eta: eta ? formatOrderDate(eta) : undefined,
    items: detail.lines.map((line, i) => ({
      productId: String(i),
      name: line.title,
      image: PLACEHOLDER_PRODUCT_IMAGE,
      qty: line.quantity,
      price: toPesos(line.unitPrice.amountMinor),
    })),
    subtotal: toPesos(detail.subtotal.amountMinor),
    shipping: toPesos(detail.shipping.amountMinor),
    discount: toPesos(detail.discount.amountMinor),
    total: toPesos(detail.total.amountMinor),
    // The public detail has no address text — surface the shipping method (and notes) instead.
    address:
      (SHIPPING_METHOD_LABEL[detail.shippingMethod] ?? detail.shippingMethod) +
      (detail.notes ? ` · ${detail.notes}` : ""),
    paymentLast4: "",
  };
}

export async function fetchMyOrders(): Promise<StoreOrderSummary[]> {
  try {
    const result = await trpc.storefront.myOrders.query({});
    return result.items;
  } catch {
    return [];
  }
}

export async function fetchOrderDetail(orderId: string): Promise<StoreOrderDetail | null> {
  try {
    return await trpc.storefront.orderDetail.query({ orderId });
  } catch {
    return null;
  }
}
