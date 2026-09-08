from __future__ import annotations

from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

from app.env import Settings, load_settings

_settings: Settings | None = None
_engine = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def reset_engine() -> None:
    """Drop the cached engine (used by quality tests that swap DATABASE_URL)."""
    global _engine, _settings
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _settings = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        settings = get_settings()
        url = settings.database_url
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url.removeprefix("postgresql://")
        elif url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url.removeprefix("postgres://")
        _engine = create_engine(url, pool_pre_ping=True)
    return _engine


def get_session() -> Generator[Session, None, None]:
    """Yield a session that commits once on success and rolls back on error."""
    with Session(get_engine()) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
