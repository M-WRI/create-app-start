import type { FastifyReply } from "fastify";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./tokens.js";

export function setAuthCookies(
  reply: FastifyReply,
  tokens: { accessToken: string; refreshToken: string },
  options: { secure: boolean },
) {
  const common = {
    path: "/",
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax" as const,
  };

  reply.setCookie(ACCESS_COOKIE, tokens.accessToken, {
    ...common,
    maxAge: 60 * 15,
  });
  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...common,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(reply: FastifyReply, options: { secure: boolean }) {
  const common = {
    path: "/",
    httpOnly: true,
    secure: options.secure,
  };
  reply.clearCookie(ACCESS_COOKIE, common);
  reply.clearCookie(REFRESH_COOKIE, { ...common, sameSite: "strict" });
}
