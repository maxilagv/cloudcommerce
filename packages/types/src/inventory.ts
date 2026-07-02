import type { ReservationStatus, StockMovementType, StockStatus } from "./enums.js";

export type StockItemResponse = {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number | null;
  status: StockStatus;
  updatedAt: Date;
};

export type StockReservationResponse = {
  id: string;
  variantId: string;
  orderId: string | null;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
};

export type StockMovementResponse = {
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
