import {
  ReservationStatus,
  type Actor,
  type StockItemResponse,
  type StockMovementResponse,
  type StockReservationResponse,
} from "@cloudcommerce/types";
import type {
  AdjustStockInput,
  ConfirmReservationInput,
  ExpireReservationsInput,
  ImportStockInput,
  ListStockMovementsInput,
  ListStockReservationsInput,
  ReleaseReservationInput,
  ReserveStockInput,
  VariantInventoryInput,
} from "@cloudcommerce/validators";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { InventoryDomainError } from "../../../shared/errors/domain-error.js";
import type { InMemoryEventBus } from "../../../shared/events/event-bus.js";
import { v7 as uuidv7 } from "uuid";
import { canManageInventory, canReadInventory, canUseReservationWorkflow } from "../domain/inventory-permissions.js";
import { assertStockAdjustmentReason, deriveStockStatus } from "../domain/stock-policy.js";
import type {
  InventoryRepository,
  StockItemEntity,
  StockMovementEntity,
  StockReservationEntity,
} from "./inventory-repository.js";

type RequestContext = {
  ip: string;
  userAgent: string;
  requestId: string;
  reason?: string | null;
};

export class InventoryService {
  public constructor(
    private readonly repository: InventoryRepository,
    private readonly eventBus?: InMemoryEventBus,
  ) {}

  public async getStockItem(actor: Actor, input: VariantInventoryInput): Promise<Result<StockItemResponse, InventoryDomainError>> {
    if (!canReadInventory(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const item = await this.repository.findStockItemByVariantId(input.variantId);
    if (!item) {
      return err({ type: "STOCK_ITEM_NOT_FOUND" });
    }
    return ok(this.presentStockItem(item));
  }

  public async getCatalogStockStatusByProductId(productId: string) {
    const variantId = await this.repository.findPrimaryVariantByProductId(productId);
    if (!variantId) {
      return ok(deriveStockStatus(0, 0, null));
    }
    const item = await this.repository.findStockItemByVariantId(variantId);
    if (!item) {
      return ok(deriveStockStatus(0, 0, null));
    }
    return ok(deriveStockStatus(item.onHand, item.reserved, item.reorderPoint));
  }

  public async listMovements(actor: Actor, input: ListStockMovementsInput): Promise<Result<StockMovementResponse[], InventoryDomainError>> {
    if (!canReadInventory(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const query: { variantId?: string; limit: number; cursor?: string } = { limit: input.limit };
    if (input.variantId !== undefined) query.variantId = input.variantId;
    if (input.cursor !== undefined) query.cursor = input.cursor;
    const movements = await this.repository.listMovements(query);
    return ok(movements.map((movement) => this.presentMovement(movement)));
  }

  public async listReservations(actor: Actor, input: ListStockReservationsInput): Promise<Result<StockReservationResponse[], InventoryDomainError>> {
    if (!canReadInventory(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const query: { variantId?: string; activeOnly: boolean; limit: number; cursor?: string } = {
      activeOnly: input.activeOnly,
      limit: input.limit,
    };
    if (input.variantId !== undefined) query.variantId = input.variantId;
    if (input.cursor !== undefined) query.cursor = input.cursor;
    const reservations = await this.repository.listReservations(query);
    return ok(reservations.map((reservation) => this.presentReservation(reservation)));
  }

  public async reserveStock(actor: Actor, input: ReserveStockInput): Promise<Result<StockReservationResponse[], InventoryDomainError>> {
    if (!canUseReservationWorkflow(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    for (const item of input.items) {
      const variant = await this.repository.findVariantById(item.variantId);
      if (!variant) {
        return err({ type: "VARIANT_NOT_FOUND" });
      }
    }
    const result = await this.repository.reserveStock({
      items: input.items,
      ttlSeconds: input.ttlSeconds,
      orderId: input.orderId ?? null,
      reason: input.reason,
      createdBy: actor.kind === "admin" ? actor.userId : null,
    });
    if (result.insufficientVariantId) {
      return err({ type: "INSUFFICIENT_STOCK", variantId: result.insufficientVariantId });
    }
    await Promise.all(result.reservations.map((reservation) => this.publishStockEvent("StockReserved", reservation.variantId, {
      variantId: reservation.variantId,
      orderId: reservation.orderId,
      quantity: reservation.quantity,
    })));
    return ok(result.reservations.map((reservation) => this.presentReservation(reservation)));
  }

  public async confirmReservation(
    actor: Actor,
    input: ConfirmReservationInput,
  ): Promise<Result<StockReservationResponse, InventoryDomainError>> {
    if (!canUseReservationWorkflow(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const reservation = await this.repository.confirmReservation({
      reservationId: input.reservationId,
      orderId: input.orderId ?? null,
      reason: input.reason,
      actorId: actor.kind === "admin" ? actor.userId : null,
    });
    if (!reservation) {
      return err({ type: "RESERVATION_NOT_FOUND" });
    }
    await this.publishStockEvent("StockReleased", reservation.variantId, {
      variantId: reservation.variantId,
      orderId: reservation.orderId,
      quantity: reservation.quantity,
    });
    return ok(this.presentReservation(reservation));
  }

  public async releaseReservation(
    actor: Actor,
    input: ReleaseReservationInput,
  ): Promise<Result<StockReservationResponse, InventoryDomainError>> {
    if (!canUseReservationWorkflow(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const reservation = await this.repository.releaseReservation({
      reservationId: input.reservationId,
      reason: input.reason,
      actorId: actor.kind === "admin" ? actor.userId : null,
    });
    if (!reservation) {
      return err({ type: "RESERVATION_NOT_FOUND" });
    }
    return ok(this.presentReservation(reservation));
  }

  public async adjustStock(
    actor: Actor,
    input: AdjustStockInput,
    context: RequestContext,
  ): Promise<Result<StockItemResponse, InventoryDomainError>> {
    if (!canManageInventory(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (!assertStockAdjustmentReason(input.reason)) {
      return err({ type: "STOCK_ADJUSTMENT_REASON_REQUIRED" });
    }
    const variant = await this.repository.findVariantById(input.variantId);
    if (!variant) {
      return err({ type: "VARIANT_NOT_FOUND" });
    }
    const item = await this.repository.adjustStock(
      {
        variantId: input.variantId,
        delta: input.delta,
        reason: input.reason,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        createdBy: actor.kind === "admin" ? actor.userId : null,
      },
      {
        actorId: actor.kind === "admin" ? actor.userId : null,
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId,
        reason: context.reason ?? input.reason,
      },
    );
    if (!item) {
      return err({ type: "INSUFFICIENT_STOCK", variantId: input.variantId });
    }
    return ok(this.presentStockItem(item));
  }

  public async importStock(actor: Actor, input: ImportStockInput): Promise<Result<StockItemResponse, InventoryDomainError>> {
    if (!canManageInventory(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const variant = await this.repository.findVariantById(input.variantId);
    if (!variant) {
      return err({ type: "VARIANT_NOT_FOUND" });
    }
    const item = await this.repository.importStock({
      variantId: input.variantId,
      quantity: input.quantity,
      reason: input.reason,
      refType: input.refType,
      refId: input.refId ?? null,
      reorderPoint: input.reorderPoint ?? null,
      createdBy: actor.kind === "admin" ? actor.userId : null,
    });
    if (!item) {
      return err({ type: "STOCK_ITEM_NOT_FOUND" });
    }
    return ok(this.presentStockItem(item));
  }

  public async expireReservations(input: ExpireReservationsInput): Promise<Result<{ expired: number }, InventoryDomainError>> {
    const expired = await this.repository.expireReservations(input);
    await Promise.all(expired.map((reservation) => this.publishStockEvent("StockReservationExpired", reservation.variantId, {
      variantId: reservation.variantId,
      orderId: reservation.orderId,
      quantity: reservation.quantity,
    })));
    return ok({ expired: expired.filter((reservation) => reservation.status === ReservationStatus.EXPIRED).length });
  }

  private async publishStockEvent(type: string, variantId: string, payload: Record<string, unknown>): Promise<void> {
    await this.eventBus?.publish({
      id: uuidv7(),
      type,
      aggregateType: "inventory",
      aggregateId: variantId,
      payload,
      occurredAt: new Date(),
    });
  }

  private presentStockItem(item: StockItemEntity): StockItemResponse {
    const available = item.onHand - item.reserved;
    return {
      variantId: item.variantId,
      onHand: item.onHand,
      reserved: item.reserved,
      available,
      reorderPoint: item.reorderPoint,
      status: deriveStockStatus(item.onHand, item.reserved, item.reorderPoint),
      updatedAt: item.updatedAt,
    };
  }

  private presentReservation(reservation: StockReservationEntity): StockReservationResponse {
    return {
      id: reservation.id,
      variantId: reservation.variantId,
      orderId: reservation.orderId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      createdAt: reservation.createdAt,
    };
  }

  private presentMovement(movement: StockMovementEntity): StockMovementResponse {
    return {
      id: movement.id,
      variantId: movement.variantId,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      refType: movement.refType,
      refId: movement.refId,
      createdBy: movement.createdBy,
      createdAt: movement.createdAt,
    };
  }
}
