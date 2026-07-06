import {
  AdminRole,
  AiAlertKind,
  AiAlertStatus,
  AiGenerationKind,
  AiGenerationStatus,
  type Actor,
  type AiAlertRecord,
  type AiGenerationSummary,
} from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { AiService } from "../../application/ai-service.js";
import type {
  AiContextReaderPort,
  AiGatewayPort,
  AiProductContext,
  AiRateLimiterPort,
  AiRepository,
  CompleteGenerationRecord,
  CreateGenerationRecord,
  ListAlertsFilters,
  ListGenerationsFilters,
  UpsertAlertRecord,
} from "../../application/ports.js";

const owner: Actor = { kind: "admin", userId: "018f0000-0000-7000-8000-000000000001", role: AdminRole.OWNER, sessionId: "s1" };
const support: Actor = { kind: "admin", userId: "018f0000-0000-7000-8000-000000000002", role: AdminRole.SUPPORT, sessionId: "s2" };
const catalogManager: Actor = { kind: "admin", userId: "018f0000-0000-7000-8000-000000000003", role: AdminRole.CATALOG_MANAGER, sessionId: "s3" };

const productId = "018f0000-0000-7000-8000-00000000aaaa";

const productContext: AiProductContext = {
  productId,
  title: "Lavarropas LG 22kg",
  subtitle: null,
  description: "Lavarropas inteligente",
  categoryName: "Lavarropas",
  brandName: "LG",
  specs: [],
  variantAttributes: [],
};

const usage = { costMinor: 350, currency: "ARS" as const, unit: "tokens" as const, amount: 1840 };

class FakeGateway implements AiGatewayPort {
  public constructor(private readonly mode: "ok" | "down" | "invalid" | "empty" = "ok") {}

  public async generateProductDescription(): ReturnType<AiGatewayPort["generateProductDescription"]> {
    if (this.mode === "down") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    if (this.mode === "invalid") return { ok: false, error: { type: "RESPONSE_INVALID" } };
    if (this.mode === "empty") return { ok: true, value: { text: "   ", model: "claude", usage } };
    return { ok: true, value: { text: "Descripcion generada.", model: "claude", usage } };
  }

  public async generateProductSpecs(): ReturnType<AiGatewayPort["generateProductSpecs"]> {
    if (this.mode !== "ok") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    return { ok: true, value: { groups: [{ name: "Dimensiones", items: [] }], model: "claude", usage } };
  }

  public async generateSeo(): ReturnType<AiGatewayPort["generateSeo"]> {
    if (this.mode !== "ok") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    return { ok: true, value: { title: "SEO", metaDescription: "Meta", keywords: ["lavarropas"], model: "claude", usage } };
  }

  public async getRecommendations(): ReturnType<AiGatewayPort["getRecommendations"]> {
    if (this.mode !== "ok") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    return {
      ok: true,
      value: {
        recommendations: [
          {
            productId,
            score: 0.9,
            reasonCodes: ["same_category"],
            evidence: { matchedAttributes: [], basedOn: ["catalogo"] },
          },
        ],
        usage,
      },
    };
  }

  public async analyzeTrends(): ReturnType<AiGatewayPort["analyzeTrends"]> {
    if (this.mode !== "ok") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    return {
      ok: true,
      value: {
        signals: [{ targetType: "CATEGORY" as never, targetId: null, signal: "Suben los lavarropas inverter", score: 0.8, window: "30d" }],
        usage,
      },
    };
  }

  public async optimizePricing(): ReturnType<AiGatewayPort["optimizePricing"]> {
    if (this.mode !== "ok") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    return {
      ok: true,
      value: {
        suggestions: [
          {
            variantId: "018f0000-0000-7000-8000-00000000bbbb",
            suggestedAmountMinor: 120_000,
            currency: "ARS",
            marginPct: 32,
            rationale: "Margen sano frente al costo vigente.",
            withinMinMargin: true,
          },
        ],
        usage,
      },
    };
  }

  public async analyzeImage(): ReturnType<AiGatewayPort["analyzeImage"]> {
    if (this.mode !== "ok") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    return {
      ok: true,
      value: {
        analysis: {
          summary: "Foto correcta",
          qualityScore: 70,
          issues: [],
          strengths: ["nitidez"],
          enhancementPlan: "replace background",
          isUsableSource: true,
        },
        model: "gemini",
        usage,
      },
    };
  }

  public async enhanceImage(): ReturnType<AiGatewayPort["enhanceImage"]> {
    if (this.mode !== "ok") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    return {
      ok: true,
      value: {
        image: { data: "aW1n", mimeType: "image/png" },
        analysis: {
          summary: "Foto correcta",
          qualityScore: 70,
          issues: [],
          strengths: [],
          enhancementPlan: "replace background",
          isUsableSource: true,
        },
        promptUsed: "studio prompt",
        model: "gemini",
        usage,
      },
    };
  }

  public async generateImage(): ReturnType<AiGatewayPort["generateImage"]> {
    if (this.mode !== "ok") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    return {
      ok: true,
      value: {
        image: { data: "aW1n", mimeType: "image/png" },
        promptUsed: "studio prompt",
        model: "gemini",
        usage,
      },
    };
  }
}

class FakeRepository implements AiRepository {
  public generations = new Map<string, AiGenerationSummary & { promptRef: string }>();
  public alerts = new Map<string, AiAlertRecord & { dedupeKey: string | null }>();
  public dailySpentMinor = 0;

  public async createGeneration(record: CreateGenerationRecord): Promise<void> {
    this.generations.set(record.id, {
      id: record.id,
      kind: record.kind,
      targetType: record.targetType,
      targetId: record.targetId,
      status: AiGenerationStatus.QUEUED,
      costEstimateMinor: record.costEstimateMinor,
      currency: "ARS",
      actorId: record.actorId,
      createdAt: new Date().toISOString(),
      completedAt: null,
      promptRef: record.promptRef,
    });
  }

  public async completeGeneration(record: CompleteGenerationRecord): Promise<void> {
    const existing = this.generations.get(record.id);
    if (!existing) return;
    existing.status = record.status;
    existing.completedAt = new Date().toISOString();
    if (record.costEstimateMinor !== undefined) {
      existing.costEstimateMinor = record.costEstimateMinor;
    }
  }

  public async findGenerationById(id: string): Promise<AiGenerationSummary | null> {
    return this.generations.get(id) ?? null;
  }

  public async findGenerationByPromptRef(promptRef: string): Promise<AiGenerationSummary | null> {
    for (const generation of this.generations.values()) {
      if (generation.promptRef === promptRef) return generation;
    }
    return null;
  }

  public async listGenerations(filters: ListGenerationsFilters): Promise<{ items: AiGenerationSummary[]; nextCursor: string | null }> {
    return { items: [...this.generations.values()].slice(0, filters.limit), nextCursor: null };
  }

  public async sumCostSince(): Promise<number> {
    return this.dailySpentMinor;
  }

  public async usageSummary(): ReturnType<AiRepository["usageSummary"]> {
    return { totalCostMinor: this.dailySpentMinor, count: this.generations.size, byKind: [], byStatus: [] };
  }

  public async upsertOpenAlert(record: UpsertAlertRecord): Promise<AiAlertRecord> {
    for (const alert of this.alerts.values()) {
      if (alert.dedupeKey === record.dedupeKey && alert.status === AiAlertStatus.OPEN) {
        alert.payload = record.payload;
        return alert;
      }
    }
    const created = {
      id: record.id,
      kind: record.kind,
      payload: record.payload,
      status: AiAlertStatus.OPEN,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      dedupeKey: record.dedupeKey,
    };
    this.alerts.set(record.id, created);
    return created;
  }

  public async findAlertById(id: string): Promise<AiAlertRecord | null> {
    return this.alerts.get(id) ?? null;
  }

  public async listAlerts(filters: ListAlertsFilters): Promise<{ items: AiAlertRecord[]; nextCursor: string | null }> {
    return { items: [...this.alerts.values()].slice(0, filters.limit), nextCursor: null };
  }

  public async setAlertStatus(input: {
    alertId: string;
    status: AiAlertStatus;
    resolvedBy: string | null;
    note: string | null;
  }): Promise<AiAlertRecord | null> {
    const alert = this.alerts.get(input.alertId);
    if (!alert) return null;
    alert.status = input.status;
    alert.resolvedAt = input.status === AiAlertStatus.RESOLVED || input.status === AiAlertStatus.DISMISSED ? new Date().toISOString() : null;
    return alert;
  }
}

class FakeRateLimiter implements AiRateLimiterPort {
  public constructor(private readonly retryAfter: number | null = null) {}

  public async check(): Promise<number | null> {
    return this.retryAfter;
  }
}

class FakeContextReader implements AiContextReaderPort {
  public constructor(private readonly hasProduct: boolean = true) {}

  public async getProductContext(): Promise<AiProductContext | null> {
    return this.hasProduct ? productContext : null;
  }

  public async getCategoryContext(): ReturnType<AiContextReaderPort["getCategoryContext"]> {
    return { categoryId: "018f0000-0000-7000-8000-00000000cccc", name: "Lavarropas", description: null };
  }

  public async listPublishedCandidates(): ReturnType<AiContextReaderPort["listPublishedCandidates"]> {
    return [
      { productId, title: "Lavarropas LG 22kg", categoryId: "018f0000-0000-7000-8000-00000000cccc", categoryName: "Lavarropas", brandName: "LG", attributes: {} },
    ];
  }

  public async getPricingContexts(): ReturnType<AiContextReaderPort["getPricingContexts"]> {
    return [
      {
        variantId: "018f0000-0000-7000-8000-00000000bbbb",
        productTitle: "Lavarropas LG 22kg",
        categoryName: "Lavarropas",
        currentPriceMinor: 110_000,
        supplierCostMinor: 80_000,
        currency: "ARS",
        minMarginBps: 2_000,
      },
    ];
  }

  public async getFallbackRecommendations(): ReturnType<AiContextReaderPort["getFallbackRecommendations"]> {
    return [
      {
        productId,
        score: 0.5,
        reasonCodes: ["same_category"],
        evidence: { matchedAttributes: [], basedOn: ["fallback_precomputed"] },
      },
    ];
  }
}

const quota = { perOperationLimitMinor: 50_000, dailyActorLimitMinor: 500_000 };

const newService = (options?: {
  gateway?: AiGatewayPort;
  repository?: FakeRepository;
  rateLimiter?: AiRateLimiterPort;
  contextReader?: AiContextReaderPort;
  quotaOverride?: typeof quota;
}) =>
  new AiService(
    options?.gateway ?? new FakeGateway(),
    options?.repository ?? new FakeRepository(),
    options?.rateLimiter ?? new FakeRateLimiter(),
    options?.contextReader ?? new FakeContextReader(),
    options?.quotaOverride ?? quota,
  );

describe("AiService.generateDescription", () => {
  it("genera descripcion, registra la generacion y reconcilia el costo", async () => {
    const repository = new FakeRepository();
    const service = newService({ repository });
    const result = await service.generateDescription(owner, { productId, locale: "es-AR", maxChars: 1200 }, "req-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe(AiGenerationStatus.SUCCEEDED);
    expect(result.value.text?.text).toBe("Descripcion generada.");
    const stored = repository.generations.get(result.value.generationId);
    expect(stored?.status).toBe(AiGenerationStatus.SUCCEEDED);
    expect(stored?.costEstimateMinor).toBe(350);
  });

  it("rechaza a un rol sin permiso de IA", async () => {
    const result = await newService().generateDescription(support, { productId, locale: "es-AR", maxChars: 1200 }, "req-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("FORBIDDEN");
  });

  it("responde RATE_LIMITED cuando la ventana se agota", async () => {
    const service = newService({ rateLimiter: new FakeRateLimiter(42) });
    const result = await service.generateDescription(owner, { productId, locale: "es-AR", maxChars: 1200 }, "req-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "RATE_LIMITED", retryAfterSeconds: 42 });
  });

  it("responde AI_QUOTA_EXCEEDED cuando la cuota diaria del actor se agota", async () => {
    const repository = new FakeRepository();
    repository.dailySpentMinor = 499_900;
    const service = newService({ repository });
    const result = await service.generateDescription(owner, { productId, locale: "es-AR", maxChars: 1200 }, "req-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("AI_QUOTA_EXCEEDED");
  });

  it("marca FAILED y devuelve 503 cuando la IA no responde", async () => {
    const repository = new FakeRepository();
    const service = newService({ gateway: new FakeGateway("down"), repository });
    const result = await service.generateDescription(owner, { productId, locale: "es-AR", maxChars: 1200 }, "req-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("AI_UPSTREAM_UNAVAILABLE");
    const [generation] = [...repository.generations.values()];
    expect(generation?.status).toBe(AiGenerationStatus.FAILED);
  });

  it("rechaza respuesta invalida sin persistir contenido", async () => {
    const service = newService({ gateway: new FakeGateway("invalid") });
    const result = await service.generateDescription(owner, { productId, locale: "es-AR", maxChars: 1200 }, "req-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("AI_RESPONSE_INVALID");
  });

  it("rechaza texto vacio como AI_CONTENT_REJECTED", async () => {
    const service = newService({ gateway: new FakeGateway("empty") });
    const result = await service.generateDescription(owner, { productId, locale: "es-AR", maxChars: 1200 }, "req-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("AI_CONTENT_REJECTED");
  });

  it("falla con TARGET_NOT_FOUND si el producto no existe", async () => {
    const service = newService({ contextReader: new FakeContextReader(false) });
    const result = await service.generateDescription(owner, { productId, locale: "es-AR", maxChars: 1200 }, "req-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("TARGET_NOT_FOUND");
  });

  it("es idempotente: la misma idempotency key no duplica generacion ni costo", async () => {
    const repository = new FakeRepository();
    const service = newService({ repository });
    const input = { productId, locale: "es-AR", maxChars: 1200, idempotencyKey: "same-key-123" };
    const first = await service.generateDescription(owner, input, "req-1");
    const second = await service.generateDescription(owner, input, "req-2");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.generationId).toBe(first.value.generationId);
    expect(repository.generations.size).toBe(1);
  });
});

describe("AiService.getRecommendations", () => {
  it("degrada a recomendaciones precomputadas cuando la IA esta caida", async () => {
    const repository = new FakeRepository();
    const service = newService({ gateway: new FakeGateway("down"), repository });
    const result = await service.getRecommendations(owner, { limit: 6 }, "req-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degraded).toBe(true);
    expect(result.value.recommendations.length).toBeGreaterThan(0);
    const [generation] = [...repository.generations.values()];
    expect(generation?.status).toBe(AiGenerationStatus.DEGRADED);
  });

  it("devuelve recomendaciones con evidencia cuando la IA responde", async () => {
    const result = await newService().getRecommendations(owner, { limit: 6 }, "req-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degraded).toBe(false);
    expect(result.value.recommendations[0]?.reasonCodes).toContain("same_category");
  });
});

describe("AiService.optimizePricing", () => {
  it("permite a FINANCE y devuelve sugerencias sin aplicar precios", async () => {
    const finance: Actor = { kind: "admin", userId: "018f0000-0000-7000-8000-000000000004", role: AdminRole.FINANCE, sessionId: "s4" };
    const result = await newService().optimizePricing(finance, { variantId: "018f0000-0000-7000-8000-00000000bbbb" }, "req-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.suggestions[0]?.withinMinMargin).toBe(true);
  });

  it("rechaza a CATALOG_MANAGER porque no puede ver costo", async () => {
    const result = await newService().optimizePricing(catalogManager, { variantId: "018f0000-0000-7000-8000-00000000bbbb" }, "req-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("FORBIDDEN");
  });
});

describe("AiService alerts", () => {
  it("analyzeTrends crea alertas TREND deduplicadas y ABM funciona", async () => {
    const repository = new FakeRepository();
    const service = newService({ repository });
    const first = await service.analyzeTrends(owner, { scope: "store", window: "30d" }, "req-1");
    expect(first.ok).toBe(true);
    expect(repository.alerts.size).toBe(1);
    const second = await service.analyzeTrends(owner, { scope: "store", window: "30d", idempotencyKey: "otra" }, "req-2");
    expect(second.ok).toBe(true);
    expect(repository.alerts.size).toBe(1);

    const [alert] = [...repository.alerts.values()];
    expect(alert?.kind).toBe(AiAlertKind.TREND);
    const resolved = await service.resolveAlert(owner, { alertId: alert?.id ?? "" });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.status).toBe(AiAlertStatus.RESOLVED);
  });

  it("rechaza gestionar alertas a roles sin permiso", async () => {
    const result = await newService().listAlerts(catalogManager, { limit: 20 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("FORBIDDEN");
  });
});
