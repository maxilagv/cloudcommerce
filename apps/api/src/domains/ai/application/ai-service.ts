import {
  AiAlertKind,
  AiAlertStatus,
  AiGenerationKind,
  AiGenerationStatus,
  AiTargetType,
  type Actor,
  type AiAlertListResult,
  type AiAlertRecord,
  type AiGeneratedImage,
  type AiImageAnalysis,
  type AiGenerationListResult,
  type AiGenerationSummary,
  type AiPriceSuggestion,
  type AiRecommendationResult,
  type AiSeo,
  type AiSpecGroups,
  type AiText,
  type AiTrendSignal,
  type AiUsage,
  type AiUsageSummary,
} from "@cloudcommerce/types";
import type {
  AcknowledgeAiAlertInput,
  AnalyzeImageInput,
  AnalyzeTrendsInput,
  DismissAiAlertInput,
  GenerateDescriptionInput,
  GenerateImageInput,
  GenerateSeoInput,
  GenerateSpecsInput,
  GetGenerationInput,
  GetRecommendationsInput,
  GetUsageSummaryInput,
  ListAiAlertsInput,
  ListGenerationsInput,
  OptimizePricingInput,
  ResolveAiAlertInput,
} from "@cloudcommerce/validators";
import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { AiDomainError } from "../../../shared/errors/domain-error.js";
import {
  canManageAiAlerts,
  canOptimizePricing,
  canUseAiContent,
  canUseAiTrends,
  canViewAiUsage,
} from "../domain/ai-permissions.js";
import type {
  AiContextReaderPort,
  AiGatewayPort,
  AiImageContext,
  AiImagePayload,
  AiMediaPort,
  AiRateLimiterPort,
  AiRepository,
  AiTargetWriterPort,
} from "./ports.js";

const IDEMPOTENCY_WINDOW_MINUTES = 10;

/** Costos estimados por operación en centavos ARS. Se reconcilian con el usage real al cerrar. */
const COST_ESTIMATE_MINOR: Record<AiGenerationKind, number> = {
  [AiGenerationKind.DESCRIPTION]: 400,
  [AiGenerationKind.SPECS]: 500,
  [AiGenerationKind.SEO]: 250,
  [AiGenerationKind.IMAGE]: 5_000,
  [AiGenerationKind.RECOMMENDATION]: 300,
  [AiGenerationKind.TRENDS]: 800,
  [AiGenerationKind.PRICING]: 800,
};

export type AiQuotaConfig = {
  perOperationLimitMinor: number;
  dailyActorLimitMinor: number;
};

export type AiImagePorts = {
  media: AiMediaPort;
  targetWriter: AiTargetWriterPort;
};

export class AiService {
  public constructor(
    private readonly gateway: AiGatewayPort,
    private readonly repository: AiRepository,
    private readonly rateLimiter: AiRateLimiterPort,
    private readonly contextReader: AiContextReaderPort,
    private readonly quota: AiQuotaConfig,
    private readonly imagePorts: AiImagePorts | null = null,
  ) {}

  public async generateDescription(
    actor: Actor,
    input: GenerateDescriptionInput,
    requestId: string,
  ): Promise<Result<{ generationId: string; status: AiGenerationStatus; text: AiText | null }, AiDomainError>> {
    if (!canUseAiContent(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const gate = await this.openGeneration(actor, AiGenerationKind.DESCRIPTION, AiTargetType.PRODUCT, input.productId, input, input.idempotencyKey);
    if (!gate.ok) {
      return gate.error.type === "DUPLICATE"
        ? ok({ generationId: gate.error.existing.id, status: gate.error.existing.status, text: null })
        : err(gate.error as AiDomainError);
    }
    const product = await this.contextReader.getProductContext(input.productId);
    if (!product) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "TARGET_NOT_FOUND" });
      return err({ type: "TARGET_NOT_FOUND" });
    }
    const result = await this.gateway.generateProductDescription({
      generationId: gate.value,
      requestId,
      locale: input.locale,
      tone: input.tone ?? null,
      maxChars: input.maxChars,
      product,
    });
    if (!result.ok) {
      return this.failGeneration(gate.value, result.error.type);
    }
    if (result.value.text.trim().length === 0) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "AI_CONTENT_REJECTED" });
      return err({ type: "AI_CONTENT_REJECTED" });
    }
    await this.repository.completeGeneration({
      id: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      costEstimateMinor: result.value.usage.costMinor,
    });
    return ok({ generationId: gate.value, status: AiGenerationStatus.SUCCEEDED, text: result.value });
  }

  public async generateSpecs(
    actor: Actor,
    input: GenerateSpecsInput,
    requestId: string,
  ): Promise<Result<{ generationId: string; status: AiGenerationStatus; specs: AiSpecGroups | null }, AiDomainError>> {
    if (!canUseAiContent(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const gate = await this.openGeneration(actor, AiGenerationKind.SPECS, AiTargetType.PRODUCT, input.productId, input, input.idempotencyKey);
    if (!gate.ok) {
      return gate.error.type === "DUPLICATE"
        ? ok({ generationId: gate.error.existing.id, status: gate.error.existing.status, specs: null })
        : err(gate.error as AiDomainError);
    }
    const product = await this.contextReader.getProductContext(input.productId);
    if (!product) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "TARGET_NOT_FOUND" });
      return err({ type: "TARGET_NOT_FOUND" });
    }
    const result = await this.gateway.generateProductSpecs({
      generationId: gate.value,
      requestId,
      sourceHints: input.sourceHints ?? null,
      product,
    });
    if (!result.ok) {
      return this.failGeneration(gate.value, result.error.type);
    }
    if (result.value.groups.length === 0) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "AI_CONTENT_REJECTED" });
      return err({ type: "AI_CONTENT_REJECTED" });
    }
    await this.repository.completeGeneration({
      id: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      costEstimateMinor: result.value.usage.costMinor,
    });
    return ok({ generationId: gate.value, status: AiGenerationStatus.SUCCEEDED, specs: result.value });
  }

  public async generateSeo(
    actor: Actor,
    input: GenerateSeoInput,
    requestId: string,
  ): Promise<Result<{ generationId: string; status: AiGenerationStatus; seo: AiSeo | null }, AiDomainError>> {
    if (!canUseAiContent(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const targetType = input.productId ? AiTargetType.PRODUCT : AiTargetType.CATEGORY;
    const targetId = input.productId ?? input.categoryId ?? null;
    const gate = await this.openGeneration(actor, AiGenerationKind.SEO, targetType, targetId, input, input.idempotencyKey);
    if (!gate.ok) {
      return gate.error.type === "DUPLICATE"
        ? ok({ generationId: gate.error.existing.id, status: gate.error.existing.status, seo: null })
        : err(gate.error as AiDomainError);
    }
    const product = input.productId ? await this.contextReader.getProductContext(input.productId) : null;
    const category = input.categoryId ? await this.contextReader.getCategoryContext(input.categoryId) : null;
    if (!product && !category) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "TARGET_NOT_FOUND" });
      return err({ type: "TARGET_NOT_FOUND" });
    }
    const result = await this.gateway.generateSeo({ generationId: gate.value, requestId, product, category });
    if (!result.ok) {
      return this.failGeneration(gate.value, result.error.type);
    }
    await this.repository.completeGeneration({
      id: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      costEstimateMinor: result.value.usage.costMinor,
    });
    return ok({ generationId: gate.value, status: AiGenerationStatus.SUCCEEDED, seo: result.value });
  }

  public async analyzeImage(
    actor: Actor,
    input: AnalyzeImageInput,
    requestId: string,
  ): Promise<Result<{ generationId: string; status: AiGenerationStatus; analysis: AiImageAnalysis | null }, AiDomainError>> {
    if (!canUseAiContent(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    if (!this.imagePorts) {
      return err({ type: "AI_UPSTREAM_UNAVAILABLE" });
    }
    const targetType = input.productId ? AiTargetType.PRODUCT : AiTargetType.CATEGORY;
    const targetId = input.productId ?? input.categoryId ?? null;
    const gate = await this.openGeneration(actor, AiGenerationKind.IMAGE, targetType, targetId, input, input.idempotencyKey);
    if (!gate.ok) {
      return gate.error.type === "DUPLICATE"
        ? ok({ generationId: gate.error.existing.id, status: gate.error.existing.status, analysis: null })
        : err(gate.error as AiDomainError);
    }
    const prepared = await this.prepareImageInput(gate.value, input.productId ?? null, input.categoryId ?? null, input.sourceMediaAssetId ?? null, true);
    if (!prepared.ok) return prepared;
    const { context, source, subject } = prepared.value;
    if (!source) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "IMAGE_SOURCE_REQUIRED" });
      return err({ type: "IMAGE_SOURCE_REQUIRED" });
    }
    const result = await this.gateway.analyzeImage({ generationId: gate.value, requestId, subject, context, image: source });
    if (!result.ok) {
      return this.failGeneration(gate.value, result.error.type);
    }
    await this.repository.completeGeneration({
      id: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      costEstimateMinor: result.value.usage.costMinor,
    });
    return ok({
      generationId: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      analysis: { ...result.value.analysis, model: result.value.model, usage: result.value.usage },
    });
  }

  public async generateImage(
    actor: Actor,
    input: GenerateImageInput,
    requestId: string,
  ): Promise<Result<{ generationId: string; status: AiGenerationStatus; image: AiGeneratedImage | null }, AiDomainError>> {
    if (!canUseAiContent(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    if (!this.imagePorts) {
      return err({ type: "AI_UPSTREAM_UNAVAILABLE" });
    }
    const targetType = input.productId ? AiTargetType.PRODUCT : AiTargetType.CATEGORY;
    const targetId = input.productId ?? input.categoryId ?? null;
    const gate = await this.openGeneration(actor, AiGenerationKind.IMAGE, targetType, targetId, input, input.idempotencyKey);
    if (!gate.ok) {
      return gate.error.type === "DUPLICATE"
        ? ok({ generationId: gate.error.existing.id, status: gate.error.existing.status, image: null })
        : err(gate.error as AiDomainError);
    }
    const sourceRequired = input.mode === "enhance";
    const prepared = await this.prepareImageInput(gate.value, input.productId ?? null, input.categoryId ?? null, input.sourceMediaAssetId ?? null, true);
    if (!prepared.ok) return prepared;
    const { context, source, subject } = prepared.value;
    if (sourceRequired && !source) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "IMAGE_SOURCE_REQUIRED" });
      return err({ type: "IMAGE_SOURCE_REQUIRED" });
    }

    let generated: { image: { data: string; mimeType: string }; promptUsed: string; model: string; usage: AiUsage };
    let analysis: AiGeneratedImage["analysis"] = null;
    if (input.mode === "enhance" && source) {
      const upstream = await this.gateway.enhanceImage({
        generationId: gate.value,
        requestId,
        subject,
        context,
        image: source,
        style: input.style,
        instructions: input.instructions ?? null,
      });
      if (!upstream.ok) {
        return this.failGeneration(gate.value, upstream.error.type);
      }
      generated = upstream.value;
      analysis = upstream.value.analysis;
    } else {
      const upstream = await this.gateway.generateImage({
        generationId: gate.value,
        requestId,
        subject,
        context,
        style: input.style,
        instructions: input.instructions ?? null,
        referenceImage: source,
      });
      if (!upstream.ok) {
        return this.failGeneration(gate.value, upstream.error.type);
      }
      generated = upstream.value;
    }

    const saved = await this.imagePorts.media.saveGeneratedImage({
      data: generated.image.data,
      mimeType: generated.image.mimeType,
      altText: context.title || null,
      createdBy: actor.kind === "admin" ? actor.userId : null,
    });
    if (!saved) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "AI_RESPONSE_INVALID" });
      return err({ type: "AI_RESPONSE_INVALID" });
    }

    let applied = false;
    if (input.applyToTarget) {
      applied = input.productId
        ? await this.imagePorts.targetWriter.setProductMainImage(input.productId, saved.mediaAssetId)
        : input.categoryId
          ? await this.imagePorts.targetWriter.setCategoryImage(input.categoryId, saved.mediaAssetId)
          : false;
    }

    await this.repository.completeGeneration({
      id: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      costEstimateMinor: generated.usage.costMinor,
    });
    return ok({
      generationId: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      image: {
        mediaAssetId: saved.mediaAssetId,
        appliedToTarget: applied,
        analysis,
        promptUsed: generated.promptUsed,
        model: generated.model,
        usage: generated.usage,
      },
    });
  }

  /** Contexto + imagen fuente para operaciones de imagen (producto o categoría). */
  private async prepareImageInput(
    generationId: string,
    productId: string | null,
    categoryId: string | null,
    sourceMediaAssetId: string | null,
    loadSource: boolean,
  ): Promise<Result<{ context: AiImageContext; source: AiImagePayload | null; subject: "product" | "category" }, AiDomainError>> {
    const ports = this.imagePorts;
    if (!ports) {
      return err({ type: "AI_UPSTREAM_UNAVAILABLE" });
    }
    let context: AiImageContext | null = null;
    let subject: "product" | "category" = "product";
    let defaultImageId: string | null = null;
    if (productId) {
      const product = await this.contextReader.getProductContext(productId);
      if (product) {
        context = {
          title: product.title,
          categoryName: product.categoryName,
          brandName: product.brandName,
          description: product.description || null,
        };
        defaultImageId = await ports.targetWriter.getProductMainImageId(productId);
      }
    } else if (categoryId) {
      subject = "category";
      const category = await this.contextReader.getCategoryContext(categoryId);
      if (category) {
        context = { title: category.name, categoryName: category.name, brandName: null, description: category.description };
        defaultImageId = await ports.targetWriter.getCategoryImageId(categoryId);
      }
    }
    if (!context) {
      await this.repository.completeGeneration({ id: generationId, status: AiGenerationStatus.FAILED, errorCode: "TARGET_NOT_FOUND" });
      return err({ type: "TARGET_NOT_FOUND" });
    }
    let source: AiImagePayload | null = null;
    if (loadSource) {
      const imageId = sourceMediaAssetId ?? defaultImageId;
      if (imageId) {
        source = await ports.media.loadImage(imageId);
      }
    }
    return ok({ context, source, subject });
  }

  public async getRecommendations(
    actor: Actor,
    input: GetRecommendationsInput,
    requestId: string,
  ): Promise<Result<AiRecommendationResult, AiDomainError>> {
    if (!canUseAiContent(actor) && actor.kind !== "system") {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const targetId = input.seedProductId ?? input.categoryId ?? null;
    const targetType = input.seedProductId ? AiTargetType.PRODUCT : input.categoryId ? AiTargetType.CATEGORY : AiTargetType.NONE;
    const recommendationKey = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const gate = await this.openGeneration(actor, AiGenerationKind.RECOMMENDATION, targetType, targetId, input, recommendationKey);
    if (!gate.ok) {
      if (gate.error.type === "DUPLICATE") {
        return err({ type: "AI_UPSTREAM_UNAVAILABLE" });
      }
      return err(gate.error as AiDomainError);
    }
    const seed = input.seedProductId ? await this.contextReader.getProductContext(input.seedProductId) : null;
    const candidates = await this.contextReader.listPublishedCandidates({
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.seedProductId !== undefined ? { excludeProductId: input.seedProductId } : {}),
      limit: 60,
    });
    const result = await this.gateway.getRecommendations({
      generationId: gate.value,
      requestId,
      seed: seed
        ? {
            productId: seed.productId,
            title: seed.title,
            categoryId: input.categoryId ?? "",
            categoryName: seed.categoryName,
            brandName: seed.brandName,
            attributes: {},
          }
        : null,
      candidates,
      limit: input.limit,
    });
    if (!result.ok) {
      const fallback = await this.contextReader.getFallbackRecommendations({
        ...(input.seedProductId !== undefined ? { seedProductId: input.seedProductId } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        limit: input.limit,
      });
      await this.repository.completeGeneration({
        id: gate.value,
        status: AiGenerationStatus.DEGRADED,
        errorCode: result.error.type,
      });
      return ok({ recommendations: fallback, degraded: true });
    }
    await this.repository.completeGeneration({
      id: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      costEstimateMinor: result.value.usage.costMinor,
    });
    return ok({ recommendations: result.value.recommendations.slice(0, input.limit), degraded: false });
  }

  public async analyzeTrends(
    actor: Actor,
    input: AnalyzeTrendsInput,
    requestId: string,
  ): Promise<Result<{ generationId: string; status: AiGenerationStatus; signals: AiTrendSignal[] }, AiDomainError>> {
    if (!canUseAiTrends(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const targetType = input.scope === "category" ? AiTargetType.CATEGORY : input.scope === "supplierFeed" ? AiTargetType.SUPPLIER_FEED : AiTargetType.NONE;
    const gate = await this.openGeneration(actor, AiGenerationKind.TRENDS, targetType, input.scopeId ?? null, input, input.idempotencyKey);
    if (!gate.ok) {
      return gate.error.type === "DUPLICATE"
        ? ok({ generationId: gate.error.existing.id, status: gate.error.existing.status, signals: [] })
        : err(gate.error as AiDomainError);
    }
    const candidates = await this.contextReader.listPublishedCandidates({
      ...(input.scope === "category" && input.scopeId ? { categoryId: input.scopeId } : {}),
      limit: 120,
    });
    const result = await this.gateway.analyzeTrends({
      generationId: gate.value,
      requestId,
      scope: input.scope,
      scopeId: input.scopeId ?? null,
      window: input.window,
      candidates,
    });
    if (!result.ok) {
      return this.failGeneration(gate.value, result.error.type);
    }
    for (const signal of result.value.signals) {
      await this.repository.upsertOpenAlert({
        id: uuidv7(),
        kind: AiAlertKind.TREND,
        payload: {
          signal: signal.signal,
          score: signal.score,
          window: signal.window,
          targetType: signal.targetType,
          targetId: signal.targetId,
        },
        dedupeKey: `trend:${signal.targetType}:${signal.targetId ?? "store"}:${signal.signal}`,
      });
    }
    await this.repository.completeGeneration({
      id: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      costEstimateMinor: result.value.usage.costMinor,
    });
    return ok({ generationId: gate.value, status: AiGenerationStatus.SUCCEEDED, signals: result.value.signals });
  }

  public async optimizePricing(
    actor: Actor,
    input: OptimizePricingInput,
    requestId: string,
  ): Promise<Result<{ generationId: string; status: AiGenerationStatus; suggestions: AiPriceSuggestion[] }, AiDomainError>> {
    if (!canOptimizePricing(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const targetType = input.variantId ? AiTargetType.VARIANT : AiTargetType.CATEGORY;
    const targetId = input.variantId ?? input.categoryId ?? null;
    const gate = await this.openGeneration(actor, AiGenerationKind.PRICING, targetType, targetId, input, input.idempotencyKey);
    if (!gate.ok) {
      return gate.error.type === "DUPLICATE"
        ? ok({ generationId: gate.error.existing.id, status: gate.error.existing.status, suggestions: [] })
        : err(gate.error as AiDomainError);
    }
    const contexts = await this.contextReader.getPricingContexts({
      ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      limit: 50,
    });
    if (contexts.length === 0) {
      await this.repository.completeGeneration({ id: gate.value, status: AiGenerationStatus.FAILED, errorCode: "TARGET_NOT_FOUND" });
      return err({ type: "TARGET_NOT_FOUND" });
    }
    const result = await this.gateway.optimizePricing({ generationId: gate.value, requestId, contexts });
    if (!result.ok) {
      return this.failGeneration(gate.value, result.error.type);
    }
    await this.repository.completeGeneration({
      id: gate.value,
      status: AiGenerationStatus.SUCCEEDED,
      costEstimateMinor: result.value.usage.costMinor,
    });
    return ok({ generationId: gate.value, status: AiGenerationStatus.SUCCEEDED, suggestions: result.value.suggestions });
  }

  public async listGenerations(actor: Actor, input: ListGenerationsInput): Promise<Result<AiGenerationListResult, AiDomainError>> {
    if (!canViewAiUsage(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    return ok(await this.repository.listGenerations(input));
  }

  public async getGeneration(actor: Actor, input: GetGenerationInput): Promise<Result<AiGenerationSummary, AiDomainError>> {
    if (!canViewAiUsage(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const generation = await this.repository.findGenerationById(input.generationId);
    return generation ? ok(generation) : err({ type: "GENERATION_NOT_FOUND" });
  }

  public async getUsageSummary(actor: Actor, input: GetUsageSummaryInput): Promise<Result<AiUsageSummary, AiDomainError>> {
    if (!canViewAiUsage(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const from = new Date(input.dateFrom);
    const to = new Date(input.dateTo);
    const summary = await this.repository.usageSummary(from, to);
    return ok({
      period: { from: from.toISOString(), to: to.toISOString() },
      totalCostMinor: summary.totalCostMinor,
      currency: "ARS",
      count: summary.count,
      byKind: summary.byKind,
      byStatus: summary.byStatus,
    });
  }

  public async listAlerts(actor: Actor, input: ListAiAlertsInput): Promise<Result<AiAlertListResult, AiDomainError>> {
    if (!canManageAiAlerts(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    return ok(await this.repository.listAlerts(input));
  }

  public async acknowledgeAlert(actor: Actor, input: AcknowledgeAiAlertInput): Promise<Result<AiAlertRecord, AiDomainError>> {
    return this.transitionAlert(actor, input.alertId, AiAlertStatus.ACKNOWLEDGED, null);
  }

  public async resolveAlert(actor: Actor, input: ResolveAiAlertInput): Promise<Result<AiAlertRecord, AiDomainError>> {
    return this.transitionAlert(actor, input.alertId, AiAlertStatus.RESOLVED, input.note ?? null);
  }

  public async dismissAlert(actor: Actor, input: DismissAiAlertInput): Promise<Result<AiAlertRecord, AiDomainError>> {
    return this.transitionAlert(actor, input.alertId, AiAlertStatus.DISMISSED, input.reason);
  }

  private async transitionAlert(
    actor: Actor,
    alertId: string,
    status: AiAlertStatus,
    note: string | null,
  ): Promise<Result<AiAlertRecord, AiDomainError>> {
    if (!canManageAiAlerts(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const alert = await this.repository.findAlertById(alertId);
    if (!alert) {
      return err({ type: "ALERT_NOT_FOUND" });
    }
    const updated = await this.repository.setAlertStatus({
      alertId,
      status,
      resolvedBy: actor.kind === "admin" ? actor.userId : null,
      note,
    });
    return updated ? ok(updated) : err({ type: "ALERT_NOT_FOUND" });
  }

  /**
   * Compuerta común de toda generación: rate limit → cuota de costo → dedup por
   * idempotencia → alta de ai_generation en QUEUED.
   */
  private async openGeneration(
    actor: Actor,
    kind: AiGenerationKind,
    targetType: AiTargetType,
    targetId: string | null,
    input: unknown,
    idempotencyKey: string | undefined,
  ): Promise<Result<string, AiDomainError | { type: "DUPLICATE"; existing: AiGenerationSummary }>> {
    const actorId = actor.kind === "admin" ? actor.userId : null;
    const actorKey = actor.kind === "admin" ? actor.userId : actor.kind === "system" ? `system:${actor.service}` : "anonymous";

    const retryAfter = await this.rateLimiter.check(actorKey, kind);
    if (retryAfter !== null) {
      return err({ type: "RATE_LIMITED", retryAfterSeconds: retryAfter });
    }

    const estimate = COST_ESTIMATE_MINOR[kind];
    if (estimate > this.quota.perOperationLimitMinor) {
      return err({ type: "AI_QUOTA_EXCEEDED" });
    }
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const spentToday = await this.repository.sumCostSince(actorId, dayStart);
    if (spentToday + estimate > this.quota.dailyActorLimitMinor) {
      return err({ type: "AI_QUOTA_EXCEEDED" });
    }

    const promptRef = createHash("sha256")
      .update(JSON.stringify({ kind, actorKey, targetId, input, idempotencyKey: idempotencyKey ?? null }))
      .digest("hex");
    const existing = await this.repository.findGenerationByPromptRef(promptRef, IDEMPOTENCY_WINDOW_MINUTES);
    if (existing) {
      return err({ type: "DUPLICATE", existing });
    }

    const generationId = uuidv7();
    await this.repository.createGeneration({
      id: generationId,
      kind,
      targetType,
      targetId,
      promptRef,
      costEstimateMinor: estimate,
      actorId,
    });
    return ok(generationId);
  }

  private failGeneration<T>(generationId: string, errorType: "UPSTREAM_UNAVAILABLE" | "RESPONSE_INVALID"): Promise<Result<T, AiDomainError>> {
    return this.repository
      .completeGeneration({ id: generationId, status: AiGenerationStatus.FAILED, errorCode: errorType })
      .then(() => err(errorType === "UPSTREAM_UNAVAILABLE" ? { type: "AI_UPSTREAM_UNAVAILABLE" } : { type: "AI_RESPONSE_INVALID" }));
  }
}
