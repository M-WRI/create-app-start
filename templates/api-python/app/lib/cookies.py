from __future__ import annotations

from fastapi import Response

from app.lib.tokens import ACCESS_COOKIE, REFRESH_COOKIE


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    secure: bool,
) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        path="/",
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=60 * 15,
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        path="/",
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=60 * 60 * 24 * 30,
    )


def clear_auth_cookies(response: Response, *, secure: bool) -> None:
    response.delete_cookie(
        key=ACCESS_COOKIE,
        path="/",
        httponly=True,
        secure=secure,
        samesite="lax",
    )
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path="/",
        httponly=True,
        secure=secure,
        samesite="strict",
    )
