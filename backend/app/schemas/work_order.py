"""Versioned structured work-order schema.

Every generated work order — from the rule-based provider or a model provider — is validated
against `WorkOrderV1` before it is stored. Bump `schema_version` (and add a new class) for
breaking changes so stored payloads remain interpretable.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import Complexity, Trade

WORK_ORDER_SCHEMA_VERSION = "1.0"

ConfidenceLevel = Literal["low", "medium", "high"]


class DurationRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    min_hours: float = Field(gt=0, le=200)
    max_hours: float = Field(gt=0, le=200)

    @model_validator(mode="after")
    def _ordered(self) -> DurationRange:
        if self.min_hours > self.max_hours:
            raise ValueError("min_hours must not exceed max_hours")
        return self


class ImageAssessment(BaseModel):
    """What was (or was not) learned from the photo. Visual notes are never confirmed facts."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["not_provided", "not_analysed", "analysed"]
    observations: list[str] = Field(default_factory=list, max_length=10)
    disclaimer: str


class GeneratorInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Literal["rule_based", "anthropic"]
    model: str | None = None
    fallback_used: bool = False
    fallback_reason: str | None = None


class WorkOrderV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0"] = WORK_ORDER_SCHEMA_VERSION
    normalized_description: str = Field(min_length=1, max_length=2000)

    suggested_trade: Trade | None
    trade_source: Literal["employer_selected", "inferred", "unknown"]
    trade_confidence: ConfidenceLevel

    problem_category: str = Field(min_length=1, max_length=64)
    problem_summary: str = Field(min_length=1, max_length=300)
    classification_confidence: ConfidenceLevel
    complexity: Complexity

    likely_tools: list[str] = Field(default_factory=list, max_length=20)
    likely_materials: list[str] = Field(default_factory=list, max_length=20)
    estimated_duration: DurationRange

    missing_information: list[str] = Field(default_factory=list, max_length=15)
    follow_up_questions: list[str] = Field(default_factory=list, max_length=15)

    image_assessment: ImageAssessment
    generator: GeneratorInfo

    @model_validator(mode="after")
    def _trade_consistency(self) -> WorkOrderV1:
        if self.suggested_trade is None and self.trade_source != "unknown":
            raise ValueError("trade_source must be 'unknown' when suggested_trade is null")
        if self.suggested_trade is not None and self.trade_source == "unknown":
            raise ValueError("trade_source cannot be 'unknown' when a trade is suggested")
        return self
