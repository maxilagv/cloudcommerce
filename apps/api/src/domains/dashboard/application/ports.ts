import type {
  Actor,
  Currency,
  DashboardCategoryMetric,
  DashboardGranularity,
  DashboardRange,
  DashboardSalesMetric,
  FinanceKpis,
  Money,
  OrderStatus,
} from "@cloudcommerce/types";
import type { Result } from "../../../shared/domain/result.js";
import type { FinanceDomainError } from "../../../shared/errors/domain-error.js";

export type DashboardPeriod = {
  range: DashboardRange;
  from: Date;
  to: Date;
  granularity: DashboardGranularity;
};

export type DashboardFinancePort = {
  getKpis(actor: Actor, input: { range: DashboardRange; currency: Currency }): Promise<Result<FinanceKpis, FinanceDomainError>>;
};

export type OrdersStatusCount = {
  status: OrderStatus;
  count: number;
};

export type OrdersTimeSeriesPoint = {
  bucket: string;
  revenueMinor: number;
  ordersCount: number;
};

export type VariantSalesRow = {
  variantId: string;
  productTitleSnapshot: string;
  skuSnapshot: string | null;
  unitsSold: number;
  revenueMinor: number;
  marginMinor: number;
};

export type CustomerSalesRow = {
  customerId: string;
  ordersCount: number;
  totalSpentMinor: number;
};

export type RecentOrderRow = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  total: Money;
  customerId: string;
  createdAt: Date;
};

export type DashboardOrdersPort = {
  countByStatus(period: DashboardPeriod): Promise<OrdersStatusCount[]>;
  getSalesTimeSeries(period: DashboardPeriod): Promise<OrdersTimeSeriesPoint[]>;
  getVariantSales(period: DashboardPeriod, limit: number): Promise<VariantSalesRow[]>;
  getTopCustomers(period: DashboardPeriod, limit: number): Promise<CustomerSalesRow[]>;
  getRecentOrders(limit: number): Promise<RecentOrderRow[]>;
};

export type VariantCatalogInfo = {
  variantId: string;
  productId: string;
  productTitle: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl?: string;
};

export type DashboardCatalogPort = {
  countPublishedProducts(): Promise<number>;
  getVariantInfo(variantIds: string[]): Promise<VariantCatalogInfo[]>;
};

export type LowStockRow = {
  variantId: string;
  available: number;
  reorderPoint: number | null;
};

export type DashboardInventoryPort = {
  countLowStock(threshold: "reorder_point" | "zero"): Promise<number>;
  listLowStock(input: { limit: number; threshold: "reorder_point" | "zero" }): Promise<LowStockRow[]>;
};

export type CustomerLabel = {
  customerId: string;
  displayName: string;
  isAnonymized: boolean;
};

export type RecentCustomerRow = CustomerLabel & {
  createdAt: Date;
};

export type DashboardCustomersPort = {
  countNewCustomers(period: DashboardPeriod): Promise<number>;
  getCustomerLabels(customerIds: string[], includePii: boolean): Promise<CustomerLabel[]>;
  getRecentCustomers(input: { limit: number; includePii: boolean }): Promise<RecentCustomerRow[]>;
};

export type DashboardCachePort = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidatePrefixes(prefixes: readonly string[]): Promise<void>;
};
