from __future__ import annotations

ERROR_CODES = {
    "AUTH_INVALID_CREDENTIALS": "AUTH_INVALID_CREDENTIALS",
    "AUTH_EMAIL_TAKEN": "AUTH_EMAIL_TAKEN",
    "AUTH_UNAUTHORIZED": "AUTH_UNAUTHORIZED",
    "AUTH_FORBIDDEN": "AUTH_FORBIDDEN",
    "VALIDATION_ERROR": "VALIDATION_ERROR",
    "IDEMPOTENCY_CONFLICT": "IDEMPOTENCY_CONFLICT",
    "INTERNAL_ERROR": "INTERNAL_ERROR",
}

ERROR_KEYS = {
    "AUTH_INVALID_CREDENTIALS": "errors.auth.invalidCredentials",
    "AUTH_EMAIL_TAKEN": "errors.auth.emailTaken",
    "AUTH_UNAUTHORIZED": "errors.auth.unauthorized",
    "AUTH_FORBIDDEN": "errors.auth.forbidden",
    "VALIDATION_ERROR": "errors.validation.failed",
    "IDEMPOTENCY_CONFLICT": "errors.idempotency.conflict",
    "INTERNAL_ERROR": "errors.common.internal",
}

IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"
IDEMPOTENCY_KEY_MAX_LENGTH = 128


def get_error_key(code: str) -> str:
    return ERROR_KEYS[code]
