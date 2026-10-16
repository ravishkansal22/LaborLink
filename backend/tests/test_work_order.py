from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.common import Trade, Urgency
from app.schemas.work_order import DurationRange, WorkOrderV1
from app.services.work_orders import (
    ImageInput,
    RuleBasedProvider,
    WorkOrderInput,
    WorkOrderService,
)


def _input(description: str, **kw) -> WorkOrderInput:
    base = dict(
        description=description,
        description_source="text",
        language=None,
        trade=None,
        urgency=Urgency.normal,
        has_coordinates=True,
        image=None,
    )
    base.update(kw)
    return WorkOrderInput(**base)


provider = RuleBasedProvider()


def _valid_payload() -> dict:
    return provider.generate(_input("Ceiling fan needs to be installed in the bedroom")).model_dump(
        mode="json"
    )


# --- schema validation -------------------------------------------------------------------------

def test_valid_payload_round_trips():
    payload = _valid_payload()
    assert WorkOrderV1.model_validate(payload).model_dump(mode="json") == payload


@pytest.mark.parametrize(
    "mutate, message",
    [
        (lambda p: p["estimated_duration"].update(min_hours=5, max_hours=1), "min_hours"),
        (lambda p: p.update(unexpected="x"), "Extra inputs"),
        (lambda p: p.update(schema_version="2.0"), "schema_version"),
        (lambda p: p.update(suggested_trade="painter"), "suggested_trade"),
        (lambda p: p.update(suggested_trade=None), "trade_source"),
        (lambda p: p.update(trade_confidence="certain"), "trade_confidence"),
        (lambda p: p["image_assessment"].update(status="confirmed"), "status"),
    ],
)
def test_schema_rejects_invalid_work_orders(mutate, message):
    payload = _valid_payload()
    mutate(payload)
    with pytest.raises(ValidationError, match=message):
        WorkOrderV1.model_validate(payload)


def test_duration_range_must_be_positive():
    with pytest.raises(ValidationError):
        DurationRange(min_hours=0, max_hours=1)


# --- rule-based provider -----------------------------------------------------------------------

@pytest.mark.parametrize(
    "text, trade, category",
    [
        ("Kitchen tap leaking badly", Trade.plumber, "leak_repair"),
        ("Bathroom drain is blocked and water overflow", Trade.plumber, "blockage_clearing"),
        ("MCB keeps tripping and there is sparking in the switch board",
         Trade.electrician, "fault_diagnosis"),
        ("Ceiling fan not working, switch board sparking", Trade.electrician, "fault_diagnosis"),
        ("Cracks in the bedroom wall need patch work", Trade.mason, "crack_repair"),
        ("Wardrobe drawer is broken", Trade.carpenter, "furniture_repair"),
        ("Bathroom ka nal tapak raha hai, pani waste ho raha hai", Trade.plumber, "leak_repair"),
    ],
)
def test_rule_based_classifies_common_jobs(text, trade, category):
    wo = provider.generate(_input(text))
    assert wo.suggested_trade == trade
    assert wo.trade_source == "inferred"
    assert wo.problem_category == category
    assert wo.likely_tools
    assert wo.generator.provider == "rule_based"


def test_rule_based_is_deterministic():
    data = _input("Water pipe leaking under the sink")
    assert provider.generate(data) == provider.generate(data)


def test_unknown_trade_produces_follow_up_instead_of_guess():
    wo = provider.generate(_input("Please come tomorrow morning"))
    assert wo.suggested_trade is None
    assert wo.trade_source == "unknown"
    assert wo.problem_category == "unclassified"
    assert any("trade" in m.lower() for m in wo.missing_information)


def test_generic_problem_has_low_classification_confidence():
    wo = provider.generate(_input("Need an electrician for some work at home"))
    assert wo.suggested_trade == Trade.electrician
    assert wo.problem_category == "general_electrical"
    assert wo.classification_confidence == "low"
    assert "The specific problem to be fixed" in wo.missing_information


def test_employer_choice_conflicting_with_description_raises_question():
    wo = provider.generate(_input("Pipe is leaking and the drain is blocked",
                                  trade=Trade.electrician))
    assert wo.suggested_trade == Trade.electrician
    assert wo.trade_source == "employer_selected"
    assert any("plumber work" in q for q in wo.follow_up_questions)


def test_rule_based_never_claims_to_have_seen_the_photo(tmp_path):
    image = ImageInput(path=Path(tmp_path / "x.png"), content_type="image/png")
    wo = provider.generate(_input("Tap leaking", image=image))
    assert wo.image_assessment.status == "not_analysed"
    assert wo.image_assessment.observations == []
    assert "does not inspect images" in wo.image_assessment.disclaimer


def test_service_adds_intake_gaps():
    service = WorkOrderService(provider)
    wo = service.generate(_input("tap leaking", has_coordinates=False))
    joined = " ".join(wo.missing_information)
    assert "photo" in joined and "coordinates" in joined and "more detailed" in joined
    # No duplicates when called on an already-flagged order.
    assert len(set(wo.missing_information)) == len(wo.missing_information)
