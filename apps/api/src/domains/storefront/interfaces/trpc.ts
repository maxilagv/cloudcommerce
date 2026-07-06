import {
  StoreCheckoutSchema,
  StoreLoginSchema,
  StoreMyOrdersSchema,
  StoreOrderDetailSchema,
  StoreRegisterSchema,
} from "@cloudcommerce/validators";
import type { StorefrontDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, storefrontErrorToAppError } from "../../../shared/errors/http-error.js";
import {
  clearCustomerCookie,
  customerSessionCookie,
  setCustomerCookie,
} from "../../../interfaces/trpc/cookies.js";
import { customerProcedure, publicProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";

const throwStorefront = (error: StorefrontDomainError): never => {
  throw appErrorToTrpcError(storefrontErrorToAppError(error));
};

/**
 * Superficie pública de cuentas y checkout del storefront. La sesión del
 * cliente viaja en cookie httpOnly firmada (cc_customer_session); el body
 * nunca incluye el token.
 */
export const storefrontRouter = router({
  register: publicProcedure.input(StoreRegisterSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.storefront.register(input, requestContext(ctx));
    if (!result.ok) return throwStorefront(result.error);
    setCustomerCookie(ctx.reply, {
      sessionToken: result.value.sessionToken,
      expiresAt: new Date(result.value.expiresAt),
      secure: ctx.container.config.secureCookies,
    });
    return { profile: result.value.profile, expiresAt: result.value.expiresAt };
  }),

  login: publicProcedure.input(StoreLoginSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.storefront.login(input, requestContext(ctx));
    if (!result.ok) return throwStorefront(result.error);
    setCustomerCookie(ctx.reply, {
      sessionToken: result.value.sessionToken,
      expiresAt: new Date(result.value.expiresAt),
      secure: ctx.container.config.secureCookies,
    });
    return { profile: result.value.profile, expiresAt: result.value.expiresAt };
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    const signed = ctx.request.cookies[customerSessionCookie];
    const unsigned = signed ? ctx.request.unsignCookie(signed) : null;
    const token = unsigned?.valid ? unsigned.value : undefined;
    const result = await ctx.container.storefront.logout(token);
    if (!result.ok) return throwStorefront(result.error);
    clearCustomerCookie(ctx.reply);
    return result.value;
  }),

  me: customerProcedure.query(async ({ ctx }) => {
    if (ctx.customerProfile) {
      return ctx.customerProfile;
    }
    const result = await ctx.container.storefront.me(ctx.actor);
    if (!result.ok) return throwStorefront(result.error);
    return result.value;
  }),

  checkout: customerProcedure.input(StoreCheckoutSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.storefront.checkout(ctx.actor, input, requestContext(ctx));
    if (!result.ok) return throwStorefront(result.error);
    return result.value;
  }),

  myOrders: customerProcedure.input(StoreMyOrdersSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.storefront.myOrders(ctx.actor, input);
    if (!result.ok) return throwStorefront(result.error);
    return result.value;
  }),

  orderDetail: customerProcedure.input(StoreOrderDetailSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.storefront.orderDetail(ctx.actor, input);
    if (!result.ok) return throwStorefront(result.error);
    return result.value;
  }),
});

const requestContext = (ctx: { ip: string; userAgent: string; requestId: string }) => ({
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
});
