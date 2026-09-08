from __future__ import annotations

import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.env import Settings, load_settings
from app.lib.contracts_catalog import ERROR_CODES, ERROR_KEYS
from app.lib.errors import AppError
from app.lib.request_id import RequestIdMiddleware
from app.modules.auth.router.routes import limiter, set_auth_rate_limit
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


def _api_error_content(*, status: int, error_code: str, error_message: str) -> dict[str, object]:
    return {
        "status": status,
        "errorMessage": error_message,
        "errorCode": error_code,
        "errorKey": ERROR_KEYS.get(error_code, ERROR_KEYS["INTERNAL_ERROR"]),
    }


def create_app(
    settings: Settings | None = None,
    *,
    rate_limit_default: str = "200/minute",
    auth_rate_limit: str = "20/minute",
) -> FastAPI:
    settings = settings or load_settings()

    app = FastAPI(title="@repo/api-python", docs_url=None, redoc_url=None)
    app.state.limiter = limiter
    app.state.settings = settings
    app.state.rate_limit_default = rate_limit_default
    app.state.auth_rate_limit = auth_rate_limit
    set_auth_rate_limit(auth_rate_limit)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> Response:
        response = JSONResponse(
            status_code=429,
            content=_api_error_content(
                status=429,
                error_code=ERROR_CODES["RATE_LIMITED"],
                error_message=str(exc.detail or "Rate limit exceeded"),
            ),
        )
        # Preserve Retry-After / rate-limit headers when SlowAPI computed them.
        view_rate_limit = getattr(request.state, "view_rate_limit", None)
        if view_rate_limit is not None:
            response = request.app.state.limiter._inject_headers(response, view_rate_limit)
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        payload = exc.to_api_error()
        return JSONResponse(
            status_code=payload.status,
            content=payload.model_dump(by_alias=True),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        message = "Validation failed"
        errors = exc.errors()
        if errors:
            message = str(errors[0].get("msg", message))
        return JSONResponse(
            status_code=422,
            content=_api_error_content(
                status=422,
                error_code=ERROR_CODES["VALIDATION_ERROR"],
                error_message=message,
            ),
        )

    def _http_status_to_api_error(status_code: int, detail: object) -> tuple[int, str, str]:
        message = str(detail) if detail else "Request failed"
        if status_code == 404:
            return 404, ERROR_CODES["NOT_FOUND"], "Not found"
        if status_code == 405:
            return 405, ERROR_CODES["METHOD_NOT_ALLOWED"], "Method not allowed"
        if status_code == 400:
            return 400, ERROR_CODES["BAD_REQUEST"], "Bad request"
        if status_code == 429:
            return 429, ERROR_CODES["RATE_LIMITED"], message
        if 400 <= status_code < 500:
            return status_code, ERROR_CODES["BAD_REQUEST"], message
        return 500, ERROR_CODES["INTERNAL_ERROR"], "Unexpected server error"

    @app.exception_handler(HTTPException)
    async def fastapi_http_exception_handler(
        _request: Request, exc: HTTPException
    ) -> JSONResponse:
        status, code, message = _http_status_to_api_error(exc.status_code, exc.detail)
        return JSONResponse(
            status_code=status,
            content=_api_error_content(status=status, error_code=code, error_message=message),
        )

    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        status, code, message = _http_status_to_api_error(exc.status_code, exc.detail)
        return JSONResponse(
            status_code=status,
            content=_api_error_content(status=status, error_code=code, error_message=message),
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
