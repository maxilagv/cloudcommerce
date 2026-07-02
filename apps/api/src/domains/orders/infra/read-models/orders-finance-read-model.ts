import { order as orderTable, orderLine } from "@cloudcommerce/database";
import { OrderStatus, type Currency } from "@cloudcommerce/types";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { OrderDocumentSource, OrdersReadModelPort, PeriodAggregate } from "../../../finance/application/ports.js";
import { parseArgentinaMonthPeriod } from "../../../finance/domain/period.js";

const validFinanceStatuses = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export class OrdersFinanceReadModel implements OrdersReadModelPort {
  public constructor(private readonly db: Database) {}

  public async getOrderForDocument(orderId: string): Promise<OrderDocumentSource | null> {
    const row = await this.db.query.order.findFirst({ where: eq(orderTable.id, orderId) });
    if (!row) {
      return null;
    }
    const lines = await this.db.select().from(orderLine).where(eq(orderLine.orderId, orderId));
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      customerId: row.customerId,
      status: row.status,
      currency: currency(row.currency),
      totalMinor: row.totalMinor,
      confirmedAt: row.confirmedAt,
      createdAt: row.createdAt,
      lines: lines.map((line) => ({
        variantId: line.variantId,
        productTitle: line.productTitleSnapshot,
        sku: line.skuSnapshot,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: line.lineTotalMinor,
        supplierCostSnapshotMinor: line.supplierCostSnapshotMinor,
      })),
    };
  }

  public async getPeriodAggregates(input: { period: string; currency: Currency }): Promise<PeriodAggregate> {
    const bounds = parseArgentinaMonthPeriod(input.period);
    if (!bounds) {
      return zeroAggregate(input.period, input.currency);
    }
    const orderRows = await this.db
      .select({
        id: orderTable.id,
        totalMinor: orderTable.totalMinor,
      })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.currency, input.currency),
          inArray(orderTable.status, validFinanceStatuses),
          gte(sql`coalesce(${orderTable.confirmedAt}, ${orderTable.createdAt})`, bounds.from),
          lt(sql`coalesce(${orderTable.confirmedAt}, ${orderTable.createdAt})`, bounds.to),
        ),
      );
    if (orderRows.length === 0) {
      return zeroAggregate(input.period, input.currency);
    }
    const ids = orderRows.map((row) => row.id);
    const [lineRow] = await this.db
      .select({
        costMinor: sql<number>`coalesce(sum(coalesce(${orderLine.supplierCostSnapshotMinor}, 0) * ${orderLine.quantity}), 0)::int`,
        linesMissingCost: sql<number>`count(*) filter (where ${orderLine.supplierCostSnapshotMinor} is null)::int`,
      })
      .from(orderLine)
      .where(inArray(orderLine.orderId, ids));
    const revenueMinor = orderRows.reduce((sum, row) => sum + row.totalMinor, 0);
    const costMinor = lineRow?.costMinor ?? 0;
    return {
      period: input.period,
      currency: input.currency,
      revenueMinor,
      costMinor,
      marginMinor: revenueMinor - costMinor,
      ordersCount: orderRows.length,
      linesMissingCost: lineRow?.linesMissingCost ?? 0,
    };
  }
}

const zeroAggregate = (period: string, currencyValue: Currency): PeriodAggregate => ({
  period,
  currency: currencyValue,
  revenueMinor: 0,
  costMinor: 0,
  marginMinor: 0,
  ordersCount: 0,
  linesMissingCost: 0,
});

const currency = (value: string): Currency => (value === "USD" ? "USD" : "ARS");
