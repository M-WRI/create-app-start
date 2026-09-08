from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from app.lib.contracts_models import LoginRequest, RegisterRequest
from app.lib.errors import AppError
from app.modules.auth.service.auth_service import StoredUser, create_auth_service


class MemoryUsers:
    def __init__(self) -> None:
        self.by_id: dict[str, StoredUser] = {}
        self.by_email: dict[str, StoredUser] = {}

    def find_by_email(self, email: str) -> StoredUser | None:
        return self.by_email.get(email)

    def find_by_id(self, user_id: str) -> StoredUser | None:
        return self.by_id.get(user_id)

    def create(self, *, email: str, password_hash: str) -> StoredUser:
        user = StoredUser(
            id=f"user-{len(self.by_id) + 1}",
            email=email,
            password_hash=password_hash,
            role="user",
            created_at=datetime(2026, 1, 1, tzinfo=UTC).replace(tzinfo=None),
        )
        self.by_id[user.id] = user
        self.by_email[user.email] = user
        return user


class MemoryRefresh:
    def __init__(self) -> None:
        self.rows: dict[str, tuple[datetime, StoredUser]] = {}

    def create(self, *, user_id: str, token_hash: str, expires_at: datetime) -> None:
        user = next(u for u in users_ref[0].by_id.values() if u.id == user_id)
        self.rows[token_hash] = (expires_at, user)

    def find_by_hash(self, token_hash: str) -> tuple[str, datetime, StoredUser] | None:
        row = self.rows.get(token_hash)
        if row is None:
            return None
        expires_at, user = row
        return token_hash, expires_at, user

    def delete_by_hash(self, token_hash: str) -> None:
        self.rows.pop(token_hash, None)


class MemoryIdempotency:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}

    def find_by_key(self, key: str) -> dict[str, Any] | None:
        return self.rows.get(key)

    def create(
        self,
        *,
        key: str,
        method: str,
        path: str,
        status_code: int,
        response_body: dict[str, Any],
    ) -> None:
        self.rows[key] = response_body


users_ref: list[MemoryUsers] = []


@pytest.fixture
def service():
    users = MemoryUsers()
    users_ref.clear()
    users_ref.append(users)
    refresh = MemoryRefresh()
    idempotency = MemoryIdempotency()
    clock = {"t": datetime.now(UTC).replace(tzinfo=None)}
    return (
        create_auth_service(
            users=users,
            refresh=refresh,
            idempotency=idempotency,
            jwt_secret="x" * 32,
            now=lambda: clock["t"],
        ),
        users,
        refresh,
        idempotency,
        clock,
    )


def test_register_login_me_idempotent(service):
    auth, _users, _refresh, _idem, _clock = service
    first = auth.register(
        RegisterRequest(email="a@example.com", password="password123"),
        idempotency_key="k1",
    )
    second = auth.register(
        RegisterRequest(email="a@example.com", password="password123"),
        idempotency_key="k1",
    )
    assert first.session.user.id == second.session.user.id

    logged_in = auth.login(LoginRequest(email="a@example.com", password="password123"))
    me = auth.me(logged_in.tokens.access_token)
    assert me.user.email == "a@example.com"


def test_duplicate_email_and_bad_password(service):
    auth, *_rest = service
    auth.register(RegisterRequest(email="a@example.com", password="password123"))
    with pytest.raises(AppError) as taken:
        auth.register(RegisterRequest(email="a@example.com", password="password123"))
    assert taken.value.error_code == "AUTH_EMAIL_TAKEN"

    with pytest.raises(AppError) as bad:
        auth.login(LoginRequest(email="a@example.com", password="wrong-password"))
    assert bad.value.error_code == "AUTH_INVALID_CREDENTIALS"


def test_refresh_and_logout(service):
    auth, _users, refresh, _idem, clock = service
    registered = auth.register(RegisterRequest(email="a@example.com", password="password123"))
    clock["t"] = clock["t"] + timedelta(minutes=1)
    refreshed = auth.refresh(registered.tokens.refresh_token)
    assert refreshed.tokens.access_token != registered.tokens.access_token
    assert refreshed.tokens.refresh_token != registered.tokens.refresh_token
    assert len(refresh.rows) == 1

    auth.logout(refreshed.tokens.refresh_token)
    with pytest.raises(AppError) as err:
        auth.refresh(refreshed.tokens.refresh_token)
    assert err.value.error_code == "AUTH_UNAUTHORIZED"


def test_me_missing_token(service):
    auth, *_rest = service
    with pytest.raises(AppError) as err:
        auth.me(None)
    assert err.value.error_code == "AUTH_UNAUTHORIZED"


def test_expired_refresh(service):
    auth, users, refresh, _idem, _clock = service
    registered = auth.register(RegisterRequest(email="a@example.com", password="password123"))
    token_hash = next(iter(refresh.rows))
    user = users.by_email["a@example.com"]
    refresh.rows[token_hash] = (datetime(2020, 1, 1), user)
    with pytest.raises(AppError) as err:
        auth.refresh(registered.tokens.refresh_token)
    assert err.value.error_code == "AUTH_UNAUTHORIZED"


def test_idempotency_conflict_when_user_missing(service):
    auth, users, _refresh, idem, _clock = service
    result = auth.register(
        RegisterRequest(email="a@example.com", password="password123"),
        idempotency_key="gone",
    )
    users.by_id.clear()
    users.by_email.clear()
    idem.rows["gone"] = result.session.model_dump(by_alias=True)
    with pytest.raises(AppError) as err:
        auth.register(
            RegisterRequest(email="a@example.com", password="password123"),
            idempotency_key="gone",
        )
    assert err.value.error_code == "IDEMPOTENCY_CONFLICT"
