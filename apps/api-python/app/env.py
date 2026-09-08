from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    node_env: str = Field(default="development", alias="NODE_ENV")
    database_url: str = Field(alias="DATABASE_URL")
    jwt_secret: str = Field(min_length=32, alias="JWT_SECRET")
    api_port: int = Field(default=3000, alias="API_PORT")
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")

    @field_validator("cookie_secure", mode="before")
    @classmethod
    def parse_cookie_secure(cls, value: object) -> object:
        if isinstance(value, str):
            return value.lower() == "true"
        return value

    def cors_origin_list(self) -> list[str]:
        return [part.strip() for part in self.cors_origins.split(",") if part.strip()]


def load_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
