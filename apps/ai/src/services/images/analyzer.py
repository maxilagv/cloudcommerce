from __future__ import annotations

from pydantic import BaseModel, Field

from ...config import get_settings
from ...models.schemas import ImageAnalysisOut, ImageContext, ImagePayload, ImageSubject
from ...utils.helpers import decode_image
from ..llm.openai_client import generate_json, image_content_part
from .prompts import describe_context

ANALYST_SYSTEM = """
You are a world-class commercial photography art director reviewing an ecommerce image.
Judge it against the standard of a top product-photography agency: lighting, background,
composition, focus, color accuracy, resolution artifacts, distracting elements, and whether
the product reads instantly and desirably.

Also verify the image actually shows the product described in the context. If it clearly
shows something unrelated or is unusable (extremely blurry, not a photo, offensive), set
isUsableSource to false.

Write the analysis fields in Spanish, except enhancementPlan which must be in English
(it will be fed to an image-editing model as retouching directions).
enhancementPlan must be a concrete, ordered list of edits (background replacement, lighting
correction, color grading, crop, artifact cleanup...) that would take this photo to
catalog-perfect quality while keeping the product itself untouched.
""".strip()


class _AnalysisPayload(BaseModel):
    summary: str = Field(max_length=600)
    quality_score: int = Field(alias="qualityScore", ge=0, le=100)
    issues: list[str] = Field(max_length=12)
    strengths: list[str] = Field(max_length=12)
    enhancement_plan: str = Field(alias="enhancementPlan", max_length=1200)
    is_usable_source: bool = Field(alias="isUsableSource")

    model_config = {"populate_by_name": True}


async def analyze_image(
    image: ImagePayload,
    subject: ImageSubject,
    context: ImageContext,
) -> tuple[ImageAnalysisOut, int]:
    """Vision-analyze a source image. Returns (analysis, tokens_used)."""
    decode_image(image.data)  # validates size + base64 before spending tokens
    settings = get_settings()
    context_text = describe_context(context, subject) or "(no context provided)"
    result, tokens = await generate_json(
        system=ANALYST_SYSTEM,
        user_content=[
            {
                "type": "text",
                "text": (
                    "Analyze this image as a candidate ecommerce "
                    f"{'product photo' if subject == 'product' else 'category card image'}.\n\n"
                    f"<untrusted-product-data>\n{context_text}\n</untrusted-product-data>"
                ),
            },
            image_content_part(image.data, image.mime_type),
        ],
        output_model=_AnalysisPayload,
        model=settings.openai_vision_model,
        temperature=0.2,
    )
    analysis = ImageAnalysisOut(
        summary=result.summary,
        quality_score=result.quality_score,
        issues=result.issues,
        strengths=result.strengths,
        enhancement_plan=result.enhancement_plan,
        is_usable_source=result.is_usable_source,
    )
    return analysis, tokens
