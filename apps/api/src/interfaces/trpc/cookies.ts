import type { FastifyReply } from "fastify";

export const adminSessionCookie = "cc_admin_session";
export const adminRefreshCookie = "cc_admin_refresh";

export const setAdminCookies = (
  reply: FastifyReply,
  input: { sessionToken: string; refreshToken: string; expiresAt: Date; secure: boolean },
): void => {
  reply.setCookie(adminSessionCookie, input.sessionToken, {
    httpOnly: true,
    secure: input.secure,
    sameSite: "lax",
    path: "/",
    expires: input.expiresAt,
    signed: true,
  });
  reply.setCookie(adminRefreshCookie, input.refreshToken, {
    httpOnly: true,
    secure: input.secure,
    sameSite: "lax",
    path: "/trpc",
    expires: input.expiresAt,
    signed: true,
  });
};

export const clearAdminCookies = (reply: FastifyReply): void => {
  reply.clearCookie(adminSessionCookie, { path: "/" });
  reply.clearCookie(adminRefreshCookie, { path: "/trpc" });
};

export const customerSessionCookie = "cc_customer_session";

export const setCustomerCookie = (
  reply: FastifyReply,
  input: { sessionToken: string; expiresAt: Date; secure: boolean },
): void => {
  reply.setCookie(customerSessionCookie, input.sessionToken, {
    httpOnly: true,
    secure: input.secure,
    sameSite: "lax",
    path: "/",
    expires: input.expiresAt,
    signed: true,
  });
};

export const clearCustomerCookie = (reply: FastifyReply): void => {
  reply.clearCookie(customerSessionCookie, { path: "/" });
};
