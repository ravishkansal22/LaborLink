from __future__ import annotations

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
