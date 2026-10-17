from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.schemas.common import ErrorResponse
from app.schemas.speech import SpeechStatusResponse, TranscriptResponse
from app.services.speech import PROVIDER, SpeechService

router = APIRouter(prefix="/speech", tags=["speech"])


def get_speech_service(request: Request) -> SpeechService:
    return request.app.state.speech_service


@router.get("/status", response_model=SpeechStatusResponse,
            summary="Whether server speech-to-text (Sarvam AI) is configured")
def speech_status(service: SpeechService = Depends(get_speech_service)) -> SpeechStatusResponse:
    return SpeechStatusResponse(
        available=service.available,
        provider=PROVIDER if service.available else None,
        max_bytes=service.max_bytes,
    )


@router.post(
    "/transcribe",
    response_model=TranscriptResponse,
    responses={code: {"model": ErrorResponse} for code in (413, 415, 422, 429, 502, 503)},
    summary="Transcribe a short voice note (under 30 s) to text with Sarvam AI",
)
def transcribe(
    file: UploadFile = File(..., description="Audio recording (multipart field name: file)"),
    language: str | None = Form(default=None, description="App language: en or hi"),
    service: SpeechService = Depends(get_speech_service),
) -> TranscriptResponse:
    audio = file.file.read(service.max_bytes + 1)  # never read more than the limit
    result = service.transcribe(audio, file.content_type, language)
    return TranscriptResponse(transcript=result.transcript, language_code=result.language_code,
                              provider=PROVIDER)
