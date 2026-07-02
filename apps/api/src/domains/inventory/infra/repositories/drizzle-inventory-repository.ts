import {
  auditLog,
  outboxEvent,
  productVariant,
  stockItem,
  stockMovement,
  stockReservation,
} from "@cloudcommerce/database";
import { ReservationStatus, StockMovementType } from "@cloudcommerce/types";
import { and, asc, desc, eq, lt, sql, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  AdjustStockRecord,
  ImportStockRecord,
  InventoryRepository,
  RequestAuditContext,
  ReserveStockRecord,
  StockItemEntity,
  StockMovementEntity,
  StockReservationEntity,
} from "../../application/inventory-repository.js";

class InsufficientStockError extends Error {
  public constructor(public readonly variantId: string) {
    super("Insufficient stock");
  }
}

export class DrizzleInventoryRepository implements InventoryRepository {
  public constructor(private readonly db: Database) {}

  public async findVariantById(variantId: string): Promise<string | null> {
    const row = await this.db.query.productVariant.findFirst({
      where: eq(productVariant.id, variantId),
      columns: { id: true },
    });
    return row?.id ?? null;
  }

  public async findPrimaryVariantByProductId(productId: string): Promise<string | null> {
    const row = await this.db.query.productVariant.findFirst({
      where: and(eq(productVariant.productId, productId), eq(productVariant.isActive, true)),
      orderBy: [asc(productVariant.position)],
      columns: { id: true },
    });
    return row?.id ?? null;
  }

  public async findStockItemByVariantId(variantId: string): Promise<StockItemEntity | null> {
    const row = await this.db.query.stockItem.findFirst({ where: eq(stockItem.variantId, variantId) });
    return row ? this.mapStockItem(row) : null;
  }

  public async listMovements(input: { variantId?: string; limit: number; cursor?: string }): Promise<StockMovementEntity[]> {
    const conditions: SQL[] = [];
    if (input.variantId) {
      conditions.push(eq(stockMovement.variantId, input.variantId));
    }
    const cursor = this.decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(lt(stockMovement.createdAt, cursor));
    }
    const rows =
      conditions.length > 0
        ? await this.db.select().from(stockMovement).where(and(...conditions)).orderBy(desc(stockMovement.createdAt)).limit(input.limit)
        : await this.db.select().from(stockMovement).orderBy(desc(stockMovement.createdAt)).limit(input.limit);
    return rows.map((row) => this.mapMovement(row));
  }

  public async listReservations(input: {
    variantId?: string;
    activeOnly: boolean;
    limit: number;
    cursor?: string;
  }): Promise<StockReservationEntity[]> {
    const conditions: SQL[] = [];
    if (input.variantId) {
      conditions.push(eq(stockReservation.variantId, input.variantId));
    }
    if (input.activeOnly) {
      conditions.push(eq(stockReservation.status, ReservationStatus.ACTIVE));
    }
    const cursor = this.decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(lt(stockReservation.createdAt, cursor));
    }
    const rows =
      conditions.length > 0
        ? await this.db.select().from(stockReservation).where(and(...conditions)).orderBy(desc(stockReservation.createdAt)).limit(input.limit)
        : await this.db.select().from(stockReservation).orderBy(desc(stockReservation.createdAt)).limit(input.limit);
    return rows.map((row) => this.mapReservation(row));
  }

  public async reserveStock(input: ReserveStockRecord): Promise<{ reservations: StockReservationEntity[]; insufficientVariantId: string | null }> {
    try {
      const reservations = await this.db.transaction(async (tx) => {
        const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);
        const rows: StockReservationEntity[] = [];
        const items = [...input.items].sort((left, right) => left.variantId.localeCompare(right.variantId));
        for (const item of items) {
          const [updated] = await tx
            .update(stockItem)
            .set({
              reserved: sql`${stockItem.reserved} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(stockItem.variantId, item.variantId),
                sql`${stockItem.onHand} - ${stockItem.reserved} >= ${item.quantity}`,
              ),
            )
            .returning();
          if (!updated) {
            throw new InsufficientStockError(item.variantId);
          }
          const [reservation] = await tx
            .insert(stockReservation)
            .values({
              id: uuidv7(),
              variantId: item.variantId,
              orderId: input.orderId,
              quantity: item.quantity,
              status: ReservationStatus.ACTIVE,
              expiresAt,
            })
            .returning();
          if (!reservation) {
            throw new Error("Failed to create stock reservation");
          }
          await tx.insert(stockMovement).values({
            id: uuidv7(),
            variantId: item.variantId,
            type: StockMovementType.RESERVATION,
            quantity: item.quantity,
            reason: input.reason,
            refType: "stock_reservation",
            refId: reservation.id,
            createdBy: input.createdBy,
          });
          rows.push(this.mapReservation(reservation));
        }
        return rows;
      });
      return { reservations, insufficientVariantId: null };
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        return { reservations: [], insufficientVariantId: error.variantId };
      }
      throw error;
    }
  }

  public async confirmReservation(input: {
    reservationId: string;
    orderId: string | null;
    reason: string;
    actorId: string | null;
  }): Promise<StockReservationEntity | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.query.stockReservation.findFirst({ where: eq(stockReservation.id, input.reservationId) });
      if (!row) {
        return null;
      }
      if (row.status !== ReservationStatus.ACTIVE) {
        return this.mapReservation(row);
      }
      if (row.expiresAt <= new Date()) {
        const [expired] = await tx
          .update(stockReservation)
          .set({ status: ReservationStatus.EXPIRED })
          .where(and(eq(stockReservation.id, row.id), eq(stockReservation.status, ReservationStatus.ACTIVE)))
          .returning();
        await tx
          .update(stockItem)
          .set({ reserved: sql`${stockItem.reserved} - ${row.quantity}`, updatedAt: new Date() })
          .where(and(eq(stockItem.variantId, row.variantId), sql`${stockItem.reserved} >= ${row.quantity}`));
        return expired ? this.mapReservation(expired) : this.mapReservation(row);
      }
      const [updatedStock] = await tx
        .update(stockItem)
        .set({
          reserved: sql`${stockItem.reserved} - ${row.quantity}`,
          onHand: sql`${stockItem.onHand} - ${row.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(stockItem.variantId, row.variantId),
            sql`${stockItem.reserved} >= ${row.quantity}`,
            sql`${stockItem.onHand} >= ${row.quantity}`,
          ),
        )
        .returning();
      if (!updatedStock) {
        return null;
      }
      const [confirmed] = await tx
        .update(stockReservation)
        .set({ status: ReservationStatus.CONFIRMED, orderId: input.orderId ?? row.orderId })
        .where(eq(stockReservation.id, row.id))
        .returning();
      await tx.insert(stockMovement).values([
        {
          id: uuidv7(),
          variantId: row.variantId,
          type: StockMovementType.RELEASE,
          quantity: -row.quantity,
          reason: input.reason,
          refType: "stock_reservation",
          refId: row.id,
          createdBy: input.actorId,
        },
        {
          id: uuidv7(),
          variantId: row.variantId,
          type: StockMovementType.SALE,
          quantity: -row.quantity,
          reason: input.reason,
          refType: "stock_reservation",
          refId: row.id,
          createdBy: input.actorId,
        },
      ]);
      return confirmed ? this.mapReservation(confirmed) : null;
    });
  }

  public async releaseReservation(input: {
    reservationId: string;
    reason: string;
    actorId: string | null;
  }): Promise<StockReservationEntity | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.query.stockReservation.findFirst({ where: eq(stockReservation.id, input.reservationId) });
      if (!row) {
        return null;
      }
      if (row.status !== ReservationStatus.ACTIVE) {
        return this.mapReservation(row);
      }
      const [updatedStock] = await tx
        .update(stockItem)
        .set({ reserved: sql`${stockItem.reserved} - ${row.quantity}`, updatedAt: new Date() })
        .where(and(eq(stockItem.variantId, row.variantId), sql`${stockItem.reserved} >= ${row.quantity}`))
        .returning();
      if (!updatedStock) {
        return null;
      }
      const [released] = await tx
        .update(stockReservation)
        .set({ status: ReservationStatus.RELEASED })
        .where(eq(stockReservation.id, row.id))
        .returning();
      await tx.insert(stockMovement).values({
        id: uuidv7(),
        variantId: row.variantId,
        type: StockMovementType.RELEASE,
        quantity: -row.quantity,
        reason: input.reason,
        refType: "stock_reservation",
        refId: row.id,
        createdBy: input.actorId,
      });
      return released ? this.mapReservation(released) : null;
    });
  }

  public async adjustStock(input: AdjustStockRecord, audit: RequestAuditContext): Promise<StockItemEntity | null> {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(stockItem)
        .values({ id: uuidv7(), variantId: input.variantId, onHand: 0, reserved: 0 })
        .onConflictDoNothing({ target: stockItem.variantId });
      const current = await tx.query.stockItem.findFirst({ where: eq(stockItem.variantId, input.variantId) });
      if (!current) {
        return null;
      }
      const nextOnHand = current.onHand + input.delta;
      if (nextOnHand < 0 || nextOnHand < current.reserved) {
        return null;
      }
      const [updated] = await tx
        .update(stockItem)
        .set({ onHand: nextOnHand, updatedAt: new Date() })
        .where(eq(stockItem.variantId, input.variantId))
        .returning();
      if (!updated) {
        return null;
      }
      await tx.insert(stockMovement).values({
        id: uuidv7(),
        variantId: input.variantId,
        type: StockMovementType.ADJUSTMENT,
        quantity: input.delta,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        createdBy: input.createdBy,
      });
      await tx.insert(auditLog).values({
        id: uuidv7(),
        actorId: audit.actorId,
        action: "stock.adjust",
        resourceType: "product_variant",
        resourceId: input.variantId,
        before: { onHand: current.onHand, reserved: current.reserved },
        after: { onHand: updated.onHand, reserved: updated.reserved },
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        reason: audit.reason ?? input.reason,
      });
      return this.mapStockItem(updated);
    });
  }

  public async importStock(input: ImportStockRecord): Promise<StockItemEntity | null> {
    return this.db.transaction(async (tx) => {
      if (input.refId) {
        const existingMovement = await tx.query.stockMovement.findFirst({
          where: and(eq(stockMovement.refType, input.refType), eq(stockMovement.refId, input.refId)),
        });
        if (existingMovement) {
          const existingItem = await tx.query.stockItem.findFirst({ where: eq(stockItem.variantId, input.variantId) });
          return existingItem ? this.mapStockItem(existingItem) : null;
        }
      }
      const [updated] = await tx
        .insert(stockItem)
        .values({
          id: uuidv7(),
          variantId: input.variantId,
          onHand: input.quantity,
          reserved: 0,
          reorderPoint: input.reorderPoint,
        })
        .onConflictDoUpdate({
          target: stockItem.variantId,
          set: {
            onHand: sql`${stockItem.onHand} + ${input.quantity}`,
            reorderPoint: input.reorderPoint,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!updated) {
        return null;
      }
      await tx.insert(stockMovement).values({
        id: uuidv7(),
        variantId: input.variantId,
        type: StockMovementType.IMPORT,
        quantity: input.quantity,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        createdBy: input.createdBy,
      });
      return this.mapStockItem(updated);
    });
  }

  public async expireReservations(input: { now: Date; batchSize: number }): Promise<StockReservationEntity[]> {
    return this.db.transaction(async (tx) => {
      const expiredRows = await tx
        .select()
        .from(stockReservation)
        .where(and(eq(stockReservation.status, ReservationStatus.ACTIVE), lt(stockReservation.expiresAt, input.now)))
        .orderBy(asc(stockReservation.expiresAt))
        .limit(input.batchSize);
      const expired: StockReservationEntity[] = [];
      for (const row of expiredRows) {
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
          .set({ reserved: sql`${stockItem.reserved} - ${row.quantity}`, updatedAt: new Date() })
          .where(and(eq(stockItem.variantId, row.variantId), sql`${stockItem.reserved} >= ${row.quantity}`));
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
        expired.push(this.mapReservation(updatedReservation));
      }
      return expired;
    });
  }

  private decodeCursor(cursor: string | undefined): Date | null {
    if (!cursor) {
      return null;
    }
    const date = new Date(cursor);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private mapStockItem(row: typeof stockItem.$inferSelect): StockItemEntity {
    return {
      id: row.id,
      variantId: row.variantId,
      onHand: row.onHand,
      reserved: row.reserved,
      reorderPoint: row.reorderPoint,
      updatedAt: row.updatedAt,
    };
  }

  private mapReservation(row: typeof stockReservation.$inferSelect): StockReservationEntity {
    return {
      id: row.id,
      variantId: row.variantId,
      orderId: row.orderId,
      quantity: row.quantity,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  private mapMovement(row: typeof stockMovement.$inferSelect): StockMovementEntity {
    return {
      id: row.id,
      variantId: row.variantId,
      type: row.type,
      quantity: row.quantity,
      reason: row.reason,
      refType: row.refType,
      refId: row.refId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }
}
