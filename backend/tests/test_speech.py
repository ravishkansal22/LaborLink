"""Speech-to-text endpoints. A fake transport stands in for Sarvam AI (no real calls)."""

from __future__ import annotations

import httpx
import pytest

from app.services.speech import SARVAM_STT_URL, SpeechService

AUDIO = b"\x1aE\xdf\xa3fake-webm-audio"


class FakeTransport:
    def __init__(self, response: httpx.Response | Exception):
        self.response = response
        self.calls: list[dict] = []

    def post(self, url, *, headers, data, files, timeout):
        self.calls.append({"url": url, "headers": headers, "data": data, "files": files})
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


def _service(transport=None, key="test-key", model=None) -> SpeechService:
    return SpeechService(api_key=key, model=model, timeout=5, max_bytes=1024,
                         transport=transport)


def _upload(client, content=AUDIO, content_type="audio/webm;codecs=opus", language="hi"):
    return client.post("/api/v1/speech/transcribe",
                       files={"file": ("voice.webm", content, content_type)},
                       data={"language": language})


def test_status_reports_unavailable_without_key(client):
    body = client.get("/api/v1/speech/status").json()
    assert body == {"available": False, "provider": None, "max_bytes": 2 * 1024 * 1024}


def test_transcribe_without_key_returns_503(client):
    r = _upload(client)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "speech_not_configured"


def test_transcribe_returns_transcript(make_client):
    fake = FakeTransport(httpx.Response(200, json={
        "request_id": "r1", "transcript": "  Bathroom ka nal tapak raha hai ",
        "language_code": "hi-IN",
    }))
    client = make_client(speech_service=_service(fake))
    assert client.get("/api/v1/speech/status").json()["available"] is True

    r = _upload(client)
    assert r.status_code == 200
    assert r.json() == {"transcript": "Bathroom ka nal tapak raha hai",
                        "language_code": "hi-IN", "provider": "sarvam"}
    call = fake.calls[0]
    assert call["url"] == SARVAM_STT_URL
    assert call["headers"] == {"api-subscription-key": "test-key"}
    assert call["data"] == {"language_code": "hi-IN"}
    assert call["files"]["file"] == ("voice.webm", AUDIO, "audio/webm")


@pytest.mark.parametrize(
    "language, code", [("en", "en-IN"), ("hi", "hi-IN"), ("ta", "ta-IN"), ("xx", "unknown")]
)
def test_language_is_mapped_and_model_is_optional(make_client, language, code):
    fake = FakeTransport(httpx.Response(200, json={"transcript": "x", "language_code": None}))
    client = make_client(speech_service=_service(fake, model="saaras:v3"))
    assert _upload(client, language=language).status_code == 200
    assert fake.calls[0]["data"] == {"language_code": code, "model": "saaras:v3"}


@pytest.mark.parametrize(
    "content, content_type, status, code",
    [
        (AUDIO, "image/png", 415, "unsupported_media_type"),
        (b"", "audio/webm", 422, "empty_audio"),
        (b"x" * 2000, "audio/webm", 413, "payload_too_large"),
    ],
)
def test_bad_uploads_are_rejected_before_calling_the_provider(make_client, content,
                                                             content_type, status, code):
    fake = FakeTransport(httpx.Response(200, json={"transcript": "x"}))
    client = make_client(speech_service=_service(fake))
    r = _upload(client, content=content, content_type=content_type)
    assert (r.status_code, r.json()["error"]["code"]) == (status, code)
    assert fake.calls == []


@pytest.mark.parametrize(
    "response, status, code",
    [
        (httpx.Response(429, json={}), 429, "speech_rate_limited"),
        (httpx.Response(403, json={"error": {"message": "bad key"}}), 502, "speech_provider_error"),
        (httpx.Response(200, text="not json"), 502, "speech_provider_error"),
        (httpx.ConnectTimeout("slow"), 502, "speech_provider_error"),
    ],
)
def test_provider_failures_map_to_clean_errors(make_client, response, status, code):
    client = make_client(speech_service=_service(FakeTransport(response)))
    r = _upload(client)
    assert (r.status_code, r.json()["error"]["code"]) == (status, code)
    assert "test-key" not in r.text
