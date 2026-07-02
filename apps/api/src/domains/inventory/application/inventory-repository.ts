import type { ReservationStatus, StockMovementType } from "@cloudcommerce/types";

export type RequestAuditContext = {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  reason?: string | null;
};

export type StockItemEntity = {
  id: string;
  variantId: string;
  onHand: number;
  reserved: number;
  reorderPoint: number | null;
  updatedAt: Date;
};

export type StockReservationEntity = {
  id: string;
  variantId: string;
  orderId: string | null;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
};

export type StockMovementEntity = {
  id: string;
  variantId: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdBy: string | null;
  createdAt: Date;
};

export type ReserveStockRecord = {
  items: Array<{ variantId: string; quantity: number }>;
  ttlSeconds: number;
  orderId: string | null;
  reason: string;
  createdBy: string | null;
};

export type AdjustStockRecord = {
  variantId: string;
  delta: number;
  reason: string;
  refType: string | null;
  refId: string | null;
  createdBy: string | null;
};

export type ImportStockRecord = {
  variantId: string;
  quantity: number;
  reason: string;
  refType: string;
  refId: string | null;
  reorderPoint: number | null;
  createdBy: string | null;
};

export interface InventoryRepository {
  findVariantById(variantId: string): Promise<string | null>;
  findPrimaryVariantByProductId(productId: string): Promise<string | null>;
  findStockItemByVariantId(variantId: string): Promise<StockItemEntity | null>;
  listMovements(input: { variantId?: string; limit: number; cursor?: string }): Promise<StockMovementEntity[]>;
  listReservations(input: { variantId?: string; activeOnly: boolean; limit: number; cursor?: string }): Promise<StockReservationEntity[]>;
  reserveStock(input: ReserveStockRecord): Promise<{ reservations: StockReservationEntity[]; insufficientVariantId: string | null }>;
  confirmReservation(input: { reservationId: string; orderId: string | null; reason: string; actorId: string | null }): Promise<StockReservationEntity | null>;
  releaseReservation(input: { reservationId: string; reason: string; actorId: string | null }): Promise<StockReservationEntity | null>;
  adjustStock(input: AdjustStockRecord, audit: RequestAuditContext): Promise<StockItemEntity | null>;
  importStock(input: ImportStockRecord): Promise<StockItemEntity | null>;
  expireReservations(input: { now: Date; batchSize: number }): Promise<StockReservationEntity[]>;
}
