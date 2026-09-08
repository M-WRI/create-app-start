from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from pwdlib import PasswordHash

from app.lib.contracts_catalog import ERROR_CODES
from app.lib.contracts_models import AuthSessionResponse, LoginRequest, RegisterRequest
from app.lib.errors import AppError
from app.lib.tokens import (
    create_refresh_token_value,
    hash_token,
    sign_access_token,
    verify_access_token,
)

password_hash = PasswordHash.recommended()


def _iso(value: datetime) -> str:
    if value.tzinfo:
        return value.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")
    return value.isoformat() + "Z"


@dataclass
class StoredUser:
    id: str
    email: str
    password_hash: str
    role: str
    created_at: datetime


class AuthUserStore(Protocol):
    def find_by_email(self, email: str) -> StoredUser | None: ...
    def find_by_id(self, user_id: str) -> StoredUser | None: ...
    def create(self, *, email: str, password_hash: str) -> StoredUser: ...


class AuthRefreshStore(Protocol):
    def create(self, *, user_id: str, token_hash: str, expires_at: datetime) -> None: ...
    def find_by_hash(self, token_hash: str) -> tuple[str, datetime, StoredUser] | None: ...
    def delete_by_hash(self, token_hash: str) -> None: ...


class AuthIdempotencyStore(Protocol):
    def find_by_key(self, key: str) -> dict[str, Any] | None: ...
    def create(
        self,
        *,
        key: str,
        method: str,
        path: str,
        status_code: int,
        response_body: dict[str, Any],
    ) -> None: ...


@dataclass
class AuthTokens:
    access_token: str
    refresh_token: str


@dataclass
class AuthResult:
    session: AuthSessionResponse
    tokens: AuthTokens


@dataclass
class AuthService:
    users: AuthUserStore
    refresh_store: AuthRefreshStore
    idempotency_store: AuthIdempotencyStore
    jwt_secret: str
    now: Callable[[], datetime]

    def issue_tokens(self, user: StoredUser) -> AuthResult:
        access_token = sign_access_token(
            sub=user.id,
            email=user.email,
            role=user.role,  # type: ignore[arg-type]
            secret=self.jwt_secret,
            now=self.now(),
        )
        refresh_token = create_refresh_token_value()
        expires_at = self.now() + timedelta(days=30)
        self.refresh_store.create(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
        session = AuthSessionResponse.model_validate(
            {
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "createdAt": _iso(user.created_at),
                }
            }
        )
        return AuthResult(
            session=session,
            tokens=AuthTokens(access_token=access_token, refresh_token=refresh_token),
        )

    def register(
        self,
        input_data: RegisterRequest,
        idempotency_key: str | None = None,
    ) -> AuthResult:
        if idempotency_key:
            existing = self.idempotency_store.find_by_key(idempotency_key)
            if existing is not None:
                stored = AuthSessionResponse.model_validate(existing)
                user = self.users.find_by_id(stored.user.id)
                if user is None:
                    raise AppError(
                        status=409,
                        error_code=ERROR_CODES["IDEMPOTENCY_CONFLICT"],
                        error_message="Idempotent replay failed",
                    )
                return self.issue_tokens(user)

        existing_user = self.users.find_by_email(str(input_data.email))
        if existing_user is not None:
            raise AppError(
                status=409,
                error_code=ERROR_CODES["AUTH_EMAIL_TAKEN"],
                error_message="Email already registered",
            )

        hashed = password_hash.hash(input_data.password)
        user = self.users.create(email=str(input_data.email), password_hash=hashed)
        result = self.issue_tokens(user)

        if idempotency_key:
            self.idempotency_store.create(
                key=idempotency_key,
                method="POST",
                path="/api/v1/auth/register",
                status_code=201,
                response_body=result.session.model_dump(by_alias=True),
            )

        return result

    def login(self, input_data: LoginRequest) -> AuthResult:
        user = self.users.find_by_email(str(input_data.email))
        if user is None:
            raise AppError(
                status=401,
                error_code=ERROR_CODES["AUTH_INVALID_CREDENTIALS"],
                error_message="Invalid credentials",
            )

        if not password_hash.verify(input_data.password, user.password_hash):
            raise AppError(
                status=401,
                error_code=ERROR_CODES["AUTH_INVALID_CREDENTIALS"],
                error_message="Invalid credentials",
            )

        return self.issue_tokens(user)

    def me(self, access_token: str | None) -> AuthSessionResponse:
        if not access_token:
            raise AppError(
                status=401,
                error_code=ERROR_CODES["AUTH_UNAUTHORIZED"],
                error_message="Missing access token",
            )

        try:
            payload = verify_access_token(access_token, self.jwt_secret)
        except Exception as exc:
            raise AppError(
                status=401,
                error_code=ERROR_CODES["AUTH_UNAUTHORIZED"],
                error_message="Invalid access token",
            ) from exc

        user = self.users.find_by_id(payload["sub"])
        if user is None:
            raise AppError(
                status=401,
                error_code=ERROR_CODES["AUTH_UNAUTHORIZED"],
                error_message="User not found",
            )

        return AuthSessionResponse.model_validate(
            {
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "createdAt": _iso(user.created_at),
                }
            }
        )

    def refresh(self, refresh_token: str | None) -> AuthResult:
        if not refresh_token:
            raise AppError(
                status=401,
                error_code=ERROR_CODES["AUTH_UNAUTHORIZED"],
                error_message="Missing refresh token",
            )

        found = self.refresh_store.find_by_hash(hash_token(refresh_token))
        if found is None:
            raise AppError(
                status=401,
                error_code=ERROR_CODES["AUTH_UNAUTHORIZED"],
                error_message="Invalid refresh token",
            )

        token_hash, expires_at, user = found
        if expires_at.replace(tzinfo=UTC) < self.now().replace(tzinfo=UTC):
            raise AppError(
                status=401,
                error_code=ERROR_CODES["AUTH_UNAUTHORIZED"],
                error_message="Invalid refresh token",
            )

        self.refresh_store.delete_by_hash(token_hash)
        return self.issue_tokens(user)

    def logout(self, refresh_token: str | None) -> None:
        if refresh_token:
            self.refresh_store.delete_by_hash(hash_token(refresh_token))


def create_auth_service(
    *,
    users: AuthUserStore,
    refresh: AuthRefreshStore,
    idempotency: AuthIdempotencyStore,
    jwt_secret: str,
    now: Callable[[], datetime] | None = None,
) -> AuthService:
    return AuthService(
        users=users,
        refresh_store=refresh,
        idempotency_store=idempotency,
        jwt_secret=jwt_secret,
        now=now or (lambda: datetime.now(UTC).replace(tzinfo=None)),
    )
