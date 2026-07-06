import { OrderStatus } from "@cloudcommerce/types";
import type { InMemoryEventBus } from "../../../shared/events/event-bus.js";
import type { LoyaltyService } from "./loyalty-service.js";

type MinimalLogger = {
  error: (payload: Record<string, unknown>, message?: string) => void;
};

/**
 * Conecta el ciclo de vida de las órdenes con CloudPoints:
 * - `OrderStatusChanged` → DELIVERED acredita puntos (idempotente por orden).
 * - `OrderCancelled` → contra-asiento del EARN si existía (idempotente).
 *
 * Los errores se registran pero NUNCA se propagan: la fidelización jamás
 * puede romper el flujo de órdenes.
 */
export class LoyaltyEventSubscriber {
  public constructor(
    private readonly loyalty: LoyaltyService,
    private readonly logger?: MinimalLogger,
  ) {}

  public register(eventBus: InMemoryEventBus): void {
    eventBus.subscribe("OrderStatusChanged", async (event) => {
      if (event.payload.toStatus !== OrderStatus.DELIVERED) {
        return;
      }
      await this.safely("earn", String(event.payload.orderId), () =>
        this.loyalty.handleOrderDelivered(String(event.payload.orderId)),
      );
    });

    eventBus.subscribe("OrderCancelled", async (event) => {
      await this.safely("reversal", String(event.payload.orderId), () =>
        this.loyalty.handleOrderCancelled(String(event.payload.orderId)),
      );
    });
  }

  private async safely(operation: string, orderId: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger?.error(
        { err: error, orderId, operation },
        `loyalty subscriber failed (${operation})`,
      );
    }
  }
}
