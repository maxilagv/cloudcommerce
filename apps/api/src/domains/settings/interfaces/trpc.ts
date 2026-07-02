import {
  DeactivateAdminUserSchema,
  GetSettingsSchema,
  InviteAdminUserSchema,
  ListAdminUsersSchema,
  ListFeatureFlagsSchema,
  ListPaymentMethodsSchema,
  ListShippingOptionsSchema,
  SetAdminUserRoleSchema,
  ToggleFeatureFlagSchema,
  TogglePaymentMethodSchema,
  UpdateSettingSchema,
  UpsertFeatureFlagSchema,
  UpsertShippingOptionSchema,
} from "@cloudcommerce/validators";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import type { SettingsDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, settingsErrorToAppError } from "../../../shared/errors/http-error.js";

const throwSettings = (error: SettingsDomainError): never => {
  throw appErrorToTrpcError(settingsErrorToAppError(error));
};

const requestContext = (ctx: { ip: string; userAgent: string; requestId: string }, reason?: string | null) => ({
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
  reason: reason ?? null,
});

export const settingsRouter = router({
  getSettings: adminProcedure.input(GetSettingsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.settings.getSettings(ctx.actor, input);
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  updateSetting: adminProcedure.input(UpdateSettingSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.settings.updateSetting(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  listShippingOptions: adminProcedure.input(ListShippingOptionsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.settings.listShippingOptions(ctx.actor, input);
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  upsertShippingOption: adminProcedure.input(UpsertShippingOptionSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.settings.upsertShippingOption(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  listPaymentMethods: adminProcedure.input(ListPaymentMethodsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.settings.listPaymentMethods(ctx.actor, input);
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  togglePaymentMethod: adminProcedure.input(TogglePaymentMethodSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.settings.togglePaymentMethod(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  listAdminUsers: adminProcedure.input(ListAdminUsersSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.settings.listAdminUsers(ctx.actor, input);
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  inviteAdminUser: adminProcedure.input(InviteAdminUserSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.settings.inviteAdminUser(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  setUserRole: adminProcedure.input(SetAdminUserRoleSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.settings.setUserRole(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  deactivateUser: adminProcedure.input(DeactivateAdminUserSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.settings.deactivateUser(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  listFeatureFlags: adminProcedure.input(ListFeatureFlagsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.settings.listFeatureFlags(ctx.actor, input);
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  toggleFeatureFlag: adminProcedure.input(ToggleFeatureFlagSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.settings.toggleFeatureFlag(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),

  upsertFeatureFlag: adminProcedure.input(UpsertFeatureFlagSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.settings.upsertFeatureFlag(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) return throwSettings(result.error);
    return result.value;
  }),
});
