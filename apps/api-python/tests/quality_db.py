from __future__ import annotations

import os
import subprocess
from pathlib import Path
from urllib.parse import urlparse, urlunparse

PROTECTED_DB_NAMES = frozenset({"asa", "postgres", "template0", "template1"})
API_PYTHON_ROOT = Path(__file__).resolve().parents[1]


def _fail_env(message: str) -> None:
    raise RuntimeError(
        f"Quality DB environment failure: {message}. "
        "Ensure Postgres is running and reachable "
        "(e.g. postgresql://asa:asa@localhost:5432/postgres)."
    )


def quality_database_name() -> str:
    # Separate from the Node quality DB so Prisma/Alembic do not race on one catalog.
    return os.environ.get("QUALITY_DATABASE_NAME", "asa_quality_test_python")


def resolve_admin_database_url() -> str:
    if os.environ.get("QUALITY_ADMIN_DATABASE_URL"):
        return os.environ["QUALITY_ADMIN_DATABASE_URL"]
    from_env = os.environ.get("DATABASE_URL")
    if from_env:
        parsed = urlparse(from_env)
        return urlunparse(parsed._replace(path="/postgres"))
    return "postgresql://asa:asa@localhost:5432/postgres"


def resolve_quality_database_url() -> str:
    if os.environ.get("QUALITY_DATABASE_URL"):
        return os.environ["QUALITY_DATABASE_URL"]
    admin = resolve_admin_database_url()
    parsed = urlparse(admin)
    return urlunparse(parsed._replace(path=f"/{quality_database_name()}"))


def _psql(admin_url: str, *args: str) -> str:
    try:
        completed = subprocess.run(
            ["psql", admin_url, "-v", "ON_ERROR_STOP=1", *args],
            check=True,
            capture_output=True,
            text=True,
        )
        return completed.stdout
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        detail = getattr(exc, "stderr", None) or str(exc)
        _fail_env(f"psql failed: {detail}")
        raise  # pragma: no cover


def _db_exists_sql(name: str) -> str:
    escaped = name.replace("'", "''")
    return f"SELECT 1 FROM pg_database WHERE datname = '{escaped}'"


def ensure_quality_database() -> str:
    """Create asa_quality_test if needed and run Alembic migrations. Never touches `asa`."""
    name = quality_database_name()
    if name in PROTECTED_DB_NAMES:
        _fail_env(f'refusing to use protected database name "{name}"')

    admin_url = resolve_admin_database_url()
    existing = _psql(admin_url, "-tAc", _db_exists_sql(name)).strip()
    if existing != "1":
        try:
            _psql(admin_url, "-c", f'CREATE DATABASE "{name}"')
        except RuntimeError:
            again = _psql(admin_url, "-tAc", _db_exists_sql(name)).strip()
            if again != "1":
                raise

    quality_url = resolve_quality_database_url()
    if quality_url.rstrip("/").endswith("/asa") or "/asa?" in quality_url:
        _fail_env("refusing to point quality tests at the asa database")

    os.environ["DATABASE_URL"] = quality_url

    try:
        subprocess.run(
            [
                str(API_PYTHON_ROOT / ".venv" / "bin" / "alembic"),
                "upgrade",
                "head",
            ],
            cwd=API_PYTHON_ROOT,
            check=True,
            capture_output=True,
            text=True,
            env={**os.environ, "DATABASE_URL": quality_url},
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        detail = getattr(exc, "stderr", None) or str(exc)
        _fail_env(f"alembic upgrade failed: {detail}")

    return quality_url
