"""Provider failure handling and the Anthropic provider, using fake clients only (no network)."""

from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from app.config import Settings
from app.models import Job
from app.schemas.common import Trade, Urgency
from app.services.work_orders import (
    ImageInput,
    ProviderError,
    RuleBasedProvider,
    WorkOrderInput,
    WorkOrderService,
)
from app.services.work_orders.anthropic_provider import AnthropicProvider, _ModelDraft


def _input(**kw) -> WorkOrderInput:
    base = dict(description="Kitchen tap is leaking under the sink", description_source="text",
                language="en", trade=None, urgency=Urgency.normal, has_coordinates=True,
                image=None)
    base.update(kw)
    return WorkOrderInput(**base)


class FailingProvider:
    name = "anthropic"

    def __init__(self, exc: Exception):
        self.exc = exc

    def generate(self, data):
        raise self.exc


class FakeMessages:
    def __init__(self, result=None, exc=None):
        self.result, self.exc, self.calls = result, exc, []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.exc:
            raise self.exc
        return self.result


def _draft(**overrides) -> _ModelDraft:
    data = dict(
        normalized_description="Kitchen tap leaking under the sink.",
        suggested_trade="plumber", trade_confidence="high",
        problem_category="leak_repair", problem_summary="Leaking kitchen tap",
        classification_confidence="medium", complexity="low",
        likely_tools=["pipe wrench"], likely_materials=["washers"],
        duration_min_hours=1, duration_max_hours=2,
        missing_information=[], follow_up_questions=["How old is the tap?"],
        image_observations=["Water appears to pool under the sink"],
    )
    data.update(overrides)
    return _ModelDraft(**data)


def _provider(messages: FakeMessages) -> AnthropicProvider:
    settings = Settings(_env_file=None, work_order_provider="anthropic")
    return AnthropicProvider(settings, client=SimpleNamespace(messages=messages))


_REQ = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


# --- fallback behaviour in the service ---------------------------------------------------------

@pytest.mark.parametrize(
    "exc, reason",
    [
        (ProviderError("timeout"), "timeout"),
        (ProviderError("invalid_output"), "invalid_output"),
        (RuntimeError("bug"), "unexpected_error:RuntimeError"),
    ],
)
def test_service_falls_back_to_rule_based(exc, reason):
    service = WorkOrderService(FailingProvider(exc))
    wo = service.generate(_input())
    assert wo.generator.provider == "rule_based"
    assert wo.generator.fallback_used is True
    assert wo.generator.fallback_reason == reason
    assert wo.suggested_trade == Trade.plumber


def test_service_revalidates_provider_output():
    class BadProvider:
        name = "anthropic"

        def generate(self, data):
            wo = RuleBasedProvider().generate(data)
            # Bypass validation to simulate a provider returning an inconsistent object.
            return wo.model_construct(**{**wo.__dict__, "trade_source": "unknown"})

    wo = WorkOrderService(BadProvider()).generate(_input())
    assert wo.generator.fallback_used is True
    assert wo.generator.fallback_reason.startswith("unexpected_error")


def test_api_job_survives_provider_failure(make_client, job_payload):
    client = make_client(WorkOrderService(FailingProvider(ProviderError("timeout"))))
    resp = client.post("/api/v1/jobs", json=job_payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "estimated"
    assert body["work_order"]["generator"]["fallback_used"] is True
    assert body["work_order"]["generator"]["fallback_reason"] == "timeout"
    assert client.get(f"/api/v1/jobs/{body['id']}").json() == body
    with client.app.state.session_factory() as s:
        assert s.query(Job).count() == 1


# --- Anthropic provider with a fake client -----------------------------------------------------

def test_anthropic_provider_success_with_image(tmp_path):
    img = tmp_path / "p.png"
    img.write_bytes(b"\x89PNG\r\n\x1a\nfake")
    messages = FakeMessages(SimpleNamespace(stop_reason="end_turn", parsed_output=_draft()))
    wo = _provider(messages).generate(_input(image=ImageInput(img, "image/png")))

    assert wo.generator.provider == "anthropic"
    assert wo.generator.model == "claude-opus-5-5"
    assert wo.suggested_trade == Trade.plumber and wo.trade_source == "inferred"
    assert wo.image_assessment.status == "analysed"
    assert "unverified" in wo.image_assessment.disclaimer
    call = messages.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["output_format"] is _ModelDraft
    assert call["messages"][0]["content"][0]["type"] == "image"


def test_anthropic_provider_keeps_employer_trade():
    messages = FakeMessages(SimpleNamespace(stop_reason="end_turn",
                                            parsed_output=_draft(suggested_trade="mason")))
    wo = _provider(messages).generate(_input(trade=Trade.plumber))
    assert wo.suggested_trade == Trade.plumber
    assert wo.trade_source == "employer_selected"
    assert wo.image_assessment.status == "not_provided"


@pytest.mark.parametrize(
    "exc, reason",
    [
        (anthropic.APITimeoutError(request=_REQ), "timeout"),
        (anthropic.APIConnectionError(request=_REQ), "connection_error"),
        (anthropic.APIStatusError("overloaded",
                                  response=httpx2.Response(529, request=_REQ), body=None),
         "api_error_529"),
        (ValueError("bad json"), "invalid_output"),
    ],
)
def test_anthropic_provider_maps_errors(exc, reason):
    with pytest.raises(ProviderError) as info:
        _provider(FakeMessages(exc=exc)).generate(_input())
    assert info.value.reason == reason


@pytest.mark.parametrize(
    "response, reason",
    [
        (SimpleNamespace(stop_reason="refusal", parsed_output=None), "refused"),
        (SimpleNamespace(stop_reason="max_tokens", parsed_output=None), "truncated"),
        (SimpleNamespace(stop_reason="end_turn", parsed_output=None), "invalid_output"),
        (SimpleNamespace(stop_reason="end_turn",
                         parsed_output=_draft(duration_min_hours=5, duration_max_hours=1)),
         "invalid_output"),
        (SimpleNamespace(stop_reason="end_turn", parsed_output=_draft(problem_summary="  ")),
         "invalid_output"),
    ],
)
def test_anthropic_provider_rejects_unusable_responses(response, reason):
    with pytest.raises(ProviderError) as info:
        _provider(FakeMessages(response)).generate(_input())
    assert info.value.reason == reason


def test_unreadable_image_is_a_provider_error(tmp_path):
    messages = FakeMessages(SimpleNamespace(stop_reason="end_turn", parsed_output=_draft()))
    data = _input(image=ImageInput(tmp_path / "missing.png", "image/png"))
    with pytest.raises(ProviderError) as info:
        _provider(messages).generate(data)
    assert info.value.reason == "image_unreadable"
    assert messages.calls == []
