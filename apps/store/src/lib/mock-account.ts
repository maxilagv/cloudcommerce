import { formatCOP } from "@/lib/utils";

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

export type LoyaltyData = {
  tier: string;
  points: number;
  nextTier: string;
  nextTierPoints: number;
  progressPct: number;
  benefits: { label: string; active: boolean }[];
};

// ── Mock data ──────────────────────────────────────────────────────────────

export const mockProfile: CustomerProfile = {
  name: "Demo Customer",
  email: "demo.customer@example.com",
  initials: "DC",
  memberSince: "Marzo 2023",
  tier: "CloudPrime",
};

export const mockOrders: Order[] = [
  {
    id: "orden-001",
    status: "in-transit",
    date: "20 jun 2026",
    eta: "27 jun 2026",
    items: [
      {
        productId: "samsung-nevera",
        name: "Samsung Nevera Family Hub 655L",
        image: "/products/samsung-nevera.svg",
        qty: 1,
        price: 7_299_900,
      },
    ],
    subtotal: 7_299_900,
    shipping: 0,
    discount: 450_000,
    total: 6_849_900,
    address: "Av. Corrientes 1234, CABA",
    paymentLast4: "4242",
  },
  {
    id: "orden-002",
    status: "preparing",
    date: "18 jun 2026",
    eta: "25 jun 2026",
    items: [
      {
        productId: "apple-macbook-air-m2",
        name: "MacBook Air M2 13\"",
        image: "/products/apple-macbook-air-m2.svg",
        qty: 1,
        price: 5_499_900,
      },
      {
        productId: "sony-wh1000xm5",
        name: "Sony WH-1000XM5",
        image: "/products/sony-wh1000xm5.svg",
        qty: 1,
        price: 1_899_900,
      },
    ],
    subtotal: 7_399_800,
    shipping: 0,
    discount: 0,
    total: 7_399_800,
    address: "Av. Corrientes 1234, CABA",
    paymentLast4: "4242",
  },
  {
    id: "orden-003",
    status: "delivered",
    date: "5 jun 2026",
    items: [
      {
        productId: "samsung-qled-55",
        name: "Samsung QLED 55\" 4K",
        image: "/products/samsung-qled-55.svg",
        qty: 1,
        price: 2_799_900,
      },
    ],
    subtotal: 2_799_900,
    shipping: 0,
    discount: 280_000,
    total: 2_519_900,
    address: "Av. Corrientes 1234, CABA",
    paymentLast4: "8891",
  },
  {
    id: "orden-004",
    status: "delivered",
    date: "14 may 2026",
    items: [
      {
        productId: "dyson-v15",
        name: "Dyson V15 Detect Absolute",
        image: "/products/dyson-v15.svg",
        qty: 1,
        price: 3_199_900,
      },
    ],
    subtotal: 3_199_900,
    shipping: 0,
    discount: 0,
    total: 3_199_900,
    address: "Av. Corrientes 1234, CABA",
    paymentLast4: "4242",
  },
  {
    id: "orden-005",
    status: "cancelled",
    date: "2 abr 2026",
    items: [
      {
        productId: "xiaomi-14-ultra",
        name: "Xiaomi 14 Ultra",
        image: "/products/xiaomi-14-ultra.svg",
        qty: 1,
        price: 4_499_900,
      },
    ],
    subtotal: 4_499_900,
    shipping: 0,
    discount: 0,
    total: 4_499_900,
    address: "Av. Corrientes 1234, CABA",
    paymentLast4: "8891",
  },
];

export const mockSpending: Record<string, SpendingPoint[]> = {
  "3M": [
    { month: "Abr", amount: 3_199_900 },
    { month: "May", amount: 3_199_900 },
    { month: "Jun", amount: 16_769_600 },
  ],
  "6M": [
    { month: "Ene", amount: 0 },
    { month: "Feb", amount: 1_200_000 },
    { month: "Mar", amount: 0 },
    { month: "Abr", amount: 3_199_900 },
    { month: "May", amount: 3_199_900 },
    { month: "Jun", amount: 16_769_600 },
  ],
  "12M": [
    { month: "Jul", amount: 2_100_000 },
    { month: "Ago", amount: 0 },
    { month: "Sep", amount: 4_500_000 },
    { month: "Oct", amount: 1_800_000 },
    { month: "Nov", amount: 6_200_000 },
    { month: "Dic", amount: 9_800_000 },
    { month: "Ene", amount: 0 },
    { month: "Feb", amount: 1_200_000 },
    { month: "Mar", amount: 0 },
    { month: "Abr", amount: 3_199_900 },
    { month: "May", amount: 3_199_900 },
    { month: "Jun", amount: 16_769_600 },
  ],
};

export const mockDocuments: AccountDocument[] = [
  { type: "remito", number: "R-0001", orderId: "orden-003", date: "7 jun 2026", status: "available", total: 2_519_900 },
  { type: "remito", number: "R-0002", orderId: "orden-004", date: "17 may 2026", status: "available", total: 3_199_900 },
  { type: "factura", number: "FA-0001", orderId: "orden-003", date: "7 jun 2026", status: "available", total: 2_519_900 },
  { type: "factura", number: "FA-0002", orderId: "orden-004", date: "17 may 2026", status: "available", total: 3_199_900 },
  { type: "nota-credito", number: "NC-0001", orderId: "orden-005", date: "5 abr 2026", status: "available", total: 4_499_900 },
];

export const mockAddresses: Address[] = [
  {
    id: "addr-1",
    label: "Casa",
    name: "Demo Customer",
    street: "Av. Corrientes 1234, Piso 3 Dpto B",
    city: "Buenos Aires, CP 1043",
    isPrimary: true,
  },
  {
    id: "addr-2",
    label: "Oficina",
    name: "Demo Customer",
    street: "Maipú 255, Piso 8",
    city: "Buenos Aires, CP 1006",
    isPrimary: false,
  },
];

export const mockPaymentMethods: PaymentMethod[] = [
  { id: "pm-1", type: "visa", last4: "4242", expiry: "09/28" },
  { id: "pm-2", type: "mastercard", last4: "8891", expiry: "03/27" },
];

export const mockLoyalty: LoyaltyData = {
  tier: "CloudPrime",
  points: 24_750,
  nextTier: "CloudElite",
  nextTierPoints: 33_000,
  progressPct: 75,
  benefits: [
    { label: "Envío gratis en todos los pedidos", active: true },
    { label: "Acceso anticipado a ofertas", active: true },
    { label: "Devoluciones sin costo 30 días", active: true },
    { label: "Soporte prioritario 24/7", active: true },
    { label: "Descuento extra 5% en electrónica", active: false },
  ],
};

export const mockMetrics = [
  {
    label: "Total gastado",
    value: formatCOP(19_969_500),
    variation: "+34%",
    positive: true,
    icon: "shopping-bag",
  },
  {
    label: "Total ahorrado",
    value: formatCOP(730_000),
    variation: "+12%",
    positive: true,
    icon: "tag",
  },
  {
    label: "Compras realizadas",
    value: "4",
    variation: "+1 este mes",
    positive: true,
    icon: "package",
  },
  {
    label: "CloudPoints",
    value: "24.750",
    variation: "+2.100 este mes",
    positive: true,
    icon: "star",
  },
];

export function getOrderById(id: string): Order | undefined {
  return mockOrders.find((o) => o.id === id);
}
