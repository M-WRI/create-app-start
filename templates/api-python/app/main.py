from __future__ import annotations

import re

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.env import Settings, load_settings
from app.lib.contracts_catalog import ERROR_CODES, ERROR_KEYS
from app.lib.errors import AppError
from app.lib.request_id import RequestIdMiddleware
from app.modules.auth.router.routes import limiter
from app.modules.auth.router.routes import router as auth_router
from app.modules.health.router.health_router import router as health_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; frame-ancestors 'none'",
        )
        return response


def _redact(message: str) -> str:
    return re.sub(
        r"password|token|cookie|authorization",
        "[redacted]",
        message,
        flags=re.IGNORECASE,
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    app = FastAPI(title="@repo/api-python", docs_url=None, redoc_url=None)
    app.state.limiter = limiter
    app.state.settings = settings
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        payload = exc.to_api_error()
        return JSONResponse(
            status_code=payload.status,
            content=payload.model_dump(by_alias=True),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "status": 422,
                "errorMessage": str(exc.errors()),
                "errorCode": ERROR_CODES["VALIDATION_ERROR"],
                "errorKey": ERROR_KEYS["VALIDATION_ERROR"],
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(_request: Request, exc: Exception) -> JSONResponse:
        print({"name": type(exc).__name__, "message": _redact(str(exc))})
        payload = AppError.internal().to_api_error()
        return JSONResponse(status_code=500, content=payload.model_dump(by_alias=True))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(SlowAPIMiddleware)

    app.include_router(health_router)
    app.include_router(auth_router)
    return app


app = create_app()
