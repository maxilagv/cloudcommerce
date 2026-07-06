import type { Money } from "./domain.js";
import type { CustomerTier, OrderStatus, ShipmentStatus, ShippingMethod } from "./enums.js";

/** Tipos públicos del storefront: cuentas de cliente, checkout y mis pedidos. */

export type StoreCustomerProfile = {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  tier: CustomerTier;
  whatsapp: string | null;
};

export type StoreAuthResult = {
  profile: StoreCustomerProfile;
  /** Expiración de la sesión (ISO). El token viaja solo por cookie httpOnly. */
  expiresAt: string;
};

export type StoreOrderLineView = {
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
};

export type StoreShipmentView = {
  carrier: string | null;
  trackingCode: string | null;
  status: ShipmentStatus;
  eta: string | null;
};

export type StoreOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  shippingMethod: ShippingMethod;
  itemCount: number;
  total: Money;
  createdAt: string;
};

export type StoreOrderDetail = StoreOrderSummary & {
  subtotal: Money;
  shipping: Money;
  discount: Money;
  tax: Money;
  notes: string | null;
  lines: StoreOrderLineView[];
  shipments: StoreShipmentView[];
  statusHistory: Array<{ status: OrderStatus; at: string }>;
};

export type StoreOrderListResult = {
  items: StoreOrderSummary[];
  nextCursor: string | null;
};

export type StoreCheckoutResult = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  total: Money;
};
