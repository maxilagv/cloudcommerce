import {
  AnalyzeCustomerProfileSchema,
  GenerateOutreachSchema,
  GetAiConversationSchema,
  GetAiProfileSchema,
  ListAiConversationsSchema,
  ListAiProfilesSchema,
  SendAiMessageSchema,
  UpdateAiConversationSchema,
} from "@cloudcommerce/validators";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import type { EngagementDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, engagementErrorToAppError } from "../../../shared/errors/http-error.js";

const throwEngagement = (error: EngagementDomainError): never => {
  throw appErrorToTrpcError(engagementErrorToAppError(error));
};

export const engagementRouter = router({
  listProfiles: adminProcedure.input(ListAiProfilesSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.engagement.listProfiles(ctx.actor, input);
    if (!result.ok) return throwEngagement(result.error);
    return result.value;
  }),

  getProfile: adminProcedure.input(GetAiProfileSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.engagement.getProfile(ctx.actor, input);
    if (!result.ok) return throwEngagement(result.error);
    return result.value;
  }),

  analyzeCustomer: adminProcedure.input(AnalyzeCustomerProfileSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.engagement.analyzeCustomer(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwEngagement(result.error);
    return result.value;
  }),

  listConversations: adminProcedure.input(ListAiConversationsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.engagement.listConversations(ctx.actor, input);
    if (!result.ok) return throwEngagement(result.error);
    return result.value;
  }),

  getConversation: adminProcedure.input(GetAiConversationSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.engagement.getConversation(ctx.actor, input);
    if (!result.ok) return throwEngagement(result.error);
    return result.value;
  }),

  sendMessage: adminProcedure.input(SendAiMessageSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.engagement.sendManualMessage(ctx.actor, input);
    if (!result.ok) return throwEngagement(result.error);
    return result.value;
  }),

  updateConversation: adminProcedure.input(UpdateAiConversationSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.engagement.updateConversation(ctx.actor, input);
    if (!result.ok) return throwEngagement(result.error);
    return result.value;
  }),

  generateOutreach: adminProcedure.input(GenerateOutreachSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.engagement.generateOutreach(ctx.actor, input, ctx.requestId);
    if (!result.ok) return throwEngagement(result.error);
    return result.value;
  }),
});
