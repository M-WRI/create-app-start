import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { Env } from "./env.js";
import { appErrorHandler } from "./lib/errors.js";
import { requestIdPlugin } from "./lib/request-id.js";
import {
  authIdempotencyModel,
  authRefreshModel,
  authUserModel,
} from "./modules/auth/model/auth-model.js";
import { createAuthRoutes } from "./modules/auth/router/auth-router.js";
import { createAuthService } from "./modules/auth/service/auth-service.js";
import { healthRoutes } from "./modules/health/router/health-router.js";

export async function buildApp(env: Env) {
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
    max: 200,
    timeWindow: "1 minute",
  });

  const authService = createAuthService({
    users: authUserModel,
    refresh: authRefreshModel,
    idempotency: authIdempotencyModel,
    jwtSecret: env.JWT_SECRET,
  });

  await app.register(healthRoutes);
  await app.register(
    createAuthRoutes({
      service: authService,
      jwtSecret: env.JWT_SECRET,
      cookieSecure: env.COOKIE_SECURE,
    }),
  );

  return app;
}
