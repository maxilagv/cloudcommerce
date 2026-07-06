from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from ...dependencies import require_service_token
from ...models.schemas import PricingRequest, PricingResponse
from ...services.pricing.optimizer import optimize

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.post("/optimize", response_model=PricingResponse, response_model_by_alias=True)
async def post_optimize(
    request: PricingRequest,
    request_id: str = Depends(require_service_token),
) -> PricingResponse:
    logger.info(
        "pricing/optimize generation=%s request=%s contexts=%d",
        request.generation_id,
        request_id,
        len(request.contexts),
    )
    return optimize(request)
