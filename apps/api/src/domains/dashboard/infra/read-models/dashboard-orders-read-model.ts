import { order as orderTable, orderLine } from "@cloudcommerce/database";
import { OrderStatus, type Currency } from "@cloudcommerce/types";
import { and, desc, gte, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  CustomerSalesRow,
  DashboardOrdersPort,
  DashboardPeriod,
  OrdersStatusCount,
  OrdersTimeSeriesPoint,
  RecentOrderRow,
  VariantSalesRow,
} from "../../application/ports.js";

const validDashboardOrderStatuses = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export class DashboardOrdersReadModel implements DashboardOrdersPort {
  public constructor(private readonly db: Database) {}

  public async countByStatus(period: DashboardPeriod): Promise<OrdersStatusCount[]> {
    const rows = await this.db
      .select({
        status: orderTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(orderTable)
      .where(and(gte(orderDateExpression, period.from), lt(orderDateExpression, period.to)))
      .groupBy(orderTable.status);
    return rows.map((row) => ({ status: row.status, count: row.count }));
  }

  public async getSalesTimeSeries(period: DashboardPeriod): Promise<OrdersTimeSeriesPoint[]> {
    const bucket = period.granularity === "month"
      ? sql<string>`to_char(date_trunc('month', ${orderDateExpression}), 'YYYY-MM')`
      : sql<string>`to_char(date_trunc('day', ${orderDateExpression}), 'YYYY-MM-DD')`;
    const rows = await this.db
      .select({
        bucket,
        revenueMinor: sql<number>`coalesce(sum(${orderTable.totalMinor}), 0)::int`,
        ordersCount: sql<number>`count(*)::int`,
      })
      .from(orderTable)
      .where(
        and(
          inArray(orderTable.status, validDashboardOrderStatuses),
          gte(orderDateExpression, period.from),
          lt(orderDateExpression, period.to),
        ),
      )
      .groupBy(bucket)
      .orderBy(bucket);
    return rows.map((row) => ({
      bucket: row.bucket,
      revenueMinor: row.revenueMinor,
      ordersCount: row.ordersCount,
    }));
  }

  public async getVariantSales(period: DashboardPeriod, limit: number): Promise<VariantSalesRow[]> {
    const rows = await this.db
      .select({
        variantId: orderLine.variantId,
        productTitleSnapshot: sql<string>`max(${orderLine.productTitleSnapshot})`,
        skuSnapshot: sql<string | null>`max(${orderLine.skuSnapshot})`,
        unitsSold: sql<number>`coalesce(sum(${orderLine.quantity}), 0)::int`,
        revenueMinor: sql<number>`coalesce(sum(${orderLine.lineTotalMinor}), 0)::int`,
        marginMinor: sql<number>`coalesce(sum(${orderLine.lineTotalMinor} - coalesce(${orderLine.supplierCostSnapshotMinor}, 0) * ${orderLine.quantity}), 0)::int`,
      })
      .from(orderLine)
      .innerJoin(orderTable, sql`${orderLine.orderId} = ${orderTable.id}`)
      .where(
        and(
          inArray(orderTable.status, validDashboardOrderStatuses),
          gte(orderDateExpression, period.from),
          lt(orderDateExpression, period.to),
        ),
      )
      .groupBy(orderLine.variantId)
      .orderBy(desc(sql`coalesce(sum(${orderLine.lineTotalMinor}), 0)`))
      .limit(limit);
    return rows.map((row) => ({
      variantId: row.variantId,
      productTitleSnapshot: row.productTitleSnapshot,
      skuSnapshot: row.skuSnapshot,
      unitsSold: row.unitsSold,
      revenueMinor: row.revenueMinor,
      marginMinor: row.marginMinor,
    }));
  }

  public async getTopCustomers(period: DashboardPeriod, limit: number): Promise<CustomerSalesRow[]> {
    const rows = await this.db
      .select({
        customerId: orderTable.customerId,
        ordersCount: sql<number>`count(*)::int`,
        totalSpentMinor: sql<number>`coalesce(sum(${orderTable.totalMinor}), 0)::int`,
      })
      .from(orderTable)
      .where(
        and(
          inArray(orderTable.status, validDashboardOrderStatuses),
          gte(orderDateExpression, period.from),
          lt(orderDateExpression, period.to),
        ),
      )
      .groupBy(orderTable.customerId)
      .orderBy(desc(sql`coalesce(sum(${orderTable.totalMinor}), 0)`))
      .limit(limit);
    return rows.map((row) => ({
      customerId: row.customerId,
      ordersCount: row.ordersCount,
      totalSpentMinor: row.totalSpentMinor,
    }));
  }

  public async getRecentOrders(limit: number): Promise<RecentOrderRow[]> {
    const rows = await this.db
      .select({
        orderId: orderTable.id,
        orderNumber: orderTable.orderNumber,
        status: orderTable.status,
        currency: orderTable.currency,
        totalMinor: orderTable.totalMinor,
        customerId: orderTable.customerId,
        createdAt: orderTable.createdAt,
      })
      .from(orderTable)
      .orderBy(desc(orderTable.createdAt), desc(orderTable.id))
      .limit(limit);
    return rows.map((row) => ({
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      status: row.status,
      total: { amountMinor: row.totalMinor, currency: currency(row.currency) },
      customerId: row.customerId,
      createdAt: row.createdAt,
    }));
  }
}

const orderDateExpression = sql<Date>`coalesce(${orderTable.confirmedAt}, ${orderTable.createdAt})`;

const currency = (value: string): Currency => (value === "USD" ? "USD" : "ARS");
