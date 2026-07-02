import { SupplierForwardResponseSchema, type SupplierApiConfigInput, type SupplierForwardResponse } from "@cloudcommerce/validators";
import { createHmac } from "node:crypto";
import { err, ok, type Result } from "../../../../shared/domain/result.js";
import type { ForwardOrderPayload, SupplierForwarderPort } from "../../application/ports.js";

const FORWARD_TIMEOUT_MS = 15_000;

/**
 * Capa anticorrupción de salida: publica el pedido en la API del proveedor y
 * valida la respuesta con schema antes de confiar en ella. La URL base fue
 * validada contra SSRF al configurarse.
 */
export class HttpSupplierForwarder implements SupplierForwarderPort {
  public async forwardOrder(input: {
    apiConfig: SupplierApiConfigInput;
    idempotencyKey: string;
    payload: ForwardOrderPayload;
  }): Promise<Result<SupplierForwardResponse, { type: "UPSTREAM_UNAVAILABLE" }>> {
    const url = `${input.apiConfig.baseUrl.replace(/\/$/, "")}/orders`;
    const body = JSON.stringify(input.payload);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "idempotency-key": input.idempotencyKey,
    };
    if (input.apiConfig.authKind === "api_key" && input.apiConfig.apiKey) {
      headers["x-api-key"] = input.apiConfig.apiKey;
    } else if (input.apiConfig.authKind === "bearer" && input.apiConfig.apiKey) {
      headers.authorization = `Bearer ${input.apiConfig.apiKey}`;
    } else if (input.apiConfig.authKind === "hmac" && input.apiConfig.apiKey) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      headers["x-timestamp"] = timestamp;
      headers["x-signature"] = createHmac("sha256", input.apiConfig.apiKey).update(`${timestamp}.${body}`).digest("hex");
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers,
        body,
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      });
      if (response.status >= 500) {
        return err({ type: "UPSTREAM_UNAVAILABLE" });
      }
      const parsed = SupplierForwardResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        return err({ type: "UPSTREAM_UNAVAILABLE" });
      }
      if (!response.ok) {
        return ok({ accepted: false, ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}) });
      }
      return ok(parsed.data);
    } catch {
      return err({ type: "UPSTREAM_UNAVAILABLE" });
    }
  }
}
