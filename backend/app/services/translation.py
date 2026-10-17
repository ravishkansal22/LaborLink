"""Translation of app text and job descriptions, via the Sarvam AI translate API.

Every translation is cached in the `translations` table, so each distinct string is sent to
Sarvam (and paid for) only once per target language. Strings are sent one per request, eight
at a time.

Without SARVAM_API_KEY nothing is sent anywhere: cached translations are still returned and
everything else stays in English.
"""

from __future__ import annotations

import hashlib
import logging
import re
import unicodedata
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from typing import Protocol

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.errors import AppError
from app.models import Translation
from app.services.db_guard import db_guard

logger = logging.getLogger("laborlink")

SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate"
PROVIDER = "sarvam"

# App language -> Sarvam code (the 11 languages mayura:v1 supports).
LANGUAGE_CODES = {
    "en": "en-IN", "hi": "hi-IN", "bn": "bn-IN", "mr": "mr-IN", "gu": "gu-IN", "pa": "pa-IN",
    "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN", "ml": "ml-IN", "od": "od-IN",
}
MAX_INPUT_CHARS = 1000  # mayura:v1 limit per request
_PLACEHOLDER = re.compile(r"\{\w+\}")


class UnsupportedLanguageError(AppError):
    status_code = 422
    code = "unsupported_language"


class _CallFailed(Exception):
    """One Sarvam request failed; the strings in it stay untranslated for now."""


class Transport(Protocol):
    def post(self, url: str, *, headers: dict[str, str], json: dict[str, str],
             timeout: float) -> httpx.Response: ...


def _hash(source: str, target: str, text: str, style: str) -> str:
    return hashlib.sha256(f"{style}\x1f{source}\x1f{target}\x1f{text}".encode()).hexdigest()


def needs_translation(text: str) -> bool:
    """True when the text contains letters outside Latin script (e.g. Devanagari, Tamil)."""
    return any(ord(ch) > 0x24F and unicodedata.category(ch).startswith("L") for ch in text)


class TranslationService:
    def __init__(self, *, api_key: str | None, model: str, mode: str, timeout: float,
                 transport: Transport | None = None, max_workers: int = 8):
        self._api_key = api_key
        self._model = model
        self._mode = mode
        self._timeout = timeout
        self._transport = transport
        self._max_workers = max_workers
        self._style = f"{model}/{mode}"  # in the cache key: a new model or mode re-translates

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    # ----------------------------------------------------------------- public

    def translate_texts(self, session: Session, texts: Sequence[str], target: str,
                        source: str = "en") -> list[str | None]:
        """Translate each text from `source` to `target`. `None` = not translated (yet)."""
        target_code = self._code(target)
        source_code = "auto" if source == "auto" else self._code(source)
        if source_code == target_code:
            return list(texts)

        unique = list(dict.fromkeys(t for t in texts if t.strip()))
        found = self._cached(session, source_code, target_code, unique)
        missing = [t for t in unique if t not in found and len(t) <= MAX_INPUT_CHARS]
        if missing and self.available:
            fresh = self._translate_missing(missing, source_code, target_code)
            self._store(session, source_code, target_code, fresh)
            found.update(fresh)
        return [t if not t.strip() else found.get(t) for t in texts]

    def to_english(self, session: Session, text: str, language: str | None) -> str | None:
        """English version of a job description written in an Indian script, or None."""
        if not needs_translation(text) or not self.available:
            return None
        source = language if language in LANGUAGE_CODES and language != "en" else "auto"
        chunk = text[:MAX_INPUT_CHARS]
        return self.translate_texts(session, [chunk], "en", source=source)[0]

    # ----------------------------------------------------------------- internals

    def _code(self, language: str) -> str:
        code = LANGUAGE_CODES.get(language)
        if code is None:
            raise UnsupportedLanguageError(
                f"Language '{language}' is not supported. Use one of: "
                + ", ".join(LANGUAGE_CODES)
            )
        return code

    def _cached(self, session: Session, source: str, target: str,
                texts: list[str]) -> dict[str, str]:
        by_hash = {_hash(source, target, t, self._style): t for t in texts}
        found: dict[str, str] = {}
        keys = list(by_hash)
        with db_guard(session):
            for i in range(0, len(keys), 500):
                rows = session.scalars(
                    select(Translation).where(Translation.source_hash.in_(keys[i:i + 500]))
                )
                for row in rows:
                    found[by_hash[row.source_hash]] = row.translated_text
        return found

    def _store(self, session: Session, source: str, target: str, fresh: dict[str, str]) -> None:
        if not fresh:
            return
        with db_guard(session):
            keys = [_hash(source, target, t, self._style) for t in fresh]
            existing = set(session.scalars(
                select(Translation.source_hash).where(Translation.source_hash.in_(keys))))
            for text, translated in fresh.items():
                key = _hash(source, target, text, self._style)
                if key not in existing:
                    session.add(Translation(source_hash=key, source_language=source,
                                            target_language=target, source_text=text,
                                            translated_text=translated))
            session.commit()

    def _translate_missing(self, texts: list[str], source: str,
                           target: str) -> dict[str, str]:
        """One request per string, several in parallel. (Sarvam merges multi-line input into
        one sentence, so strings can't be packed together.)"""

        def run(text: str) -> tuple[str, str | None]:
            try:
                return text, self._translate_one(text, source, target)
            except _CallFailed:
                return text, None

        with ThreadPoolExecutor(max_workers=self._max_workers) as pool:
            return {text: out for text, out in pool.map(run, texts) if out is not None}

    def _translate_one(self, text: str, source: str, target: str) -> str:
        # {name} placeholders are sent as [0], [1]...: Sarvam keeps those, but translates or
        # drops words in braces. A reply that loses one keeps the English text instead.
        names = list(dict.fromkeys(_PLACEHOLDER.findall(text)))
        protected = text
        for i, name in enumerate(names):
            protected = protected.replace(name, f"[{i}]")
        translated = self._call(protected, source, target).strip()
        if not translated:
            return text
        for i, name in enumerate(names):
            if translated.count(f"[{i}]") != protected.count(f"[{i}]"):
                return text
            translated = translated.replace(f"[{i}]", name)
        return translated

    def _call(self, text: str, source: str, target: str) -> str:
        payload = {"input": text, "source_language_code": source,
                   "target_language_code": target, "model": self._model,
                   "mode": self._mode, "numerals_format": "international"}
        headers = {"api-subscription-key": self._api_key or ""}
        try:
            if self._transport is not None:
                response = self._transport.post(SARVAM_TRANSLATE_URL, headers=headers,
                                                json=payload, timeout=self._timeout)
            else:
                with httpx.Client() as client:
                    response = client.post(SARVAM_TRANSLATE_URL, headers=headers,
                                           json=payload, timeout=self._timeout)
        except httpx.HTTPError as exc:
            logger.warning("Translation request failed: %s", type(exc).__name__)
            raise _CallFailed from None
        if response.status_code != 200:
            logger.warning("Translation returned HTTP %s", response.status_code)
            raise _CallFailed
        try:
            return str(response.json()["translated_text"])
        except (ValueError, KeyError, TypeError):
            raise _CallFailed from None


def build_translation_service(settings: Settings) -> TranslationService:
    key = settings.sarvam_api_key.get_secret_value() if settings.sarvam_api_key else None
    return TranslationService(
        api_key=key or None,
        model=settings.sarvam_translate_model,
        mode=settings.sarvam_translate_mode,
        timeout=settings.provider_timeout_seconds,
    )
