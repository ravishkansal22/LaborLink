"""Translate database failures into a stable, non-leaky API error."""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterator
from contextlib import contextmanager

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.errors import AppError, DatabaseUnavailableError

logger = logging.getLogger("laborlink.db")


@contextmanager
def db_guard(
    session: Session,
    *,
    on_integrity_error: Callable[[], AppError] | None = None,
) -> Iterator[None]:
    """Roll back on any database error.

    `on_integrity_error` maps a constraint violation (e.g. a unique index protecting against a
    concurrent duplicate) to a domain error instead of the generic 503.
    """
    try:
        yield
    except IntegrityError as exc:
        session.rollback()
        if on_integrity_error is not None:
            raise on_integrity_error() from exc
        logger.error("Database constraint violated: %s", type(exc).__name__)
        raise DatabaseUnavailableError(
            "The database is unavailable or the operation failed. Please retry."
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        logger.error("Database operation failed: %s", type(exc).__name__)
        raise DatabaseUnavailableError(
            "The database is unavailable or the operation failed. Please retry."
        ) from exc
