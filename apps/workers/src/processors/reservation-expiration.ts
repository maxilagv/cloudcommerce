import * as schema from "@cloudcommerce/database";
import { outboxEvent, stockItem, stockMovement, stockReservation } from "@cloudcommerce/database";
import { ReservationStatus, StockMovementType } from "@cloudcommerce/types";
import { and, asc, eq, lt, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import pino from "pino";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RESERVATION_EXPIRATION_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
});

const env = envSchema.parse(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const sql = postgres(env.DATABASE_URL, { max: 2, prepare: false });
const db = drizzle(sql, { schema });

export async function processExpiredReservationsBatch(batchSize = env.RESERVATION_EXPIRATION_BATCH_SIZE): Promise<void> {
  const now = new Date();
  const expired = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(stockReservation)
      .where(and(eq(stockReservation.status, ReservationStatus.ACTIVE), lt(stockReservation.expiresAt, now)))
      .orderBy(asc(stockReservation.expiresAt))
      .limit(batchSize);

    let processed = 0;
    for (const row of rows) {
      const [updatedReservation] = await tx
        .update(stockReservation)
        .set({ status: ReservationStatus.EXPIRED })
        .where(and(eq(stockReservation.id, row.id), eq(stockReservation.status, ReservationStatus.ACTIVE)))
        .returning();
      if (!updatedReservation) {
        continue;
      }
      await tx
        .update(stockItem)
        .set({ reserved: drizzleSql`${stockItem.reserved} - ${row.quantity}`, updatedAt: new Date() })
        .where(and(eq(stockItem.variantId, row.variantId), drizzleSql`${stockItem.reserved} >= ${row.quantity}`));
      await tx.insert(stockMovement).values({
        id: uuidv7(),
        variantId: row.variantId,
        type: StockMovementType.RELEASE,
        quantity: -row.quantity,
        reason: "Reservation expired",
        refType: "stock_reservation",
        refId: row.id,
        createdBy: null,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "inventory",
        aggregateId: row.id,
        eventType: "StockReservationExpired",
        payload: { reservationId: row.id, variantId: row.variantId },
      });
      processed += 1;
    }
    return processed;
  });

  if (expired > 0) {
    logger.info({ expired }, "Expired stock reservations");
  }
}
