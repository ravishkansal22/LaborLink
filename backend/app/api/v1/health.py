from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app import __version__
from app.db import check_database

router = APIRouter(tags=["health"])


class ComponentStatus(BaseModel):
    status: Literal["ok", "unavailable", "unverified"]
    detail: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    app: str
    version: str
    environment: str
    checks: dict[str, ComponentStatus]
    work_order_provider: str
    rate_card_version: str


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse, "description": "Database unavailable"}},
)
def health(request: Request, response: Response) -> HealthResponse:
    state = request.app.state
    settings = state.settings
    db_ok = check_database(state.engine)
    provider = state.work_order_service.provider_name

    checks = {
        "database": ComponentStatus(status="ok" if db_ok else "unavailable"),
        "work_order_provider": (
            ComponentStatus(status="ok", detail="rule_based (offline, deterministic)")
            if provider == "rule_based"
            else ComponentStatus(
                status="unverified",
                detail=f"{provider} is not called by health checks; "
                       "rule_based fallback is always available",
            )
        ),
        "rate_card": ComponentStatus(status="ok", detail=state.rate_card.version),
    }
    if not db_ok:
        response.status_code = 503
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        app=settings.app_name,
        version=__version__,
        environment=settings.environment,
        checks=checks,
        work_order_provider=provider,
        rate_card_version=state.rate_card.version,
    )
