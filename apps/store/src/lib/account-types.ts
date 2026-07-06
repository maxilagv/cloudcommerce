/**
 * UI shapes for the customer account area. Order data comes from the real
 * backend (`lib/api/orders.ts` maps `storefront.myOrders` / `orderDetail`
 * into these types); addresses and payment methods are managed locally by
 * their Zustand stores until the backend exposes them.
 */

export type CustomerProfile = {
  name: string;
  email: string;
  initials: string;
  memberSince: string;
  tier: "CloudPrime" | "CloudPlus" | "CloudBase";
};

export type OrderStatus = "in-transit" | "preparing" | "delivered" | "cancelled";

export type OrderItem = {
  productId: string;
  name: string;
  image: string;
  qty: number;
  price: number;
};

export type Order = {
  id: string;
  status: OrderStatus;
  date: string;
  eta?: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  address: string;
  paymentLast4: string;
};

export type SpendingPoint = {
  month: string;
  amount: number;
};

export type AccountDocument = {
  type: "remito" | "factura" | "nota-credito";
  number: string;
  orderId: string;
  date: string;
  status: "available" | "processing";
  total: number;
};

export type Address = {
  id: string;
  label: string;
  name: string;
  street: string;
  city: string;
  isPrimary: boolean;
};

export type PaymentMethod = {
  id: string;
  type: "visa" | "mastercard" | "amex";
  last4: string;
  expiry: string;
};
