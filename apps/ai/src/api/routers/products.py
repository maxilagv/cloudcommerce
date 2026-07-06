from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from ...dependencies import require_service_token
from ...models.schemas import (
    GenerateDescriptionRequest,
    GenerateSeoRequest,
    GenerateSpecsRequest,
    SeoResponse,
    SpecsResponse,
    TextResponse,
)
from ...services.generation.description import generate_description
from ...services.generation.seo import generate_seo
from ...services.generation.specs import generate_specs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["products"])


@router.post("/generate-description", response_model=TextResponse, response_model_by_alias=True)
async def post_generate_description(
    request: GenerateDescriptionRequest,
    request_id: str = Depends(require_service_token),
) -> TextResponse:
    logger.info("generate-description generation=%s request=%s", request.generation_id, request_id)
    return await generate_description(request)


@router.post("/generate-specs", response_model=SpecsResponse, response_model_by_alias=True)
async def post_generate_specs(
    request: GenerateSpecsRequest,
    request_id: str = Depends(require_service_token),
) -> SpecsResponse:
    logger.info("generate-specs generation=%s request=%s", request.generation_id, request_id)
    return await generate_specs(request)


@router.post("/generate-seo", response_model=SeoResponse, response_model_by_alias=True)
async def post_generate_seo(
    request: GenerateSeoRequest,
    request_id: str = Depends(require_service_token),
) -> SeoResponse:
    logger.info("generate-seo generation=%s request=%s", request.generation_id, request_id)
    return await generate_seo(request)
