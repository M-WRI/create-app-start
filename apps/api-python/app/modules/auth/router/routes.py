from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.lib.contracts_models import AuthSessionResponse, LoginRequest, RegisterRequest
from app.lib.cookies import clear_auth_cookies, set_auth_cookies
from app.lib.db import SettingsDep
from app.lib.tokens import ACCESS_COOKIE, REFRESH_COOKIE
from app.modules.auth.router.auth_router import (
    AuthServiceDep,
    parse_idempotency_key,
    require_auth,
)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

RequireAuthDep = Annotated[dict[str, str], Depends(require_auth)]
IdempotencyKeyDep = Annotated[str | None, Depends(parse_idempotency_key)]


@router.post("/register", status_code=201)
@limiter.limit("20/minute")
def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    service: AuthServiceDep,
    settings: SettingsDep,
    idempotency_key: IdempotencyKeyDep,
) -> AuthSessionResponse:
    _ = request
    result = service.register(body, idempotency_key)
    set_auth_cookies(
        response,
        access_token=result.tokens.access_token,
        refresh_token=result.tokens.refresh_token,
        secure=settings.cookie_secure,
    )
    return result.session


@router.post("/login")
@limiter.limit("20/minute")
def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    service: AuthServiceDep,
    settings: SettingsDep,
) -> AuthSessionResponse:
    _ = request
    result = service.login(body)
    set_auth_cookies(
        response,
        access_token=result.tokens.access_token,
        refresh_token=result.tokens.refresh_token,
        secure=settings.cookie_secure,
    )
    return result.session


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    service: AuthServiceDep,
    settings: SettingsDep,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
) -> Response:
    service.logout(refresh_token)
    clear_auth_cookies(response, secure=settings.cookie_secure)
    return Response(status_code=204)


@router.post("/refresh")
def refresh_route(
    response: Response,
    service: AuthServiceDep,
    settings: SettingsDep,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
) -> AuthSessionResponse:
    result = service.refresh(refresh_token)
    set_auth_cookies(
        response,
        access_token=result.tokens.access_token,
        refresh_token=result.tokens.refresh_token,
        secure=settings.cookie_secure,
    )
    return result.session


@router.get("/me")
def me(
    service: AuthServiceDep,
    _auth: RequireAuthDep,
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
) -> AuthSessionResponse:
    return service.me(access_token)
