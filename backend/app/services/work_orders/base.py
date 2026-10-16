"""Provider-neutral types for work-order generation."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.schemas.common import Trade, Urgency
from app.schemas.work_order import WorkOrderV1


@dataclass(frozen=True)
class ImageInput:
    path: Path
    content_type: str


@dataclass(frozen=True)
class WorkOrderInput:
    description: str
    description_source: str
    language: str | None
    trade: Trade | None
    urgency: Urgency
    has_coordinates: bool
    image: ImageInput | None


class ProviderError(Exception):
    """A provider could not produce a valid work order. `reason` is a short, log-safe code."""

    def __init__(self, reason: str, message: str = ""):
        super().__init__(message or reason)
        self.reason = reason


class WorkOrderProvider(Protocol):
    name: str

    def generate(self, data: WorkOrderInput) -> WorkOrderV1:
        """Return a validated work order or raise ProviderError."""
        ...
