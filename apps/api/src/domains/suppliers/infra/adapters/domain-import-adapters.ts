import { ShipmentStatus, type Actor } from "@cloudcommerce/types";
import type { InventoryService } from "../../../inventory/application/inventory-service.js";
import type { PricingService } from "../../../pricing/application/pricing-service.js";
import type { OrderService } from "../../../orders/application/order-service.js";
import type { InventoryImportPort, OrdersIntegrationPort, PricingImportPort } from "../../application/ports.js";
import type { OrdersForwardReadModel } from "../read-models/orders-forward-read-model.js";

const systemActor: Actor = { kind: "system", service: "supplier-import" };

const systemContext = {
  ip: "internal",
  userAgent: "supplier-import",
  requestId: "supplier-import",
};

/** El import delega el costo a pricing: este módulo no fija PVP. */
export class PricingImportAdapter implements PricingImportPort {
  public constructor(private readonly pricing: PricingService) {}

  public async applySupplierCost(input: { variantId: string; supplierId: string; costAmountMinor: number }): Promise<boolean> {
    const result = await this.pricing.setSupplierCost(
      systemActor,
      {
        variantId: input.variantId,
        supplierId: input.supplierId,
        costAmountMinor: input.costAmountMinor,
        currency: "ARS",
        validFrom: new Date(),
      },
      systemContext,
    );
    return result.ok;
  }
}

/** El import delega el stock a inventory: emite el DELTA real, nunca pisa el saldo. */
export class InventoryImportAdapter implements InventoryImportPort {
  public constructor(private readonly inventory: InventoryService) {}

  public async applyStockLevel(input: { variantId: string; stock: number; reason: string; refId: string }): Promise<boolean> {
    const current = await this.inventory.getStockItem(systemActor, { variantId: input.variantId });
    const onHand = current.ok ? current.value.onHand : 0;
    const delta = input.stock - onHand;
    if (delta === 0) {
      return true;
    }
    const result = await this.inventory.adjustStock(
      systemActor,
      {
        variantId: input.variantId,
        delta,
        reason: input.reason,
        refType: "supplier_feed",
        refId: input.refId,
      },
      systemContext,
    );
    return result.ok;
  }
}

export class OrdersIntegrationAdapter implements OrdersIntegrationPort {
  public constructor(
    private readonly readModel: OrdersForwardReadModel,
    private readonly orders: OrderService,
  ) {}

  public async getForwardableOrder(orderId: string): ReturnType<OrdersIntegrationPort["getForwardableOrder"]> {
    return this.readModel.getForwardableOrder(orderId);
  }

  public async applyShipmentUpdate(input: {
    orderId: string;
    status: "PREPARED" | "DISPATCHED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "DELAYED" | "FAILED_ATTEMPT";
    carrier: string | null;
    trackingCode: string | null;
    description: string | null;
    occurredAt: Date;
  }): Promise<boolean> {
    const result = await this.orders.applySupplierShipmentUpdate({ kind: "system", service: "supplier-fulfillment" }, {
      orderId: input.orderId,
      status: ShipmentStatus[input.status],
      carrier: input.carrier,
      trackingCode: input.trackingCode,
      description: input.description,
      occurredAt: input.occurredAt,
    });
    return result.ok;
  }
}
