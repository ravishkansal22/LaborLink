from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class SpeechStatusResponse(BaseModel):
    available: bool
    provider: Literal["sarvam"] | None
    max_bytes: int


class TranscriptResponse(BaseModel):
    transcript: str
    language_code: str | None
    provider: Literal["sarvam"]
