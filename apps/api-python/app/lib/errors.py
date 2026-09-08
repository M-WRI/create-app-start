from __future__ import annotations

from app.lib.contracts_catalog import ERROR_CODES, ERROR_KEYS, get_error_key
from app.lib.contracts_models import ApiError


class AppError(Exception):
    def __init__(
        self,
        *,
        status: int,
        error_code: str,
        error_message: str,
        error_key: str | None = None,
    ) -> None:
        super().__init__(error_message)
        self.status = status
        self.error_code = error_code
        self.error_message = error_message
        self.error_key = error_key or get_error_key(error_code)

    def to_api_error(self) -> ApiError:
        return ApiError.model_validate(
            {
                "status": self.status,
                "errorMessage": self.error_message,
                "errorCode": self.error_code,
                "errorKey": self.error_key,
            }
        )

    @staticmethod
    def internal(error_message: str = "Unexpected server error") -> AppError:
        return AppError(
            status=500,
            error_code=ERROR_CODES["INTERNAL_ERROR"],
            error_message=error_message,
            error_key=ERROR_KEYS["INTERNAL_ERROR"],
        )
