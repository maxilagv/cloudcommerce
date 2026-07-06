import { z } from "zod";
import { err, ok, type Result } from "../../../../shared/domain/result.js";
import type { WhatsappPort } from "../../application/ports.js";

const GRAPH_BASE_URL = "https://graph.facebook.com/v20.0";
const TIMEOUT_MS = 30_000;

const SendResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

/**
 * Adaptador de la Cloud API de WhatsApp (Meta). Envía mensajes de texto
 * simples; la configuración es opcional y isConfigured() permite degradar el
 * dominio cuando faltan credenciales.
 */
export class WhatsappCloudGateway implements WhatsappPort {
  public constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {}

  public isConfigured(): boolean {
    return this.accessToken.length > 0 && this.phoneNumberId.length > 0;
  }

  public async sendText(input: {
    to: string;
    text: string;
  }): Promise<Result<{ waMessageId: string }, { type: "UPSTREAM_UNAVAILABLE" } | { type: "SEND_REJECTED"; detail: string }>> {
    if (!this.isConfigured()) {
      return err({ type: "SEND_REJECTED", detail: "whatsapp_not_configured" });
    }
    const url = `${GRAPH_BASE_URL}/${this.phoneNumberId}/messages`;
    const body = JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "text",
      text: { body: input.text },
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.accessToken}`,
          },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.status >= 500) {
          if (attempt === 0) continue;
          return err({ type: "UPSTREAM_UNAVAILABLE" });
        }
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 300);
          return err({ type: "SEND_REJECTED", detail });
        }
        const parsed = SendResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          return err({ type: "SEND_REJECTED", detail: "invalid_response" });
        }
        const first = parsed.data.messages[0];
        if (!first) {
          return err({ type: "SEND_REJECTED", detail: "invalid_response" });
        }
        return ok({ waMessageId: first.id });
      } catch {
        if (attempt === 0) continue;
        return err({ type: "UPSTREAM_UNAVAILABLE" });
      }
    }
    return err({ type: "UPSTREAM_UNAVAILABLE" });
  }
}
