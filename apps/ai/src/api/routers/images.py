from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from ...dependencies import require_service_token
from ...models.schemas import (
    AnalyzeImageRequest,
    AnalyzeImageResponse,
    EnhanceImageRequest,
    EnhanceImageResponse,
    GenerateImageRequest,
    GenerateImageResponse,
)
from ...services.images.pipeline import run_analyze, run_enhance, run_generate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["images"])


@router.post("/analyze", response_model=AnalyzeImageResponse, response_model_by_alias=True)
async def post_analyze(
    request: AnalyzeImageRequest,
    request_id: str = Depends(require_service_token),
) -> AnalyzeImageResponse:
    logger.info("images/analyze generation=%s request=%s", request.generation_id, request_id)
    try:
        return await run_analyze(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/enhance", response_model=EnhanceImageResponse, response_model_by_alias=True)
async def post_enhance(
    request: EnhanceImageRequest,
    request_id: str = Depends(require_service_token),
) -> EnhanceImageResponse:
    logger.info("images/enhance generation=%s request=%s style=%s", request.generation_id, request_id, request.style)
    try:
        return await run_enhance(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/generate", response_model=GenerateImageResponse, response_model_by_alias=True)
async def post_generate(
    request: GenerateImageRequest,
    request_id: str = Depends(require_service_token),
) -> GenerateImageResponse:
    logger.info("images/generate generation=%s request=%s style=%s", request.generation_id, request_id, request.style)
    try:
        return await run_generate(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
