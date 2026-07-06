from __future__ import annotations

import base64
import io
import logging

from PIL import Image

from ...config import get_settings
from ...models.schemas import (
    AnalyzeImageRequest,
    AnalyzeImageResponse,
    EnhanceImageRequest,
    EnhanceImageResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    ImagePayload,
)
from ...utils.helpers import decode_image, image_usage, token_usage
from ..llm.gemini_client import generate_image as gemini_generate
from .analyzer import analyze_image
from .prompts import build_enhance_prompt, build_generate_prompt

logger = logging.getLogger(__name__)


async def run_analyze(request: AnalyzeImageRequest) -> AnalyzeImageResponse:
    analysis, tokens = await analyze_image(request.image, request.subject, request.context)
    settings = get_settings()
    return AnalyzeImageResponse(
        analysis=analysis,
        model=settings.openai_vision_model,
        usage=token_usage(tokens),
    )


async def run_enhance(request: EnhanceImageRequest) -> EnhanceImageResponse:
    """Two-stage pipeline: expert vision critique → guided Gemini re-shoot.

    The GPT vision pass produces an English retouching plan; Gemini then edits the
    original photo following that plan plus the style template, preserving product
    identity. This is what turns a phone snapshot into a catalog-grade image.
    """
    source_bytes = decode_image(request.image.data)
    analysis, _tokens = await analyze_image(request.image, request.subject, request.context)
    if not analysis.is_usable_source:
        raise ValueError(f"source image not usable: {analysis.summary}")

    prompt = build_enhance_prompt(
        subject=request.subject,
        context=request.context,
        style=request.style,
        enhancement_plan=analysis.enhancement_plan,
        instructions=request.instructions,
    )
    result = await gemini_generate(prompt, source_image=(source_bytes, request.image.mime_type))
    payload = _postprocess(result.data, result.mime_type)
    settings = get_settings()
    return EnhanceImageResponse(
        image=payload,
        analysis=analysis,
        prompt_used=prompt[:4000],
        model=settings.gemini_image_model,
        usage=image_usage(1),
    )


async def run_generate(request: GenerateImageRequest) -> GenerateImageResponse:
    source: tuple[bytes, str] | None = None
    if request.reference_image is not None:
        source = (decode_image(request.reference_image.data), request.reference_image.mime_type)

    prompt = build_generate_prompt(
        subject=request.subject,
        context=request.context,
        style=request.style,
        instructions=request.instructions,
        has_reference=source is not None,
    )
    result = await gemini_generate(prompt, source_image=source)
    payload = _postprocess(result.data, result.mime_type)
    settings = get_settings()
    return GenerateImageResponse(
        image=payload,
        prompt_used=prompt[:4000],
        model=settings.gemini_image_model,
        usage=image_usage(1),
    )


def _postprocess(data: bytes, mime_type: str) -> ImagePayload:
    """Validate the generated image and normalize it to PNG within the size cap."""
    settings = get_settings()
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.load()
            output = img
            max_side = settings.image_output_size
            if max(img.size) > max_side:
                ratio = max_side / max(img.size)
                output = img.resize(
                    (max(1, round(img.width * ratio)), max(1, round(img.height * ratio))),
                    Image.LANCZOS,
                )
            buffer = io.BytesIO()
            if output.mode not in ("RGB", "RGBA"):
                output = output.convert("RGB")
            output.save(buffer, format="PNG", optimize=True)
            normalized = buffer.getvalue()
    except Exception as exc:
        logger.error("Generated image failed validation: %s", exc)
        raise RuntimeError("generated image is not a valid image") from exc

    return ImagePayload(data=base64.b64encode(normalized).decode("ascii"), mime_type="image/png")
