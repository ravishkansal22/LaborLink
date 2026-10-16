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
    """Job lifecycle (see app/services/lifecycle.py and docs/BACKEND_ARCHITECTURE.md)."""

    needs_information = "needs_information"  # trade unknown; no estimate, not discoverable
    estimated = "estimated"  # work order + estimate available; open for matching and offers
    booked = "booked"  # a booking is confirmed; closed to new offers
    in_progress = "in_progress"  # the booked worker has started
    awaiting_confirmation = "awaiting_confirmation"  # evidence submitted; employer to review
    completed = "completed"  # employer confirmed; eligible for simulated settlement
    disputed = "disputed"  # employer disputed; never settled (resolution not implemented)


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
    """The booking record itself stays `confirmed`; execution progress lives on the job status."""

    confirmed = "confirmed"


class ReviewDecision(str, Enum):
    confirmed = "confirmed"
    disputed = "disputed"


class SettlementStatus(str, Enum):
    """Simulated states only — LaborLink never moves real money."""

    simulated_pending = "simulated_pending"
    simulated_settled = "simulated_settled"


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list[Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
