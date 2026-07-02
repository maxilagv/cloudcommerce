import { stockItem } from "@cloudcommerce/database";
import { and, asc, lte, or, sql } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { DashboardInventoryPort, LowStockRow } from "../../application/ports.js";

export class DashboardInventoryReadModel implements DashboardInventoryPort {
  public constructor(private readonly db: Database) {}

  public async countLowStock(threshold: "reorder_point" | "zero"): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockItem)
      .where(lowStockCondition(threshold));
    return row?.count ?? 0;
  }

  public async listLowStock(input: { limit: number; threshold: "reorder_point" | "zero" }): Promise<LowStockRow[]> {
    const available = availableExpression();
    const rows = await this.db
      .select({
        variantId: stockItem.variantId,
        available,
        reorderPoint: stockItem.reorderPoint,
      })
      .from(stockItem)
      .where(lowStockCondition(input.threshold))
      .orderBy(asc(available), asc(stockItem.variantId))
      .limit(input.limit);
    return rows.map((row) => ({
      variantId: row.variantId,
      available: row.available,
      reorderPoint: row.reorderPoint,
    }));
  }
}

const availableExpression = () => sql<number>`(${stockItem.onHand} - ${stockItem.reserved})::int`;

const lowStockCondition = (threshold: "reorder_point" | "zero") => {
  const available = availableExpression();
  if (threshold === "zero") {
    return lte(available, 0);
  }
  return or(lte(available, 0), and(sql`${stockItem.reorderPoint} is not null`, lte(available, stockItem.reorderPoint))) ?? sql`false`;
};
