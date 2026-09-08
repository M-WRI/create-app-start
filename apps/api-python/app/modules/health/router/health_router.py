from __future__ import annotations

from fastapi import APIRouter

from app.modules.health.service.health_service import get_health

router = APIRouter(tags=["health"])


@router.get("/api/v1/health")
def health() -> dict[str, str]:
    return get_health()
