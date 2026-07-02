import { StockStatus } from "@cloudcommerce/types";

export const deriveStockStatus = (onHand: number, reserved: number, reorderPoint: number | null): StockStatus => {
  const available = onHand - reserved;
  if (available > 0) {
    return StockStatus.IN_STOCK;
  }
  if (available === 0 && reorderPoint !== null && onHand <= reorderPoint) {
    return StockStatus.SOON;
  }
  return StockStatus.OUT_OF_STOCK;
};

export const assertStockAdjustmentReason = (reason: string): boolean => reason.trim().length >= 3;
