from __future__ import annotations

from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    target_language: str = Field(min_length=2, max_length=5, description="e.g. hi, ta, bn")
    source_language: str = Field(default="en", min_length=2, max_length=5,
                                 description="Language of `texts`; `auto` to detect")
    texts: list[str] = Field(min_length=1, max_length=200)


class TranslateResponse(BaseModel):
    target_language: str
    translations: list[str | None] = Field(
        description="Same order as `texts`. null = not translated yet (show the original)."
    )
    available: bool = Field(description="False when no Sarvam key is configured; only "
                                        "previously cached translations are returned.")
