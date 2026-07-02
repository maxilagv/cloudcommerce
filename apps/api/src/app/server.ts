import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { checkCacheHealth } from "../infrastructure/cache/client.js";
import { checkDatabaseHealth } from "../infrastructure/database/health.js";
import { globalErrorHandler } from "../shared/http/error-handler.js";
import { envelope } from "../shared/http/envelope.js";
import { attachRequestId, resolveRequestId } from "../shared/http/request-id.js";
import { createTRPCContext } from "../interfaces/trpc/context.js";
import { registerFinanceRoutes } from "../interfaces/http/routes/finance-routes.js";
import { registerMediaRoutes } from "../interfaces/http/routes/media-routes.js";
import { registerSupplierWebhookRoutes } from "../interfaces/http/routes/supplier-webhook-routes.js";
import { appRouter } from "../interfaces/trpc/router.js";
import { AppError } from "../shared/errors/app-error.js";
import type { AppContainer } from "./container.js";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

export const buildServer = async (container: AppContainer) => {
  const app = Fastify({
    logger: false,
    requestTimeout: 30_000,
    bodyLimit: container.config.MEDIA_MAX_REQUEST_BYTES,
  });

  app.addHook("onRequest", async (request, reply) => {
    request.requestId = resolveRequestId(request);
    attachRequestId(reply, request.requestId);
  });

  app.addHook("preHandler", async (request) => {
    const stateChangingCookieEndpoint = request.url.startsWith("/trpc") || request.url.startsWith("/media/upload");
    if (request.method === "GET" || request.method === "HEAD" || !stateChangingCookieEndpoint) {
      return;
    }
    const origin = request.headers.origin;
    if (origin && !container.config.corsAllowedOrigins.includes(origin)) {
      throw new AppError({ code: "FORBIDDEN", status: 403, message: "Origen no permitido." });
    }
    const fetchSite = request.headers["sec-fetch-site"];
    if (fetchSite === "cross-site") {
      throw new AppError({ code: "FORBIDDEN", status: 403, message: "Solicitud cross-site rechazada." });
    }
  });

  await app.register(helmet);
  await app.register(cookie, { secret: container.config.COOKIE_SECRET });
  await app.register(multipart, {
    limits: {
      fileSize: container.config.MEDIA_MAX_FILE_BYTES,
      files: 1,
      fieldSize: 16_384,
    },
  });
  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || container.config.corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
  });

  app.setErrorHandler(globalErrorHandler);

  app.get("/health/live", async (request) => envelope({ status: "ok" }, request.requestId));
  app.get("/health/startup", async (request) => envelope({ status: "ok" }, request.requestId));
  app.get("/health/ready", async (request, reply) => {
    const [dbOk, redisOk] = await Promise.all([checkDatabaseHealth(container.database), checkCacheHealth(container.cache)]);
    if (!dbOk || !redisOk) {
      reply.status(503);
    }
    return envelope({ status: dbOk && redisOk ? "ok" : "degraded", db: dbOk, redis: redisOk }, request.requestId);
  });

  await registerMediaRoutes(app, container);
  await registerFinanceRoutes(app, container);
  await registerSupplierWebhookRoutes(app, container);

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: (opts: CreateFastifyContextOptions) => createTRPCContext({ ...opts, container }),
    },
  });

  return app;
};
