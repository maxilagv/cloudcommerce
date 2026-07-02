import {
  AdjustStockInputSchema,
  ConfirmReservationInputSchema,
  ImportStockInputSchema,
  ListStockMovementsInputSchema,
  ListStockReservationsInputSchema,
  ReleaseReservationInputSchema,
  ReserveStockInputSchema,
  VariantInventoryInputSchema,
} from "@cloudcommerce/validators";
import type { InventoryDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, inventoryErrorToAppError } from "../../../shared/errors/http-error.js";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";

const throwInventory = (error: InventoryDomainError): never => {
  throw appErrorToTrpcError(inventoryErrorToAppError(error));
};

const requestContext = (ctx: { ip: string; userAgent: string; requestId: string }) => ({
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
});

export const inventoryRouter = router({
  getStockItem: adminProcedure.input(VariantInventoryInputSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.inventory.getStockItem(ctx.actor, input);
    if (!result.ok) {
      return throwInventory(result.error);
    }
    return result.value;
  }),

  movements: adminProcedure.input(ListStockMovementsInputSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.inventory.listMovements(ctx.actor, input);
    if (!result.ok) {
      return throwInventory(result.error);
    }
    return result.value;
  }),

  reservations: adminProcedure.input(ListStockReservationsInputSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.inventory.listReservations(ctx.actor, input);
    if (!result.ok) {
      return throwInventory(result.error);
    }
    return result.value;
  }),

  reserve: adminProcedure.input(ReserveStockInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.inventory.reserveStock(ctx.actor, input);
    if (!result.ok) {
      return throwInventory(result.error);
    }
    return result.value;
  }),

  confirmReservation: adminProcedure.input(ConfirmReservationInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.inventory.confirmReservation(ctx.actor, input);
    if (!result.ok) {
      return throwInventory(result.error);
    }
    return result.value;
  }),

  releaseReservation: adminProcedure.input(ReleaseReservationInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.inventory.releaseReservation(ctx.actor, input);
    if (!result.ok) {
      return throwInventory(result.error);
    }
    return result.value;
  }),

  adjustStock: adminProcedure.input(AdjustStockInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.inventory.adjustStock(ctx.actor, input, requestContext(ctx));
    if (!result.ok) {
      return throwInventory(result.error);
    }
    return result.value;
  }),

  importStock: adminProcedure.input(ImportStockInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.inventory.importStock(ctx.actor, input);
    if (!result.ok) {
      return throwInventory(result.error);
    }
    return result.value;
  }),
});
