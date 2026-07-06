from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, Field

from ...config import get_settings
from ...models.schemas import GenerateDescriptionRequest, TextResponse
from ...utils.helpers import token_usage
from ..llm.openai_client import generate_json
from .prompt_safety import build_prompt


def build_description_prompt(
    product: Mapping[str, Any],
    locale: str,
    constraints: Mapping[str, Any],
) -> dict[str, Any]:
    return build_prompt(
        system_task=(
            "You are an elite ecommerce copywriter for a premium Argentine dropshipping store. "
            "Write accurate ecommerce product copy. Do not invent unavailable specs, prices, "
            "stock, warranties, shipping promises, or discounts. "
            "Write in natural, persuasive Spanish (variant given by the locale) that converts "
            "browsers into buyers: open with the strongest benefit, keep sentences short, use "
            "concrete details from the provided facts, and close with a subtle purchase motivator. "
            "Never use clichés like 'producto de alta calidad' without backing them with a fact."
        ),
        user_task=(
            f"Generate a product description for locale {locale}. "
            f"Respect these constraints: {dict(constraints)}."
        ),
        context={"product": product},
    )


class _DescriptionPayload(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)


async def generate_description(request: GenerateDescriptionRequest) -> TextResponse:
    product = request.product.model_dump(by_alias=True)
    prompt = build_description_prompt(
        product=product,
        locale=request.locale,
        constraints={
            "maxChars": request.constraints.max_chars,
            "tone": request.constraints.tone,
        },
    )
    result, tokens = await generate_json(
        system=prompt["system"],
        user_content=prompt["messages"][0]["content"],
        output_model=_DescriptionPayload,
        temperature=0.6,
    )
    text = result.text.strip()
    if len(text) > request.constraints.max_chars:
        cut = text[: request.constraints.max_chars]
        # Trim to the last full sentence (or word) so we never ship a chopped phrase.
        last_stop = max(cut.rfind(". "), cut.rfind(".\n"), cut.rfind("!"), cut.rfind("?"))
        text = cut[: last_stop + 1] if last_stop > request.constraints.max_chars // 2 else cut.rsplit(" ", 1)[0]
    return TextResponse(text=text, model=get_settings().openai_text_model, usage=token_usage(tokens))
