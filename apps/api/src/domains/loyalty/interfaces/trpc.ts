import {
  AdjustLoyaltyPointsSchema,
  ListCloudDigitalMembershipsSchema,
  ListLoyaltyRedemptionsSchema,
  LoyaltyTransactionsQuerySchema,
  RedeemRewardSchema,
  ResolveRedemptionSchema,
  SetCloudDigitalMembershipStatusSchema,
  UpdateLoyaltyConfigSchema,
  UpsertCloudDigitalBenefitSchema,
  UpsertLoyaltyRewardSchema,
} from "@cloudcommerce/validators";
import type { LoyaltyDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, loyaltyErrorToAppError } from "../../../shared/errors/http-error.js";
import {
  adminProcedure,
  customerProcedure,
  publicProcedure,
  router,
} from "../../../interfaces/trpc/middleware/auth.js";

const throwLoyalty = (error: LoyaltyDomainError): never => {
  throw appErrorToTrpcError(loyaltyErrorToAppError(error));
};

/**
 * CloudPoints + CloudDigital.
 * - `my.*` / `cloudDigital.*`: sesión de cliente de la tienda.
 * - `rewards.open`: público (vidriera de regalos de la semana).
 * - `admin.*`: panel de administración.
 */
export const loyaltyRouter = router({
  rewards: router({
    open: publicProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.openRewards();
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    program: publicProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.programInfo();
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
  }),

  my: router({
    summary: customerProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.mySummary(ctx.actor);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    transactions: customerProcedure
      .input(LoyaltyTransactionsQuerySchema)
      .query(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.myTransactions(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
    redeem: customerProcedure.input(RedeemRewardSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.loyalty.redeem(ctx.actor, input);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    redemptions: customerProcedure
      .input(LoyaltyTransactionsQuerySchema)
      .query(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.myRedemptions(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
  }),

  cloudDigital: router({
    membership: customerProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.myCloudDigital(ctx.actor);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    join: customerProcedure.mutation(async ({ ctx }) => {
      const result = await ctx.container.loyalty.joinCloudDigital(ctx.actor);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    benefits: customerProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.cloudDigitalBenefits(ctx.actor);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
  }),

  admin: router({
    stats: adminProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.stats(ctx.actor);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    getConfig: adminProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.getConfig(ctx.actor);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    updateConfig: adminProcedure
      .input(UpdateLoyaltyConfigSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.updateConfig(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
    listRewards: adminProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.listRewardsAdmin(ctx.actor);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    upsertReward: adminProcedure
      .input(UpsertLoyaltyRewardSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.upsertReward(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
    listRedemptions: adminProcedure
      .input(ListLoyaltyRedemptionsSchema)
      .query(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.listRedemptions(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
    resolveRedemption: adminProcedure
      .input(ResolveRedemptionSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.resolveRedemption(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
    adjustPoints: adminProcedure
      .input(AdjustLoyaltyPointsSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.adjustPoints(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
    listMemberships: adminProcedure
      .input(ListCloudDigitalMembershipsSchema)
      .query(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.listMemberships(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
    setMembershipStatus: adminProcedure
      .input(SetCloudDigitalMembershipStatusSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.setMembershipStatus(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
    listBenefits: adminProcedure.query(async ({ ctx }) => {
      const result = await ctx.container.loyalty.listBenefitsAdmin(ctx.actor);
      if (!result.ok) {
        return throwLoyalty(result.error);
      }
      return result.value;
    }),
    upsertBenefit: adminProcedure
      .input(UpsertCloudDigitalBenefitSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await ctx.container.loyalty.upsertBenefit(ctx.actor, input);
        if (!result.ok) {
          return throwLoyalty(result.error);
        }
        return result.value;
      }),
  }),
});
