import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../../../app/container.js";
import { envelope } from "../../../shared/http/envelope.js";

/**
 * Webhook de la Cloud API de WhatsApp (Meta).
 * - GET: verificación de suscripción (hub.challenge en texto plano).
 * - POST: eventos entrantes. La firma X-Hub-Signature-256 se calcula sobre el
 *   CUERPO CRUDO con el app secret, por eso el content type parser conserva el
 *   string sin deserializar (el JSON.parse ocurre después de validar la firma).
 * Siempre respondemos 200 rápido para evitar reintentos agresivos de Meta.
 */

const verifyQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional(),
});

const metaPayloadSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z
                .object({
                  messages: z
                    .array(
                      z.object({
                        from: z.string().min(1),
                        id: z.string().min(1),
                        timestamp: z.string().optional(),
                        type: z.string(),
                        text: z.object({ body: z.string() }).optional(),
                      }),
                    )
                    .optional(),
                })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export const registerWhatsappWebhookRoutes = async (app: FastifyInstance, container: AppContainer): Promise<void> => {
  await app.register(async (scope) => {
    scope.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
      done(null, body);
    });

    scope.get("/api/v1/webhooks/whatsapp", async (request, reply) => {
      const query = verifyQuerySchema.safeParse(request.query);
      const verifyToken = container.config.WHATSAPP_VERIFY_TOKEN;
      if (
        query.success &&
        verifyToken &&
        query.data["hub.mode"] === "subscribe" &&
        query.data["hub.verify_token"] === verifyToken &&
        query.data["hub.challenge"] !== undefined
      ) {
        reply.status(200).header("content-type", "text/plain; charset=utf-8");
        return query.data["hub.challenge"];
      }
      reply.status(403);
      return envelope({ code: "FORBIDDEN" }, request.requestId);
    });

    scope.post("/api/v1/webhooks/whatsapp", async (request, reply) => {
      const appSecret = container.config.WHATSAPP_APP_SECRET;
      if (!appSecret) {
        reply.status(503);
        return envelope({ code: "UPSTREAM_UNAVAILABLE" }, request.requestId);
      }
      const rawBody = typeof request.body === "string" ? request.body : "";
      const signatureHeader = request.headers["x-hub-signature-256"];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      if (!signature || !isValidSignature(appSecret, rawBody, signature)) {
        reply.status(401);
        return envelope({ code: "WEBHOOK_SIGNATURE_INVALID" }, request.requestId);
      }

      let payload: unknown;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        // Payload ilegible: 200 igualmente para no provocar reintentos infinitos.
        return envelope({ received: true }, request.requestId);
      }
      const parsed = metaPayloadSchema.safeParse(payload);
      if (parsed.success) {
        for (const entry of parsed.data.entry ?? []) {
          for (const change of entry.changes ?? []) {
            for (const message of change.value?.messages ?? []) {
              if (message.type !== "text" || !message.text) {
                continue;
              }
              try {
                await container.engagement.handleInboundWhatsapp({
                  from: message.from,
                  text: message.text.body,
                  waMessageId: message.id,
                  timestamp: message.timestamp ?? "",
                });
              } catch (error: unknown) {
                container.logger.error(
                  { waMessageId: message.id, error: error instanceof Error ? error.message : "unknown" },
                  "whatsapp webhook: fallo procesando mensaje entrante",
                );
              }
            }
          }
        }
      }
      return envelope({ received: true }, request.requestId);
    });
  });
};

const isValidSignature = (appSecret: string, rawBody: string, header: string): boolean => {
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(header);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
};
