import type { Currency, Money } from "./domain.js";
import type { OrderStatus } from "./enums.js";

export type DashboardRange = "7d" | "30d" | "12m";
export type DashboardSalesMetric = "revenue" | "income" | "orders";
export type DashboardCategoryMetric = "revenue" | "units";
export type DashboardGranularity = "day" | "month";

export type KpiDelta = {
  pct: number;
  positive: boolean;
  label: string;
};

export type Kpi<T = Money | number> = {
  key: string;
  label: string;
  value: T;
  delta?: KpiDelta;
};

export type DashboardOverviewKpis = {
  sales?: Kpi<Money>;
  income?: Kpi<Money>;
  margin?: Kpi<Money>;
  marginPct?: number;
  orders?: Kpi<number>;
  averageTicket?: Kpi<Money>;
  newCustomers?: Kpi<number>;
  publishedProducts: Kpi<number>;
  lowStockCount?: Kpi<number>;
};

export type DashboardOverviewResponse = {
  range: DashboardRange;
  period: { from: string; to: string };
  currency: Currency;
  kpis: DashboardOverviewKpis;
  ordersByStatus: Array<{ status: OrderStatus; count: number }>;
  computedAt: string;
  stale: boolean;
};

export type TimeSeriesPoint = {
  bucket: string;
  label: string;
  value: number;
};

export type SalesTimeSeriesResponse = {
  range: DashboardRange;
  metric: DashboardSalesMetric;
  granularity: DashboardGranularity;
  currency: Currency;
  points: TimeSeriesPoint[];
  total: number;
};

export type CategorySlice = {
  categoryId: string | null;
  name: string;
  value: number;
  share: number;
};

export type SalesByCategoryResponse = {
  range: DashboardRange;
  metric: DashboardCategoryMetric;
  currency: Currency;
  slices: CategorySlice[];
  total: number;
};

export type TopProduct = {
  productId: string;
  title: string;
  imageUrl?: string;
  unitsSold: number;
  revenue: Money;
  marginMinor?: number;
};

export type TopProductsResponse = {
  range: DashboardRange;
  metric: DashboardCategoryMetric;
  items: TopProduct[];
};

export type TopCustomer = {
  customerId: string;
  displayName: string;
  ordersCount: number;
  totalSpent: Money;
  isAnonymized: boolean;
};

export type TopCustomersResponse = {
  range: DashboardRange;
  items: TopCustomer[];
};

export type RecentOrder = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  total: Money;
  customerLabel: string;
  createdAt: string;
};

export type RecentCustomer = {
  customerId: string;
  displayName: string;
  createdAt: string;
  isAnonymized: boolean;
};

export type RecentAiGeneration = {
  id: string;
  kind: string;
  status: string;
  targetLabel?: string;
  createdAt: string;
};

export type RecentActivityResponse = {
  orders: RecentOrder[];
  customers: RecentCustomer[];
  aiGenerations: RecentAiGeneration[];
};

export type LowStockAlert = {
  variantId: string;
  productId: string;
  productTitle: string;
  sku: string;
  available: number;
  reorderPoint: number | null;
  severity: "out_of_stock" | "low";
};

export type LowStockAlertsResponse = {
  items: LowStockAlert[];
  totalCount: number;
};
