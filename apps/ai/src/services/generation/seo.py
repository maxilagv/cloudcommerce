from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .prompt_safety import build_prompt


def build_seo_prompt(
    product: Mapping[str, Any] | None,
    category: Mapping[str, Any] | None,
) -> dict[str, Any]:
    return build_prompt(
        system_task=(
            "Create concise ecommerce SEO metadata. Keep claims grounded in the provided product "
            "and category facts."
        ),
        user_task="Generate title, meta description, and keywords.",
        context={"product": product, "category": category},
    )
