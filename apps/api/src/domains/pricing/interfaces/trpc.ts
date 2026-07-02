import {
  CreateDiscountInputSchema,
  DeactivateDiscountInputSchema,
  ListDiscountsInputSchema,
  SetManualPriceInputSchema,
  SetMarkupRuleInputSchema,
  SetSupplierCostInputSchema,
  UpsertPriceListInputSchema,
  VariantPricingInputSchema,
} from "@cloudcommerce/validators";
import type { PricingDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, pricingErrorToAppError } from "../../../shared/errors/http-error.js";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";

const throwPricing = (error: PricingDomainError): never => {
  throw appErrorToTrpcError(pricingErrorToAppError(error));
};

const requestContext = (ctx: { ip: string; userAgent: string; requestId: string }) => ({
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
});

export const pricingRouter = router({
  computeSalePrice: adminProcedure.input(VariantPricingInputSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.pricing.computeSalePrice(ctx.actor, input);
    if (!result.ok) {
      return throwPricing(result.error);
    }
    return result.value;
  }),

  upsertPriceList: adminProcedure.input(UpsertPriceListInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.pricing.upsertPriceList(ctx.actor, input);
    if (!result.ok) {
      return throwPricing(result.error);
    }
    return result.value;
  }),

  setSupplierCost: adminProcedure.input(SetSupplierCostInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.pricing.setSupplierCost(ctx.actor, input, requestContext(ctx));
    if (!result.ok) {
      return throwPricing(result.error);
    }
    return result.value;
  }),

  setMarkupRule: adminProcedure.input(SetMarkupRuleInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.pricing.setMarkupRule(ctx.actor, input, requestContext(ctx));
    if (!result.ok) {
      return throwPricing(result.error);
    }
    return result.value;
  }),

  setManualPrice: adminProcedure.input(SetManualPriceInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.pricing.setManualPrice(ctx.actor, input, requestContext(ctx));
    if (!result.ok) {
      return throwPricing(result.error);
    }
    return result.value;
  }),

  discounts: router({
    list: adminProcedure.input(ListDiscountsInputSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.pricing.listDiscounts(ctx.actor, input);
      if (!result.ok) {
        return throwPricing(result.error);
      }
      return result.value;
    }),
    create: adminProcedure.input(CreateDiscountInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.pricing.createDiscount(ctx.actor, input);
      if (!result.ok) {
        return throwPricing(result.error);
      }
      return result.value;
    }),
    deactivate: adminProcedure.input(DeactivateDiscountInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.pricing.deactivateDiscount(ctx.actor, input.id);
      if (!result.ok) {
        return throwPricing(result.error);
      }
      return result.value;
    }),
  }),
});
