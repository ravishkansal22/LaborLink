"""Create the database tables and runtime folders.  Usage (from backend/): python -m app.init_db"""

from __future__ import annotations

from app.config import get_settings
from app.db import create_db_engine, init_db


def main() -> None:
    settings = get_settings()
    engine = create_db_engine(settings)
    created = init_db(engine)
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    engine.dispose()
    print(f"Database ready: {settings.resolved_database_url}")
    summary = ", ".join(created) if created else "none (schema already current)"
    print(f"Schema additions: {summary}")
    print(f"Upload folder ready: {settings.upload_path}")


if __name__ == "__main__":
    main()
