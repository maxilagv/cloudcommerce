import {
  type Actor,
  type CategorySlice,
  type Currency,
  type DashboardCategoryMetric,
  type DashboardOverviewResponse,
  type DashboardRange,
  type DashboardSalesMetric,
  type LowStockAlertsResponse,
  type Money,
  type RecentActivityResponse,
  type SalesByCategoryResponse,
  type SalesTimeSeriesResponse,
  type TimeSeriesPoint,
  type TopCustomersResponse,
  type TopProductsResponse,
} from "@cloudcommerce/types";
import type {
  GetDashboardOverviewInput,
  GetLowStockAlertsInput,
  GetRecentActivityInput,
  GetSalesByCategoryInput,
  GetSalesTimeSeriesInput,
  GetTopCustomersInput,
  GetTopProductsInput,
} from "@cloudcommerce/validators";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { DashboardDomainError } from "../../../shared/errors/domain-error.js";
import { dashboardCacheKey, dashboardCacheTtlSeconds } from "../domain/cache-policy.js";
import { dashboardCapabilitiesFor } from "../domain/dashboard-permissions.js";
import type {
  CustomerLabel,
  DashboardCachePort,
  DashboardCatalogPort,
  DashboardCustomersPort,
  DashboardFinancePort,
  DashboardInventoryPort,
  DashboardOrdersPort,
  DashboardPeriod,
  VariantCatalogInfo,
  VariantSalesRow,
} from "./ports.js";

const currency: Currency = "ARS";

export class DashboardService {
  public constructor(
    private readonly finance: DashboardFinancePort,
    private readonly orders: DashboardOrdersPort,
    private readonly inventory: DashboardInventoryPort,
    private readonly catalog: DashboardCatalogPort,
    private readonly customers: DashboardCustomersPort,
    private readonly cache: DashboardCachePort,
  ) {}

  public async getOverview(
    actor: Actor,
    input: GetDashboardOverviewInput,
  ): Promise<Result<DashboardOverviewResponse, DashboardDomainError>> {
    const capabilities = dashboardCapabilitiesFor(actor);
    if (!capabilities.canViewDashboard) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const period = resolvePeriod(input.range);
    return ok(
      await this.cached(
        dashboardCacheKey.overview(cacheRole(actor), input.range),
        dashboardCacheTtlSeconds.overview,
        async () => {
          const [financeResult, publishedProducts, lowStockCount, ordersByStatus, newCustomers] = await Promise.all([
            capabilities.canViewFinancial ? this.finance.getKpis(actor, { range: input.range, currency }) : Promise.resolve(null),
            this.catalog.countPublishedProducts(),
            capabilities.canViewStock ? this.inventory.countLowStock("reorder_point") : Promise.resolve(0),
            capabilities.canViewOrders ? this.orders.countByStatus(period) : Promise.resolve([]),
            capabilities.canViewCustomerActivity ? this.customers.countNewCustomers(period) : Promise.resolve(0),
          ]);
          const kpis: DashboardOverviewResponse["kpis"] = {
            publishedProducts: {
              key: "publishedProducts",
              label: "Productos publicados",
              value: publishedProducts,
            },
          };
          if (capabilities.canViewStock) {
            kpis.lowStockCount = { key: "lowStockCount", label: "Stock bajo", value: lowStockCount };
          }
          if (capabilities.canViewCustomerActivity) {
            kpis.newCustomers = { key: "newCustomers", label: "Clientes nuevos", value: newCustomers };
          }
          if (financeResult?.ok) {
            kpis.sales = { key: "sales", label: "Ventas del periodo", value: financeResult.value.totalRevenue };
            kpis.income = { key: "income", label: "Ingresos netos", value: financeResult.value.totalRevenue };
            kpis.orders = { key: "orders", label: "Pedidos", value: financeResult.value.ordersCount };
            kpis.averageTicket = { key: "averageTicket", label: "Ticket promedio", value: financeResult.value.avgTicket };
            if (capabilities.canViewMargin) {
              kpis.margin = { key: "margin", label: "Margen", value: financeResult.value.totalMargin };
              kpis.marginPct = financeResult.value.marginPct;
            }
          }
          return {
            range: input.range,
            period: { from: period.from.toISOString(), to: period.to.toISOString() },
            currency,
            kpis,
            ordersByStatus,
            computedAt: new Date().toISOString(),
            stale: false,
          };
        },
      ),
    );
  }

  public async getSalesTimeSeries(
    actor: Actor,
    input: GetSalesTimeSeriesInput,
  ): Promise<Result<SalesTimeSeriesResponse, DashboardDomainError>> {
    const capabilities = dashboardCapabilitiesFor(actor);
    if (!capabilities.canViewFinancial) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const period = resolvePeriod(input.range);
    return ok(
      await this.cached(
        dashboardCacheKey.salesTimeSeries(cacheRole(actor), input.range, input.metric),
        dashboardCacheTtlSeconds.salesTimeSeries,
        async () => {
          const rows = await this.orders.getSalesTimeSeries(period);
          const points = fillTimeSeries(period, input.metric, rows);
          return {
            range: input.range,
            metric: input.metric,
            granularity: period.granularity,
            currency,
            points,
            total: points.reduce((sum, point) => sum + point.value, 0),
          };
        },
      ),
    );
  }

  public async getSalesByCategory(
    actor: Actor,
    input: GetSalesByCategoryInput,
  ): Promise<Result<SalesByCategoryResponse, DashboardDomainError>> {
    const capabilities = dashboardCapabilitiesFor(actor);
    if (!capabilities.canViewCatalog || (input.metric === "revenue" && !capabilities.canViewFinancial)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const period = resolvePeriod(input.range);
    return ok(
      await this.cached(
        dashboardCacheKey.salesByCategory(cacheRole(actor), input.range, input.metric, input.limit),
        dashboardCacheTtlSeconds.salesByCategory,
        async () => {
          const rows = await this.orders.getVariantSales(period, Math.max(input.limit * 4, input.limit));
          const info = await this.catalogInfoByVariant(rows.map((row) => row.variantId));
          const grouped = new Map<string, { categoryId: string | null; name: string; value: number }>();
          for (const row of rows) {
            const catalogInfo = info.get(row.variantId);
            const categoryId = catalogInfo?.categoryId ?? null;
            const name = catalogInfo?.categoryName ?? "Sin categoria";
            const key = categoryId ?? "uncategorized";
            const current = grouped.get(key) ?? { categoryId, name, value: 0 };
            current.value += metricValue(row, input.metric);
            grouped.set(key, current);
          }
          const sorted = [...grouped.values()].sort((left, right) => right.value - left.value);
          const total = sorted.reduce((sum, slice) => sum + slice.value, 0);
          const top = sorted.slice(0, input.limit);
          const other = sorted.slice(input.limit).reduce((sum, slice) => sum + slice.value, 0);
          const slices = top.map((slice) => presentSlice(slice, total));
          if (other > 0) {
            slices.push(presentSlice({ categoryId: null, name: "Otras", value: other }, total));
          }
          return { range: input.range, metric: input.metric, currency, slices, total };
        },
      ),
    );
  }

  public async getTopProducts(
    actor: Actor,
    input: GetTopProductsInput,
  ): Promise<Result<TopProductsResponse, DashboardDomainError>> {
    const capabilities = dashboardCapabilitiesFor(actor);
    if (!capabilities.canViewCatalog || (input.metric === "revenue" && !capabilities.canViewFinancial)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const period = resolvePeriod(input.range);
    return ok(
      await this.cached(
        dashboardCacheKey.topProducts(cacheRole(actor), input.range, input.limit, input.metric),
        dashboardCacheTtlSeconds.topProducts,
        async () => {
          const rows = await this.orders.getVariantSales(period, Math.max(input.limit * 3, input.limit));
          const info = await this.catalogInfoByVariant(rows.map((row) => row.variantId));
          const products = new Map<string, {
            productId: string;
            title: string;
            imageUrl?: string;
            unitsSold: number;
            revenueMinor: number;
            marginMinor: number;
          }>();
          for (const row of rows) {
            const catalogInfo = info.get(row.variantId);
            if (!catalogInfo) {
              continue;
            }
            const current = products.get(catalogInfo.productId) ?? {
              productId: catalogInfo.productId,
              title: catalogInfo.productTitle,
              ...(catalogInfo.imageUrl ? { imageUrl: catalogInfo.imageUrl } : {}),
              unitsSold: 0,
              revenueMinor: 0,
              marginMinor: 0,
            };
            current.unitsSold += row.unitsSold;
            current.revenueMinor += row.revenueMinor;
            current.marginMinor += row.marginMinor;
            products.set(catalogInfo.productId, current);
          }
          const sorted = [...products.values()].sort((left, right) =>
            input.metric === "units" ? right.unitsSold - left.unitsSold : right.revenueMinor - left.revenueMinor,
          );
          return {
            range: input.range,
            metric: input.metric,
            items: sorted.slice(0, input.limit).map((item) => ({
              productId: item.productId,
              title: item.title,
              ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
              unitsSold: item.unitsSold,
              revenue: money(item.revenueMinor),
              ...(capabilities.canViewMargin ? { marginMinor: item.marginMinor } : {}),
            })),
          };
        },
      ),
    );
  }

  public async getTopCustomers(
    actor: Actor,
    input: GetTopCustomersInput,
  ): Promise<Result<TopCustomersResponse, DashboardDomainError>> {
    const capabilities = dashboardCapabilitiesFor(actor);
    if (!capabilities.canViewFinancial) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const period = resolvePeriod(input.range);
    const rows = await this.orders.getTopCustomers(period, input.limit);
    const labels = await this.customerLabelsById(rows.map((row) => row.customerId), capabilities.canViewCustomerPii);
    return ok({
      range: input.range,
      items: rows.map((row) => {
        const label = labels.get(row.customerId) ?? anonymizedCustomer(row.customerId);
        return {
          customerId: row.customerId,
          displayName: label.displayName,
          ordersCount: row.ordersCount,
          totalSpent: money(row.totalSpentMinor),
          isAnonymized: label.isAnonymized,
        };
      }),
    });
  }

  public async getRecentActivity(
    actor: Actor,
    input: GetRecentActivityInput,
  ): Promise<Result<RecentActivityResponse, DashboardDomainError>> {
    const capabilities = dashboardCapabilitiesFor(actor);
    if (!capabilities.canViewDashboard) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const [orders, recentCustomers] = await Promise.all([
      capabilities.canViewOrders ? this.orders.getRecentOrders(input.limit) : Promise.resolve([]),
      capabilities.canViewCustomerActivity
        ? this.customers.getRecentCustomers({ limit: input.limit, includePii: capabilities.canViewCustomerPii })
        : Promise.resolve([]),
    ]);
    const labels = await this.customerLabelsById(orders.map((order) => order.customerId), capabilities.canViewCustomerPii);
    return ok({
      orders: orders.map((order) => ({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        customerLabel: labels.get(order.customerId)?.displayName ?? anonymizedCustomer(order.customerId).displayName,
        createdAt: order.createdAt.toISOString(),
      })),
      customers: recentCustomers.map((customer) => ({
        customerId: customer.customerId,
        displayName: customer.displayName,
        createdAt: customer.createdAt.toISOString(),
        isAnonymized: customer.isAnonymized,
      })),
      aiGenerations: [],
    });
  }

  public async getLowStockAlerts(
    actor: Actor,
    input: GetLowStockAlertsInput,
  ): Promise<Result<LowStockAlertsResponse, DashboardDomainError>> {
    const capabilities = dashboardCapabilitiesFor(actor);
    if (!capabilities.canViewStock) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const [rows, totalCount] = await Promise.all([
      this.inventory.listLowStock(input),
      this.inventory.countLowStock(input.threshold),
    ]);
    const info = await this.catalogInfoByVariant(rows.map((row) => row.variantId));
    return ok({
      items: rows.map((row) => {
        const catalogInfo = info.get(row.variantId);
        return {
          variantId: row.variantId,
          productId: catalogInfo?.productId ?? row.variantId,
          productTitle: catalogInfo?.productTitle ?? "Producto sin datos",
          sku: catalogInfo?.sku ?? "",
          available: row.available,
          reorderPoint: row.reorderPoint,
          severity: row.available <= 0 ? "out_of_stock" : "low",
        };
      }),
      totalCount,
    });
  }

  private async cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const value = await load();
    await this.cache.set(key, value, ttlSeconds);
    return value;
  }

  private async catalogInfoByVariant(variantIds: string[]): Promise<Map<string, VariantCatalogInfo>> {
    const uniqueIds = [...new Set(variantIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const rows = await this.catalog.getVariantInfo(uniqueIds);
    return new Map(rows.map((row) => [row.variantId, row]));
  }

  private async customerLabelsById(customerIds: string[], includePii: boolean): Promise<Map<string, CustomerLabel>> {
    const uniqueIds = [...new Set(customerIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const rows = await this.customers.getCustomerLabels(uniqueIds, includePii);
    return new Map(rows.map((row) => [row.customerId, row]));
  }
}

export const resolvePeriod = (range: DashboardRange, now = new Date()): DashboardPeriod => {
  const to = new Date(now);
  const from = new Date(now);
  if (range === "7d") {
    from.setUTCDate(from.getUTCDate() - 6);
    from.setUTCHours(0, 0, 0, 0);
    return { range, from, to, granularity: "day" };
  }
  if (range === "30d") {
    from.setUTCDate(from.getUTCDate() - 29);
    from.setUTCHours(0, 0, 0, 0);
    return { range, from, to, granularity: "day" };
  }
  from.setUTCMonth(from.getUTCMonth() - 11);
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);
  return { range, from, to, granularity: "month" };
};

const fillTimeSeries = (
  period: DashboardPeriod,
  metric: DashboardSalesMetric,
  rows: Array<{ bucket: string; revenueMinor: number; ordersCount: number }>,
): TimeSeriesPoint[] => {
  const values = new Map(rows.map((row) => [row.bucket, metric === "orders" ? row.ordersCount : row.revenueMinor]));
  const points: TimeSeriesPoint[] = [];
  const cursor = new Date(period.from);
  while (cursor <= period.to) {
    const bucket = period.granularity === "month"
      ? `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`
      : cursor.toISOString().slice(0, 10);
    points.push({
      bucket,
      label: period.granularity === "month" ? monthLabel(cursor) : dayLabel(cursor),
      value: values.get(bucket) ?? 0,
    });
    if (period.granularity === "month") {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return points;
};

const presentSlice = (slice: { categoryId: string | null; name: string; value: number }, total: number): CategorySlice => ({
  categoryId: slice.categoryId,
  name: slice.name,
  value: slice.value,
  share: total === 0 ? 0 : slice.value / total,
});

const metricValue = (row: VariantSalesRow, metric: DashboardCategoryMetric): number =>
  metric === "units" ? row.unitsSold : row.revenueMinor;

const money = (amountMinor: number): Money => ({ amountMinor, currency });

const cacheRole = (actor: Actor): string => actor.kind === "admin" ? actor.role : actor.kind;

const anonymizedCustomer = (customerId: string): CustomerLabel => ({
  customerId,
  displayName: "Cliente",
  isAnonymized: true,
});

const monthLabel = (date: Date): string =>
  new Intl.DateTimeFormat("es-AR", { month: "short" }).format(date).replace(".", "");

const dayLabel = (date: Date): string =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(date).replace(".", "");
