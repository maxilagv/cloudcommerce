import type { Actor, AdminProfile, StoreCustomerProfile } from "@cloudcommerce/types";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { appErrorToTrpcError, identityErrorToAppError } from "../../shared/errors/http-error.js";
import type { AppContainer } from "../../app/container.js";
import { adminSessionCookie, customerSessionCookie } from "./cookies.js";

export type TRPCContext = {
  container: AppContainer;
  requestId: string;
  ip: string;
  userAgent: string;
  actor: Actor;
  profile: AdminProfile | null;
  /** Perfil del cliente cuando la sesión es del storefront. */
  customerProfile: StoreCustomerProfile | null;
  permissions: Array<{ resource: string; action: string }>;
  reply: CreateFastifyContextOptions["res"];
  request: CreateFastifyContextOptions["req"];
};

const unsign = (opts: CreateFastifyContextOptions, cookieName: string): string | undefined => {
  const signed = opts.req.cookies[cookieName];
  const unsigned = signed ? opts.req.unsignCookie(signed) : null;
  return unsigned?.valid ? unsigned.value : undefined;
};

export const createTRPCContext = async (
  opts: CreateFastifyContextOptions & { container: AppContainer },
): Promise<TRPCContext> => {
  const sessionToken = unsign(opts, adminSessionCookie);
  const session = await opts.container.identity.resolveSession(sessionToken);
  if (!session.ok && session.error.type !== "UNAUTHENTICATED") {
    throw appErrorToTrpcError(identityErrorToAppError(session.error));
  }

  // Sin sesión de admin: intenta resolver la sesión de cliente del storefront.
  let actor: Actor = session.ok ? session.value.actor : { kind: "public" };
  let customerProfile: StoreCustomerProfile | null = null;
  if (!session.ok) {
    const customerToken = unsign(opts, customerSessionCookie);
    const customerSession = await opts.container.storefront.resolveSession(customerToken);
    if (customerSession) {
      actor = customerSession.actor;
      customerProfile = customerSession.profile;
    }
  }

  return {
    container: opts.container,
    requestId: opts.req.requestId,
    ip: opts.req.ip,
    userAgent: opts.req.headers["user-agent"] ?? "unknown",
    actor,
    profile: session.ok ? session.value.profile : null,
    customerProfile,
    permissions: session.ok ? session.value.permissions : [],
    reply: opts.res,
    request: opts.req,
  };
};
