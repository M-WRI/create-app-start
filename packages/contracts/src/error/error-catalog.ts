export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_TAKEN: "AUTH_EMAIL_TAKEN",
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_KEYS = {
  AUTH_INVALID_CREDENTIALS: "errors.auth.invalidCredentials",
  AUTH_EMAIL_TAKEN: "errors.auth.emailTaken",
  AUTH_UNAUTHORIZED: "errors.auth.unauthorized",
  AUTH_FORBIDDEN: "errors.auth.forbidden",
  VALIDATION_ERROR: "errors.validation.failed",
  IDEMPOTENCY_CONFLICT: "errors.idempotency.conflict",
  INTERNAL_ERROR: "errors.common.internal",
} as const satisfies Record<ErrorCode, string>;

export type ErrorKey = (typeof ERROR_KEYS)[ErrorCode];

export function getErrorKey(code: ErrorCode): ErrorKey {
  return ERROR_KEYS[code];
}
