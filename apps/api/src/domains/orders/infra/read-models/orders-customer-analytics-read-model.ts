import { category, order as orderTable, orderLine, product, productVariant } from "@cloudcommerce/database";
import { OrderStatus, type Currency } from "@cloudcommerce/types";
import type {
  CustomerBreakdownSlice,
  CustomerPurchaseHistoryItem,
  CustomerAnalyticsBreakdown,
  CustomerAnalyticsRange,
  SpendingPoint,
} from "@cloudcommerce/types";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { CustomerPurchaseAnalyticsPort, CustomerPurchaseAnalyticsSnapshot } from "../../../customers/application/customer-analytics-port.js";

const validCustomerAnalyticsStatuses = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

type OrderAnalyticsRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalMinor: number;
  confirmedAt: Date | null;
  createdAt: Date;
};

export class OrdersCustomerAnalyticsReadModel implements CustomerPurchaseAnalyticsPort {
  public constructor(private readonly db: Database) {}

  public async getCustomerAnalytics(input: {
    customerId: string;
    range: CustomerAnalyticsRange;
    breakdown: CustomerAnalyticsBreakdown;
    includeSensitiveInvestment: boolean;
  }): Promise<CustomerPurchaseAnalyticsSnapshot> {
    const months = input.range === "3M" ? 3 : input.range === "6M" ? 6 : 12;
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - months + 1);
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
    const orders = await this.db
      .select({
        id: orderTable.id,
        orderNumber: orderTable.orderNumber,
        status: orderTable.status,
        currency: orderTable.currency,
        totalMinor: orderTable.totalMinor,
        confirmedAt: orderTable.confirmedAt,
        createdAt: orderTable.createdAt,
      })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.customerId, input.customerId),
          inArray(orderTable.status, validCustomerAnalyticsStatuses),
          gte(orderTable.createdAt, from),
        ),
      )
      .orderBy(desc(orderTable.createdAt));

    const orderIds = orders.map((row) => row.id);
    const lines = orderIds.length > 0
      ? await this.db
          .select({
            orderId: orderLine.orderId,
            lineTotalMinor: orderLine.lineTotalMinor,
            supplierCostSnapshotMinor: orderLine.supplierCostSnapshotMinor,
            quantity: orderLine.quantity,
            categoryName: category.name,
          })
          .from(orderLine)
          .innerJoin(productVariant, eq(orderLine.variantId, productVariant.id))
          .innerJoin(product, eq(productVariant.productId, product.id))
          .innerJoin(category, eq(product.categoryId, category.id))
          .where(inArray(orderLine.orderId, orderIds))
      : [];

    const currencyValue = currency(orders[0]?.currency ?? "ARS");
    const totalSpentMinor = orders.reduce((sum, order) => sum + order.totalMinor, 0);
    const totalInvestedMinor = lines.reduce((sum, line) => sum + (line.supplierCostSnapshotMinor ?? 0) * line.quantity, 0);
    const spendingSeries = this.buildSpendingSeries(months, orders);
    const purchaseBreakdown = this.buildBreakdown(input.breakdown, lines, totalSpentMinor);
    const purchaseHistory: CustomerPurchaseHistoryItem[] = orders.slice(0, 10).map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.confirmedAt ?? order.createdAt,
      status: order.status,
      total: { amountMinor: order.totalMinor, currency: currency(order.currency) },
    }));
    const zero = { amountMinor: 0, currency: currencyValue };
    const totalSpent = { amountMinor: totalSpentMinor, currency: currencyValue };
    const aov = {
      amountMinor: orders.length === 0 ? 0 : Math.round(totalSpentMinor / orders.length),
      currency: currencyValue,
    };
    const marginMinor = totalSpentMinor - totalInvestedMinor;
    return {
      ordersCount: orders.length,
      totalSpent,
      totalSaved: zero,
      aov,
      lastOrderAt: orders[0]?.createdAt ?? null,
      spendingSeries,
      purchaseBreakdown,
      purchaseHistory,
      totalInvested: input.includeSensitiveInvestment ? { amountMinor: totalInvestedMinor, currency: currencyValue } : null,
      margin: input.includeSensitiveInvestment
        ? { amount: { amountMinor: marginMinor, currency: currencyValue }, pct: totalSpentMinor === 0 ? 0 : marginMinor / totalSpentMinor }
        : null,
    };
  }

  private buildSpendingSeries(months: number, orders: OrderAnalyticsRow[]): SpendingPoint[] {
    const buckets = new Map<string, number>();
    for (const order of orders) {
      const date = order.confirmedAt ?? order.createdAt;
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, (buckets.get(key) ?? 0) + order.totalMinor);
    }
    return Array.from({ length: months }, (_, index) => {
      const date = new Date();
      date.setUTCMonth(date.getUTCMonth() - (months - index - 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      return {
        month: new Intl.DateTimeFormat("es-AR", { month: "short" }).format(date).replace(".", ""),
        amount: buckets.get(key) ?? 0,
      };
    });
  }

  private buildBreakdown(
    breakdown: CustomerAnalyticsBreakdown,
    lines: Array<{ categoryName: string; lineTotalMinor: number }>,
    totalSpentMinor: number,
  ): CustomerBreakdownSlice[] {
    const grouped = new Map<string, { amountMinor: number; count: number }>();
    for (const line of lines) {
      const key = breakdown === "category" ? line.categoryName : "spend";
      const current = grouped.get(key) ?? { amountMinor: 0, count: 0 };
      current.amountMinor += line.lineTotalMinor;
      current.count += 1;
      grouped.set(key, current);
    }
    return [...grouped.entries()].map(([key, value]) => ({
      key,
      label: key,
      value: value.amountMinor,
      amountMinor: value.amountMinor,
      count: value.count,
      pct: totalSpentMinor === 0 ? 0 : value.amountMinor / totalSpentMinor,
    }));
  }
}

const currency = (value: string): Currency => (value === "USD" ? "USD" : "ARS");
