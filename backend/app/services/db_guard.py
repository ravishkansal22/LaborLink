"""Translate database failures into a stable, non-leaky API error."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.errors import DatabaseUnavailableError

logger = logging.getLogger("laborlink.db")


@contextmanager
def db_guard(session: Session) -> Iterator[None]:
    try:
        yield
    except SQLAlchemyError as exc:
        session.rollback()
        logger.error("Database operation failed: %s", type(exc).__name__)
        raise DatabaseUnavailableError(
            "The database is unavailable or the operation failed. Please retry."
        ) from exc
