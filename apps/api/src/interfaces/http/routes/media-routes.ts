import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppContainer } from "../../../app/container.js";
import { mediaErrorToAppError } from "../../../shared/errors/http-error.js";
import { envelope } from "../../../shared/http/envelope.js";
import { adminSessionCookie } from "../../trpc/cookies.js";

type UploadRequest = FastifyRequest;

export const registerMediaRoutes = async (app: FastifyInstance, container: AppContainer): Promise<void> => {
  app.post("/media/upload", async (request: UploadRequest, reply: FastifyReply) => {
    const actor = await resolveActor(request, container);
    const uploaded = await request.file({
      limits: {
        fileSize: container.config.MEDIA_MAX_FILE_BYTES,
        files: 1,
      },
    });
    if (!uploaded) {
      throw mediaErrorToAppError({ type: "MEDIA_UPLOAD_INVALID", reason: "Falta el archivo." });
    }
    const body = await uploaded.toBuffer();
    const result = await container.media.upload(actor, {
      body,
      declaredContentType: uploaded.mimetype,
      originalFileName: uploaded.filename,
    });
    if (!result.ok) {
      throw mediaErrorToAppError(result.error);
    }
    reply.status(201).send(envelope(result.value, request.requestId));
  });

  app.get("/media/assets/:mediaAssetId/download", async (request: FastifyRequest<{ Params: { mediaAssetId: string } }>, reply: FastifyReply) => {
    const expiresRaw = readQueryValue(request.query, "expires");
    const signature = readQueryValue(request.query, "signature");
    const expiresAt = Number(expiresRaw);
    if (!Number.isInteger(expiresAt) || !signature) {
      throw mediaErrorToAppError({ type: "FORBIDDEN" });
    }
    const result = await container.media.getDownload(request.params.mediaAssetId, expiresAt, signature);
    if (!result.ok) {
      throw mediaErrorToAppError(result.error);
    }
    reply
      .header("Cache-Control", "private, max-age=60")
      .type(result.value.contentType)
      .send(result.value.body);
  });
};

const resolveActor = async (request: FastifyRequest, container: AppContainer) => {
  const signedSession = request.cookies[adminSessionCookie];
  const unsignedSession = signedSession ? request.unsignCookie(signedSession) : null;
  const sessionId = unsignedSession?.valid ? unsignedSession.value : undefined;
  const session = await container.identity.resolveSession(sessionId);
  return session.ok ? session.value.actor : { kind: "public" as const };
};

const readQueryValue = (query: unknown, key: string): string | null => {
  if (query === null || typeof query !== "object" || !(key in query)) {
    return null;
  }
  const value = (query as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
};
