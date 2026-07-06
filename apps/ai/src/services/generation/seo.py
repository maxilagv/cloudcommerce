from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, Field

from ...config import get_settings
from ...models.schemas import GenerateSeoRequest, SeoResponse
from ...utils.helpers import token_usage
from ..llm.openai_client import generate_json
from .prompt_safety import build_prompt


def build_seo_prompt(
    product: Mapping[str, Any] | None,
    category: Mapping[str, Any] | None,
) -> dict[str, Any]:
    return build_prompt(
        system_task=(
            "You are an ecommerce SEO expert for the Argentine market. "
            "Create concise ecommerce SEO metadata. Keep claims grounded in the provided product "
            "and category facts. Title under 60 characters, meta description 120-160 characters, "
            "keywords as the customer would actually search them in Spanish (no keyword stuffing)."
        ),
        user_task="Generate title, meta description, and keywords.",
        context={"product": product, "category": category},
    )


class _SeoPayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    meta_description: str = Field(alias="metaDescription", min_length=1, max_length=400)
    keywords: list[str] = Field(max_length=20)

    model_config = {"populate_by_name": True}


async def generate_seo(request: GenerateSeoRequest) -> SeoResponse:
    prompt = build_seo_prompt(
        product=request.product.model_dump(by_alias=True) if request.product else None,
        category=request.category.model_dump(by_alias=True) if request.category else None,
    )
    result, tokens = await generate_json(
        system=prompt["system"],
        user_content=prompt["messages"][0]["content"],
        output_model=_SeoPayload,
        temperature=0.3,
    )
    keywords = [keyword.strip()[:60] for keyword in result.keywords if keyword.strip()][:20]
    return SeoResponse(
        title=result.title.strip(),
        meta_description=result.meta_description.strip(),
        keywords=keywords,
        model=get_settings().openai_text_model,
        usage=token_usage(tokens),
    )
