import { type ApiError, AppError } from "@repo/contracts";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function sendApiError(reply: FastifyReply, error: AppError | ApiError) {
  const payload = error instanceof AppError ? error.toApiError() : error;
  return reply.status(payload.status).send(payload);
}

export async function appErrorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return sendApiError(reply, error);
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
