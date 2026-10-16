"""Test fixtures. Every test gets its own temporary SQLite database and upload folder,
and never reads backend/.env, so development data is never touched."""

from __future__ import annotations

import struct
import zlib
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.work_orders import WorkOrderService


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        upload_dir=str(tmp_path / "uploads"),
        max_upload_bytes=1024 * 1024,
        work_order_provider="rule_based",
    )


@pytest.fixture
def make_client(settings) -> Iterator[Callable[..., TestClient]]:
    clients: list[TestClient] = []

    def _make(service: WorkOrderService | None = None, cfg: Settings | None = None) -> TestClient:
        app = create_app(cfg or settings, work_order_service=service)
        client = TestClient(app, raise_server_exceptions=False)
        client.__enter__()
        clients.append(client)
        return client

    yield _make
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()


@pytest.fixture
def job_payload() -> dict:
    return {
        "description": "Kitchen sink tap is leaking and dripping all night",
        "location": {"address": "Navrangpura, Ahmedabad", "latitude": 23.03, "longitude": 72.56},
        "urgency": "normal",
    }


def make_png(width: int = 2, height: int = 2) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    raw = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


@pytest.fixture
def png_bytes() -> bytes:
    return make_png()
