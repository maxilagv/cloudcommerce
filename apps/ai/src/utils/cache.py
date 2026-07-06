"""Small async TTL cache with optional Redis backing.

Used to avoid re-paying for identical generations inside the service. apps/api
already deduplicates by idempotency key, so this is a second, cheap layer for
retries that arrive with a new generation id.
"""

from __future__ import annotations

import json
import time
from typing import Any

from ..config import get_settings


class TtlCache:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._memory: dict[str, tuple[float, Any]] = {}
        self._redis = None
        if self._settings.redis_url:
            try:
                import redis.asyncio as redis

                self._redis = redis.from_url(self._settings.redis_url, decode_responses=True)
            except Exception:  # pragma: no cover - optional dependency/connection
                self._redis = None

    async def get(self, key: str) -> Any | None:
        if self._redis is not None:
            try:
                raw = await self._redis.get(f"ai:cache:{key}")
                return json.loads(raw) if raw is not None else None
            except Exception:
                pass
        entry = self._memory.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() > expires_at:
            self._memory.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._settings.cache_ttl_seconds
        if self._redis is not None:
            try:
                await self._redis.set(f"ai:cache:{key}", json.dumps(value, default=str), ex=ttl)
                return
            except Exception:
                pass
        self._memory[key] = (time.monotonic() + ttl, value)


_cache: TtlCache | None = None


def get_cache() -> TtlCache:
    global _cache
    if _cache is None:
        _cache = TtlCache()
    return _cache
