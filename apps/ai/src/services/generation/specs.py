from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, Field

from ...config import get_settings
from ...models.schemas import GenerateSpecsRequest, SpecGroupOut, SpecsResponse
from ...utils.helpers import slugify, token_usage
from ..llm.openai_client import generate_json
from .prompt_safety import build_prompt


def build_specs_prompt(
    product: Mapping[str, Any],
    source_hints: str | None,
) -> dict[str, Any]:
    return build_prompt(
        system_task=(
            "You are a meticulous ecommerce catalog specialist. Extract and organize product "
            "specifications into logical groups (e.g. 'General', 'Dimensiones', 'Conectividad'). "
            "Only state facts present in the provided product data or hints — never invent values. "
            "If a value is unknown, omit the item entirely. Labels and group names in Spanish. "
            "Numeric values go in valueNum with their unit in unit; textual values in valueText."
        ),
        user_task=(
            "Generate structured specifications for this product. "
            + (f"Additional hints from the store owner: {source_hints}" if source_hints else "")
        ),
        context={"product": product},
    )


class _SpecsPayload(BaseModel):
    groups: list[SpecGroupOut] = Field(max_length=12)


async def generate_specs(request: GenerateSpecsRequest) -> SpecsResponse:
    prompt = build_specs_prompt(
        product=request.product.model_dump(by_alias=True),
        source_hints=request.source_hints,
    )
    result, tokens = await generate_json(
        system=prompt["system"],
        user_content=prompt["messages"][0]["content"],
        output_model=_SpecsPayload,
        temperature=0.2,
    )
    groups = [_normalize_group(group) for group in result.groups]
    return SpecsResponse(groups=groups, model=get_settings().openai_text_model, usage=token_usage(tokens))


def _normalize_group(group: SpecGroupOut) -> SpecGroupOut:
    seen: set[str] = set()
    items = []
    for item in group.items:
        key = slugify(item.key or item.label)[:60]
        if key in seen:
            continue
        seen.add(key)
        items.append(item.model_copy(update={"key": key}))
    return group.model_copy(update={"items": items})
