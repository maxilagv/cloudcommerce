from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from ...dependencies import require_service_token
from ...models.schemas import (
    RecommendationsRequest,
    RecommendationsResponse,
    TrendsRequest,
    TrendsResponse,
)
from ...services.catalog.recommendations import recommend
from ...services.trends.analyzer import analyze

logger = logging.getLogger(__name__)

router = APIRouter(tags=["insights"])


@router.post("/recommendations", response_model=RecommendationsResponse, response_model_by_alias=True)
async def post_recommendations(
    request: RecommendationsRequest,
    request_id: str = Depends(require_service_token),
) -> RecommendationsResponse:
    logger.info(
        "recommendations generation=%s request=%s candidates=%d",
        request.generation_id,
        request_id,
        len(request.candidates),
    )
    return await recommend(request)


@router.post("/trends/analyze", response_model=TrendsResponse, response_model_by_alias=True)
async def post_trends_analyze(
    request: TrendsRequest,
    request_id: str = Depends(require_service_token),
) -> TrendsResponse:
    logger.info(
        "trends/analyze generation=%s request=%s scope=%s",
        request.generation_id,
        request_id,
        request.scope,
    )
    return await analyze(request)
