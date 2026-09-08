from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field

UserRole = Literal["user", "admin"]


class ApiError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: int = Field(ge=400, le=599)
    error_message: str = Field(min_length=1, alias="errorMessage")
    error_code: str = Field(min_length=1, alias="errorCode")
    error_key: str = Field(min_length=1, alias="errorKey")


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=1, max_length=128)


class AuthUser(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    email: EmailStr = Field(max_length=320)
    role: UserRole
    created_at: AwareDatetime = Field(alias="createdAt")


class AuthSessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user: AuthUser
