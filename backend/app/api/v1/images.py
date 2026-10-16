from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_settings
from app.config import Settings
from app.schemas.common import ErrorResponse
from app.schemas.jobs import ImageUploadResponse
from app.services.images import store_image

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
