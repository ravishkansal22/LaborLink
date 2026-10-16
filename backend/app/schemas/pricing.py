"""FairRate rate-card configuration and price-estimate schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import Complexity, Trade, Urgency


class TradeRate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hourly_rate: float = Field(gt=0)
    minimum_charge: float = Field(ge=0)


class OfferLimits(BaseModel):
    """Platform policy for worker offers, applied to the job's current labour estimate.

    permitted labour amount = [labour.min x floor_ratio, labour.max x ceiling_ratio]
    These are illustrative LaborLink demo limits, not legal requirements.
    """

    model_config = ConfigDict(extra="forbid")

    floor_ratio: float = Field(default=1.0, gt=0, le=1)
    ceiling_ratio: float = Field(default=1.25, ge=1, le=3)


class RateCard(BaseModel):
    """Pricing configuration loaded from JSON (see app/data/rate_card.json)."""

    model_config = ConfigDict(extra="forbid")

    version: str = Field(min_length=1, max_length=64)
    currency: str = Field(min_length=3, max_length=3)
    region: str
    disclaimer: str
    trades: dict[Trade, TradeRate]
    complexity_multipliers: dict[Complexity, float]
    urgency_multipliers: dict[Urgency, float]
    travel_allowance: float = Field(ge=0)
    rounding_step: int = Field(default=10, gt=0)
    # Hourly statutory wage floors per trade. Only add VERIFIED, jurisdiction-specific figures.
    wage_floors: dict[Trade, float] = Field(default_factory=dict)
    wage_floor_source: str | None = None
    offer_limits: OfferLimits = Field(default_factory=OfferLimits)

    @model_validator(mode="after")
    def _complete(self) -> RateCard:
        missing = [t.value for t in Trade if t not in self.trades]
        if missing:
            raise ValueError(f"rate card is missing trades: {missing}")
        if set(self.complexity_multipliers) != set(Complexity):
            raise ValueError("complexity_multipliers must define low, medium and high")
        if set(self.urgency_multipliers) != set(Urgency):
            raise ValueError("urgency_multipliers must define flexible, normal and urgent")
        if any(m <= 0 for m in [*self.complexity_multipliers.values(),
                                *self.urgency_multipliers.values()]):
            raise ValueError("multipliers must be positive")
        if self.wage_floors and not self.wage_floor_source:
            raise ValueError("wage_floor_source is required when wage_floors are configured")
        return self


class AmountRange(BaseModel):
    min: int = Field(ge=0)
    max: int = Field(ge=0)


class WageFloorCheck(BaseModel):
    status: Literal["not_configured", "satisfied", "applied"]
    detail: str


class PriceEstimate(BaseModel):
    """Indicative FairRate estimate. Not a quote and not an official market rate."""

    id: str | None = None
    min_amount: int = Field(ge=0)
    max_amount: int = Field(ge=0)
    currency: str
    labour: AmountRange
    travel_allowance: int = Field(ge=0)
    materials_included: bool = False
    hourly_rate_used: float
    multipliers: dict[str, float]
    duration_hours: dict[str, float]
    assumptions: list[str]
    warnings: list[str]
    wage_floor_check: WageFloorCheck
    rate_card_version: str
    is_indicative: Literal[True] = True
    created_at: datetime | None = None


class OfferTerms(BaseModel):
    """What a worker may offer for a job, derived from its current estimate."""

    price_estimate_id: str
    currency: str
    suggested_labour_amount: int = Field(gt=0)
    permitted_min: int = Field(gt=0)
    permitted_max: int = Field(gt=0)
    travel_allowance: int = Field(ge=0)
    basis: str
