from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from .config import get_settings


async def require_service_token(
    authorization: str | None = Header(default=None),
    x_request_id: str | None = Header(default=None),
) -> str:
    """Authenticate calls from apps/api via the shared service token.

    Returns the request id (or "unknown") for logging correlation.
    """
    settings = get_settings()
    if not settings.service_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI_SERVICE_TOKEN is not configured",
        )
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if not secrets.compare_digest(token, settings.service_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid service token")
    return x_request_id or "unknown"
