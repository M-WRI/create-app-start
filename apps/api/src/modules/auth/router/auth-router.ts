import type { FastifyPluginAsync } from "fastify";
import { createAuthController } from "../controller/auth-controller.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { AuthService } from "../service/auth-service.js";

export function createAuthRoutes(options: {
  service: AuthService;
  jwtSecret: string;
  cookieSecure: boolean;
}): FastifyPluginAsync {
  const controller = createAuthController(options.service, {
    cookieSecure: options.cookieSecure,
  });
  const requireAuth = createRequireAuth(options.jwtSecret);

  return async (app) => {
    const authRateLimit = {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    };

    app.post("/api/v1/auth/register", authRateLimit, controller.register);
    app.post("/api/v1/auth/login", authRateLimit, controller.login);
    app.post("/api/v1/auth/logout", controller.logout);
    app.post("/api/v1/auth/refresh", controller.refresh);
    app.get("/api/v1/auth/me", { preHandler: requireAuth }, controller.me);
  };
}
