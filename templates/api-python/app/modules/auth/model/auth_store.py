from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.modules.auth.model.auth_model import IdempotencyRecord, RefreshSession, User
from app.modules.auth.service.auth_service import StoredUser


def _to_stored(user: User) -> StoredUser:
    return StoredUser(
        id=user.id,
        email=user.email,
        password_hash=user.password_hash,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        created_at=user.created_at,
    )


class SqlAuthUserStore:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_by_email(self, email: str) -> StoredUser | None:
        user = self._session.exec(select(User).where(User.email == email)).first()
        return _to_stored(user) if user else None

    def find_by_id(self, user_id: str) -> StoredUser | None:
        user = self._session.get(User, user_id)
        return _to_stored(user) if user else None

    def create(self, *, email: str, password_hash: str) -> StoredUser:
        user = User(email=email, password_hash=password_hash)
        self._session.add(user)
        self._session.flush()
        self._session.refresh(user)
        return _to_stored(user)


class SqlAuthRefreshStore:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, *, user_id: str, token_hash: str, expires_at: datetime) -> None:
        self._session.add(
            RefreshSession(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        )
        self._session.flush()

    def find_by_hash(self, token_hash: str) -> tuple[str, datetime, StoredUser] | None:
        session = self._session.exec(
            select(RefreshSession).where(RefreshSession.token_hash == token_hash)
        ).first()
        if session is None:
            return None
        user = self._session.get(User, session.user_id)
        if user is None:
            return None
        return session.token_hash, session.expires_at, _to_stored(user)

    def consume_by_hash(self, token_hash: str) -> tuple[str, datetime, StoredUser] | None:
        session = self._session.exec(
            select(RefreshSession).where(RefreshSession.token_hash == token_hash).with_for_update()
        ).first()
        if session is None:
            return None
        user = self._session.get(User, session.user_id)
        if user is None:
            self._session.delete(session)
            self._session.flush()
            return None
        result = (session.token_hash, session.expires_at, _to_stored(user))
        self._session.delete(session)
        self._session.flush()
        return result

    def delete_by_hash(self, token_hash: str) -> None:
        session = self._session.exec(
            select(RefreshSession).where(RefreshSession.token_hash == token_hash)
        ).first()
        if session is not None:
            self._session.delete(session)
            self._session.flush()


class SqlAuthIdempotencyStore:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_by_key(self, key: str) -> dict[str, Any] | None:
        record = self._session.exec(
            select(IdempotencyRecord).where(IdempotencyRecord.key == key)
        ).first()
        if record is None:
            return None
        body = record.response_body
        return body if isinstance(body, dict) else None

    def create(
        self,
        *,
        key: str,
        method: str,
        path: str,
        status_code: int,
        response_body: dict[str, Any],
    ) -> None:
        self._session.add(
            IdempotencyRecord(
                key=key,
                method=method,
                path=path,
                status_code=status_code,
                response_body=response_body,
            )
        )
        self._session.flush()
