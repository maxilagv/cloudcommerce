import {
  CompletePasswordResetInputSchema,
  CreateAdminUserInputSchema,
  DisableMfaInputSchema,
  LoginInputSchema,
  MfaCodeInputSchema,
  RefreshInputSchema,
  RevokeSessionInputSchema,
  StartPasswordResetInputSchema,
  UpdateAdminRoleInputSchema,
} from "@cloudcommerce/validators";
import { appErrorToTrpcError, identityErrorToAppError } from "../../../shared/errors/http-error.js";
import type { IdentityDomainError } from "../../../shared/errors/domain-error.js";
import { adminProcedure, publicProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import { adminRefreshCookie, clearAdminCookies, setAdminCookies } from "../../../interfaces/trpc/cookies.js";
import { presentMe, presentSessions } from "./presenters.js";

const throwIdentity = (error: IdentityDomainError): never => {
  throw appErrorToTrpcError(identityErrorToAppError(error));
};

const requestContext = (ctx: { ip: string; userAgent: string; requestId: string }, deviceFingerprint?: string) => ({
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
  ...(deviceFingerprint ? { deviceFingerprint } : {}),
});

export const identityRouter = router({
  login: publicProcedure.input(LoginInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.identity.login(input, requestContext(ctx, input.deviceFingerprint));
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    setAdminCookies(ctx.reply, {
      sessionId: result.value.sessionId,
      refreshToken: result.value.refreshToken,
      expiresAt: result.value.refreshExpiresAt,
      secure: ctx.container.config.secureCookies,
    });
    return presentMe(result.value.profile, result.value.permissions);
  }),

  logout: adminProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.container.identity.logout(ctx.actor, requestContext(ctx));
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    clearAdminCookies(ctx.reply);
    return result.value;
  }),

  logoutAll: adminProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.container.identity.logoutAll(ctx.actor, requestContext(ctx));
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    clearAdminCookies(ctx.reply);
    return result.value;
  }),

  me: adminProcedure.query(async ({ ctx }) => {
    const session = await ctx.container.identity.resolveSession(ctx.actor.kind === "admin" ? ctx.actor.sessionId : undefined);
    if (!session.ok) {
      return throwIdentity(session.error);
    }
    return presentMe(session.value.profile, session.value.permissions);
  }),

  refresh: publicProcedure.input(RefreshInputSchema).mutation(async ({ ctx, input }) => {
    const signedRefresh = ctx.request.cookies[adminRefreshCookie];
    const unsignedRefresh = signedRefresh ? ctx.request.unsignCookie(signedRefresh) : null;
    const cookieRefresh = unsignedRefresh?.valid ? unsignedRefresh.value : undefined;
    const result = await ctx.container.identity.refresh(
      { ...input, refreshToken: input.refreshToken ?? cookieRefresh },
      requestContext(ctx, input.deviceFingerprint),
    );
    if (!result.ok) {
      clearAdminCookies(ctx.reply);
      return throwIdentity(result.error);
    }
    setAdminCookies(ctx.reply, {
      sessionId: result.value.sessionId,
      refreshToken: result.value.refreshToken,
      expiresAt: result.value.refreshExpiresAt,
      secure: ctx.container.config.secureCookies,
    });
    return { refreshed: true };
  }),

  listSessions: adminProcedure.query(async ({ ctx }) => {
    const result = await ctx.container.identity.listSessions(ctx.actor);
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    return presentSessions(result.value);
  }),

  revokeSession: adminProcedure.input(RevokeSessionInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.identity.revokeSession(ctx.actor, input, requestContext(ctx));
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    return result.value;
  }),

  startPasswordReset: publicProcedure.input(StartPasswordResetInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.identity.startPasswordReset(input, requestContext(ctx, input.deviceFingerprint));
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    return result.value;
  }),

  completePasswordReset: publicProcedure.input(CompletePasswordResetInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.identity.completePasswordReset(input, requestContext(ctx));
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    clearAdminCookies(ctx.reply);
    return result.value;
  }),

  enableMfa: adminProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.container.identity.enableMfa(ctx.actor);
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    return result.value;
  }),

  verifyMfa: adminProcedure.input(MfaCodeInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.identity.verifyMfa(ctx.actor, input.code, requestContext(ctx));
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    return result.value;
  }),

  disableMfa: adminProcedure.input(DisableMfaInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.identity.disableMfa(ctx.actor, input.password, input.code, requestContext(ctx));
    if (!result.ok) {
      return throwIdentity(result.error);
    }
    return result.value;
  }),

  admin: router({
    createUser: adminProcedure.input(CreateAdminUserInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.identity.createUser(ctx.actor, input, requestContext(ctx));
      if (!result.ok) {
        return throwIdentity(result.error);
      }
      return result.value;
    }),
    updateRole: adminProcedure.input(UpdateAdminRoleInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.identity.updateRole(ctx.actor, input, requestContext(ctx));
      if (!result.ok) {
        return throwIdentity(result.error);
      }
      return result.value;
    }),
  }),
});
