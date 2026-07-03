from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .prompt_safety import build_prompt


def build_description_prompt(
    product: Mapping[str, Any],
    locale: str,
    constraints: Mapping[str, Any],
) -> dict[str, Any]:
    return build_prompt(
        system_task=(
            "Write accurate ecommerce product copy. Do not invent unavailable specs, prices, "
            "stock, warranties, shipping promises, or discounts."
        ),
        user_task=(
            f"Generate a product description for locale {locale}. "
            f"Respect these constraints: {dict(constraints)}."
        ),
        context={"product": product},
    )
