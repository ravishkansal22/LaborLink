"""Work-order generation: provider selection, fallback, and intake-level gap detection."""

from __future__ import annotations

import logging

from app.config import Settings
from app.schemas.work_order import GeneratorInfo, WorkOrderV1
from app.services.work_orders.base import (
    ImageInput,
    ProviderError,
    WorkOrderInput,
    WorkOrderProvider,
)
from app.services.work_orders.rule_based import RuleBasedProvider

__all__ = [
    "ImageInput",
    "ProviderError",
    "RuleBasedProvider",
    "WorkOrderInput",
    "WorkOrderProvider",
    "WorkOrderService",
    "build_work_order_service",
]

logger = logging.getLogger("laborlink.work_orders")


def _append_unique(items: list[str], value: str) -> None:
    if value not in items:
        items.append(value)


def add_intake_gaps(work_order: WorkOrderV1, data: WorkOrderInput) -> WorkOrderV1:
    """Flag gaps that are visible from the intake itself, regardless of provider."""
    missing = list(work_order.missing_information)
    questions = list(work_order.follow_up_questions)
    if len(data.description.split()) < 5:
        _append_unique(missing, "A more detailed description of the problem")
        _append_unique(
            questions, "Can you describe the problem in more detail (what, where, since when)?"
        )
    if data.image is None:
        _append_unique(missing, "A photo of the problem area")
        _append_unique(questions, "Can you add a photo of the problem area?")
    if not data.has_coordinates:
        _append_unique(
            missing, "Map coordinates of the job location (needed to find nearby workers)"
        )
    return work_order.model_copy(
        update={"missing_information": missing[:15], "follow_up_questions": questions[:15]}
    )


class WorkOrderService:
    def __init__(self, primary: WorkOrderProvider, fallback: RuleBasedProvider | None = None):
        self.primary = primary
        self.fallback = fallback or (
            primary if isinstance(primary, RuleBasedProvider) else RuleBasedProvider()
        )

    @property
    def provider_name(self) -> str:
        return self.primary.name

    def generate(self, data: WorkOrderInput) -> WorkOrderV1:
        if self.primary is self.fallback:
            return add_intake_gaps(self.fallback.generate(data), data)
        try:
            work_order = self.primary.generate(data)
            # Re-validate whatever the provider returned before trusting it.
            work_order = WorkOrderV1.model_validate(work_order.model_dump())
        except ProviderError as exc:
            reason = exc.reason
            logger.warning("Work-order provider %s failed (%s); using fallback",
                           self.primary.name, reason)
            work_order = self._fallback(data, reason)
        except Exception as exc:
            logger.exception("Unexpected error in provider %s; using fallback", self.primary.name)
            work_order = self._fallback(data, f"unexpected_error:{type(exc).__name__}")
        return add_intake_gaps(work_order, data)

    def _fallback(self, data: WorkOrderInput, reason: str) -> WorkOrderV1:
        result = self.fallback.generate(data)
        return result.model_copy(update={"generator": GeneratorInfo(
            provider="rule_based", fallback_used=True, fallback_reason=reason[:100]
        )})


def build_work_order_service(settings: Settings) -> WorkOrderService:
    if settings.work_order_provider == "anthropic":
        from app.services.work_orders.anthropic_provider import AnthropicProvider

        return WorkOrderService(AnthropicProvider(settings))
    return WorkOrderService(RuleBasedProvider())
