from __future__ import annotations

import base64
import logging

from google import genai
from google.genai import types

from ...config import get_settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def get_gemini() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


class GeminiImageResult:
    def __init__(self, data: bytes, mime_type: str) -> None:
        self.data = data
        self.mime_type = mime_type

    @property
    def base64(self) -> str:
        return base64.b64encode(self.data).decode("ascii")


async def generate_image(
    prompt: str,
    *,
    source_image: tuple[bytes, str] | None = None,
    model: str | None = None,
) -> GeminiImageResult:
    """Generate (or edit, when `source_image` is given) an image with Gemini.

    Returns the first image part of the response. Raises RuntimeError when the
    model returns no image (e.g. safety block).
    """
    settings = get_settings()
    resolved_model = model or settings.gemini_image_model
    client = get_gemini()

    contents: list[types.Part | str] = []
    if source_image is not None:
        data, mime_type = source_image
        contents.append(types.Part.from_bytes(data=data, mime_type=mime_type))
    contents.append(prompt)

    response = await client.aio.models.generate_content(
        model=resolved_model,
        contents=contents,
        config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
    )

    for candidate in response.candidates or []:
        for part in (candidate.content.parts if candidate.content else None) or []:
            inline = getattr(part, "inline_data", None)
            if inline is not None and inline.data:
                raw = inline.data if isinstance(inline.data, bytes) else base64.b64decode(inline.data)
                return GeminiImageResult(raw, inline.mime_type or "image/png")

    feedback = getattr(response, "prompt_feedback", None)
    reason = getattr(feedback, "block_reason", None) if feedback else None
    raise RuntimeError(f"Gemini returned no image (block_reason={reason})")
