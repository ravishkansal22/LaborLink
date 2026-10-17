"""Translation endpoint and job-description translation. A fake transport stands in for Sarvam."""

from __future__ import annotations

import httpx
import pytest

from app.services.translation import SARVAM_TRANSLATE_URL, TranslationService, needs_translation


class FakeSarvam:
    """Translates by tagging the text, e.g. 'Book' -> '[ta] Book'."""

    def __init__(self, status: int = 200, drop_tokens: bool = False):
        self.status = status
        self.drop_tokens = drop_tokens
        self.calls: list[dict] = []

    def post(self, url, *, headers, json, timeout):
        self.calls.append({"url": url, "headers": headers, "json": json})
        if self.status != 200:
            return httpx.Response(self.status, json={"error": {"message": "nope"}})
        tag = json["target_language_code"].split("-")[0]
        text = f"[{tag}] {json['input']}"
        if self.drop_tokens:
            text = text.replace("[0]", "")
        return httpx.Response(200, json={"translated_text": text, "source_language_code": "en-IN"})


def _service(fake: FakeSarvam | None, key: str | None = "test-key") -> TranslationService:
    return TranslationService(api_key=key, model="mayura:v1", mode="formal",
                              timeout=5, transport=fake, max_workers=1)


def _translate(client, texts, target="ta", source="en"):
    return client.post("/api/v1/translate",
                       json={"texts": texts, "target_language": target, "source_language": source})


def test_each_string_is_translated_once_and_cached(make_client):
    fake = FakeSarvam()
    client = make_client(translation_service=_service(fake))
    r = _translate(client, ["Book", "Track", "Book"])
    assert r.status_code == 200
    assert r.json() == {"target_language": "ta", "available": True,
                        "translations": ["[ta] Book", "[ta] Track", "[ta] Book"]}
    assert sorted(c["json"]["input"] for c in fake.calls) == ["Book", "Track"]
    call = fake.calls[0]
    assert call["url"] == SARVAM_TRANSLATE_URL
    assert call["headers"] == {"api-subscription-key": "test-key"}
    assert call["json"] | {"input": "Book"} == {
        "input": "Book", "source_language_code": "en-IN", "target_language_code": "ta-IN",
        "model": "mayura:v1", "mode": "formal", "numerals_format": "international"}

    assert _translate(client, ["Track"]).json()["translations"] == ["[ta] Track"]
    assert len(fake.calls) == 2  # served from the database cache


def test_cache_survives_without_a_key(make_client, settings):
    _translate(make_client(translation_service=_service(FakeSarvam())), ["Book"])
    offline = make_client(translation_service=_service(None, key=None))
    body = _translate(offline, ["Book", "New text"]).json()
    assert body == {"target_language": "ta", "available": False,
                    "translations": ["[ta] Book", None]}


def test_placeholders_are_sent_as_tokens_and_restored(make_client):
    fake = FakeSarvam()
    client = make_client(translation_service=_service(fake))
    body = _translate(client, ["Book {name} for {amount}"]).json()
    assert fake.calls[0]["json"]["input"] == "Book [0] for [1]"
    assert body["translations"] == ["[ta] Book {name} for {amount}"]


def test_lost_placeholders_keep_the_english_text(make_client):
    client = make_client(translation_service=_service(FakeSarvam(drop_tokens=True)))
    body = _translate(client, ["Arriving in {n} min"]).json()
    assert body["translations"] == ["Arriving in {n} min"]


def test_provider_errors_leave_strings_untranslated(make_client):
    client = make_client(translation_service=_service(FakeSarvam(status=429)))
    assert _translate(client, ["Book"]).json()["translations"] == [None]


def test_same_language_is_returned_unchanged(make_client):
    fake = FakeSarvam()
    client = make_client(translation_service=_service(fake))
    assert _translate(client, ["Book"], target="en").json()["translations"] == ["Book"]
    assert fake.calls == []


def test_unknown_language_is_rejected(make_client):
    client = make_client(translation_service=_service(FakeSarvam()))
    r = _translate(client, ["Book"], target="fr")
    assert (r.status_code, r.json()["error"]["code"]) == (422, "unsupported_language")


@pytest.mark.parametrize("text, expected", [
    ("Kitchen tap leaking", False), ("Bathroom ka nal tapak raha hai", False),
    ("Café door stuck", False), ("नल से पानी टपक रहा है", True), ("குழாய் கசிகிறது", True),
])
def test_needs_translation_detects_indian_scripts(text, expected):
    assert needs_translation(text) is expected


class EnglishSarvam(FakeSarvam):
    def post(self, url, *, headers, json, timeout):
        self.calls.append({"json": json})
        return httpx.Response(200, json={"translated_text": "The kitchen tap is leaking",
                                         "source_language_code": "hi-IN"})


def test_job_in_hindi_script_is_understood_but_stored_as_written(make_client, job_payload):
    fake = EnglishSarvam()
    client = make_client(translation_service=_service(fake))
    job_payload |= {"description": "रसोई का नल टपक रहा है", "language": "hi"}
    body = client.post("/api/v1/jobs", json=job_payload).json()
    assert body["request"]["description"] == "रसोई का नल टपक रहा है"
    assert body["trade"] == "plumber"
    assert body["work_order"]["problem_category"] == "leak_repair"
    assert body["work_order"]["problem_summary"] == "रसोई का नल टपक रहा है"
    assert fake.calls[0]["json"]["source_language_code"] == "hi-IN"
    assert fake.calls[0]["json"]["target_language_code"] == "en-IN"


def test_latin_script_jobs_are_not_sent_for_translation(make_client, job_payload):
    fake = EnglishSarvam()
    client = make_client(translation_service=_service(fake))
    assert client.post("/api/v1/jobs", json=job_payload).status_code == 201
    assert fake.calls == []
