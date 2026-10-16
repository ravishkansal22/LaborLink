"""FastAPI dependencies. Shared objects live on `app.state` so tests can build isolated apps."""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy.orm import Session

from app.config import Settings
from app.schemas.pricing import RateCard
from app.services.work_orders import WorkOrderService


def get_db(request: Request) -> Iterator[Session]:
    session = request.app.state.session_factory()
    try:
        yield session
    finally:
        session.close()


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_rate_card(request: Request) -> RateCard:
    return request.app.state.rate_card


def get_work_order_service(request: Request) -> WorkOrderService:
    return request.app.state.work_order_service
