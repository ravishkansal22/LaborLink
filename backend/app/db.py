"""Database engine, session management and initialisation."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Engine, create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import Settings


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Stores timezone-aware UTC datetimes; always returns aware UTC values (SQLite drops tz)."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetimes are not allowed; use timezone-aware UTC values")
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


def create_db_engine(settings: Settings) -> Engine:
    url = settings.resolved_database_url
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if settings.sqlite_path is not None:
            settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, **kwargs)

    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _enable_sqlite_fk(dbapi_conn, _record):  # pragma: no cover - trivial
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


# Nullable columns added to tables that already existed in an earlier phase:
# (table, column, SQL type, index name or None). `create_all` cannot add columns to an existing
# table, so they are added with ALTER TABLE ... ADD COLUMN, which keeps every existing row.
ADDITIVE_COLUMNS: list[tuple[str, str, str, str | None]] = [
    ("jobs", "employer_ref", "VARCHAR(64)", "ix_jobs_employer_ref"),  # Phase 3
]


def init_db(engine: Engine) -> list[str]:
    """Bring the schema up to date additively; return what was created.

    1. `create_all` creates missing tables (with their indexes) and never touches existing ones.
    2. Each missing column in ADDITIVE_COLUMNS is added as a nullable column (plus its index).
    Nothing is ever dropped, renamed or rewritten. Changes that are not purely additive (type
    changes, renames, NOT NULL columns) require a real migration tool such as Alembic.
    """
    from app import models  # noqa: F401  (registers models on Base.metadata)

    existing = set(inspect(engine).get_table_names())
    Base.metadata.create_all(engine)
    created = [t.name for t in Base.metadata.sorted_tables if t.name not in existing]

    with engine.begin() as conn:
        for table, column, sql_type, index in ADDITIVE_COLUMNS:
            columns = {c["name"] for c in inspect(conn).get_columns(table)}
            if column in columns:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))
            if index:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {index} ON {table} ({column})"))
            created.append(f"{table}.{column}")
    return created


def check_database(engine: Engine) -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
