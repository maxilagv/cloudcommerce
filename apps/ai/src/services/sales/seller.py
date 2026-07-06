from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ...config import get_settings
from ...models.schemas import OutreachRequest, OutreachResponse, ReplyRequest, ReplyResponse
from ...utils.helpers import token_usage
from ..llm.openai_client import generate_json
from .prompts import (
    REPLY_EXTRA_RULES,
    SELLER_DATA_BOUNDARY,
    SELLER_SYSTEM_TEMPLATE,
    seller_context,
)

GOAL_BRIEFS = {
    "follow_up": "Reconnect casually after their recent activity; add value before selling.",
    "cross_sell": "Suggest one candidate that genuinely complements what they already bought.",
    "win_back": "They have not bought in a while; rekindle the relationship without guilt-tripping.",
    "new_arrival": "A new candidate matches their interests; share it like an insider tip.",
    "post_purchase": "Check their latest purchase arrived well and they are happy; do not sell.",
}


class _OutreachPayload(BaseModel):
    message: str = Field(min_length=1, max_length=1200)
    reasoning: str = Field(max_length=800)
    recommended_product_ids: list[str] = Field(alias="recommendedProductIds", max_length=6)
    should_send: bool = Field(alias="shouldSend")

    model_config = {"populate_by_name": True}


class _ReplyPayload(BaseModel):
    message: str = Field(min_length=1, max_length=1200)
    intent: Literal["question", "purchase_intent", "complaint", "smalltalk", "opt_out", "other"]
    needs_human: bool = Field(alias="needsHuman")
    recommended_product_ids: list[str] = Field(alias="recommendedProductIds", max_length=6)

    model_config = {"populate_by_name": True}


async def generate_outreach(request: OutreachRequest) -> OutreachResponse:
    system = (
        SELLER_SYSTEM_TEMPLATE.format(store_name=request.store_name)
        + "\n\n"
        + SELLER_DATA_BOUNDARY
    )
    user_content = (
        f"GOAL: {request.goal} — {GOAL_BRIEFS[request.goal]}\n\n"
        "Write the single WhatsApp message to send now (or decide not to send).\n\n"
        + seller_context(request.customer, request.profile, request.candidates, request.conversation)
    )
    result, tokens = await generate_json(
        system=system,
        user_content=user_content,
        output_model=_OutreachPayload,
        temperature=0.7,
    )
    valid_ids = {candidate.product_id for candidate in request.candidates}
    recommended = [pid for pid in result.recommended_product_ids if pid in valid_ids]
    return OutreachResponse(
        message=result.message.strip(),
        reasoning=result.reasoning.strip(),
        recommended_product_ids=recommended,
        should_send=result.should_send,
        model=get_settings().openai_text_model,
        usage=token_usage(tokens),
    )


async def generate_reply(request: ReplyRequest) -> ReplyResponse:
    system = (
        SELLER_SYSTEM_TEMPLATE.format(store_name=request.store_name)
        + "\n\n"
        + REPLY_EXTRA_RULES
        + "\n\n"
        + SELLER_DATA_BOUNDARY
    )
    user_content = (
        "The customer just sent the message inside <untrusted-incoming>. Reply now.\n\n"
        + f"<untrusted-incoming>\n{request.incoming_message}\n</untrusted-incoming>\n\n"
        + seller_context(request.customer, request.profile, request.candidates, request.conversation)
    )
    result, tokens = await generate_json(
        system=system,
        user_content=user_content,
        output_model=_ReplyPayload,
        temperature=0.6,
    )
    valid_ids = {candidate.product_id for candidate in request.candidates}
    recommended = [pid for pid in result.recommended_product_ids if pid in valid_ids]
    return ReplyResponse(
        message=result.message.strip(),
        intent=result.intent,
        needs_human=result.needs_human,
        recommended_product_ids=recommended,
        model=get_settings().openai_text_model,
        usage=token_usage(tokens),
    )
