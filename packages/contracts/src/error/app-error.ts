import type { ApiError } from "./api-error.js";
import { ERROR_KEYS, type ErrorCode, getErrorKey } from "./error-catalog.js";

export type AppErrorOptions = {
  status: number;
  errorCode: ErrorCode;
  errorMessage: string;
  errorKey?: string;
};

export class AppError extends Error {
  readonly status: number;
  readonly errorCode: ErrorCode;
  readonly errorKey: string;
  readonly errorMessage: string;

  constructor(options: AppErrorOptions) {
    super(options.errorMessage);
    this.name = "AppError";
    this.status = options.status;
    this.errorCode = options.errorCode;
    this.errorMessage = options.errorMessage;
    this.errorKey = options.errorKey ?? getErrorKey(options.errorCode);
  }

  toApiError(): ApiError {
    return {
      status: this.status,
      errorMessage: this.errorMessage,
      errorCode: this.errorCode,
      errorKey: this.errorKey,
    };
  }

  static internal(errorMessage = "Unexpected server error"): AppError {
    return new AppError({
      status: 500,
      errorCode: "INTERNAL_ERROR",
      errorMessage,
      errorKey: ERROR_KEYS.INTERNAL_ERROR,
    });
  }
}
