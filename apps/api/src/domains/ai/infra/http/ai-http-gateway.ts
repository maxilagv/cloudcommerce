import { AiTargetType, type AiSeo, type AiSpecGroups, type AiText } from "@cloudcommerce/types";
import { z } from "zod";
import { err, ok, type Result } from "../../../../shared/domain/result.js";
import type {
  AiCatalogCandidate,
  AiCategoryContext,
  AiGatewayPort,
  AiPricingContext,
  AiProductContext,
  AiUpstreamError,
} from "../../application/ports.js";

const UsageSchema = z.object({
  costMinor: z.number().int().min(0),
  currency: z.literal("ARS"),
  unit: z.enum(["tokens", "image"]),
  amount: z.number().int().min(0),
});

const TextResponseSchema = z.object({
  text: z.string().min(1).max(20_000),
  model: z.string().min(1).max(120),
  usage: UsageSchema,
});

const SeoResponseSchema = z.object({
  title: z.string().min(1).max(200),
  metaDescription: z.string().min(1).max(400),
  keywords: z.array(z.string().min(1).max(60)).max(20),
  model: z.string().min(1).max(120),
  usage: UsageSchema,
});

const SpecsResponseSchema = z.object({
  groups: z.array(
    z.object({
      name: z.string().min(1).max(80),
      items: z.array(
        z.object({
          key: z.string().min(1).max(60),
          label: z.string().min(1).max(120),
          valueText: z.string().max(500).nullable(),
          valueNum: z.number().nullable(),
          unit: z.string().max(20).nullable(),
        }),
      ).max(40),
    }),
  ).max(12),
  model: z.string().min(1).max(120),
  usage: UsageSchema,
});

const RecommendationsResponseSchema = z.object({
  recommendations: z.array(
    z.object({
      productId: z.string().uuid(),
      score: z.number().min(0).max(1),
      reasonCodes: z.array(z.string().min(1).max(60)).max(10),
      evidence: z.object({
        matchedAttributes: z.array(z.string().max(120)).max(20),
        basedOn: z.array(z.string().max(120)).max(20),
      }),
    }),
  ).max(24),
  usage: UsageSchema,
});

const TrendsResponseSchema = z.object({
  signals: z.array(
    z.object({
      targetType: z.nativeEnum(AiTargetType),
      targetId: z.string().uuid().nullable(),
      signal: z.string().min(1).max(300),
      score: z.number().min(0).max(1),
      window: z.string().min(1).max(20),
    }),
  ).max(50),
  usage: UsageSchema,
});

const PricingResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      variantId: z.string().uuid(),
      suggestedAmountMinor: z.number().int().min(0),
      currency: z.literal("ARS"),
      marginPct: z.number(),
      rationale: z.string().min(1).max(600),
      withinMinMargin: z.boolean(),
    }),
  ).max(100),
  usage: UsageSchema,
});

const TIMEOUT_MS: Record<string, number> = {
  "products/generate-description": 8_000,
  "products/generate-specs": 10_000,
  "products/generate-seo": 6_000,
  recommendations: 6_000,
  "trends/analyze": 6_000,
  "pricing/optimize": 6_000,
};

export class AiHttpGateway implements AiGatewayPort {
  public constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
  ) {}

  public async generateProductDescription(input: {
    generationId: string;
    requestId: string;
    locale: string;
    tone: string | null;
    maxChars: number;
    product: AiProductContext;
  }): Promise<Result<AiText, AiUpstreamError>> {
    return this.call("products/generate-description", input.generationId, input.requestId, {
      generationId: input.generationId,
      locale: input.locale,
      constraints: { maxChars: input.maxChars, tone: input.tone ?? "asesor claro, sin exageracion" },
      product: input.product,
    }, TextResponseSchema);
  }

  public async generateProductSpecs(input: {
    generationId: string;
    requestId: string;
    sourceHints: string | null;
    product: AiProductContext;
  }): Promise<Result<AiSpecGroups, AiUpstreamError>> {
    return this.call("products/generate-specs", input.generationId, input.requestId, {
      generationId: input.generationId,
      sourceHints: input.sourceHints,
      product: input.product,
    }, SpecsResponseSchema);
  }

  public async generateSeo(input: {
    generationId: string;
    requestId: string;
    product: AiProductContext | null;
    category: AiCategoryContext | null;
  }): Promise<Result<AiSeo, AiUpstreamError>> {
    return this.call("products/generate-seo", input.generationId, input.requestId, {
      generationId: input.generationId,
      product: input.product,
      category: input.category,
    }, SeoResponseSchema);
  }

  public async getRecommendations(input: {
    generationId: string;
    requestId: string;
    seed: AiCatalogCandidate | null;
    candidates: AiCatalogCandidate[];
    limit: number;
  }): Promise<Result<z.infer<typeof RecommendationsResponseSchema>, AiUpstreamError>> {
    return this.call("recommendations", input.generationId, input.requestId, {
      generationId: input.generationId,
      seed: input.seed,
      candidates: input.candidates,
      limit: input.limit,
    }, RecommendationsResponseSchema);
  }

  public async analyzeTrends(input: {
    generationId: string;
    requestId: string;
    scope: "category" | "supplierFeed" | "store";
    scopeId: string | null;
    window: string;
    candidates: AiCatalogCandidate[];
  }): Promise<Result<z.infer<typeof TrendsResponseSchema>, AiUpstreamError>> {
    return this.call("trends/analyze", input.generationId, input.requestId, {
      generationId: input.generationId,
      scope: input.scope,
      scopeId: input.scopeId,
      window: input.window,
      candidates: input.candidates,
    }, TrendsResponseSchema);
  }

  public async optimizePricing(input: {
    generationId: string;
    requestId: string;
    contexts: AiPricingContext[];
  }): Promise<Result<z.infer<typeof PricingResponseSchema>, AiUpstreamError>> {
    return this.call("pricing/optimize", input.generationId, input.requestId, {
      generationId: input.generationId,
      contexts: input.contexts,
    }, PricingResponseSchema);
  }

  private async call<T extends z.ZodType>(
    path: string,
    generationId: string,
    requestId: string,
    body: Record<string, unknown>,
    schema: T,
  ): Promise<Result<z.infer<T>, AiUpstreamError>> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/internal/ai/v1/${path}`;
    const timeout = TIMEOUT_MS[path] ?? 8_000;
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
          signal: AbortSignal.timeout(timeout),
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
