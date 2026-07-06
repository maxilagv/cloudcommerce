from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)

PRICING_BODY = {
    "generationId": "gen-1",
    "contexts": [
        {
            "variantId": "0198d2f0-0000-7000-8000-000000000001",
            "productTitle": "Test",
            "categoryName": "Cat",
            "currentPriceMinor": None,
            "supplierCostMinor": 10_000,
            "currency": "ARS",
            "minMarginBps": 2000,
        }
    ],
}


def test_health_is_public() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_missing_token_is_rejected() -> None:
    response = client.post("/internal/ai/v1/pricing/optimize", json=PRICING_BODY)
    assert response.status_code == 401


def test_wrong_token_is_rejected() -> None:
    response = client.post(
        "/internal/ai/v1/pricing/optimize",
        json=PRICING_BODY,
        headers={"authorization": "Bearer wrong"},
    )
    assert response.status_code == 401


def test_valid_token_reaches_handler() -> None:
    response = client.post(
        "/internal/ai/v1/pricing/optimize",
        json=PRICING_BODY,
        headers={"authorization": "Bearer test-token-0123456789abcdef", "x-request-id": "req-1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["suggestions"][0]["withinMinMargin"] is True
    assert body["usage"]["currency"] == "ARS"
