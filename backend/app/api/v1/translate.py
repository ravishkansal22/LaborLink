from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.common import ErrorResponse
from app.schemas.translate import TranslateRequest, TranslateResponse
from app.services.translation import TranslationService

router = APIRouter(tags=["translation"])


def get_translation_service(request: Request) -> TranslationService:
    return request.app.state.translation_service


@router.post(
    "/translate",
    response_model=TranslateResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Translate app text into an Indian language (Sarvam AI, cached)",
)
def translate(
    payload: TranslateRequest,
    db: Session = Depends(get_db),
    service: TranslationService = Depends(get_translation_service),
) -> TranslateResponse:
    translations = service.translate_texts(
        db, payload.texts, payload.target_language, source=payload.source_language
    )
    return TranslateResponse(
        target_language=payload.target_language,
        translations=translations,
        available=service.available,
    )
