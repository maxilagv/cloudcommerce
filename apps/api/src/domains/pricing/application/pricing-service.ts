import {
  PriceOrigin,
  PricingScope,
  type Actor,
  type Currency,
  type MarkupRuleResponse,
  type PriceBreakdownInternal,
  type PriceBreakdownPublic,
  type PriceBreakdownResponse,
  type PriceListResponse,
  type SupplierCostResponse,
  type DiscountResponse,
} from "@cloudcommerce/types";
import type {
  CreateDiscountInput,
  ListDiscountsInput,
  SetManualPriceInput,
  SetMarkupRuleInput,
  SetSupplierCostInput,
  UpsertPriceListInput,
  VariantPricingInput,
} from "@cloudcommerce/validators";
import { ok, err, type Result } from "../../../shared/domain/result.js";
import type { PricingDomainError } from "../../../shared/errors/domain-error.js";
import type { InMemoryEventBus } from "../../../shared/events/event-bus.js";
import { v7 as uuidv7 } from "uuid";
import { applyMarkup, applyMinimumMargin, marginBps, minSalePriceForMargin } from "../domain/money.js";
import {
  canManagePricePolicy,
  canManageSupplierCost,
  canReadPricing,
  canViewSensitivePricing,
} from "../domain/pricing-permissions.js";
import type {
  DiscountEntity,
  MarkupRuleEntity,
  PriceEntity,
  PriceListEntity,
  PricingRepository,
  RequestAuditContext,
  SupplierCostEntity,
  VariantPricingContext,
} from "./pricing-repository.js";

type RequestContext = {
  ip: string;
  userAgent: string;
  requestId: string;
  reason?: string | null;
};

type ComputedPrice = {
  variantId: string;
  amountMinor: number;
  compareAtAmountMinor: number | null;
  currency: Currency;
  origin: PriceOrigin;
  validFrom: Date;
  validTo: Date | null;
  supplierCost: SupplierCostEntity;
  markupRule: MarkupRuleEntity | null;
};

export class PricingService {
  public constructor(
    private readonly repository: PricingRepository,
    private readonly eventBus?: InMemoryEventBus,
  ) {}

  public async computeSalePrice(
    actor: Actor,
    input: VariantPricingInput,
  ): Promise<Result<PriceBreakdownResponse, PricingDomainError>> {
    if (!canReadPricing(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const computed = await this.computeVariantPrice(input.variantId, input.currency, new Date());
    if (!computed.ok) {
      return computed;
    }
    return ok(this.presentBreakdown(computed.value, canViewSensitivePricing(actor)));
  }

  public async getCatalogPriceByProductId(
    productId: string,
    currency: Currency = "ARS",
  ): Promise<Result<{ salePriceMinor: number; compareAtPriceMinor: number | null; currency: "ARS" }, PricingDomainError>> {
    const variant = await this.repository.findPrimaryVariantByProductId(productId);
    if (!variant) {
      return err({ type: "PRICE_POLICY_VIOLATION" });
    }
    const computed = await this.computeVariantPrice(variant.variantId, currency, new Date());
    if (!computed.ok) {
      return computed;
    }
    return ok({
      salePriceMinor: computed.value.amountMinor,
      compareAtPriceMinor: computed.value.compareAtAmountMinor,
      currency: "ARS",
    });
  }

  public async setSupplierCost(
    actor: Actor,
    input: SetSupplierCostInput,
    context: RequestContext,
  ): Promise<Result<SupplierCostResponse, PricingDomainError>> {
    if (!canManageSupplierCost(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const variant = await this.repository.findVariantContext(input.variantId);
    if (!variant) {
      return err({ type: "VARIANT_NOT_FOUND" });
    }
    const saved = await this.repository.setSupplierCost(
      {
        variantId: input.variantId,
        supplierId: input.supplierId ?? null,
        costAmountMinor: input.costAmountMinor,
        currency: input.currency,
        validFrom: input.validFrom,
      },
      this.audit(actor, context, "Supplier cost updated"),
    );
    await this.publishPriceChanged(input.variantId);
    return ok(this.presentSupplierCost(saved));
  }

  public async setMarkupRule(
    actor: Actor,
    input: SetMarkupRuleInput,
    context: RequestContext,
  ): Promise<Result<MarkupRuleResponse, PricingDomainError>> {
    if (!canManagePricePolicy(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const saved = await this.repository.setMarkupRule(
      {
        scope: input.scope,
        scopeId: input.scope === PricingScope.GLOBAL ? null : input.scopeId ?? null,
        kind: input.kind,
        value: input.value,
        minMarginBps: input.minMarginBps ?? null,
        createdBy: actor.kind === "admin" ? actor.userId : null,
      },
      this.audit(actor, context, "Markup rule updated"),
    );
    return ok(this.presentMarkupRule(saved));
  }

  public async setManualPrice(
    actor: Actor,
    input: SetManualPriceInput,
    context: RequestContext,
  ): Promise<Result<PriceBreakdownResponse, PricingDomainError>> {
    if (!canManagePricePolicy(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const variant = await this.repository.findVariantContext(input.variantId);
    if (!variant) {
      return err({ type: "VARIANT_NOT_FOUND" });
    }
    const priceList = await this.ensureDefaultPriceList(input.currency);
    const cost = await this.repository.getActiveSupplierCost(input.variantId, input.currency, input.validFrom);
    if (!cost) {
      return err({ type: "NO_SUPPLIER_COST" });
    }
    const rule = await this.repository.findApplicableMarkupRule(variant);
    const minMarginBpsValue = rule?.minMarginBps ?? null;
    if (minMarginBpsValue !== null && input.amountMinor < minSalePriceForMargin(cost.costAmountMinor, minMarginBpsValue)) {
      return err({ type: "MARGIN_BELOW_MINIMUM", minMarginBps: minMarginBpsValue });
    }
    await this.repository.setManualPrice(
      {
        variantId: input.variantId,
        listId: priceList.id,
        amountMinor: input.amountMinor,
        currency: input.currency,
        compareAtAmountMinor: input.compareAtAmountMinor ?? null,
        validFrom: input.validFrom,
        validTo: input.validTo ?? null,
        createdBy: actor.kind === "admin" ? actor.userId : null,
      },
      this.audit(actor, context, "Manual sale price updated"),
    );
    await this.publishPriceChanged(input.variantId);
    const computed = await this.computeVariantPrice(input.variantId, input.currency, input.validFrom);
    if (!computed.ok) {
      return computed;
    }
    return ok(this.presentBreakdown(computed.value, canViewSensitivePricing(actor)));
  }

  public async upsertPriceList(actor: Actor, input: UpsertPriceListInput): Promise<Result<PriceListResponse, PricingDomainError>> {
    if (!canManagePricePolicy(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const record: { id?: string; name: string; currency: Currency; isDefault: boolean } = {
      name: input.name,
      currency: input.currency,
      isDefault: input.isDefault,
    };
    if (input.id !== undefined) record.id = input.id;
    const saved = await this.repository.upsertPriceList(record);
    return ok(this.presentPriceList(saved));
  }

  public async createDiscount(
    actor: Actor,
    input: CreateDiscountInput,
  ): Promise<Result<DiscountResponse, PricingDomainError>> {
    if (!canManagePricePolicy(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const saved = await this.repository.createDiscount({
      code: input.code ?? null,
      scope: input.scope,
      scopeId: input.scope === PricingScope.GLOBAL ? null : input.scopeId ?? null,
      kind: input.kind,
      value: input.value,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      maxUses: input.maxUses ?? null,
    });
    return ok(this.presentDiscount(saved));
  }

  public async listDiscounts(actor: Actor, input: ListDiscountsInput): Promise<Result<DiscountResponse[], PricingDomainError>> {
    if (!canReadPricing(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const query: { includeInactive: boolean; code?: string } = { includeInactive: input.includeInactive };
    if (input.code !== undefined) query.code = input.code;
    const discounts = await this.repository.listDiscounts(query);
    return ok(discounts.map((discount) => this.presentDiscount(discount)));
  }

  public async deactivateDiscount(actor: Actor, id: string): Promise<Result<DiscountResponse, PricingDomainError>> {
    if (!canManagePricePolicy(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const saved = await this.repository.deactivateDiscount(id);
    if (!saved) {
      return err({ type: "DISCOUNT_INVALID" });
    }
    return ok(this.presentDiscount(saved));
  }

  private async computeVariantPrice(
    variantId: string,
    currency: Currency,
    at: Date,
  ): Promise<Result<ComputedPrice, PricingDomainError>> {
    if (currency !== "ARS") {
      return err({ type: "CURRENCY_MISMATCH" });
    }
    const variant = await this.repository.findVariantContext(variantId);
    if (!variant || !variant.isActive) {
      return err({ type: "VARIANT_NOT_FOUND" });
    }
    const priceList = await this.ensureDefaultPriceList(currency);
    const cost = await this.repository.getActiveSupplierCost(variantId, currency, at);
    if (!cost) {
      return err({ type: "NO_SUPPLIER_COST" });
    }
    const manualPrice = await this.repository.getActiveManualPrice(variantId, priceList.id, currency, at);
    const markup = await this.repository.findApplicableMarkupRule(variant);
    if (!manualPrice && !markup) {
      return err({ type: "NO_ACTIVE_MARKUP_RULE" });
    }

    if (manualPrice) {
      const ruleMinMargin = markup?.minMarginBps ?? null;
      if (ruleMinMargin !== null && manualPrice.amountMinor < minSalePriceForMargin(cost.costAmountMinor, ruleMinMargin)) {
        return err({ type: "MARGIN_BELOW_MINIMUM", minMarginBps: ruleMinMargin });
      }
      const compareAt = await this.resolveCompareAt(manualPrice, priceList.id, currency, at);
      return ok({
        variantId,
        amountMinor: manualPrice.amountMinor,
        compareAtAmountMinor: compareAt,
        currency,
        origin: PriceOrigin.MANUAL,
        validFrom: manualPrice.validFrom,
        validTo: manualPrice.validTo,
        supplierCost: cost,
        markupRule: markup,
      });
    }

    if (!markup) {
      return err({ type: "NO_ACTIVE_MARKUP_RULE" });
    }
    const base = applyMarkup(cost.costAmountMinor, markup.kind, markup.value);
    const amountMinor = applyMinimumMargin(base, cost.costAmountMinor, markup.minMarginBps);
    const previous = await this.repository.getPreviousPrice(variantId, priceList.id, currency, at);
    const compareAt = previous && previous.amountMinor > amountMinor ? previous.amountMinor : null;
    return ok({
      variantId,
      amountMinor,
      compareAtAmountMinor: compareAt,
      currency,
      origin: PriceOrigin.COMPUTED,
      validFrom: at,
      validTo: null,
      supplierCost: cost,
      markupRule: markup,
    });
  }

  private async resolveCompareAt(price: PriceEntity, listId: string, currency: Currency, at: Date): Promise<number | null> {
    if (price.compareAtAmountMinor && price.compareAtAmountMinor > price.amountMinor) {
      return price.compareAtAmountMinor;
    }
    const previous = await this.repository.getPreviousPrice(price.variantId, listId, currency, at);
    return previous && previous.amountMinor > price.amountMinor ? previous.amountMinor : null;
  }

  private async ensureDefaultPriceList(currency: Currency): Promise<PriceListEntity> {
    const existing = await this.repository.getDefaultPriceList(currency);
    if (existing) {
      return existing;
    }
    return this.repository.upsertPriceList({ name: `${currency} Default`, currency, isDefault: true });
  }

  private presentBreakdown(price: ComputedPrice, includeSensitive: boolean): PriceBreakdownResponse {
    const publicBreakdown: PriceBreakdownPublic = {
      variantId: price.variantId,
      price: { amountMinor: price.amountMinor, currency: price.currency },
      compareAtPrice: price.compareAtAmountMinor ? { amountMinor: price.compareAtAmountMinor, currency: price.currency } : null,
      origin: price.origin,
      validFrom: price.validFrom,
      validTo: price.validTo,
    };
    if (!includeSensitive) {
      return publicBreakdown;
    }
    const internalBreakdown: PriceBreakdownInternal = {
      ...publicBreakdown,
      supplierCost: { amountMinor: price.supplierCost.costAmountMinor, currency: price.currency },
      markupRule: price.markupRule ? this.presentMarkupRule(price.markupRule) : null,
      marginMinor: price.amountMinor - price.supplierCost.costAmountMinor,
      marginBps: marginBps(price.amountMinor, price.supplierCost.costAmountMinor),
    };
    return internalBreakdown;
  }

  private presentPriceList(priceList: PriceListEntity): PriceListResponse {
    return {
      id: priceList.id,
      name: priceList.name,
      currency: priceList.currency,
      isDefault: priceList.isDefault,
    };
  }

  private presentSupplierCost(cost: SupplierCostEntity): SupplierCostResponse {
    return {
      id: cost.id,
      variantId: cost.variantId,
      supplierId: cost.supplierId,
      cost: { amountMinor: cost.costAmountMinor, currency: cost.currency },
      validFrom: cost.validFrom,
      validTo: cost.validTo,
    };
  }

  private presentMarkupRule(rule: MarkupRuleEntity): MarkupRuleResponse {
    return {
      id: rule.id,
      scope: rule.scope,
      scopeId: rule.scopeId,
      kind: rule.kind,
      value: rule.value,
      minMarginBps: rule.minMarginBps,
      isActive: rule.isActive,
      createdBy: rule.createdBy,
      createdAt: rule.createdAt,
    };
  }

  private presentDiscount(discount: DiscountEntity): DiscountResponse {
    return {
      id: discount.id,
      code: discount.code,
      scope: discount.scope,
      scopeId: discount.scopeId,
      kind: discount.kind,
      value: discount.value,
      validFrom: discount.validFrom,
      validTo: discount.validTo,
      maxUses: discount.maxUses,
      usedCount: discount.usedCount,
      isActive: discount.isActive,
    };
  }

  private audit(actor: Actor, context: RequestContext, reason: string): RequestAuditContext {
    return {
      actorId: actor.kind === "admin" ? actor.userId : null,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      reason: context.reason ?? reason,
    };
  }

  private async publishPriceChanged(variantId: string): Promise<void> {
    await this.eventBus?.publish({
      id: uuidv7(),
      type: "PriceChanged",
      aggregateType: "pricing",
      aggregateId: variantId,
      payload: { variantId },
      occurredAt: new Date(),
    });
  }
}
