import { AdminRole, OrderStatus, type Actor, type Currency, type FinanceKpis } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { ok, type Result } from "../../../../shared/domain/result.js";
import type { FinanceDomainError } from "../../../../shared/errors/domain-error.js";
import { DashboardService } from "../../application/dashboard-service.js";
import type {
  CustomerLabel,
  CustomerSalesRow,
  DashboardCachePort,
  DashboardCatalogPort,
  DashboardCustomersPort,
  DashboardFinancePort,
  DashboardInventoryPort,
  DashboardOrdersPort,
  DashboardPeriod,
  LowStockRow,
  OrdersStatusCount,
  OrdersTimeSeriesPoint,
  RecentCustomerRow,
  RecentOrderRow,
  VariantCatalogInfo,
  VariantSalesRow,
} from "../../application/ports.js";

describe("DashboardService", () => {
  it("omits financial margin and money widgets for CATALOG_MANAGER", async () => {
    const finance = new FakeFinancePort();
    const service = newService({ finance });

    const result = await service.getOverview(admin(AdminRole.CATALOG_MANAGER), { range: "30d", compareToPrevious: true });

    expect(result.ok).toBe(true);
    expect(finance.calls).toBe(0);
    if (result.ok) {
      expect(result.value.kpis.publishedProducts.value).toBe(3);
      expect(result.value.kpis.lowStockCount?.value).toBe(2);
      expect(result.value.kpis.margin).toBeUndefined();
      expect(result.value.kpis.sales).toBeUndefined();
      expect(result.value.ordersByStatus).toEqual([]);
    }
  });

  it("returns zeroed structures for empty periods instead of failing", async () => {
    const service = newService({
      finance: new FakeFinancePort({ kpis: emptyKpis("ARS") }),
      orders: new FakeOrdersPort({ statusCounts: [], timeSeries: [] }),
      catalog: new FakeCatalogPort({ publishedCount: 0 }),
      inventory: new FakeInventoryPort({ lowStockCount: 0 }),
      customers: new FakeCustomersPort({ newCustomers: 0 }),
    });

    const overview = await service.getOverview(admin(AdminRole.OWNER), { range: "30d", compareToPrevious: true });
    const series = await service.getSalesTimeSeries(admin(AdminRole.OWNER), { range: "30d", metric: "revenue" });

    expect(overview.ok).toBe(true);
    expect(series.ok).toBe(true);
    if (overview.ok) {
      expect(overview.value.kpis.sales?.value.amountMinor).toBe(0);
      expect(overview.value.kpis.margin?.value.amountMinor).toBe(0);
      expect(overview.value.kpis.orders?.value).toBe(0);
      expect(overview.value.ordersByStatus).toEqual([]);
    }
    if (series.ok) {
      expect(series.value.total).toBe(0);
      expect(series.value.points.length).toBe(30);
      expect(series.value.points.every((point) => point.value === 0)).toBe(true);
    }
  });

  it("denies financial series to catalog roles", async () => {
    const result = await newService().getSalesTimeSeries(admin(AdminRole.CATALOG_MANAGER), { range: "7d", metric: "revenue" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("FORBIDDEN");
    }
  });

  it("allows catalog roles to see top products by units without margin", async () => {
    const service = newService({
      orders: new FakeOrdersPort({
        variantSales: [
          {
            variantId: "variant-1",
            productTitleSnapshot: "Heladera Demo",
            skuSnapshot: "HEL-1",
            unitsSold: 4,
            revenueMinor: 400_000,
            marginMinor: 120_000,
          },
        ],
      }),
      catalog: new FakeCatalogPort({
        variants: [
          {
            variantId: "variant-1",
            productId: "product-1",
            productTitle: "Heladera Demo",
            sku: "HEL-1",
            categoryId: "category-1",
            categoryName: "Refrigeradores",
          },
        ],
      }),
    });

    const result = await service.getTopProducts(admin(AdminRole.CATALOG_MANAGER), { range: "30d", limit: 5, metric: "units" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items[0]?.unitsSold).toBe(4);
      expect(result.value.items[0]?.marginMinor).toBeUndefined();
    }
  });
});

const newService = (overrides: {
  finance?: DashboardFinancePort;
  orders?: DashboardOrdersPort;
  inventory?: DashboardInventoryPort;
  catalog?: DashboardCatalogPort;
  customers?: DashboardCustomersPort;
  cache?: DashboardCachePort;
} = {}): DashboardService =>
  new DashboardService(
    overrides.finance ?? new FakeFinancePort(),
    overrides.orders ?? new FakeOrdersPort(),
    overrides.inventory ?? new FakeInventoryPort(),
    overrides.catalog ?? new FakeCatalogPort(),
    overrides.customers ?? new FakeCustomersPort(),
    overrides.cache ?? new FakeCachePort(),
  );

const admin = (role: AdminRole): Actor => ({ kind: "admin", userId: "admin-user", role, sessionId: "session" });

class FakeFinancePort implements DashboardFinancePort {
  public calls = 0;

  public constructor(private readonly options: { kpis?: FinanceKpis } = {}) {}

  public async getKpis(_actor: Actor, input: { currency: Currency }): Promise<Result<FinanceKpis, FinanceDomainError>> {
    this.calls += 1;
    return ok(this.options.kpis ?? {
      range: "30d",
      totalRevenue: { amountMinor: 1_000_000, currency: input.currency },
      totalCost: { amountMinor: 600_000, currency: input.currency },
      totalMargin: { amountMinor: 400_000, currency: input.currency },
      marginPct: 0.4,
      ordersCount: 5,
      avgTicket: { amountMinor: 200_000, currency: input.currency },
      trend: [],
    });
  }
}

class FakeOrdersPort implements DashboardOrdersPort {
  public constructor(private readonly options: {
    statusCounts?: OrdersStatusCount[];
    timeSeries?: OrdersTimeSeriesPoint[];
    variantSales?: VariantSalesRow[];
    topCustomers?: CustomerSalesRow[];
    recentOrders?: RecentOrderRow[];
  } = {}) {}

  public async countByStatus(_period: DashboardPeriod): Promise<OrdersStatusCount[]> {
    return this.options.statusCounts ?? [{ status: OrderStatus.CONFIRMED, count: 2 }];
  }

  public async getSalesTimeSeries(_period: DashboardPeriod): Promise<OrdersTimeSeriesPoint[]> {
    return this.options.timeSeries ?? [];
  }

  public async getVariantSales(_period: DashboardPeriod, _limit: number): Promise<VariantSalesRow[]> {
    return this.options.variantSales ?? [];
  }

  public async getTopCustomers(_period: DashboardPeriod, _limit: number): Promise<CustomerSalesRow[]> {
    return this.options.topCustomers ?? [];
  }

  public async getRecentOrders(_limit: number): Promise<RecentOrderRow[]> {
    return this.options.recentOrders ?? [];
  }
}

class FakeCatalogPort implements DashboardCatalogPort {
  public constructor(private readonly options: { publishedCount?: number; variants?: VariantCatalogInfo[] } = {}) {}

  public async countPublishedProducts(): Promise<number> {
    return this.options.publishedCount ?? 3;
  }

  public async getVariantInfo(_variantIds: string[]): Promise<VariantCatalogInfo[]> {
    return this.options.variants ?? [];
  }
}

class FakeInventoryPort implements DashboardInventoryPort {
  public constructor(private readonly options: { lowStockCount?: number; rows?: LowStockRow[] } = {}) {}

  public async countLowStock(_threshold: "reorder_point" | "zero"): Promise<number> {
    return this.options.lowStockCount ?? 2;
  }

  public async listLowStock(_input: { limit: number; threshold: "reorder_point" | "zero" }): Promise<LowStockRow[]> {
    return this.options.rows ?? [];
  }
}

class FakeCustomersPort implements DashboardCustomersPort {
  public constructor(private readonly options: {
    newCustomers?: number;
    labels?: CustomerLabel[];
    recent?: RecentCustomerRow[];
  } = {}) {}

  public async countNewCustomers(_period: DashboardPeriod): Promise<number> {
    return this.options.newCustomers ?? 1;
  }

  public async getCustomerLabels(_customerIds: string[], _includePii: boolean): Promise<CustomerLabel[]> {
    return this.options.labels ?? [];
  }

  public async getRecentCustomers(_input: { limit: number; includePii: boolean }): Promise<RecentCustomerRow[]> {
    return this.options.recent ?? [];
  }
}

class FakeCachePort implements DashboardCachePort {
  private readonly values = new Map<string, unknown>();

  public async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  public async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  public async invalidatePrefixes(_prefixes: readonly string[]): Promise<void> {}
}

const emptyKpis = (currency: Currency): FinanceKpis => ({
  range: "30d",
  totalRevenue: { amountMinor: 0, currency },
  totalCost: { amountMinor: 0, currency },
  totalMargin: { amountMinor: 0, currency },
  marginPct: 0,
  ordersCount: 0,
  avgTicket: { amountMinor: 0, currency },
  trend: [],
});
