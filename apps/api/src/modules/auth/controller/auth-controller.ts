import {
  IDEMPOTENCY_KEY_HEADER,
  isValidIdempotencyKey,
  loginRequestSchema,
  registerRequestSchema,
} from "@repo/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { clearAuthCookies, setAuthCookies } from "../../../lib/cookies.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../../../lib/tokens.js";
import type { AuthService } from "../service/auth-service.js";

export function createAuthController(service: AuthService, options: { cookieSecure: boolean }) {
  return {
    async register(request: FastifyRequest, reply: FastifyReply) {
      const body = registerRequestSchema.parse(request.body);
      const rawKey = request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()];
      const idempotencyKey =
        typeof rawKey === "string" && isValidIdempotencyKey(rawKey) ? rawKey : undefined;
      const result = await service.register(body, idempotencyKey);
      setAuthCookies(reply, result.tokens, { secure: options.cookieSecure });
      return reply.status(201).send(result.session);
    },

    async login(request: FastifyRequest, reply: FastifyReply) {
      const body = loginRequestSchema.parse(request.body);
      const result = await service.login(body);
      setAuthCookies(reply, result.tokens, { secure: options.cookieSecure });
      return reply.send(result.session);
    },

    async logout(request: FastifyRequest, reply: FastifyReply) {
      await service.logout(request.cookies[REFRESH_COOKIE]);
      clearAuthCookies(reply, { secure: options.cookieSecure });
      return reply.status(204).send();
    },

    async refresh(request: FastifyRequest, reply: FastifyReply) {
      const result = await service.refresh(request.cookies[REFRESH_COOKIE]);
      setAuthCookies(reply, result.tokens, { secure: options.cookieSecure });
      return reply.send(result.session);
    },

    async me(request: FastifyRequest, reply: FastifyReply) {
      const session = await service.me(request.cookies[ACCESS_COOKIE]);
      return reply.send(session);
    },
  };
}
