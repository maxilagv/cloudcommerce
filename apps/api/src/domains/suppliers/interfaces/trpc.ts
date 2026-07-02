import {
  ConfigureFeedSchema,
  CreateSupplierSchema,
  GetSupplierSchema,
  LinkSupplierProductSchema,
  ListFeedsSchema,
  ListOrderRefsSchema,
  ListSupplierMapSchema,
  ListSuppliersSchema,
  RetryForwardSchema,
  RunFeedSchema,
  SetSupplierActiveSchema,
  SetSupplierApiConfigSchema,
  UpdateSupplierSchema,
} from "@cloudcommerce/validators";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import type { SupplierDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, supplierErrorToAppError } from "../../../shared/errors/http-error.js";

const throwSupplier = (error: SupplierDomainError): never => {
  throw appErrorToTrpcError(supplierErrorToAppError(error));
};

export const suppliersRouter = router({
  list: adminProcedure.input(ListSuppliersSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.suppliers.listSuppliers(ctx.actor, input);
    if (!result.ok) return throwSupplier(result.error);
    return result.value;
  }),

  get: adminProcedure.input(GetSupplierSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.suppliers.getSupplier(ctx.actor, input);
    if (!result.ok) return throwSupplier(result.error);
    return result.value;
  }),

  create: adminProcedure.input(CreateSupplierSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.suppliers.createSupplier(ctx.actor, input);
    if (!result.ok) return throwSupplier(result.error);
    return result.value;
  }),

  update: adminProcedure.input(UpdateSupplierSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.suppliers.updateSupplier(ctx.actor, input);
    if (!result.ok) return throwSupplier(result.error);
    return result.value;
  }),

  setActive: adminProcedure.input(SetSupplierActiveSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.suppliers.setActive(ctx.actor, input);
    if (!result.ok) return throwSupplier(result.error);
    return result.value;
  }),

  setApiConfig: adminProcedure.input(SetSupplierApiConfigSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.suppliers.setApiConfig(ctx.actor, input);
    if (!result.ok) return throwSupplier(result.error);
    return result.value;
  }),

  feeds: router({
    list: adminProcedure.input(ListFeedsSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.suppliers.listFeeds(ctx.actor, input);
      if (!result.ok) return throwSupplier(result.error);
      return result.value;
    }),

    configure: adminProcedure.input(ConfigureFeedSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.suppliers.configureFeed(ctx.actor, input);
      if (!result.ok) return throwSupplier(result.error);
      return result.value;
    }),

    run: adminProcedure.input(RunFeedSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.suppliers.runFeedImport(ctx.actor, input);
      if (!result.ok) return throwSupplier(result.error);
      return result.value;
    }),
  }),

  map: router({
    list: adminProcedure.input(ListSupplierMapSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.suppliers.listMap(ctx.actor, input);
      if (!result.ok) return throwSupplier(result.error);
      return result.value;
    }),

    link: adminProcedure.input(LinkSupplierProductSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.suppliers.linkProduct(ctx.actor, input);
      if (!result.ok) return throwSupplier(result.error);
      return result.value;
    }),
  }),

  orders: router({
    refs: adminProcedure.input(ListOrderRefsSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.suppliers.listOrderRefs(ctx.actor, input);
      if (!result.ok) return throwSupplier(result.error);
      return result.value;
    }),

    retryForward: adminProcedure.input(RetryForwardSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.suppliers.retryForward(ctx.actor, input);
      if (!result.ok) return throwSupplier(result.error);
      return result.value;
    }),
  }),
});
