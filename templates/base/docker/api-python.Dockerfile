# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /uvx /bin/

FROM base AS deps
COPY apps/api-python/pyproject.toml apps/api-python/uv.lock* apps/api-python/
WORKDIR /app/apps/api-python
RUN uv sync --no-dev

FROM base AS runtime
WORKDIR /app/apps/api-python
COPY --from=deps /app/apps/api-python/.venv /app/apps/api-python/.venv
COPY apps/api-python /app/apps/api-python
ENV PATH="/app/apps/api-python/.venv/bin:$PATH"
EXPOSE 3000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${API_PORT:-3000}"]
