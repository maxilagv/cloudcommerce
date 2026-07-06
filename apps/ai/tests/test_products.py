import base64

import pytest

from src.models.schemas import (
    GenerateDescriptionRequest,
    SeoResponse,
    SpecsResponse,
    TextResponse,
    Usage,
)
from src.utils.helpers import decode_image, slugify, token_usage


def test_text_response_serializes_gateway_contract() -> None:
    response = TextResponse(text="Hola", model="gpt-test", usage=token_usage(1234))
    payload = response.model_dump(by_alias=True)
    assert payload["text"] == "Hola"
    assert payload["usage"]["currency"] == "ARS"
    assert payload["usage"]["unit"] == "tokens"
    assert payload["usage"]["amount"] == 1234
    assert payload["usage"]["costMinor"] >= 1


def test_seo_response_uses_camel_case_aliases() -> None:
    response = SeoResponse(
        title="t",
        meta_description="m",
        keywords=["k"],
        model="gpt-test",
        usage=Usage(cost_minor=1, currency="ARS", unit="tokens", amount=10),
    )
    payload = response.model_dump(by_alias=True)
    assert "metaDescription" in payload
    assert "meta_description" not in payload


def test_specs_response_item_aliases() -> None:
    response = SpecsResponse.model_validate(
        {
            "groups": [
                {
                    "name": "General",
                    "items": [
                        {"key": "peso", "label": "Peso", "valueText": None, "valueNum": 1.2, "unit": "kg"}
                    ],
                }
            ],
            "model": "gpt-test",
            "usage": {"costMinor": 1, "currency": "ARS", "unit": "tokens", "amount": 10},
        }
    )
    payload = response.model_dump(by_alias=True)
    assert payload["groups"][0]["items"][0]["valueNum"] == 1.2


def test_description_request_parses_gateway_payload() -> None:
    request = GenerateDescriptionRequest.model_validate(
        {
            "generationId": "gen-1",
            "locale": "es-AR",
            "constraints": {"maxChars": 1200, "tone": "premium"},
            "product": {
                "productId": "0198d2f0-0000-7000-8000-000000000001",
                "title": "Mate acero",
                "subtitle": None,
                "description": "",
                "categoryName": "Cocina",
                "brandName": None,
                "specs": [],
                "variantAttributes": [],
            },
        }
    )
    assert request.constraints.max_chars == 1200
    assert request.product.title == "Mate acero"


def test_slugify_normalizes_accents() -> None:
    assert slugify("Cámara Réflex 4K") == "camara-reflex-4k"


def test_decode_image_rejects_garbage_and_oversize() -> None:
    with pytest.raises(ValueError):
        decode_image("not-base64!!!")
    big = base64.b64encode(b"x" * 32).decode()
    with pytest.raises(ValueError):
        decode_image(big, max_bytes=16)
    assert decode_image(base64.b64encode(b"ok").decode()) == b"ok"
