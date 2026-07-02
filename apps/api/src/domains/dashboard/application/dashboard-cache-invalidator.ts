import type { InMemoryEventBus } from "../../../shared/events/event-bus.js";
import { dashboardInvalidationPrefixes } from "../domain/cache-policy.js";
import type { DashboardCachePort } from "./ports.js";

const orderEvents = ["OrderCreated", "OrderConfirmed", "OrderStatusChanged", "OrderCancelled", "ShipmentStatusChanged"] as const;
const financeEvents = ["DocumentGenerated", "PriceChanged"] as const;
const catalogEvents = ["catalog.product_published", "ProductPublished", "ProductArchived"] as const;
const customerEvents = ["CustomerCreated", "CustomerDeactivated"] as const;
const stockEvents = ["StockReserved", "StockReleased", "StockReservationExpired"] as const;

export class DashboardCacheInvalidator {
  public constructor(private readonly cache: DashboardCachePort) {}

  public register(eventBus: InMemoryEventBus): void {
    this.subscribe(eventBus, orderEvents, dashboardInvalidationPrefixes.ordersChanged);
    this.subscribe(eventBus, financeEvents, dashboardInvalidationPrefixes.financeChanged);
    this.subscribe(eventBus, catalogEvents, dashboardInvalidationPrefixes.catalogChanged);
    this.subscribe(eventBus, customerEvents, dashboardInvalidationPrefixes.customersChanged);
    this.subscribe(eventBus, stockEvents, dashboardInvalidationPrefixes.stockChanged);
  }

  private subscribe(eventBus: InMemoryEventBus, events: readonly string[], prefixes: readonly string[]): void {
    for (const eventType of events) {
      eventBus.subscribe(eventType, async () => {
        await this.cache.invalidatePrefixes(prefixes);
      });
    }
  }
}
