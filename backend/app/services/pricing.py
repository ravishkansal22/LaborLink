"""FairRate: deterministic, explainable indicative pricing.

All numbers come from the rate card (app/data/rate_card.json); this module holds only the
formula:

    hourly_rate      = trade rate (raised to the configured wage floor, if one is configured)
    multiplier       = complexity multiplier x urgency multiplier
    labour (min/max) = max(hourly_rate x duration_hours (min/max) x multiplier, minimum_charge)
    total (min/max)  = labour rounded outward to `rounding_step` + travel allowance

Identical inputs always produce identical outputs.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from app.schemas.common import Complexity, Trade, Urgency
from app.schemas.pricing import (
    AmountRange,
    OfferTerms,
    PriceEstimate,
    RateCard,
    WageFloorCheck,
)
from app.schemas.work_order import DurationRange


class RateCardError(Exception):
    pass


def load_rate_card(path: Path) -> RateCard:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RateCardError(f"Rate card not found at {path}") from exc
    except json.JSONDecodeError as exc:
        raise RateCardError(f"Rate card at {path} is not valid JSON") from exc
    try:
        return RateCard.model_validate(data)
    except ValueError as exc:
        raise RateCardError(f"Rate card at {path} is invalid: {exc}") from exc


def _round_down(value: float, step: int) -> int:
    return int(math.floor(round(value, 6) / step) * step)


def _round_up(value: float, step: int) -> int:
    return int(math.ceil(round(value, 6) / step) * step)


def _money(card: RateCard, amount: float) -> str:
    return f"{card.currency} {amount:,.0f}"


def calculate_estimate(
    card: RateCard,
    *,
    trade: Trade,
    complexity: Complexity,
    urgency: Urgency,
    duration: DurationRange,
    context_warnings: list[str] | None = None,
) -> PriceEstimate:
    trade_rate = card.trades[trade]
    hourly_rate = trade_rate.hourly_rate
    assumptions: list[str] = []
    warnings: list[str] = list(context_warnings or [])

    floor = card.wage_floors.get(trade)
    if floor is None:
        wage_check = WageFloorCheck(
            status="not_configured",
            detail=(
                "No verified jurisdiction-specific minimum wage is configured for this trade, "
                "so the estimate has not been checked against a legal wage floor."
            ),
        )
        warnings.append(wage_check.detail)
    elif hourly_rate < floor:
        wage_check = WageFloorCheck(
            status="applied",
            detail=(
                f"Hourly rate raised from {_money(card, hourly_rate)} to the configured wage "
                f"floor of {_money(card, floor)} ({card.wage_floor_source})."
            ),
        )
        hourly_rate = floor
        assumptions.append(wage_check.detail)
    else:
        wage_check = WageFloorCheck(
            status="satisfied",
            detail=(
                f"Hourly rate {_money(card, hourly_rate)} meets the configured wage floor of "
                f"{_money(card, floor)} ({card.wage_floor_source})."
            ),
        )

    c_mult = card.complexity_multipliers[complexity]
    u_mult = card.urgency_multipliers[urgency]
    multiplier = c_mult * u_mult

    raw_min = hourly_rate * duration.min_hours * multiplier
    raw_max = hourly_rate * duration.max_hours * multiplier
    labour_min = max(raw_min, trade_rate.minimum_charge)
    labour_max = max(raw_max, trade_rate.minimum_charge)

    step = card.rounding_step
    labour = AmountRange(min=_round_down(labour_min, step), max=_round_up(labour_max, step))
    travel = int(round(card.travel_allowance))

    assumptions.insert(
        0,
        f"{trade.value.capitalize()} hourly rate of {_money(card, hourly_rate)} from rate card "
        f"'{card.version}' ({card.region}). {card.disclaimer}",
    )
    assumptions.append(
        f"Labour time of {duration.min_hours:g}-{duration.max_hours:g} hours comes from the "
        "work order and is an estimate, not a measurement."
    )
    assumptions.append(
        f"Complexity '{complexity.value}' multiplier {c_mult:g} x urgency '{urgency.value}' "
        f"multiplier {u_mult:g} = {multiplier:g}."
    )
    if raw_min < trade_rate.minimum_charge:
        assumptions.append(
            f"Minimum call-out charge of {_money(card, trade_rate.minimum_charge)} applies."
        )
    assumptions.append(
        f"Flat travel allowance of {_money(card, travel)}; the actual distance to the worker "
        "is not priced yet."
    )
    assumptions.append(
        "Materials and spare parts are not included; they are billed separately at actual cost."
    )
    assumptions.append(f"Amounts are rounded outward to the nearest {_money(card, step)}.")

    return PriceEstimate(
        min_amount=labour.min + travel,
        max_amount=labour.max + travel,
        currency=card.currency,
        labour=labour,
        travel_allowance=travel,
        materials_included=False,
        hourly_rate_used=hourly_rate,
        multipliers={"complexity": c_mult, "urgency": u_mult, "combined": round(multiplier, 4)},
        duration_hours={"min": duration.min_hours, "max": duration.max_hours},
        assumptions=assumptions,
        warnings=warnings,
        wage_floor_check=wage_check,
        rate_card_version=card.version,
    )


def offer_terms(card: RateCard, estimate: PriceEstimate) -> OfferTerms:
    """Offer limits for a job, derived from its current estimate (no second pricing formula).

    The suggested amount is the midpoint of the estimated labour range. Counter-offers may not
    go below `labour.min x floor_ratio` (protecting workers from a race to the bottom) or above
    `labour.max x ceiling_ratio` (protecting employers).
    """
    if estimate.id is None:
        raise ValueError("estimate must be persisted before offer terms are derived")
    step = card.rounding_step
    limits = card.offer_limits
    permitted_min = max(_round_up(estimate.labour.min * limits.floor_ratio, step), step)
    permitted_max = max(_round_down(estimate.labour.max * limits.ceiling_ratio, step),
                        permitted_min)
    midpoint = (estimate.labour.min + estimate.labour.max) / 2
    suggested = int(math.floor(midpoint / step + 0.5) * step)  # round half up
    suggested = min(max(suggested, permitted_min), permitted_max)
    return OfferTerms(
        price_estimate_id=estimate.id,
        currency=estimate.currency,
        suggested_labour_amount=suggested,
        permitted_min=permitted_min,
        permitted_max=permitted_max,
        travel_allowance=estimate.travel_allowance,
        basis=(
            f"Labour estimate {_money(card, estimate.labour.min)}-"
            f"{_money(card, estimate.labour.max)}; offers allowed from {limits.floor_ratio:g}x "
            f"the minimum to {limits.ceiling_ratio:g}x the maximum (illustrative LaborLink "
            "policy, not a legal requirement)."
        ),
    )
