import { type ApiError, apiErrorSchema } from "./api-error.js";
import { AppError } from "./app-error.js";
import { ERROR_CODES, ERROR_KEYS } from "./error-catalog.js";

const FALLBACK_API_ERROR: ApiError = {
  status: 500,
  errorMessage: "Unexpected error",
  errorCode: ERROR_CODES.INTERNAL_ERROR,
  errorKey: ERROR_KEYS.INTERNAL_ERROR,
};

export type NormalizeApiErrorInput = {
  status?: number;
  body?: unknown;
  fallbackMessage?: string;
};

/**
 * Normalize network / unknown failures into the shared ApiError shape.
 * Prefer body when it already matches the contract.
 */
export function normalizeApiError(input: NormalizeApiErrorInput): ApiError {
  const parsed = apiErrorSchema.safeParse(input.body);
  if (parsed.success) {
    return parsed.data;
  }

  if (input.body instanceof AppError) {
    return input.body.toApiError();
  }

  const status = input.status ?? 500;

  if (status === 401) {
    return {
      status: 401,
      errorMessage: input.fallbackMessage ?? "Unauthorized",
      errorCode: ERROR_CODES.AUTH_UNAUTHORIZED,
      errorKey: ERROR_KEYS.AUTH_UNAUTHORIZED,
    };
  }

  if (status === 403) {
    return {
      status: 403,
      errorMessage: input.fallbackMessage ?? "Forbidden",
      errorCode: ERROR_CODES.AUTH_FORBIDDEN,
      errorKey: ERROR_KEYS.AUTH_FORBIDDEN,
    };
  }

  if (status === 422) {
    return {
      status: 422,
      errorMessage: input.fallbackMessage ?? "Validation failed",
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      errorKey: ERROR_KEYS.VALIDATION_ERROR,
    };
  }

  return {
    ...FALLBACK_API_ERROR,
    status: status >= 400 && status <= 599 ? status : 500,
    errorMessage: input.fallbackMessage ?? FALLBACK_API_ERROR.errorMessage,
  };
}
