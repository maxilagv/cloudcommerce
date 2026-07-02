import { OrderStatus } from "@cloudcommerce/types";

export type OrderStateFailure = "INVALID_ORDER_STATE" | "TRANSITION_REASON_REQUIRED";

export type OrderTransitionInput = {
  from: OrderStatus | null;
  to: OrderStatus;
  reason?: string | null;
  hasShipment?: boolean;
};

const transitionEntries: Array<[OrderStatus | "initial", ReadonlySet<OrderStatus>]> = [
  ["initial", statusSet(OrderStatus.DRAFT, OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED)],
  [OrderStatus.DRAFT, statusSet(OrderStatus.PENDING_CONFIRMATION, OrderStatus.CANCELLED)],
  [OrderStatus.PENDING_CONFIRMATION, statusSet(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)],
  [OrderStatus.CONFIRMED, statusSet(OrderStatus.PREPARING, OrderStatus.CANCELLED)],
  [OrderStatus.PREPARING, statusSet(OrderStatus.READY_TO_SHIP, OrderStatus.CANCELLED)],
  [OrderStatus.READY_TO_SHIP, statusSet(OrderStatus.SHIPPED)],
  [OrderStatus.SHIPPED, statusSet(OrderStatus.DELIVERED, OrderStatus.RETURN_REQUESTED)],
  [OrderStatus.RETURN_REQUESTED, statusSet(OrderStatus.RETURNED)],
];

const allowedTransitions: ReadonlyMap<OrderStatus | "initial", ReadonlySet<OrderStatus>> = new Map(transitionEntries);

export const canTransitionOrder = (input: OrderTransitionInput): { ok: true } | { ok: false; failure: OrderStateFailure } => {
  const current = input.from ?? "initial";
  const allowed = allowedTransitions.get(current);
  if (!allowed?.has(input.to)) {
    return { ok: false, failure: "INVALID_ORDER_STATE" };
  }
  if (requiresTransitionReason(input.from, input.to) && !input.reason?.trim()) {
    return { ok: false, failure: "TRANSITION_REASON_REQUIRED" };
  }
  if (input.to === OrderStatus.SHIPPED && input.hasShipment !== true) {
    return { ok: false, failure: "INVALID_ORDER_STATE" };
  }
  return { ok: true };
};

export const requiresTransitionReason = (from: OrderStatus | null, to: OrderStatus): boolean => {
  if (to === OrderStatus.CANCELLED || to === OrderStatus.RETURN_REQUESTED || to === OrderStatus.RETURNED) {
    return true;
  }
  return from === OrderStatus.SHIPPED && to !== OrderStatus.DELIVERED;
};

export const isOrderTerminal = (status: OrderStatus): boolean =>
  [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.RETURNED].includes(status);

export const isOrderConfirmedOrLater = (status: OrderStatus): boolean =>
  [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY_TO_SHIP,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.RETURN_REQUESTED,
    OrderStatus.RETURNED,
  ].includes(status);

function statusSet(...statuses: OrderStatus[]): ReadonlySet<OrderStatus> {
  return new Set(statuses);
}
