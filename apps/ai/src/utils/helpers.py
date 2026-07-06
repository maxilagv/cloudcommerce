from __future__ import annotations

import base64
import binascii
import math
import re
import unicodedata

from ..config import get_settings
from ..models.schemas import Usage


def token_usage(total_tokens: int) -> Usage:
    settings = get_settings()
    cost = math.ceil(max(total_tokens, 0) / 1000 * settings.text_cost_minor_per_1k_tokens)
    return Usage(cost_minor=cost, currency="ARS", unit="tokens", amount=max(total_tokens, 0))


def image_usage(images: int = 1) -> Usage:
    settings = get_settings()
    return Usage(
        cost_minor=settings.image_cost_minor * max(images, 1),
        currency="ARS",
        unit="image",
        amount=max(images, 1),
    )


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return normalized or "item"


def decode_image(data: str, *, max_bytes: int | None = None) -> bytes:
    """Decode base64 image data, enforcing the configured size limit."""
    limit = max_bytes if max_bytes is not None else get_settings().max_image_bytes
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("invalid base64 image data") from exc
    if len(raw) == 0:
        raise ValueError("empty image")
    if len(raw) > limit:
        raise ValueError(f"image exceeds {limit} bytes")
    return raw


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))
