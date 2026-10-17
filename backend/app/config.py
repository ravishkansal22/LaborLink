"""Centralised application settings, loaded from environment variables / backend/.env."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _resolve(path: str | Path) -> Path:
    """Resolve a path relative to the backend directory (absolute paths are kept)."""
    p = Path(path)
    return p if p.is_absolute() else (BACKEND_DIR / p).resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LABORLINK_",
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "LaborLink API"
    environment: Literal["development", "test", "production"] = "development"

    database_url: str = "sqlite:///./var/laborlink.db"
    upload_dir: str = "./var/uploads"
    max_upload_bytes: int = Field(default=5 * 1024 * 1024, gt=0)
    rate_card_path: str = "./app/data/rate_card.json"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    work_order_provider: Literal["rule_based", "anthropic"] = "rule_based"
    anthropic_model: str = "claude-opus-5-5"
    anthropic_effort: Literal["low", "medium", "high", "xhigh", "max"] = "low"
    provider_timeout_seconds: float = Field(default=30.0, gt=0)

    # Speech-to-text (Sarvam AI). No key = feature off; the app uses browser recognition.
    sarvam_api_key: SecretStr | None = Field(
        default=None, validation_alias=AliasChoices("SARVAM_API_KEY", "LABORLINK_SARVAM_API_KEY")
    )
    sarvam_stt_model: str = ""  # empty = Sarvam's default model
    max_audio_bytes: int = Field(default=2 * 1024 * 1024, gt=0)
    # Translation (Sarvam AI, same key). "formal" keeps the text in the native script; the
    # colloquial modes mix in many English words.
    sarvam_translate_model: str = "mayura:v1"
    sarvam_translate_mode: Literal[
        "formal", "modern-colloquial", "classic-colloquial", "code-mixed"
    ] = "formal"

    @property
    def resolved_database_url(self) -> str:
        """SQLite URLs with relative paths are anchored to backend/ so cwd doesn't matter."""
        prefix = "sqlite:///"
        url = self.database_url
        if url.startswith(prefix) and not url.startswith("sqlite:///:memory:"):
            return prefix + _resolve(url[len(prefix):]).as_posix()
        return url

    @property
    def sqlite_path(self) -> Path | None:
        url = self.resolved_database_url
        if url.startswith("sqlite:///") and ":memory:" not in url:
            return Path(url[len("sqlite:///"):])
        return None

    @property
    def upload_path(self) -> Path:
        return _resolve(self.upload_dir)

    @property
    def rate_card_file(self) -> Path:
        return _resolve(self.rate_card_path)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
