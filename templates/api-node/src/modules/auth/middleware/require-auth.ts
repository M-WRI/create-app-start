import { AppError, type UserRole, hasRequiredRole } from "@repo/contracts";
import type { FastifyRequest } from "fastify";
import { ACCESS_COOKIE, verifyAccessToken } from "../../../lib/tokens.js";

export function createRequireAuth(jwtSecret: string) {
  return async function requireAuth(request: FastifyRequest) {
    const token = request.cookies[ACCESS_COOKIE];
    if (!token) {
      throw new AppError({
        status: 401,
        errorCode: "AUTH_UNAUTHORIZED",
        errorMessage: "Missing access token",
      });
    }
    try {
      const payload = await verifyAccessToken(token, jwtSecret);
      request.authUser = payload;
    } catch {
      throw new AppError({
        status: 401,
        errorCode: "AUTH_UNAUTHORIZED",
        errorMessage: "Invalid access token",
      });
    }
  };
}

export function requireRole(roles: UserRole | UserRole[]) {
  return async function roleGuard(request: FastifyRequest) {
    const user = request.authUser;
    if (!user || !hasRequiredRole(user.role, roles)) {
      throw new AppError({
        status: 403,
        errorCode: "AUTH_FORBIDDEN",
        errorMessage: "Forbidden",
      });
    }
  };
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      sub: string;
      email: string;
      role: UserRole;
    };
  }
}
