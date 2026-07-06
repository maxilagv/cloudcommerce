from __future__ import annotations

import math

from ...models.schemas import (
    PriceSuggestionOut,
    PricingContext,
    PricingRequest,
    PricingResponse,
    Usage,
)

DEFAULT_MIN_MARGIN_BPS = 2_000  # 20%
TARGET_MARGIN_BPS = 3_500  # healthy dropshipping target when there is no current price signal


def optimize(request: PricingRequest) -> PricingResponse:
    """Margin-safe price suggestions.

    Deterministic by design: pricing must be auditable and instant, so this uses
    margin math + psychological rounding instead of an LLM.
    """
    suggestions = [suggest_for(context) for context in request.contexts]
    return PricingResponse(
        suggestions=suggestions,
        usage=Usage(cost_minor=0, currency="ARS", unit="tokens", amount=0),
    )


def suggest_for(context: PricingContext) -> PriceSuggestionOut:
    min_margin_bps = context.min_margin_bps if context.min_margin_bps is not None else DEFAULT_MIN_MARGIN_BPS
    cost = context.supplier_cost_minor
    floor = math.ceil(cost * (1 + min_margin_bps / 10_000))

    if context.current_price_minor is not None and context.current_price_minor >= floor:
        # The current price already clears the floor: keep it but snap to a
        # psychological ending, never dropping below the floor.
        base = context.current_price_minor
        rationale_core = "Mantiene el precio actual (cumple margen mínimo) con redondeo psicológico."
    else:
        base = max(floor, math.ceil(cost * (1 + TARGET_MARGIN_BPS / 10_000)))
        rationale_core = (
            "Precio actual por debajo del margen mínimo; se sugiere el piso rentable."
            if context.current_price_minor is not None
            else "Sin precio vigente; se aplica margen objetivo sobre el costo del proveedor."
        )

    suggested = _psychological_round(base, floor)
    margin_pct = ((suggested - cost) / cost * 100) if cost > 0 else 100.0
    # False flags a variant whose CURRENT price is below the profitable floor —
    # that is the actionable alert for the owner (the suggestion itself always clears it).
    within = context.current_price_minor is None or context.current_price_minor >= floor

    rationale = (
        f"{rationale_core} Costo proveedor ${cost / 100:,.0f}, margen resultante {margin_pct:.1f}% "
        f"(mínimo requerido {min_margin_bps / 100:.1f}%)."
    )
    return PriceSuggestionOut(
        variant_id=context.variant_id,
        suggested_amount_minor=suggested,
        currency="ARS",
        margin_pct=round(margin_pct, 2),
        rationale=rationale[:600],
        within_min_margin=within,
    )


def _psychological_round(amount_minor: int, floor_minor: int) -> int:
    """Snap to an attractive ARS ending (…990) without crossing below the floor."""
    if amount_minor <= 0:
        return max(amount_minor, floor_minor)
    pesos = amount_minor / 100
    if pesos < 1_000:
        candidate = (math.floor(pesos / 10) * 10 + 9.9) * 100
    else:
        candidate = (math.floor(pesos / 100) * 100 + 99) * 100
    candidate_minor = int(round(candidate))
    if candidate_minor < floor_minor:
        # Move up to the next attractive ending instead.
        step = 1_000 if pesos < 1_000 else 10_000
        candidate_minor += step
    return max(candidate_minor, floor_minor)
