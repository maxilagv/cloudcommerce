from __future__ import annotations

from pydantic import BaseModel, Field

from ...models.schemas import (
    RecommendationEvidence,
    RecommendationOut,
    RecommendationsRequest,
    RecommendationsResponse,
)
from ...utils.helpers import clamp, token_usage
from ..generation.prompt_safety import build_prompt
from ..llm.openai_client import generate_json


class _RecommendationItem(BaseModel):
    product_id: str = Field(alias="productId")
    score: float
    reason_codes: list[str] = Field(alias="reasonCodes", max_length=10)
    matched_attributes: list[str] = Field(alias="matchedAttributes", max_length=20)
    based_on: list[str] = Field(alias="basedOn", max_length=20)

    model_config = {"populate_by_name": True}


class _RecommendationsPayload(BaseModel):
    recommendations: list[_RecommendationItem] = Field(max_length=24)


async def recommend(request: RecommendationsRequest) -> RecommendationsResponse:
    prompt = build_prompt(
        system_task=(
            "You are an ecommerce merchandising expert. Rank the candidate products by how well "
            "they complement or substitute the seed product (or, without a seed, by overall "
            "cross-sell appeal). Score 0-1. reasonCodes are short machine codes like "
            "'same_category', 'complementary_use', 'brand_affinity'. Only use productIds present "
            "in the candidates list. Return at most the requested limit, best first."
        ),
        user_task=f"Recommend up to {request.limit} products.",
        context={
            "seed": request.seed.model_dump(by_alias=True) if request.seed else None,
            "candidates": [candidate.model_dump(by_alias=True) for candidate in request.candidates],
        },
    )
    result, tokens = await generate_json(
        system=prompt["system"],
        user_content=prompt["messages"][0]["content"],
        output_model=_RecommendationsPayload,
        temperature=0.2,
    )
    valid_ids = {candidate.product_id for candidate in request.candidates}
    seen: set[str] = set()
    recommendations: list[RecommendationOut] = []
    for item in result.recommendations:
        if item.product_id not in valid_ids or item.product_id in seen:
            continue
        seen.add(item.product_id)
        recommendations.append(
            RecommendationOut(
                product_id=item.product_id,
                score=clamp(item.score, 0, 1),
                reason_codes=[code[:60] for code in item.reason_codes][:10],
                evidence=RecommendationEvidence(
                    matched_attributes=[attr[:120] for attr in item.matched_attributes][:20],
                    based_on=[basis[:120] for basis in item.based_on][:20],
                ),
            )
        )
        if len(recommendations) >= request.limit:
            break
    return RecommendationsResponse(recommendations=recommendations, usage=token_usage(tokens))
