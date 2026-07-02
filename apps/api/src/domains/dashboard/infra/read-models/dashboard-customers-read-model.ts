import { customer } from "@cloudcommerce/database";
import { and, desc, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { CustomerLabel, DashboardCustomersPort, DashboardPeriod, RecentCustomerRow } from "../../application/ports.js";

export class DashboardCustomersReadModel implements DashboardCustomersPort {
  public constructor(private readonly db: Database) {}

  public async countNewCustomers(period: DashboardPeriod): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(customer)
      .where(and(isNull(customer.deletedAt), gte(customer.createdAt, period.from), lt(customer.createdAt, period.to)));
    return row?.count ?? 0;
  }

  public async getCustomerLabels(customerIds: string[], includePii: boolean): Promise<CustomerLabel[]> {
    if (customerIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({
        customerId: customer.id,
        displayName: customer.displayName,
      })
      .from(customer)
      .where(inArray(customer.id, customerIds));
    return rows.map((row) => ({
      customerId: row.customerId,
      displayName: includePii ? row.displayName : anonymized(row.displayName),
      isAnonymized: !includePii,
    }));
  }

  public async getRecentCustomers(input: { limit: number; includePii: boolean }): Promise<RecentCustomerRow[]> {
    const rows = await this.db
      .select({
        customerId: customer.id,
        displayName: customer.displayName,
        createdAt: customer.createdAt,
      })
      .from(customer)
      .where(isNull(customer.deletedAt))
      .orderBy(desc(customer.createdAt), desc(customer.id))
      .limit(input.limit);
    return rows.map((row) => ({
      customerId: row.customerId,
      displayName: input.includePii ? row.displayName : anonymized(row.displayName),
      isAnonymized: !input.includePii,
      createdAt: row.createdAt,
    }));
  }
}

const anonymized = (displayName: string): string => {
  const initials = displayName
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials.length > 0 ? initials : "Cliente";
};
