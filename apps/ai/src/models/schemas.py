"""Wire schemas for /internal/ai/v1/*.

Request shapes mirror what apps/api's AiHttpGateway sends; response shapes are
validated on the Node side with Zod (see apps/api/src/domains/ai/infra/http/
ai-http-gateway.ts) — field names and constraints here must stay in sync.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


class Usage(ApiModel):
    cost_minor: int = Field(alias="costMinor", ge=0)
    currency: Literal["ARS"] = "ARS"
    unit: Literal["tokens", "image"]
    amount: int = Field(ge=0)


class HealthResponse(ApiModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str


# ---------------------------------------------------------------------------
# Catalog contexts (whitelisted by apps/api — never contain PII)
# ---------------------------------------------------------------------------


class SpecItemContext(ApiModel):
    key: str
    label: str
    value_text: str | None = Field(default=None, alias="valueText")
    value_num: float | None = Field(default=None, alias="valueNum")
    unit: str | None = None


class ProductContext(ApiModel):
    product_id: str = Field(alias="productId")
    title: str
    subtitle: str | None = None
    description: str = ""
    category_name: str = Field(default="", alias="categoryName")
    brand_name: str | None = Field(default=None, alias="brandName")
    specs: list[SpecItemContext] = Field(default_factory=list)
    variant_attributes: list[dict[str, Any]] = Field(default_factory=list, alias="variantAttributes")


class CategoryContext(ApiModel):
    category_id: str = Field(alias="categoryId")
    name: str
    description: str | None = None


class CatalogCandidate(ApiModel):
    product_id: str = Field(alias="productId")
    title: str
    category_id: str = Field(default="", alias="categoryId")
    category_name: str = Field(default="", alias="categoryName")
    brand_name: str | None = Field(default=None, alias="brandName")
    attributes: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Text generation
# ---------------------------------------------------------------------------


class DescriptionConstraints(ApiModel):
    max_chars: int = Field(alias="maxChars", ge=100, le=20_000)
    tone: str = "asesor claro, sin exageracion"


class GenerateDescriptionRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    locale: str = "es-AR"
    constraints: DescriptionConstraints
    product: ProductContext


class TextResponse(ApiModel):
    text: str = Field(min_length=1, max_length=20_000)
    model: str
    usage: Usage


class GenerateSpecsRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    source_hints: str | None = Field(default=None, alias="sourceHints")
    product: ProductContext


class SpecItemOut(ApiModel):
    key: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=1, max_length=120)
    value_text: str | None = Field(default=None, alias="valueText", max_length=500)
    value_num: float | None = Field(default=None, alias="valueNum")
    unit: str | None = Field(default=None, max_length=20)


class SpecGroupOut(ApiModel):
    name: str = Field(min_length=1, max_length=80)
    items: list[SpecItemOut] = Field(max_length=40)


class SpecsResponse(ApiModel):
    groups: list[SpecGroupOut] = Field(max_length=12)
    model: str
    usage: Usage


class GenerateSeoRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    product: ProductContext | None = None
    category: CategoryContext | None = None


class SeoResponse(ApiModel):
    title: str = Field(min_length=1, max_length=200)
    meta_description: str = Field(alias="metaDescription", min_length=1, max_length=400)
    keywords: list[str] = Field(max_length=20)
    model: str
    usage: Usage


# ---------------------------------------------------------------------------
# Recommendations / trends / pricing
# ---------------------------------------------------------------------------


class RecommendationsRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    seed: CatalogCandidate | None = None
    candidates: list[CatalogCandidate] = Field(default_factory=list)
    limit: int = Field(default=8, ge=1, le=24)


class RecommendationEvidence(ApiModel):
    matched_attributes: list[str] = Field(alias="matchedAttributes", max_length=20)
    based_on: list[str] = Field(alias="basedOn", max_length=20)


class RecommendationOut(ApiModel):
    product_id: str = Field(alias="productId")
    score: float = Field(ge=0, le=1)
    reason_codes: list[str] = Field(alias="reasonCodes", max_length=10)
    evidence: RecommendationEvidence


class RecommendationsResponse(ApiModel):
    recommendations: list[RecommendationOut] = Field(max_length=24)
    usage: Usage


class TrendsRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    scope: Literal["category", "supplierFeed", "store"]
    scope_id: str | None = Field(default=None, alias="scopeId")
    window: str = "30d"
    candidates: list[CatalogCandidate] = Field(default_factory=list)


class TrendSignalOut(ApiModel):
    target_type: Literal["PRODUCT", "VARIANT", "CATEGORY", "SUPPLIER_FEED", "NONE"] = Field(alias="targetType")
    target_id: str | None = Field(default=None, alias="targetId")
    signal: str = Field(min_length=1, max_length=300)
    score: float = Field(ge=0, le=1)
    window: str = Field(min_length=1, max_length=20)


class TrendsResponse(ApiModel):
    signals: list[TrendSignalOut] = Field(max_length=50)
    usage: Usage


class PricingContext(ApiModel):
    variant_id: str = Field(alias="variantId")
    product_title: str = Field(alias="productTitle")
    category_name: str = Field(default="", alias="categoryName")
    current_price_minor: int | None = Field(default=None, alias="currentPriceMinor")
    supplier_cost_minor: int = Field(alias="supplierCostMinor", ge=0)
    currency: Literal["ARS"] = "ARS"
    min_margin_bps: int | None = Field(default=None, alias="minMarginBps")


class PricingRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    contexts: list[PricingContext]


class PriceSuggestionOut(ApiModel):
    variant_id: str = Field(alias="variantId")
    suggested_amount_minor: int = Field(alias="suggestedAmountMinor", ge=0)
    currency: Literal["ARS"] = "ARS"
    margin_pct: float = Field(alias="marginPct")
    rationale: str = Field(min_length=1, max_length=600)
    within_min_margin: bool = Field(alias="withinMinMargin")


class PricingResponse(ApiModel):
    suggestions: list[PriceSuggestionOut] = Field(max_length=100)
    usage: Usage


# ---------------------------------------------------------------------------
# Images (new surface — mirrored by AiHttpGateway image methods)
# ---------------------------------------------------------------------------

ImageStyle = Literal["studio", "lifestyle", "hero", "minimal"]
ImageSubject = Literal["product", "category"]


class ImagePayload(ApiModel):
    data: str = Field(description="Base64-encoded image bytes, no data: prefix")
    mime_type: str = Field(default="image/png", alias="mimeType")


class ImageContext(ApiModel):
    title: str = ""
    category_name: str = Field(default="", alias="categoryName")
    brand_name: str | None = Field(default=None, alias="brandName")
    description: str | None = None


class AnalyzeImageRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    subject: ImageSubject = "product"
    context: ImageContext = Field(default_factory=ImageContext)
    image: ImagePayload


class ImageAnalysisOut(ApiModel):
    summary: str = Field(max_length=600)
    quality_score: int = Field(alias="qualityScore", ge=0, le=100)
    issues: list[str] = Field(max_length=12)
    strengths: list[str] = Field(max_length=12)
    enhancement_plan: str = Field(alias="enhancementPlan", max_length=1200)
    is_usable_source: bool = Field(alias="isUsableSource")


class AnalyzeImageResponse(ApiModel):
    analysis: ImageAnalysisOut
    model: str
    usage: Usage


class EnhanceImageRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    subject: ImageSubject = "product"
    context: ImageContext = Field(default_factory=ImageContext)
    image: ImagePayload
    style: ImageStyle = "studio"
    instructions: str | None = None


class EnhanceImageResponse(ApiModel):
    image: ImagePayload
    analysis: ImageAnalysisOut
    prompt_used: str = Field(alias="promptUsed", max_length=4000)
    model: str
    usage: Usage


class GenerateImageRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    subject: ImageSubject = "product"
    context: ImageContext = Field(default_factory=ImageContext)
    style: ImageStyle = "studio"
    instructions: str | None = None
    reference_image: ImagePayload | None = Field(default=None, alias="referenceImage")


class GenerateImageResponse(ApiModel):
    image: ImagePayload
    prompt_used: str = Field(alias="promptUsed", max_length=4000)
    model: str
    usage: Usage


# ---------------------------------------------------------------------------
# Customer intelligence (new surface — profiling + expert WhatsApp seller)
# ---------------------------------------------------------------------------


class PurchaseLine(ApiModel):
    product_title: str = Field(alias="productTitle")
    category_name: str = Field(default="", alias="categoryName")
    quantity: int = 1
    unit_price_minor: int | None = Field(default=None, alias="unitPriceMinor")
    purchased_at: str | None = Field(default=None, alias="purchasedAt")


class CustomerSnapshot(ApiModel):
    """Whitelisted customer view: first name + tier + purchase history only."""

    customer_id: str = Field(alias="customerId")
    first_name: str = Field(default="", alias="firstName")
    tier: str = ""
    locale: str = "es-AR"
    purchases: list[PurchaseLine] = Field(default_factory=list)
    previous_profile: dict[str, Any] | None = Field(default=None, alias="previousProfile")


class AnalyzeCustomerRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    customer: CustomerSnapshot


class CustomerProfileOut(ApiModel):
    interests: list[str] = Field(max_length=15)
    segments: list[str] = Field(max_length=8)
    price_sensitivity: Literal["low", "medium", "high"] = Field(alias="priceSensitivity")
    buying_patterns: list[str] = Field(alias="buyingPatterns", max_length=8)
    recommended_categories: list[str] = Field(alias="recommendedCategories", max_length=8)
    next_best_actions: list[str] = Field(alias="nextBestActions", max_length=6)
    summary: str = Field(max_length=1000)
    confidence: int = Field(ge=0, le=100)


class AnalyzeCustomerResponse(ApiModel):
    profile: CustomerProfileOut
    model: str
    usage: Usage


class SaleCandidate(ApiModel):
    product_id: str = Field(alias="productId")
    title: str
    category_name: str = Field(default="", alias="categoryName")
    price_minor: int | None = Field(default=None, alias="priceMinor")
    currency: str = "ARS"
    in_stock: bool = Field(default=True, alias="inStock")


class ConversationTurn(ApiModel):
    role: Literal["customer", "assistant", "agent"]
    content: str
    sent_at: str | None = Field(default=None, alias="sentAt")


OutreachGoal = Literal["follow_up", "cross_sell", "win_back", "new_arrival", "post_purchase"]


class OutreachRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    goal: OutreachGoal = "follow_up"
    customer: CustomerSnapshot
    profile: dict[str, Any] | None = None
    candidates: list[SaleCandidate] = Field(default_factory=list)
    conversation: list[ConversationTurn] = Field(default_factory=list)
    store_name: str = Field(default="CloudCommerce", alias="storeName")


class OutreachResponse(ApiModel):
    message: str = Field(min_length=1, max_length=1200)
    reasoning: str = Field(max_length=800)
    recommended_product_ids: list[str] = Field(alias="recommendedProductIds", max_length=6)
    should_send: bool = Field(alias="shouldSend")
    model: str
    usage: Usage


class ReplyRequest(ApiModel):
    generation_id: str = Field(alias="generationId")
    customer: CustomerSnapshot
    profile: dict[str, Any] | None = None
    conversation: list[ConversationTurn] = Field(default_factory=list)
    incoming_message: str = Field(alias="incomingMessage", min_length=1, max_length=4000)
    candidates: list[SaleCandidate] = Field(default_factory=list)
    store_name: str = Field(default="CloudCommerce", alias="storeName")


class ReplyResponse(ApiModel):
    message: str = Field(min_length=1, max_length=1200)
    intent: Literal["question", "purchase_intent", "complaint", "smalltalk", "opt_out", "other"]
    needs_human: bool = Field(alias="needsHuman")
    recommended_product_ids: list[str] = Field(alias="recommendedProductIds", max_length=6)
    model: str
    usage: Usage
