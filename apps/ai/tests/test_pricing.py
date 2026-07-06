from src.models.schemas import PricingContext, PricingRequest
from src.services.pricing.optimizer import optimize, suggest_for


def make_context(**overrides):
    base = {
        "variantId": "0198d2f0-0000-7000-8000-000000000001",
        "productTitle": "Auriculares BT",
        "categoryName": "Audio",
        "currentPriceMinor": None,
        "supplierCostMinor": 100_000,  # $1000.00
        "currency": "ARS",
        "minMarginBps": 2_000,
    }
    base.update(overrides)
    return PricingContext.model_validate(base)


def test_suggestion_never_breaks_min_margin() -> None:
    suggestion = suggest_for(make_context())
    floor = 100_000 * 1.2
    assert suggestion.suggested_amount_minor >= floor
    assert suggestion.margin_pct >= 20
    assert suggestion.within_min_margin is True


def test_current_price_below_floor_is_flagged() -> None:
    suggestion = suggest_for(make_context(currentPriceMinor=110_000))
    assert suggestion.within_min_margin is False
    assert suggestion.suggested_amount_minor >= 120_000


def test_healthy_current_price_is_kept_and_rounded() -> None:
    suggestion = suggest_for(make_context(currentPriceMinor=150_000))
    assert suggestion.within_min_margin is True
    assert suggestion.suggested_amount_minor >= 120_000
    # psychological ending: ...99 pesos
    assert (suggestion.suggested_amount_minor // 100) % 100 == 99 or (
        suggestion.suggested_amount_minor // 100
    ) % 10 == 9


def test_optimize_reports_zero_cost_usage() -> None:
    response = optimize(
        PricingRequest.model_validate(
            {"generationId": "gen-1", "contexts": [make_context().model_dump(by_alias=True)]}
        )
    )
    assert response.usage.cost_minor == 0
    assert len(response.suggestions) == 1
    payload = response.suggestions[0].model_dump(by_alias=True)
    assert set(payload) >= {"variantId", "suggestedAmountMinor", "currency", "marginPct", "rationale", "withinMinMargin"}
