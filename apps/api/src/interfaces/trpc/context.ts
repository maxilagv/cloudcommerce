import type { Actor } from "@cloudcommerce/types";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { appErrorToTrpcError, identityErrorToAppError } from "../../shared/errors/http-error.js";
import type { AppContainer } from "../../app/container.js";
import { adminSessionCookie } from "./cookies.js";

export type TRPCContext = {
  container: AppContainer;
  requestId: string;
  ip: string;
  userAgent: string;
  actor: Actor;
  permissions: Array<{ resource: string; action: string }>;
  reply: CreateFastifyContextOptions["res"];
  request: CreateFastifyContextOptions["req"];
};

export const createTRPCContext = async (
  opts: CreateFastifyContextOptions & { container: AppContainer },
): Promise<TRPCContext> => {
  const signedSession = opts.req.cookies[adminSessionCookie];
  const unsignedSession = signedSession ? opts.req.unsignCookie(signedSession) : null;
  const sessionId = unsignedSession?.valid ? unsignedSession.value : undefined;
  const session = await opts.container.identity.resolveSession(sessionId);
  if (!session.ok && session.error.type !== "UNAUTHENTICATED") {
    throw appErrorToTrpcError(identityErrorToAppError(session.error));
  }

  return {
    container: opts.container,
    requestId: opts.req.requestId,
    ip: opts.req.ip,
    userAgent: opts.req.headers["user-agent"] ?? "unknown",
    actor: session.ok ? session.value.actor : { kind: "public" },
    permissions: session.ok ? session.value.permissions : [],
    reply: opts.res,
    request: opts.req,
  };
};
