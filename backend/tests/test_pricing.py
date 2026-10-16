import json

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.schemas.common import Complexity, Trade, Urgency
from app.schemas.pricing import RateCard
from app.schemas.work_order import DurationRange
from app.services.pricing import RateCardError, calculate_estimate, load_rate_card


@pytest.fixture
def card() -> RateCard:
    return load_rate_card(Settings(_env_file=None).rate_card_file)


def _estimate(card, **overrides):
    args = dict(
        trade=Trade.electrician,
        complexity=Complexity.medium,
        urgency=Urgency.normal,
        duration=DurationRange(min_hours=2, max_hours=4),
    )
    args.update(overrides)
    return calculate_estimate(card, **args)


def test_default_rate_card_is_valid_and_illustrative(card):
    assert card.currency == "INR"
    assert set(card.trades) == set(Trade)
    assert "not official" in card.disclaimer
    assert card.wage_floors == {}


def test_known_calculation(card):
    est = _estimate(card)
    # electrician 280/h x 2-4h x 1.0 x 1.0 = 560-1120 labour, + 50 travel
    assert est.labour.min == 560 and est.labour.max == 1120
    assert est.travel_allowance == 50
    assert (est.min_amount, est.max_amount) == (610, 1170)
    assert est.hourly_rate_used == 280
    assert est.multipliers == {"complexity": 1.0, "urgency": 1.0, "combined": 1.0}
    assert est.materials_included is False
    assert any("not included" in a for a in est.assumptions)
    assert any("illustrative" in a.lower() for a in est.assumptions)


def test_deterministic_for_identical_inputs(card):
    assert _estimate(card) == _estimate(card)


def test_minimum_charge_applies_to_short_jobs(card):
    est = _estimate(card, trade=Trade.mason, duration=DurationRange(min_hours=0.5, max_hours=1))
    assert est.labour.min == 400 and est.labour.max == 400  # mason minimum charge
    assert any("Minimum call-out charge" in a for a in est.assumptions)


def test_multipliers_and_outward_rounding(card):
    est = _estimate(card, trade=Trade.plumber, complexity=Complexity.high, urgency=Urgency.urgent,
                    duration=DurationRange(min_hours=1.5, max_hours=3))
    # 250 x 1.3 x 1.25 = 406.25/h -> 609.375 .. 1218.75
    assert est.labour.min == 600 and est.labour.max == 1220
    assert est.multipliers["combined"] == pytest.approx(1.625)


def test_context_warnings_are_passed_through(card):
    est = _estimate(card, context_warnings=["Problem unclear"])
    assert est.warnings[0] == "Problem unclear"


def test_wage_floor_not_configured_is_reported(card):
    est = _estimate(card)
    assert est.wage_floor_check.status == "not_configured"
    assert any("wage floor" in w for w in est.warnings)


def test_wage_floor_applied_when_rate_is_below_floor(card):
    floored = card.model_copy(update={"wage_floors": {Trade.electrician: 300.0},
                                      "wage_floor_source": "Test schedule"})
    est = _estimate(floored)
    assert est.wage_floor_check.status == "applied"
    assert est.hourly_rate_used == 300
    assert est.labour.min == 600


def test_wage_floor_satisfied(card):
    floored = card.model_copy(update={"wage_floors": {Trade.electrician: 200.0},
                                      "wage_floor_source": "Test schedule"})
    est = _estimate(floored)
    assert est.wage_floor_check.status == "satisfied"
    assert est.hourly_rate_used == 280


def test_rate_card_rejects_incomplete_or_unsourced_config(card):
    data = card.model_dump(mode="json")
    del data["trades"]["mason"]
    with pytest.raises(ValidationError, match="missing trades"):
        RateCard.model_validate(data)

    data = card.model_dump(mode="json")
    data["wage_floors"] = {"plumber": 100}
    with pytest.raises(ValidationError, match="wage_floor_source"):
        RateCard.model_validate(data)

    data = card.model_dump(mode="json")
    data["urgency_multipliers"]["urgent"] = 0
    with pytest.raises(ValidationError, match="positive"):
        RateCard.model_validate(data)


def test_load_rate_card_errors(tmp_path, card):
    with pytest.raises(RateCardError, match="not found"):
        load_rate_card(tmp_path / "missing.json")
    bad = tmp_path / "bad.json"
    bad.write_text("{oops", encoding="utf-8")
    with pytest.raises(RateCardError, match="not valid JSON"):
        load_rate_card(bad)
    invalid = tmp_path / "invalid.json"
    invalid.write_text(json.dumps({"version": "x"}), encoding="utf-8")
    with pytest.raises(RateCardError, match="invalid"):
        load_rate_card(invalid)
