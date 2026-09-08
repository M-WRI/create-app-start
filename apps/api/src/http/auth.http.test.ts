import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ensureQualityDatabase } from "./quality-db.js";

const jwtSecret = "quality-test-secret-min-32-chars!!";

function cookieHeader(setCookie: string | string[] | undefined): string {
  const parts = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

function setCookies(response: { headers: Record<string, unknown> }): string | string[] | undefined {
  return response.headers["set-cookie"] as string | string[] | undefined;
}

describe("auth HTTP (quality DB)", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let qualityUrl: string;

  beforeAll(async () => {
    qualityUrl = await ensureQualityDatabase();
    const { resetPrismaClient } = await import("../lib/prisma.js");
    prisma = await resetPrismaClient(qualityUrl);
    const { buildApp } = await import("../app.js");
    const { loadEnv } = await import("../env.js");
    app = await buildApp(
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: qualityUrl,
        JWT_SECRET: jwtSecret,
        COOKIE_SECURE: "false",
        CORS_ORIGINS: "http://localhost:5173",
        API_PORT: "3000",
      }),
      { rateLimit: { max: 10_000, authMax: 10_000, timeWindow: "1 minute" } },
    );
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    await prisma.idempotencyRecord.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.user.deleteMany();
  });

  it("returns ApiError for invalid login and register bodies", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "not-an-email", password: "short" },
    });
    expect(login.statusCode).toBe(422);
    expect(login.json()).toMatchObject({ errorCode: "VALIDATION_ERROR", status: 422 });

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "x", password: "1" },
    });
    expect(register.statusCode).toBe(422);
    expect(register.json()).toMatchObject({ errorCode: "VALIDATION_ERROR", status: 422 });
  });

  it("sets httpOnly cookies on login and clears them on logout", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "cookie@example.com", password: "password123" },
      headers: { "idempotency-key": "cookie-reg" },
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "cookie@example.com", password: "password123" },
    });
    expect(login.statusCode).toBe(200);
    const cookies = setCookies(login);
    expect(cookies).toBeTruthy();
    const joined = Array.isArray(cookies) ? cookies.join("\n") : String(cookies);
    expect(joined).toMatch(/access_token=/);
    expect(joined).toMatch(/refresh_token=/);
    expect(joined.toLowerCase()).toMatch(/httponly/);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie: cookieHeader(cookies) },
    });
    expect(logout.statusCode).toBe(204);
    const cleared = setCookies(logout);
    const clearedJoined = Array.isArray(cleared) ? cleared.join("\n") : String(cleared ?? "");
    expect(clearedJoined).toMatch(/access_token=/);
    expect(clearedJoined).toMatch(/refresh_token=/);
    expect(clearedJoined.toLowerCase()).toMatch(/max-age=0|expires=/i);
  });

  it("returns AUTH_UNAUTHORIZED for /me without cookies", async () => {
    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(me.statusCode).toBe(401);
    expect(me.json()).toMatchObject({ errorCode: "AUTH_UNAUTHORIZED", status: 401 });
  });

  it("returns NOT_FOUND ApiError for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ errorCode: "NOT_FOUND", status: 404 });
  });

  it("returns BAD_REQUEST for malformed JSON", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{not-json",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ errorCode: "BAD_REQUEST", status: 400 });
  });

  it("replays concurrent register with same idempotency key and credentials", async () => {
    const key = "concurrent-same-creds";
    const payload = { email: "idem@example.com", password: "password123" };
    const [a, b] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload,
        headers: { "idempotency-key": key },
      }),
      app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload,
        headers: { "idempotency-key": key },
      }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 201]);
    expect(a.json().user.id).toBe(b.json().user.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("allows only one winner for refresh single-use", async () => {
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "refresh@example.com", password: "password123" },
      headers: { "idempotency-key": "refresh-reg" },
    });
    const cookie = cookieHeader(setCookies(registered));
    const [a, b] = await Promise.all([
      app.inject({ method: "POST", url: "/api/v1/auth/refresh", headers: { cookie } }),
      app.inject({ method: "POST", url: "/api/v1/auth/refresh", headers: { cookie } }),
    ]);
    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses).toEqual([200, 401]);
  });

  it("rate limits auth endpoints with ApiError RATE_LIMITED", async () => {
    const { buildApp } = await import("../app.js");
    const { loadEnv } = await import("../env.js");
    const limitedApp = await buildApp(
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: qualityUrl,
        JWT_SECRET: jwtSecret,
        COOKIE_SECURE: "false",
        CORS_ORIGINS: "http://localhost:5173",
        API_PORT: "3000",
      }),
      { rateLimit: { max: 1000, authMax: 3, timeWindow: "1 minute" } },
    );
    try {
      const results = [];
      for (let i = 0; i < 5; i += 1) {
        results.push(
          await limitedApp.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: { email: `rl${i}@example.com`, password: "password123" },
          }),
        );
      }
      const limited = results.find((r) => r.statusCode === 429);
      expect(limited).toBeTruthy();
      expect(limited?.json()).toMatchObject({ errorCode: "RATE_LIMITED", status: 429 });
    } finally {
      await limitedApp.close();
    }
  });
});
