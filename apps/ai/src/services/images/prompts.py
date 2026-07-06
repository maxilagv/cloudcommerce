"""Prompt library for commercial product photography.

These prompts are engineered for Gemini image models to produce catalog-ready,
agency-grade imagery: perfect lighting, true-to-product fidelity, and zero
AI-artifact tells. The subject's identity (shape, materials, branding, colors)
must always be preserved exactly — we sell the real product.
"""

from __future__ import annotations

from ...models.schemas import ImageContext, ImageStyle, ImageSubject

FIDELITY_RULES = """
NON-NEGOTIABLE FIDELITY RULES:
- Preserve the product's exact shape, proportions, materials, colors, textures, logos and printed text. Do not redesign, restyle or "improve" the product itself.
- No added watermarks, badges, price tags or invented brand marks.
- No text overlays of any kind.
- Photorealistic output only — it must be indistinguishable from a photo taken by a top commercial photographer with a full-frame camera and professional strobes.
- No AI artifacts: no warped reflections, no melted edges, no duplicated features, no impossible shadows.
""".strip()

STYLE_PROMPTS: dict[ImageStyle, str] = {
    "studio": (
        "Ultra-clean professional studio product photograph. Seamless pure white background "
        "(RGB 255,255,255) with a subtle natural contact shadow grounding the product. "
        "Three-point softbox lighting: large key light at 45 degrees, gentle fill, rim light "
        "separating the product from the background. Perfectly even exposure, crisp edge-to-edge "
        "focus, colors calibrated and true to life. Composition centered with generous negative "
        "space, product occupying ~75% of the frame. Shot on a 100mm macro lens at f/8."
    ),
    "lifestyle": (
        "Premium lifestyle product photograph in a realistic, aspirational setting that matches "
        "the product's use case. Soft natural window light with warm tones, shallow depth of "
        "field (f/2.8) keeping the product tack-sharp while the environment melts into a creamy "
        "bokeh. Styled props kept minimal and secondary — the product is the unmistakable hero. "
        "Editorial magazine quality, natural color grading, inviting and human."
    ),
    "hero": (
        "Dramatic hero banner product photograph for a premium ecommerce landing page. Dark, "
        "moody gradient background with cinematic rim lighting sculpting the product's silhouette. "
        "Low camera angle conveying presence and desirability. Subtle reflective surface below "
        "with a soft mirror reflection. High contrast, deep blacks, spectacular yet realistic. "
        "Wide composition with clear negative space on one side for headline placement."
    ),
    "minimal": (
        "Minimalist premium product photograph. Soft monochromatic pastel background chosen to "
        "complement the product's palette. Single large diffused light source creating soft, "
        "long shadows. Scandinavian aesthetic: airy, calm, geometric. Perfect symmetry or "
        "intentional rule-of-thirds placement. Gallery-grade simplicity."
    ),
}

CATEGORY_STYLE_HINT = (
    "This image represents a whole product CATEGORY for a store navigation card. Compose an "
    "attractive arrangement (single emblematic product or small curated group) that instantly "
    "communicates the category. Keep it uncluttered and readable at small sizes."
)


def describe_context(context: ImageContext, subject: ImageSubject) -> str:
    parts: list[str] = []
    if context.title:
        parts.append(f"{'Product' if subject == 'product' else 'Category'}: {context.title}")
    if context.category_name and subject == "product":
        parts.append(f"Category: {context.category_name}")
    if context.brand_name:
        parts.append(f"Brand: {context.brand_name}")
    if context.description:
        parts.append(f"Details: {context.description[:500]}")
    return "\n".join(parts)


def build_enhance_prompt(
    *,
    subject: ImageSubject,
    context: ImageContext,
    style: ImageStyle,
    enhancement_plan: str,
    instructions: str | None,
) -> str:
    sections = [
        "Transform the attached photo into a flawless, agency-grade ecommerce image of the SAME product.",
        describe_context(context, subject),
        f"TARGET LOOK: {STYLE_PROMPTS[style]}",
    ]
    if subject == "category":
        sections.append(CATEGORY_STYLE_HINT)
    if enhancement_plan:
        sections.append(f"SPECIFIC FIXES REQUIRED (from expert photo analysis): {enhancement_plan}")
    if instructions:
        sections.append(f"OWNER INSTRUCTIONS (visual adjustments only): {instructions[:500]}")
    sections.append(FIDELITY_RULES)
    return "\n\n".join(section for section in sections if section)


def build_generate_prompt(
    *,
    subject: ImageSubject,
    context: ImageContext,
    style: ImageStyle,
    instructions: str | None,
    has_reference: bool,
) -> str:
    lead = (
        "Create a flawless, agency-grade ecommerce photograph of the product in the attached reference image."
        if has_reference
        else "Create a flawless, agency-grade ecommerce photograph of the following product."
    )
    sections = [
        lead,
        describe_context(context, subject),
        f"TARGET LOOK: {STYLE_PROMPTS[style]}",
    ]
    if subject == "category":
        sections.append(CATEGORY_STYLE_HINT)
    if instructions:
        sections.append(f"OWNER INSTRUCTIONS (visual adjustments only): {instructions[:500]}")
    if has_reference:
        sections.append(FIDELITY_RULES)
    else:
        sections.append(
            "Photorealistic output only, no text overlays, no watermarks, no invented brand logos."
        )
    return "\n\n".join(section for section in sections if section)
