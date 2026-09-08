import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { AppError } from "@repo/contracts";
import Fastify from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { Env } from "./env.js";
import { appErrorHandler, sendApiError } from "./lib/errors.js";
import { requestIdPlugin } from "./lib/request-id.js";
import {
  authIdempotencyModel,
  authRefreshModel,
  authUserModel,
  createPrismaAuthUnitOfWork,
  isPrismaUniqueViolation,
} from "./modules/auth/model/auth-model.js";
import { createAuthRoutes } from "./modules/auth/router/auth-router.js";
import { createAuthService } from "./modules/auth/service/auth-service.js";
import { healthRoutes } from "./modules/health/router/health-router.js";

export type BuildAppOptions = {
  rateLimit?: {
    max?: number;
    timeWindow?: number | string;
    /** Per-route limit for login/register (default 20). */
    authMax?: number;
  };
};

export async function buildApp(env: Env, options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: ["req.headers.cookie", "req.headers.authorization", "password", "token"],
    },
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(appErrorHandler);
  app.setNotFoundHandler((_request, reply) =>
    sendApiError(
      reply,
      new AppError({
        status: 404,
        errorCode: "NOT_FOUND",
        errorMessage: "Not found",
      }),
    ),
  );

  await app.register(requestIdPlugin);
  await app.register(cookie);
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(rateLimit, {
    max: options.rateLimit?.max ?? 200,
    timeWindow: options.rateLimit?.timeWindow ?? "1 minute",
    errorResponseBuilder: (_request, context) =>
      new AppError({
        status: 429,
        errorCode: "RATE_LIMITED",
        errorMessage: `Rate limit exceeded, retry in ${context.after}`,
      }),
  });

  const authService = createAuthService({
    users: authUserModel,
    refresh: authRefreshModel,
    idempotency: authIdempotencyModel,
    uow: createPrismaAuthUnitOfWork(),
    isUniqueViolation: isPrismaUniqueViolation,
    jwtSecret: env.JWT_SECRET,
  });

  await app.register(healthRoutes);
  await app.register(
    createAuthRoutes({
      service: authService,
      jwtSecret: env.JWT_SECRET,
      cookieSecure: env.COOKIE_SECURE,
      authRateLimit: {
        max: options.rateLimit?.authMax ?? 20,
        timeWindow: options.rateLimit?.timeWindow ?? "1 minute",
      },
    }),
  );

  return app;
}
