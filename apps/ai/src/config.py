from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the AI microservice.

    Every value can be overridden via environment variables (see .env.example).
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Service ---
    service_name: str = Field(default="cloudcommerce-ai", alias="AI_SERVICE_NAME")
    host: str = Field(default="0.0.0.0", alias="AI_SERVICE_HOST")
    port: int = Field(default=8000, alias="AI_SERVICE_PORT")
    environment: str = Field(default="development", alias="AI_SERVICE_ENV")
    log_level: str = Field(default="INFO", alias="AI_LOG_LEVEL")

    # Shared secret required on every request coming from apps/api.
    service_token: str = Field(default="", alias="AI_SERVICE_TOKEN")

    # --- OpenAI (text: descriptions, specs, SEO, sales copilot; vision: image analysis) ---
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_text_model: str = Field(default="gpt-4o", alias="OPENAI_TEXT_MODEL")
    openai_vision_model: str = Field(default="gpt-4o", alias="OPENAI_VISION_MODEL")
    openai_timeout_seconds: float = Field(default=90.0, alias="OPENAI_TIMEOUT_SECONDS")

    # --- Gemini (image generation / enhancement) ---
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_image_model: str = Field(default="gemini-2.5-flash-image", alias="GEMINI_IMAGE_MODEL")
    gemini_timeout_seconds: float = Field(default=120.0, alias="GEMINI_TIMEOUT_SECONDS")

    # --- Limits ---
    max_image_bytes: int = Field(default=12 * 1024 * 1024, alias="AI_MAX_IMAGE_BYTES")
    image_output_size: int = Field(default=2048, alias="AI_IMAGE_OUTPUT_SIZE")

    # --- Cost accounting (ARS minor units; reported back to apps/api as usage) ---
    text_cost_minor_per_1k_tokens: int = Field(default=8, alias="AI_TEXT_COST_MINOR_PER_1K_TOKENS")
    image_cost_minor: int = Field(default=5000, alias="AI_IMAGE_COST_MINOR")

    # --- Cache (optional; falls back to in-memory when unset) ---
    redis_url: str = Field(default="", alias="REDIS_URL")
    cache_ttl_seconds: int = Field(default=3600, alias="AI_CACHE_TTL_SECONDS")


@lru_cache
def get_settings() -> Settings:
    return Settings()
