import {
  AcknowledgeAiAlertSchema,
  AnalyzeImageSchema,
  AnalyzeTrendsSchema,
  DismissAiAlertSchema,
  GenerateDescriptionSchema,
  GenerateImageSchema,
  GenerateSeoSchema,
  GenerateSpecsSchema,
  GetGenerationSchema,
  GetRecommendationsSchema,
  GetUsageSummarySchema,
  ListAiAlertsSchema,
  ListGenerationsSchema,
  OptimizePricingSchema,
  ResolveAiAlertSchema,
} from "@cloudcommerce/validators";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import type { AiDomainError } from "../../../shared/errors/domain-error.js";
import { aiErrorToAppError, appErrorToTrpcError } from "../../../shared/errors/http-error.js";

const throwAi = (error: AiDomainError): never => {
  throw appErrorToTrpcError(aiErrorToAppError(error));
};

export const aiRouter = router({
  generateDescription: adminProcedure.input(GenerateDescriptionSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.generateDescription(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  generateSpecs: adminProcedure.input(GenerateSpecsSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.generateSpecs(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  generateSeo: adminProcedure.input(GenerateSeoSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.generateSeo(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  analyzeImage: adminProcedure.input(AnalyzeImageSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.analyzeImage(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  generateImage: adminProcedure.input(GenerateImageSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.generateImage(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  getRecommendations: adminProcedure.input(GetRecommendationsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.ai.getRecommendations(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  analyzeTrends: adminProcedure.input(AnalyzeTrendsSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.analyzeTrends(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  optimizePricing: adminProcedure.input(OptimizePricingSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.optimizePricing(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  listGenerations: adminProcedure.input(ListGenerationsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.ai.listGenerations(ctx.actor, input);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  getGeneration: adminProcedure.input(GetGenerationSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.ai.getGeneration(ctx.actor, input);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  getUsageSummary: adminProcedure.input(GetUsageSummarySchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.ai.getUsageSummary(ctx.actor, input);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  listAlerts: adminProcedure.input(ListAiAlertsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.ai.listAlerts(ctx.actor, input);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  acknowledgeAlert: adminProcedure.input(AcknowledgeAiAlertSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.acknowledgeAlert(ctx.actor, input);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  resolveAlert: adminProcedure.input(ResolveAiAlertSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.resolveAlert(ctx.actor, input);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),

  dismissAlert: adminProcedure.input(DismissAiAlertSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.ai.dismissAlert(ctx.actor, input);
    if (!result.ok) return throwAi(result.error);
    return result.value;
  }),
});
