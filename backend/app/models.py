"""SQLAlchemy ORM models.

Phase 1: jobs, work orders, price estimates, image uploads.
Phase 2: workers, offers, bookings — new tables only; Phase 1 tables are unchanged, so
`create_all` upgrades an existing database without touching its data.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
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


# --- Phase 2 ----------------------------------------------------------------------------------


class Worker(Base):
    """Self-declared worker profile. Nothing here is verified by LaborLink."""

    __tablename__ = "workers"
    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_workers_latitude"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_workers_longitude"),
        CheckConstraint("service_radius_km > 0", name="ck_workers_radius"),
        CheckConstraint("years_experience IS NULL OR years_experience >= 0",
                        name="ck_workers_experience"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    display_name: Mapped[str] = mapped_column(String(80))
    trades: Mapped[list[str]] = mapped_column(JSON)
    years_experience: Mapped[int | None] = mapped_column(Integer)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    locality: Mapped[str | None] = mapped_column(String(120))
    service_radius_km: Mapped[float] = mapped_column(Float)
    availability: Mapped[str] = mapped_column(String(16), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)


class Offer(Base):
    """A worker's response to a job: accept the suggested amount or a counter-offer."""

    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("labour_amount > 0", name="ck_offers_amount_positive"),
        # At most one active (pending) offer per worker per job.
        Index("uq_offers_active_worker_job", "job_id", "worker_id", unique=True,
              sqlite_where=text("status = 'pending'")),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    worker_id: Mapped[str] = mapped_column(ForeignKey("workers.id"), index=True)
    price_estimate_id: Mapped[str] = mapped_column(ForeignKey("price_estimates.id"))
    kind: Mapped[str] = mapped_column(String(24))
    labour_amount: Mapped[int] = mapped_column(Integer)
    travel_allowance: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    message: Mapped[str | None] = mapped_column(String(280))
    status: Mapped[str] = mapped_column(String(16), index=True)
    closed_reason: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)

    worker: Mapped[Worker] = relationship()


class Booking(Base):
    """Confirmed booking. UNIQUE(job_id) guarantees a job can be booked only once."""

    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("agreed_labour_amount > 0", name="ck_bookings_amount_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), unique=True
    )
    offer_id: Mapped[str] = mapped_column(ForeignKey("offers.id"), unique=True)
    worker_id: Mapped[str] = mapped_column(ForeignKey("workers.id"), index=True)
    agreed_labour_amount: Mapped[int] = mapped_column(Integer)
    travel_allowance: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)

    worker: Mapped[Worker] = relationship()
    offer: Mapped[Offer] = relationship()
