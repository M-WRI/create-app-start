export {
  type ApiError,
  apiErrorSchema,
  isApiError,
  parseApiError,
} from "./error/api-error.js";
export { AppError, type AppErrorOptions } from "./error/app-error.js";
export {
  type ErrorCode,
  type ErrorKey,
  ERROR_CODES,
  ERROR_KEYS,
  getErrorKey,
} from "./error/error-catalog.js";
export {
  type NormalizeApiErrorInput,
  normalizeApiError,
} from "./error/normalize-api-error.js";

export {
  type AuthSessionResponse,
  type AuthUser,
  authSessionResponseSchema,
  authUserSchema,
  type LoginRequest,
  loginRequestSchema,
  type MeResponse,
  meResponseSchema,
  type RegisterRequest,
  registerRequestSchema,
} from "./auth/schemas.js";

export {
  hasRequiredRole,
  type UserRole,
  USER_ROLES,
  userRoleSchema,
} from "./rbac/role.js";

export {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  isValidIdempotencyKey,
} from "./idempotency/constants.js";
