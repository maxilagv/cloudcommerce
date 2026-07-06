import type { AiOutreachGoal } from "@cloudcommerce/types";
import { z } from "zod";
import { err, ok, type Result } from "../../../../shared/domain/result.js";
import type {
  EngagementAiPort,
  EngagementConversationTurn,
  EngagementCustomerWireSnapshot,
  EngagementSaleCandidate,
  EngagementUpstreamError,
} from "../../application/ports.js";

/**
 * Gateway HTTP hacia el servicio Python (apps/ai) para inteligencia de
 * clientes. Mismo estilo que AiHttpGateway: fetch con timeout, un reintento
 * ante 5xx y validación Zod de la respuesta.
 */

const UsageSchema = z.object({
  costMinor: z.number().int().min(0),
  currency: z.literal("ARS"),
  unit: z.enum(["tokens", "image"]),
  amount: z.number().int().min(0),
});

const ProfileSchema = z.object({
  interests: z.array(z.string().min(1).max(120)).max(15),
  segments: z.array(z.string().min(1).max(120)).max(8),
  priceSensitivity: z.enum(["low", "medium", "high"]),
  buyingPatterns: z.array(z.string().min(1).max(300)).max(8),
  recommendedCategories: z.array(z.string().min(1).max(120)).max(8),
  nextBestActions: z.array(z.string().min(1).max(300)).max(6),
  summary: z.string().max(1_000),
  confidence: z.number().int().min(0).max(100),
});

const AnalyzeCustomerResponseSchema = z.object({
  profile: ProfileSchema,
  model: z.string().min(1).max(120),
  usage: UsageSchema,
});

const OutreachResponseSchema = z.object({
  message: z.string().min(1).max(1_200),
  reasoning: z.string().max(800),
  recommendedProductIds: z.array(z.string().min(1).max(80)).max(6),
  shouldSend: z.boolean(),
  model: z.string().min(1).max(120),
  usage: UsageSchema,
});

const ReplyResponseSchema = z.object({
  message: z.string().min(1).max(1_200),
  intent: z.enum(["question", "purchase_intent", "complaint", "smalltalk", "opt_out", "other"]),
  needsHuman: z.boolean(),
  recommendedProductIds: z.array(z.string().min(1).max(80)).max(6),
  model: z.string().min(1).max(120),
  usage: UsageSchema,
});

const TIMEOUT_MS = 60_000;

export class EngagementAiGateway implements EngagementAiPort {
  public constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
  ) {}

  public async analyzeProfile(input: {
    generationId: string;
    requestId: string;
    customer: EngagementCustomerWireSnapshot;
  }): Promise<Result<z.infer<typeof AnalyzeCustomerResponseSchema>, EngagementUpstreamError>> {
    return this.call("customers/analyze-profile", input.generationId, input.requestId, {
      generationId: input.generationId,
      customer: input.customer,
    }, AnalyzeCustomerResponseSchema);
  }

  public async generateOutreach(input: {
    generationId: string;
    requestId: string;
    goal: AiOutreachGoal;
    customer: EngagementCustomerWireSnapshot;
    profile: Record<string, unknown> | null;
    candidates: EngagementSaleCandidate[];
    conversation: EngagementConversationTurn[];
    storeName: string;
  }): Promise<Result<z.infer<typeof OutreachResponseSchema>, EngagementUpstreamError>> {
    return this.call("customers/outreach", input.generationId, input.requestId, {
      generationId: input.generationId,
      goal: input.goal,
      customer: input.customer,
      profile: input.profile,
      candidates: input.candidates,
      conversation: input.conversation,
      storeName: input.storeName,
    }, OutreachResponseSchema);
  }

  public async generateReply(input: {
    generationId: string;
    requestId: string;
    customer: EngagementCustomerWireSnapshot;
    profile: Record<string, unknown> | null;
    conversation: EngagementConversationTurn[];
    incomingMessage: string;
    candidates: EngagementSaleCandidate[];
    storeName: string;
  }): Promise<Result<z.infer<typeof ReplyResponseSchema>, EngagementUpstreamError>> {
    return this.call("customers/reply", input.generationId, input.requestId, {
      generationId: input.generationId,
      customer: input.customer,
      profile: input.profile,
      conversation: input.conversation,
      incomingMessage: input.incomingMessage,
      candidates: input.candidates,
      storeName: input.storeName,
    }, ReplyResponseSchema);
  }

  private async call<T extends z.ZodType>(
    path: string,
    generationId: string,
    requestId: string,
    body: Record<string, unknown>,
    schema: T,
  ): Promise<Result<z.infer<T>, EngagementUpstreamError>> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/internal/ai/v1/${path}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.serviceToken}`,
            "x-request-id": requestId,
            "idempotency-key": generationId,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.status >= 500) {
          if (attempt === 0) continue;
          return err({ type: "UPSTREAM_UNAVAILABLE" });
        }
        if (!response.ok) {
          return err({ type: "RESPONSE_INVALID" });
        }
        const parsed = schema.safeParse(await response.json());
        if (!parsed.success) {
          return err({ type: "RESPONSE_INVALID" });
        }
        return ok(parsed.data);
      } catch {
        if (attempt === 0) continue;
        return err({ type: "UPSTREAM_UNAVAILABLE" });
      }
    }
    return err({ type: "UPSTREAM_UNAVAILABLE" });
  }
}
