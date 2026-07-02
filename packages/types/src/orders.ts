import type { Money } from "./domain.js";
import type { OrderChannel, OrderStatus, ShipmentStatus, ShippingMethod } from "./enums.js";

// ---------------------------------------------------------------------------
// Contratos de respuesta del dominio `orders` (Fase 5).
// Los presenters del backend construyen estos shapes; el frontend los consume.
// Regla de salida ([06] §Validación de salida): el costo proveedor
// (`supplierCost`) y el margen SOLO viajan en presenters para roles con permiso
// de costo (OWNER/ADMIN/FINANCE). Nunca al cliente.
// ---------------------------------------------------------------------------

/** Línea de una orden. `supplierCost`/`margin` son opcionales: presentes solo para roles con permiso de costo. */
export type OrderLineView = {
  id: string;
  variantId: string;
  productTitle: string;
  sku: string | null;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  supplierCost?: Money;
  lineMargin?: Money;
};

/** Un cambio de estado registrado (`order_status_event`). */
export type OrderStatusEventView = {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  actorId: string | null;
  createdAt: Date;
};

/** Vista compacta para listados (`orders.list`). */
export type OrderSummary = {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  channel: OrderChannel;
  currency: Money["currency"];
  itemCount: number;
  total: Money;
  shippingMethod: ShippingMethod;
  createdAt: Date;
};

/** Vista completa de una orden (`orders.get`). Documento histórico inmutable. */
export type OrderDetail = OrderSummary & {
  subtotal: Money;
  shipping: Money;
  discount: Money;
  tax: Money;
  shippingAddressId: string | null;
  placedBy: string | null;
  notes: string | null;
  lines: OrderLineView[];
  statusHistory: OrderStatusEventView[];
  updatedAt: Date;
  /** true si el actor puede ver costo/margen; cuando true, las líneas incluyen `supplierCost`/`lineMargin`. */
  costVisible: boolean;
  /** Margen total de la orden (revenue − costo). Presente solo si `costVisible`. */
  totalMargin?: Money;
};

export type OrderListResult = {
  items: OrderSummary[];
  nextCursor: string | null;
};

// --- Envíos y tracking ------------------------------------------------------

export type ShipmentEventView = {
  status: ShipmentStatus;
  description: string | null;
  occurredAt: Date;
};

export type ShipmentView = {
  id: string;
  orderId: string;
  carrier: string | null;
  trackingCode: string | null;
  status: ShipmentStatus;
  eta: Date | null;
  events: ShipmentEventView[];
  createdAt: Date;
  updatedAt: Date;
};

/** Resultado de `shipments.tracking`. `stale=true` cuando se sirvió el último estado conocido (proveedor caído). */
export type TrackingView = {
  shipmentId: string;
  orderId: string;
  status: ShipmentStatus;
  carrier: string | null;
  trackingCode: string | null;
  eta: Date | null;
  events: ShipmentEventView[];
  stale: boolean;
};
