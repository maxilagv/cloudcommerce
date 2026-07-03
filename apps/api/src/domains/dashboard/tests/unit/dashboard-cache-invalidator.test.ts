import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "../../../../shared/events/event-bus.js";
import { DashboardCacheInvalidator } from "../../application/dashboard-cache-invalidator.js";

describe("DashboardCacheInvalidator", () => {
  it.each(["OrderCreated", "PriceChanged", "catalog.product_published", "StockReserved"])(
    "invalidates dashboard cache prefixes for %s",
    async (eventType) => {
      const cache = new FakeDashboardCache();
      const eventBus = new InMemoryEventBus();
      new DashboardCacheInvalidator(cache).register(eventBus);

      await eventBus.publish({
        id: "event-1",
        type: eventType,
        aggregateType: "test",
        aggregateId: "aggregate-1",
        payload: {},
        occurredAt: new Date(),
      });

      expect(cache.invalidated.length).toBeGreaterThan(0);
    },
  );
});

class FakeDashboardCache {
  public invalidated: readonly string[][] = [];

  public async get<T>(): Promise<T | null> {
    return null;
  }

  public async set<T>(): Promise<void> {}

  public async invalidatePrefixes(prefixes: readonly string[]): Promise<void> {
    this.invalidated = [...this.invalidated, [...prefixes]];
  }
}
