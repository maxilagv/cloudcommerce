from __future__ import annotations

import json
import logging
from typing import Any, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from ...config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_client: AsyncOpenAI | None = None


def get_openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _client = AsyncOpenAI(api_key=settings.openai_api_key, timeout=settings.openai_timeout_seconds)
    return _client


async def generate_json(
    *,
    system: str,
    user_content: str | list[dict[str, Any]],
    output_model: type[T],
    model: str | None = None,
    temperature: float = 0.4,
    max_retries: int = 2,
) -> tuple[T, int]:
    """Call OpenAI in JSON mode and validate the payload against a Pydantic model.

    Returns (validated_payload, total_tokens_used). On validation failure the
    model is re-prompted with the validation error, up to `max_retries` times.
    """
    settings = get_settings()
    resolved_model = model or settings.openai_text_model
    client = get_openai()

    schema = output_model.model_json_schema()
    system_with_schema = (
        f"{system.strip()}\n\n"
        "Respond with a single JSON object only — no markdown fences, no commentary. "
        f"It must conform to this JSON Schema:\n{json.dumps(schema, ensure_ascii=False)}"
    )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_with_schema},
        {"role": "user", "content": user_content},
    ]

    last_error: Exception | None = None
    total_tokens = 0
    for attempt in range(max_retries + 1):
        response = await client.chat.completions.create(
            model=resolved_model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        if response.usage is not None:
            total_tokens += response.usage.total_tokens
        raw = response.choices[0].message.content or "{}"
        try:
            return output_model.model_validate_json(raw), total_tokens
        except ValidationError as exc:
            last_error = exc
            logger.warning("OpenAI JSON validation failed (attempt %d): %s", attempt + 1, exc)
            messages.append({"role": "assistant", "content": raw})
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "The previous JSON did not validate. Fix it and return only the corrected "
                        f"JSON object. Validation errors:\n{exc}"
                    ),
                }
            )

    raise RuntimeError(f"OpenAI returned invalid JSON after {max_retries + 1} attempts: {last_error}")


def image_content_part(base64_data: str, mime_type: str) -> dict[str, Any]:
    """Build an image_url content part for vision requests."""
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{base64_data}", "detail": "high"},
    }
