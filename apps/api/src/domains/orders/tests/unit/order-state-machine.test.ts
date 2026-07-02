import { OrderStatus } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { canTransitionOrder } from "../../domain/order-state-machine.js";

describe("order state machine", () => {
  it("allows the manual order initial transition to CONFIRMED", () => {
    expect(canTransitionOrder({ from: null, to: OrderStatus.CONFIRMED }).ok).toBe(true);
  });

  it("rejects unlisted transitions", () => {
    const result = canTransitionOrder({ from: OrderStatus.DELIVERED, to: OrderStatus.CANCELLED, reason: "late cancel" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toBe("INVALID_ORDER_STATE");
    }
  });

  it("requires a reason for cancellation", () => {
    const result = canTransitionOrder({ from: OrderStatus.CONFIRMED, to: OrderStatus.CANCELLED });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toBe("TRANSITION_REASON_REQUIRED");
    }
  });

  it("requires a shipment before SHIPPED", () => {
    const result = canTransitionOrder({ from: OrderStatus.READY_TO_SHIP, to: OrderStatus.SHIPPED });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toBe("INVALID_ORDER_STATE");
    }
  });
});
