import { type ApiError, AppError } from "@repo/contracts";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export function sendApiError(reply: FastifyReply, error: AppError | ApiError) {
  const payload = error instanceof AppError ? error.toApiError() : error;
  return reply.status(payload.status).send(payload);
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

const KNOWN_FASTIFY_CLIENT_CODES = new Set([
  "FST_ERR_NOT_FOUND",
  "FST_ERR_METHOD_NOT_ALLOWED",
  "FST_ERR_CTP_INVALID_JSON_BODY",
  "FST_ERR_CTP_EMPTY_JSON_BODY",
  "FST_ERR_CTP_INVALID_MEDIA_TYPE",
  "FST_ERR_CTP_INVALID_CONTENT_LENGTH",
  "FST_ERR_CTP_BODY_TOO_LARGE",
  "FST_JWT_AUTHORIZATION_TOKEN_INVALID",
]);

function errorCodeOf(error: FastifyError): string | undefined {
  return typeof error.code === "string" ? error.code : undefined;
}

function isRateLimitError(error: FastifyError): boolean {
  const code = errorCodeOf(error);
  if (code === "FST_ERR_RATE_LIMIT" || code === "RATE_LIMITED") {
    return true;
  }
  if (error instanceof AppError && error.errorCode === "RATE_LIMITED") {
    return true;
  }
  return error.statusCode === 429;
}

function isMethodNotAllowed(error: FastifyError): boolean {
  const code = errorCodeOf(error);
  return code === "FST_ERR_METHOD_NOT_ALLOWED" || error.statusCode === 405;
}

function isBadRequest(error: FastifyError): boolean {
  const code = errorCodeOf(error);
  if (!code) {
    return false;
  }
  return (
    code === "FST_ERR_CTP_INVALID_JSON_BODY" ||
    code === "FST_ERR_CTP_EMPTY_JSON_BODY" ||
    code === "FST_ERR_CTP_INVALID_MEDIA_TYPE" ||
    code === "FST_ERR_CTP_INVALID_CONTENT_LENGTH" ||
    code.startsWith("FST_ERR_CTP_")
  );
}

export async function appErrorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    if (error.errorCode === "RATE_LIMITED" && !reply.hasHeader("retry-after")) {
      // keep any retry-after already set by @fastify/rate-limit
    }
    return sendApiError(reply, error);
  }

  if (isZodError(error) || error.name === "ZodError") {
    const message =
      isZodError(error) && error.issues[0]?.message ? error.issues[0].message : "Validation failed";
    return sendApiError(
      reply,
      new AppError({
        status: 422,
        errorCode: "VALIDATION_ERROR",
        errorMessage: message,
      }),
    );
  }

  if (error.validation) {
    return sendApiError(
      reply,
      new AppError({
        status: 422,
        errorCode: "VALIDATION_ERROR",
        errorMessage: error.message,
      }),
    );
  }

  if (isRateLimitError(error)) {
    return sendApiError(
      reply,
      new AppError({
        status: 429,
        errorCode: "RATE_LIMITED",
        errorMessage: error.message || "Rate limit exceeded",
      }),
    );
  }

  const code = errorCodeOf(error);
  if (code === "FST_ERR_NOT_FOUND" || (error.statusCode === 404 && code === "FST_ERR_NOT_FOUND")) {
    return sendApiError(
      reply,
      new AppError({
        status: 404,
        errorCode: "NOT_FOUND",
        errorMessage: "Not found",
      }),
    );
  }

  if (isMethodNotAllowed(error)) {
    return sendApiError(
      reply,
      new AppError({
        status: 405,
        errorCode: "METHOD_NOT_ALLOWED",
        errorMessage: "Method not allowed",
      }),
    );
  }

  if (isBadRequest(error)) {
    return sendApiError(
      reply,
      new AppError({
        status: 400,
        errorCode: "BAD_REQUEST",
        errorMessage: "Bad request",
      }),
    );
  }

  // Only map known Fastify client codes via statusCode; never trust arbitrary 4xx/5xx.
  if (code && KNOWN_FASTIFY_CLIENT_CODES.has(code) && error.statusCode === 404) {
    return sendApiError(
      reply,
      new AppError({
        status: 404,
        errorCode: "NOT_FOUND",
        errorMessage: "Not found",
      }),
    );
  }

  requestLogRedacted(error);

  return sendApiError(reply, AppError.internal());
}

function requestLogRedacted(error: unknown) {
  if (error instanceof Error) {
    console.error({
      name: error.name,
      message: error.message.replace(/password|token|cookie|authorization/gi, "[redacted]"),
    });
    return;
  }
  console.error("Unknown error");
}
