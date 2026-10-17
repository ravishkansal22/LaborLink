"""Application factory.

Run locally (from backend/):
    python -m uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1 import router as v1_router
from app.config import Settings, get_settings
from app.db import create_db_engine, create_session_factory, init_db
from app.errors import register_error_handlers
from app.services.pricing import load_rate_card
from app.services.speech import SpeechService, build_speech_service
from app.services.work_orders import WorkOrderService, build_work_order_service


def create_app(
    settings: Settings | None = None,
    *,
    work_order_service: WorkOrderService | None = None,
    speech_service: SpeechService | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    engine = create_db_engine(settings)
    rate_card = load_rate_card(settings.rate_card_file)  # fail fast on bad pricing config

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        created = init_db(engine)
        if created:
            logging.getLogger("laborlink").info("Schema additions: %s", ", ".join(created))
        settings.upload_path.mkdir(parents=True, exist_ok=True)
        yield
        engine.dispose()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "LaborLink Phase 1 API: job intake, structured work orders and indicative "
            "FairRate price estimates. Estimates use illustrative rates, not official ones."
        ),
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.state.rate_card = rate_card
    app.state.work_order_service = work_order_service or build_work_order_service(settings)
    app.state.speech_service = speech_service or build_speech_service(settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(v1_router)
    return app


def __getattr__(name: str):
    # Lazily build the default app so importing app.main (e.g. in tests) has no side effects.
    if name == "app":
        global app
        app = create_app()
        return app
    raise AttributeError(name)
