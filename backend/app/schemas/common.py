"""Shared enums and the error response schema."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel


class Trade(str, Enum):
    plumber = "plumber"
    electrician = "electrician"
    mason = "mason"
    carpenter = "carpenter"


class Urgency(str, Enum):
    flexible = "flexible"
    normal = "normal"
    urgent = "urgent"


class Complexity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class JobStatus(str, Enum):
    """Job lifecycle (see docs/BACKEND_ARCHITECTURE.md#job-lifecycle).

    Phase 3 is expected to add `in_progress` and `completed` after `booked`.
    """

    needs_information = "needs_information"  # trade unknown; no estimate, not discoverable
    estimated = "estimated"  # work order + estimate available; open for matching and offers
    booked = "booked"  # a booking is confirmed; closed to new offers


class Availability(str, Enum):
    available = "available"
    unavailable = "unavailable"


class OfferKind(str, Enum):
    accept_suggested = "accept_suggested"  # worker accepts the suggested labour amount
    counter = "counter"  # worker proposes a different amount within the permitted range


class OfferStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class BookingStatus(str, Enum):
    """Phase 3 is expected to add in-progress/completed states."""

    confirmed = "confirmed"


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list[Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
