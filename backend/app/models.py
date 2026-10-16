"""SQLAlchemy ORM models for Phase 1.

Jobs are the central record. Later phases (matching, bids, bookings, passbook) attach new
tables to `jobs.id` and extend `JobStatus`; nothing here needs to be restructured for that.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime, utcnow


def new_id() -> str:
    return str(uuid.uuid4())


class ImageUpload(Base):
    """Metadata for an uploaded job photo. The binary lives on disk, never in the database."""

    __tablename__ = "image_uploads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    stored_filename: Mapped[str] = mapped_column(String(64), unique=True)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(32))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    status: Mapped[str] = mapped_column(String(32), index=True)

    description: Mapped[str] = mapped_column(Text)
    description_source: Mapped[str] = mapped_column(String(32))
    language: Mapped[str | None] = mapped_column(String(16))
    requested_trade: Mapped[str | None] = mapped_column(String(32))
    trade: Mapped[str | None] = mapped_column(String(32), index=True)
    urgency: Mapped[str] = mapped_column(String(16))

    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    image_id: Mapped[str | None] = mapped_column(ForeignKey("image_uploads.id"))

    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)

    image: Mapped[ImageUpload | None] = relationship()
    work_order: Mapped[WorkOrderRecord | None] = relationship(
        back_populates="job", uselist=False, cascade="all, delete-orphan"
    )
    price_estimates: Mapped[list[PriceEstimateRecord]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="PriceEstimateRecord.sequence",
    )

    @property
    def current_estimate(self) -> PriceEstimateRecord | None:
        return self.price_estimates[-1] if self.price_estimates else None


class WorkOrderRecord(Base):
    """Validated structured work order (stored as versioned JSON payload)."""

    __tablename__ = "work_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), unique=True)
    schema_version: Mapped[str] = mapped_column(String(16))
    provider: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    job: Mapped[Job] = relationship(back_populates="work_order")


class PriceEstimateRecord(Base):
    """One FairRate calculation. Recalculations append rows; the latest is current."""

    __tablename__ = "price_estimates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    rate_card_version: Mapped[str] = mapped_column(String(64))
    currency: Mapped[str] = mapped_column(String(3))
    min_amount: Mapped[int] = mapped_column(Integer)
    max_amount: Mapped[int] = mapped_column(Integer)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    job: Mapped[Job] = relationship(back_populates="price_estimates")
