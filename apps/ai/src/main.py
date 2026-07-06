from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .api.routers import customers, images, pricing, products, trends
from .config import get_settings
from .models.schemas import HealthResponse

VERSION = "1.0.0"

settings = get_settings()
logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("cloudcommerce.ai")

app = FastAPI(
    title="CloudCommerce AI Service",
    version=VERSION,
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.environment == "development" else None,
)

API_PREFIX = "/internal/ai/v1"
app.include_router(products.router, prefix=API_PREFIX)
app.include_router(images.router, prefix=API_PREFIX)
app.include_router(customers.router, prefix=API_PREFIX)
app.include_router(pricing.router, prefix=API_PREFIX)
app.include_router(trends.router, prefix=API_PREFIX)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(service=settings.service_name, version=VERSION)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError) -> JSONResponse:
    # Upstream model failures (OpenAI/Gemini) surface as RuntimeError → 502 so
    # apps/api retries once and then degrades gracefully.
    logger.error("upstream failure on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=502, content={"detail": str(exc)})


def run() -> None:
    import uvicorn

    uvicorn.run("src.main:app", host=settings.host, port=settings.port, reload=settings.environment == "development")


if __name__ == "__main__":
    run()
