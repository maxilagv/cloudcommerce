import { AdminRole, ReservationStatus, StockStatus, type Actor } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { InventoryService } from "../../application/inventory-service.js";
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
import { deriveStockStatus } from "../../domain/stock-policy.js";

const variantId = "66666666-6666-4666-8666-666666666661";
const now = new Date("2026-07-01T00:00:00.000Z");

describe("InventoryService", () => {
  it("derives stock status from available quantity", () => {
    expect(deriveStockStatus(10, 2, 3)).toBe(StockStatus.IN_STOCK);
    expect(deriveStockStatus(5, 5, 5)).toBe(StockStatus.SOON);
    expect(deriveStockStatus(0, 0, null)).toBe(StockStatus.OUT_OF_STOCK);
  });

  it("requires a reason for admin stock adjustments", async () => {
    const service = new InventoryService(new FakeInventoryRepository());
    const result = await service.adjustStock(
      admin(AdminRole.ADMIN),
      { variantId, delta: 1, reason: "  ", refType: null, refId: null },
      requestContext,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("STOCK_ADJUSTMENT_REASON_REQUIRED");
    }
  });

  it("rejects stock adjustments from SUPPORT", async () => {
    const service = new InventoryService(new FakeInventoryRepository());
    const result = await service.adjustStock(
      admin(AdminRole.SUPPORT),
      { variantId, delta: 1, reason: "correccion manual", refType: null, refId: null },
      requestContext,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("FORBIDDEN");
    }
  });

  it("reports insufficient stock for reservations", async () => {
    const service = new InventoryService(new FakeInventoryRepository({ insufficientVariantId: variantId }));
    const result = await service.reserveStock(systemActor, {
      items: [{ variantId, quantity: 3 }],
      ttlSeconds: 900,
      orderId: null,
      reason: "checkout reservation",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INSUFFICIENT_STOCK");
    }
  });

  it("expires reservations and reports the processed count", async () => {
    const service = new InventoryService(new FakeInventoryRepository());
    const result = await service.expireReservations({ now, batchSize: 100 });

    expect(result).toEqual({ ok: true, value: { expired: 1 } });
  });
});

const admin = (role: AdminRole): Actor => ({
  kind: "admin",
  userId: "admin-user",
  role,
  sessionId: "session",
});

const systemActor: Actor = { kind: "system", service: "orders" };

const requestContext = {
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "request-id",
};

class FakeInventoryRepository implements InventoryRepository {
  public constructor(private readonly options: { insufficientVariantId?: string } = {}) {}

  public async findVariantById(id: string): Promise<string | null> {
    return id === variantId ? id : null;
  }

  public async findPrimaryVariantByProductId(): Promise<string | null> {
    return variantId;
  }

  public async findStockItemByVariantId(id: string): Promise<StockItemEntity | null> {
    return id === variantId ? stockItem : null;
  }

  public async listMovements(): Promise<StockMovementEntity[]> {
    return [];
  }

  public async listReservations(): Promise<StockReservationEntity[]> {
    return [];
  }

  public async reserveStock(_input: ReserveStockRecord): Promise<{ reservations: StockReservationEntity[]; insufficientVariantId: string | null }> {
    if (this.options.insufficientVariantId) {
      return { reservations: [], insufficientVariantId: this.options.insufficientVariantId };
    }
    return { reservations: [reservation], insufficientVariantId: null };
  }

  public async confirmReservation(): Promise<StockReservationEntity | null> {
    return reservation;
  }

  public async releaseReservation(): Promise<StockReservationEntity | null> {
    return reservation;
  }

  public async adjustStock(_input: AdjustStockRecord, _audit: RequestAuditContext): Promise<StockItemEntity | null> {
    return stockItem;
  }

  public async importStock(_input: ImportStockRecord): Promise<StockItemEntity | null> {
    return stockItem;
  }

  public async expireReservations(): Promise<StockReservationEntity[]> {
    return [{ ...reservation, status: ReservationStatus.EXPIRED }];
  }
}

const stockItem: StockItemEntity = {
  id: "99999999-9999-4999-8999-999999999991",
  variantId,
  onHand: 10,
  reserved: 2,
  reorderPoint: 3,
  updatedAt: now,
};

const reservation: StockReservationEntity = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  variantId,
  orderId: null,
  quantity: 1,
  status: ReservationStatus.ACTIVE,
  expiresAt: now,
  createdAt: now,
};
