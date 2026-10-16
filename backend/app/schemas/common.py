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
    """Phase 1 statuses. Phase 2+ will add e.g. `open`, `booked`, `completed`."""

    estimated = "estimated"  # work order + price estimate available
    needs_information = "needs_information"  # trade could not be determined; no estimate yet


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list[Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
