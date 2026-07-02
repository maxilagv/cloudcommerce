import {
  CancelOrderSchema,
  CreateManualOrderSchema,
  CreateShipmentSchema,
  GetOrderSchema,
  ListOrdersSchema,
  RefreshTrackingSchema,
  TransitionOrderSchema,
} from "@cloudcommerce/validators";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import type { OrderDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, orderErrorToAppError } from "../../../shared/errors/http-error.js";

const throwOrder = (error: OrderDomainError): never => {
  throw appErrorToTrpcError(orderErrorToAppError(error));
};

const requestContext = (
  ctx: { ip: string; userAgent: string; requestId: string; request: { headers: Record<string, unknown> } },
  reason?: string | null,
) => ({
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
  reason: reason ?? null,
  idempotencyKey: readHeader(ctx.request.headers["idempotency-key"]),
});

export const ordersRouter = router({
  createManual: adminProcedure.input(CreateManualOrderSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.orders.createManualOrder(ctx.actor, input, requestContext(ctx));
    if (!result.ok) {
      return throwOrder(result.error);
    }
    return result.value;
  }),

  list: adminProcedure.input(ListOrdersSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.orders.list(ctx.actor, input);
    if (!result.ok) {
      return throwOrder(result.error);
    }
    return result.value;
  }),

  get: adminProcedure.input(GetOrderSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.orders.getDetail(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwOrder(result.error);
    }
    return result.value;
  }),

  transition: adminProcedure.input(TransitionOrderSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.orders.transition(ctx.actor, input);
    if (!result.ok) {
      return throwOrder(result.error);
    }
    return result.value;
  }),

  cancel: adminProcedure.input(CancelOrderSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.orders.cancel(ctx.actor, input);
    if (!result.ok) {
      return throwOrder(result.error);
    }
    return result.value;
  }),

  createShipment: adminProcedure.input(CreateShipmentSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.orders.createShipment(ctx.actor, input);
    if (!result.ok) {
      return throwOrder(result.error);
    }
    return result.value;
  }),

  refreshTracking: adminProcedure.input(RefreshTrackingSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.orders.refreshTracking(ctx.actor, input);
    if (!result.ok) {
      return throwOrder(result.error);
    }
    return result.value;
  }),
});

const readHeader = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim().length > 0) {
    return value[0].trim();
  }
  return null;
};
