import type { FastifyInstance } from "fastify";
import type { AppContainer } from "../../../app/container.js";
import { envelope } from "../../../shared/http/envelope.js";
import { supplierErrorToAppError } from "../../../shared/errors/http-error.js";

/**
 * Webhook de fulfillment del proveedor. No autenticado por sesión: la firma
 * HMAC del CUERPO CRUDO prueba la identidad (por eso el content type parser
 * conserva el string sin deserializar; el JSON.parse ocurre después de
 * verificar la firma). Cabeceras esperadas:
 *   x-supplier-timestamp: epoch en segundos
 *   x-supplier-signature: hex(hmac_sha256(webhookSecret, "{timestamp}.{rawBody}"))
 */
export const registerSupplierWebhookRoutes = async (app: FastifyInstance, container: AppContainer): Promise<void> => {
  await app.register(async (scope) => {
    scope.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
      done(null, body);
    });

    scope.post<{ Params: { supplierSlug: string } }>("/api/v1/webhooks/suppliers/:supplierSlug/fulfillment", async (request, reply) => {
      const rawBody = typeof request.body === "string" ? request.body : "";
      const header = (name: string): string | undefined => {
        const value = request.headers[name];
        return Array.isArray(value) ? value[0] : value;
      };
      const result = await container.suppliers.handleWebhook({
        supplierSlug: request.params.supplierSlug,
        rawBody,
        headers: {
          signature: header("x-supplier-signature"),
          timestamp: header("x-supplier-timestamp"),
        },
      });
      if (!result.ok) {
        const appError = supplierErrorToAppError(result.error);
        // Un evento sin correlación no debe provocar reintentos infinitos del proveedor.
        reply.status(appError.status);
        return envelope({ code: appError.code }, request.requestId);
      }
      return envelope(result.value, request.requestId);
    });
  });
};
