from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from ...dependencies import require_service_token
from ...models.schemas import (
    AnalyzeCustomerRequest,
    AnalyzeCustomerResponse,
    OutreachRequest,
    OutreachResponse,
    ReplyRequest,
    ReplyResponse,
)
from ...services.sales.profiler import analyze_customer
from ...services.sales.seller import generate_outreach, generate_reply

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customers", tags=["customers"])


@router.post("/analyze-profile", response_model=AnalyzeCustomerResponse, response_model_by_alias=True)
async def post_analyze_profile(
    request: AnalyzeCustomerRequest,
    request_id: str = Depends(require_service_token),
) -> AnalyzeCustomerResponse:
    logger.info("customers/analyze-profile generation=%s request=%s", request.generation_id, request_id)
    return await analyze_customer(request)


@router.post("/outreach", response_model=OutreachResponse, response_model_by_alias=True)
async def post_outreach(
    request: OutreachRequest,
    request_id: str = Depends(require_service_token),
) -> OutreachResponse:
    logger.info(
        "customers/outreach generation=%s request=%s goal=%s",
        request.generation_id,
        request_id,
        request.goal,
    )
    return await generate_outreach(request)


@router.post("/reply", response_model=ReplyResponse, response_model_by_alias=True)
async def post_reply(
    request: ReplyRequest,
    request_id: str = Depends(require_service_token),
) -> ReplyResponse:
    logger.info("customers/reply generation=%s request=%s", request.generation_id, request_id)
    return await generate_reply(request)
