import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppContainer } from "../../../app/container.js";
import { AppError } from "../../../shared/errors/app-error.js";

export const registerFinanceRoutes = async (app: FastifyInstance, container: AppContainer): Promise<void> => {
  app.get("/finance/documents/download", async (request: FastifyRequest, reply: FastifyReply) => {
    const storageKey = readQueryValue(request.query, "key");
    const filename = readQueryValue(request.query, "filename");
    const expiresRaw = readQueryValue(request.query, "expires");
    const signature = readQueryValue(request.query, "signature");
    const expires = Number(expiresRaw);
    if (!storageKey || !filename || !Number.isInteger(expires) || !signature) {
      throw new AppError({ code: "FORBIDDEN", status: 403, message: "URL de descarga invalida." });
    }
    const result = await container.documentStorage.getSignedDocument({ storageKey, filename, expires, signature });
    if (!result) {
      throw new AppError({ code: "FORBIDDEN", status: 403, message: "URL de descarga invalida o expirada." });
    }
    reply
      .header("Cache-Control", "private, max-age=60")
      .header("Content-Disposition", `attachment; filename="${sanitizeFilename(result.filename)}"`)
      .type("application/octet-stream")
      .send(result.body);
  });
};

const readQueryValue = (query: unknown, key: string): string | null => {
  if (query === null || typeof query !== "object" || !(key in query)) {
    return null;
  }
  const value = (query as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
};

const sanitizeFilename = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "_");
