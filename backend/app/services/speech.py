"""Speech-to-text for voice job descriptions, via the Sarvam AI REST API.

Audio is forwarded to Sarvam and the transcript returned; LaborLink never stores the audio and
never logs it, the transcript or the API key. Without SARVAM_API_KEY the service reports itself
unavailable and the app falls back to the browser's own speech recognition.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.config import Settings
from app.errors import AppError, PayloadTooLargeError, UnsupportedMediaError

logger = logging.getLogger("laborlink")

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
PROVIDER = "sarvam"

# App language -> Sarvam BCP-47 code. Anything else lets Sarvam detect the language.
LANGUAGE_CODES = {"en": "en-IN", "hi": "hi-IN"}

# Formats the browser recorder produces, plus common uploads. Sarvam accepts all of these.
AUDIO_TYPES = {
    "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav",
    "audio/x-wav", "audio/wave", "audio/aac", "audio/flac", "video/webm",
}


class SpeechNotConfiguredError(AppError):
    status_code = 503
    code = "speech_not_configured"


class SpeechProviderError(AppError):
    status_code = 502
    code = "speech_provider_error"


class SpeechRateLimitedError(AppError):
    status_code = 429
    code = "speech_rate_limited"


class EmptyAudioError(AppError):
    status_code = 422
    code = "empty_audio"


class Transport(Protocol):
    def post(self, url: str, *, headers: dict[str, str], data: dict[str, str],
             files: dict[str, tuple[str, bytes, str]], timeout: float) -> httpx.Response: ...


@dataclass(frozen=True)
class Transcript:
    transcript: str
    language_code: str | None


class SpeechService:
    def __init__(self, *, api_key: str | None, model: str | None, timeout: float,
                 max_bytes: int, transport: Transport | None = None):
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self.max_bytes = max_bytes
        self._transport = transport

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    def transcribe(
        self, audio: bytes, content_type: str | None, language: str | None
    ) -> Transcript:
        if not self._api_key:
            raise SpeechNotConfiguredError(
                "Server speech-to-text is not configured (SARVAM_API_KEY is not set)."
            )
        media = (content_type or "").split(";")[0].strip().lower()
        if media not in AUDIO_TYPES:
            raise UnsupportedMediaError(f"Unsupported audio type '{media or 'unknown'}'.")
        if not audio:
            raise EmptyAudioError("The recording is empty.")
        if len(audio) > self.max_bytes:
            raise PayloadTooLargeError(
                f"Audio is larger than {self.max_bytes // 1024} KB. "
                "Keep voice notes under 30 seconds."
            )

        data = {"language_code": LANGUAGE_CODES.get((language or "").lower(), "unknown")}
        if self._model:
            data["model"] = self._model
        extension = media.split("/")[1].replace("x-", "")
        files = {"file": (f"voice.{extension}", audio, media)}
        headers = {"api-subscription-key": self._api_key}
        try:
            if self._transport is not None:
                response = self._transport.post(SARVAM_STT_URL, headers=headers, data=data,
                                                files=files, timeout=self._timeout)
            else:
                with httpx.Client() as client:
                    response = client.post(SARVAM_STT_URL, headers=headers, data=data,
                                           files=files, timeout=self._timeout)
        except httpx.HTTPError as exc:
            logger.warning("Speech-to-text request failed: %s", type(exc).__name__)
            raise SpeechProviderError("The speech service could not be reached.") from None

        if response.status_code == 429:
            raise SpeechRateLimitedError("The speech service is busy. Please try again shortly.")
        if response.status_code != 200:
            logger.warning("Speech-to-text returned HTTP %s", response.status_code)
            raise SpeechProviderError("The speech service could not transcribe this recording.")
        try:
            body = response.json()
            text = str(body.get("transcript") or "").strip()
            language_code = body.get("language_code")
        except (ValueError, AttributeError):
            raise SpeechProviderError("The speech service returned an unexpected reply.") from None
        return Transcript(transcript=text, language_code=language_code)


def build_speech_service(settings: Settings) -> SpeechService:
    key = settings.sarvam_api_key.get_secret_value() if settings.sarvam_api_key else None
    return SpeechService(
        api_key=key or None,
        model=settings.sarvam_stt_model or None,
        timeout=settings.provider_timeout_seconds,
        max_bytes=settings.max_audio_bytes,
    )
