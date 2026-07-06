from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ...models.schemas import TrendSignalOut, TrendsRequest, TrendsResponse
from ...utils.helpers import clamp, token_usage
from ..generation.prompt_safety import build_prompt
from ..llm.openai_client import generate_json


class _SignalItem(BaseModel):
    target_type: Literal["PRODUCT", "VARIANT", "CATEGORY", "SUPPLIER_FEED", "NONE"] = Field(alias="targetType")
    target_id: str | None = Field(default=None, alias="targetId")
    signal: str = Field(max_length=300)
    score: float

    model_config = {"populate_by_name": True}


class _TrendsPayload(BaseModel):
    signals: list[_SignalItem] = Field(max_length=50)


async def analyze(request: TrendsRequest) -> TrendsResponse:
    prompt = build_prompt(
        system_task=(
            "You are a retail trends analyst for an Argentine dropshipping store. From the "
            "candidate catalog, surface actionable demand signals: products or product families "
            "with strong seasonal, cultural or market momentum for the given window. Each signal "
            "is one concrete, specific sentence in Spanish (what is trending and why it matters "
            "commercially). Use targetType PRODUCT with the candidate's productId when the signal "
            "is about a specific product; use NONE with null targetId for store-wide signals. "
            "Be selective: 3-8 high-conviction signals beat 20 vague ones."
        ),
        user_task=(
            f"Analyze trends for scope={request.scope} window={request.window}. "
            "Return signals ordered by score descending."
        ),
        context={
            "scopeId": request.scope_id,
            "candidates": [candidate.model_dump(by_alias=True) for candidate in request.candidates],
        },
    )
    result, tokens = await generate_json(
        system=prompt["system"],
        user_content=prompt["messages"][0]["content"],
        output_model=_TrendsPayload,
        temperature=0.4,
    )
    valid_ids = {candidate.product_id for candidate in request.candidates}
    signals: list[TrendSignalOut] = []
    for item in result.signals:
        target_id = item.target_id if item.target_id in valid_ids else None
        target_type = item.target_type if target_id is not None or item.target_type == "NONE" else "NONE"
        signals.append(
            TrendSignalOut(
                target_type=target_type,
                target_id=target_id,
                signal=item.signal.strip()[:300],
                score=clamp(item.score, 0, 1),
                window=request.window[:20],
            )
        )
    return TrendsResponse(signals=signals[:50], usage=token_usage(tokens))
