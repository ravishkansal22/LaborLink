"""Safe storage of uploaded job photos.

- Only JPEG, PNG and WebP are accepted, verified by file signature (not by the client's claim).
- Size is enforced while reading, so oversized uploads are never fully buffered.
- Files are stored under a server-generated name in the configured upload directory and are
  never executed or served back by Phase 1.
"""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from pathlib import Path
from typing import BinaryIO

from sqlalchemy.orm import Session

from app.errors import AppError, NotFoundError, PayloadTooLargeError, UnsupportedMediaError
from app.models import ImageUpload
from app.services.db_guard import db_guard

logger = logging.getLogger("laborlink.images")

_CHUNK = 64 * 1024


class StorageError(AppError):
    status_code = 500
    code = "storage_error"


def detect_image_type(head: bytes) -> tuple[str, str] | None:
    """Return (content_type, extension) from magic bytes, or None if unsupported."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


def safe_original_name(name: str | None) -> str | None:
    if not name:
        return None
    base = re.split(r"[\\/]", name)[-1]
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._")
    return cleaned[:100] or None


def store_image(
    session: Session,
    stream: BinaryIO,
    *,
    original_filename: str | None,
    upload_dir: Path,
    max_bytes: int,
) -> ImageUpload:
    data = bytearray()
    while True:
        chunk = stream.read(_CHUNK)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > max_bytes:
            raise PayloadTooLargeError(f"Image exceeds the {max_bytes}-byte limit.")
    if not data:
        raise UnsupportedMediaError("Uploaded file is empty.")

    detected = detect_image_type(bytes(data[:16]))
    if detected is None:
        raise UnsupportedMediaError("Only JPEG, PNG and WebP images are accepted.")
    content_type, ext = detected

    image_id = str(uuid.uuid4())
    stored_name = f"{image_id}.{ext}"
    target = upload_dir / stored_name
    try:
        upload_dir.mkdir(parents=True, exist_ok=True)
        target.write_bytes(bytes(data))
    except OSError as exc:
        logger.error("Could not write upload: %s", type(exc).__name__)
        raise StorageError("The image could not be stored.") from exc

    record = ImageUpload(
        id=image_id,
        stored_filename=stored_name,
        original_filename=safe_original_name(original_filename),
        content_type=content_type,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
    )
    try:
        with db_guard(session):
            session.add(record)
            session.commit()
    except Exception:
        target.unlink(missing_ok=True)  # don't leave orphaned files behind
        raise
    return record


def find_image(session: Session, image_id: str) -> ImageUpload:
    with db_guard(session):
        record = session.get(ImageUpload, image_id)
    if record is None:
        raise NotFoundError(f"Image '{image_id}' was not found.")
    return record
