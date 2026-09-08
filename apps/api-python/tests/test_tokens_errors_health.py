from __future__ import annotations

from app.lib.errors import AppError
from app.lib.tokens import hash_token, sign_access_token, verify_access_token
from app.modules.health.service.health_service import get_health


def test_health_ok() -> None:
    assert get_health() == {"status": "ok"}


def test_app_error_to_api_error() -> None:
    err = AppError(status=409, error_code="AUTH_EMAIL_TAKEN", error_message="taken")
    payload = err.to_api_error()
    assert payload.model_dump(by_alias=True) == {
        "status": 409,
        "errorMessage": "taken",
        "errorCode": "AUTH_EMAIL_TAKEN",
        "errorKey": "errors.auth.emailTaken",
    }


def test_tokens_roundtrip() -> None:
    secret = "y" * 32
    token = sign_access_token(sub="u1", email="a@example.com", role="user", secret=secret)
    payload = verify_access_token(token, secret)
    assert payload == {"sub": "u1", "email": "a@example.com", "role": "user"}
    assert len(hash_token("abc")) == 64
