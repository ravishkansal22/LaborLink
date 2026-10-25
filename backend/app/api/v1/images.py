from __future__ import annotations
import json
import logging

from google import genai
from google.genai import types

from app.errors import ServiceUnavailableError
from app.schemas.jobs import ImageDescriptionSuggestions
from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_settings
from app.config import Settings
from app.errors import NotFoundError
from app.schemas.common import ErrorResponse
from app.schemas.jobs import ImageUploadResponse
from app.services.images import find_image, store_image

router = APIRouter(tags=["images"])


@router.post(
    "/images",
    status_code=status.HTTP_201_CREATED,
    response_model=ImageUploadResponse,
    responses={
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
    summary="Upload an optional job photo (JPEG, PNG or WebP)",
)
def upload_image(
    file: UploadFile = File(..., description="Image file (multipart field name: file)"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ImageUploadResponse:
    record = store_image(
        db,
        file.file,
        original_filename=file.filename,
        upload_dir=settings.upload_path,
        max_bytes=settings.max_upload_bytes,
    )
    return ImageUploadResponse(
        id=record.id,
        content_type=record.content_type,
        size_bytes=record.size_bytes,
        sha256=record.sha256,
        created_at=record.created_at,
    )


@router.get(
    "/images/{image_id}",
    response_class=FileResponse,
    responses={
        200: {"content": {"image/jpeg": {}, "image/png": {}, "image/webp": {}}},
        404: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
    summary="Download an uploaded photo (served with its verified image type)",
)
def get_image(
    image_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    record = find_image(db, image_id)
    path = settings.upload_path / record.stored_filename
    if not path.is_file():
        raise NotFoundError(f"Image '{image_id}' is no longer stored.")
    return FileResponse(
        path,
        media_type=record.content_type,
        headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"},
    )
logger = logging.getLogger("laborlink")


@router.post(
    "/images/{image_id}/suggestions",
    response_model=ImageDescriptionSuggestions,
    responses={
        404: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
    summary="Suggest job descriptions from an uploaded photo",
)
def suggest_image_descriptions(
    image_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ImageDescriptionSuggestions:
    # Require a configured API key.
    if not settings.gemini_api_key:
        raise ServiceUnavailableError(
            "Image suggestions are unavailable. Please enter the job description manually."
        )

    # Retrieve the previously uploaded image.
    record = find_image(db, image_id)
    path = settings.upload_path / record.stored_filename

    if not path.is_file():
        raise NotFoundError(f"Image '{image_id}' is no longer stored.")

    prompt = """
You are helping an employer choose the right type of worker on a
labour-services platform.

Analyse the uploaded photo and recommend the most suitable worker
category based on the visible problem.

Allowed worker categories:
- electrician: visible electrical wiring, switches, sockets, lights,
  or electrical fixtures
- plumber: visible leaking or broken pipes, taps, drains, or water
  supply fixtures
- mason: visible damaged walls, plaster, bricks, tiles, or masonry
- carpenter: visible damaged doors, wooden furniture, cabinets,
  or other wooden fittings
- not_sure: the image does not provide enough evidence to choose
  a suitable category

Do not assume a category when the evidence is unclear.
Do not claim certainty about hidden faults or their causes.
Do not invent measurements, prices, locations, or urgency.

Also generate exactly 3 short, clear job descriptions that an employer
could use to request help. Base them on what is visibly supported by
the image. If the problem is unclear, include a general inspection
request instead of guessing.

Return only a valid JSON object with this structure:
{
  "recommended_trade": "plumber",
  "suggestions": [
    "Inspect and repair the visibly leaking pipe.",
    "Check the pipe connection and fix the water leak.",
    "Inspect the plumbing fixture and identify the source of leakage."
  ]
}

The recommended_trade value must be exactly one of:
"electrician", "plumber", "mason", "carpenter", "not_sure".

Do not include Markdown or any text outside the JSON object.
"""

    try:
        image_bytes = path.read_bytes()
        client = genai.Client(
            api_key=settings.gemini_api_key.get_secret_value()
        )

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                prompt,
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=record.content_type,
                ),
            ],
        )

        response_text = response.text
        if not response_text:
            raise ValueError("The model returned an empty response.")

        parsed = json.loads(response_text)

        if not isinstance(parsed, dict):
            raise ValueError("The model response was not a JSON object.")

        recommended_trade = parsed.get("recommended_trade")
        valid_trades = {
        "electrician",
        "plumber",
        "mason",
        "carpenter",
        "not_sure",
        }

        if recommended_trade not in valid_trades:
            raise ValueError("The model returned an invalid worker category.")

        raw_suggestions = parsed.get("suggestions")

        if not isinstance(raw_suggestions, list):
            raise ValueError("The model did not return a suggestions list.")

        suggestions = [
            item.strip()
            for item in raw_suggestions
            if isinstance(item, str) and item.strip()
        ]

        if not 2 <= len(suggestions) <= 3:
            raise ValueError("The model returned an invalid number of suggestions.")

        return ImageDescriptionSuggestions(
        recommended_trade=recommended_trade,
        suggestions=suggestions,
    )

    except Exception as exc:
        # Log the exception type, not credentials or provider response contents.
        logger.warning(
            "Gemini image-description suggestions failed (%s).",
            type(exc).__name__,
        )
        raise ServiceUnavailableError(
            "Could not generate suggestions right now. Please enter the job description manually."
        ) from None
