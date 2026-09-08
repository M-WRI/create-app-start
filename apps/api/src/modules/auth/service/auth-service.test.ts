import { AppError } from "@repo/contracts";
import { describe, expect, it } from "vitest";
import { createAuthService } from "./auth-service.js";

const jwtSecret = "test-secret-min-32-characters-long!!";

function createDeps() {
  const users = new Map<
    string,
    {
      id: string;
      email: string;
      passwordHash: string;
      role: "user" | "admin";
      createdAt: Date;
    }
  >();
  const refresh = new Map<
    string,
    {
      tokenHash: string;
      userId: string;
      expiresAt: Date;
      user: {
        id: string;
        email: string;
        role: "user" | "admin";
        createdAt: Date;
        passwordHash: string;
      };
    }
  >();
  const idempotency = new Map<string, { responseBody: unknown }>();

  return {
    usersMap: users,
    users: {
      async findByEmail(email: string) {
        return [...users.values()].find((user) => user.email === email) ?? null;
      },
      async findById(id: string) {
        return users.get(id) ?? null;
      },
      async create(input: { email: string; passwordHash: string }) {
        const user = {
          id: crypto.randomUUID(),
          email: input.email,
          passwordHash: input.passwordHash,
          role: "user" as const,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        };
        users.set(user.id, user);
        return user;
      },
    },
    refresh: {
      async create(input: { userId: string; tokenHash: string; expiresAt: Date }) {
        const user = users.get(input.userId);
        if (!user) {
          throw new Error("missing user");
        }
        refresh.set(input.tokenHash, { ...input, user });
      },
      async findByHash(tokenHash: string) {
        return refresh.get(tokenHash) ?? null;
      },
      async consumeByHash(tokenHash: string) {
        const session = refresh.get(tokenHash) ?? null;
        if (session) {
          refresh.delete(tokenHash);
        }
        return session;
      },
      async deleteByHash(tokenHash: string) {
        refresh.delete(tokenHash);
      },
    },
    idempotency: {
      async findByKey(key: string) {
        const value = idempotency.get(key);
        return value ? { responseBody: value.responseBody } : null;
      },
      async create(input: {
        key: string;
        method: string;
        path: string;
        statusCode: number;
        responseBody: unknown;
      }) {
        idempotency.set(input.key, { responseBody: input.responseBody });
      },
    },
    jwtSecret,
  };
}

describe("createAuthService", () => {
  it("registers, logs in, and returns me", async () => {
    const service = createAuthService(createDeps() as never);
    const registered = await service.register({ email: "a@b.co", password: "password1" }, "idem-1");
    expect(registered.session.user.email).toBe("a@b.co");

    const replay = await service.register({ email: "a@b.co", password: "password1" }, "idem-1");
    expect(replay.session.user.id).toBe(registered.session.user.id);

    const login = await service.login({ email: "a@b.co", password: "password1" });
    const me = await service.me(login.tokens.accessToken);
    expect(me.user.email).toBe("a@b.co");
  });

  it("rejects invalid credentials and duplicate email", async () => {
    const service = createAuthService(createDeps() as never);
    await service.register({ email: "a@b.co", password: "password1" });
    await expect(
      service.register({ email: "a@b.co", password: "password1" }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(service.login({ email: "a@b.co", password: "wrong-pass" })).rejects.toMatchObject({
      errorCode: "AUTH_INVALID_CREDENTIALS",
    });
  });

  it("refreshes and logs out", async () => {
    const service = createAuthService(createDeps() as never);
    const registered = await service.register({ email: "a@b.co", password: "password1" });
    const refreshed = await service.refresh(registered.tokens.refreshToken);
    expect(refreshed.tokens.accessToken).toBeTruthy();
    await service.logout(refreshed.tokens.refreshToken);
    await expect(service.refresh(refreshed.tokens.refreshToken)).rejects.toMatchObject({
      errorCode: "AUTH_UNAUTHORIZED",
    });
  });

  it("rejects missing access token", async () => {
    const service = createAuthService(createDeps() as never);
    await expect(service.me(undefined)).rejects.toMatchObject({ errorCode: "AUTH_UNAUTHORIZED" });
  });

  it("rejects unknown email, bad token, and missing refresh", async () => {
    const service = createAuthService(createDeps() as never);
    await expect(
      service.login({ email: "missing@b.co", password: "password1" }),
    ).rejects.toMatchObject({
      errorCode: "AUTH_INVALID_CREDENTIALS",
    });
    await expect(service.me("not-a-jwt")).rejects.toMatchObject({
      errorCode: "AUTH_UNAUTHORIZED",
    });
    await expect(service.refresh(undefined)).rejects.toMatchObject({
      errorCode: "AUTH_UNAUTHORIZED",
    });
    await service.logout(undefined);
  });

  it("rejects me when user no longer exists", async () => {
    const deps = createDeps();
    const service = createAuthService(deps as never);
    const registered = await service.register({ email: "a@b.co", password: "password1" });
    deps.usersMap.clear();
    await expect(service.me(registered.tokens.accessToken)).rejects.toMatchObject({
      errorCode: "AUTH_UNAUTHORIZED",
    });
  });

  it("rejects idempotent replay when stored user is gone", async () => {
    const deps = createDeps();
    const service = createAuthService(deps as never);
    const registered = await service.register({ email: "a@b.co", password: "password1" }, "gone");
    deps.usersMap.clear();
    await expect(
      service.register({ email: "a@b.co", password: "password1" }, "gone"),
    ).rejects.toMatchObject({ errorCode: "IDEMPOTENCY_CONFLICT" });
    expect(registered.session.user.id).toBeTruthy();
  });

  it("rejects idempotent replay with mismatched credentials", async () => {
    const service = createAuthService(createDeps() as never);
    await service.register({ email: "a@b.co", password: "password1" }, "idem-key");
    await expect(
      service.register({ email: "a@b.co", password: "other-password" }, "idem-key"),
    ).rejects.toMatchObject({ errorCode: "IDEMPOTENCY_CONFLICT" });
    await expect(
      service.register({ email: "other@b.co", password: "password1" }, "idem-key"),
    ).rejects.toMatchObject({ errorCode: "IDEMPOTENCY_CONFLICT" });
  });

  it("allows only one concurrent refresh of the same token", async () => {
    const service = createAuthService(createDeps() as never);
    const registered = await service.register({ email: "a@b.co", password: "password1" });
    const token = registered.tokens.refreshToken;
    const [first, second] = await Promise.allSettled([
      service.refresh(token),
      service.refresh(token),
    ]);
    const fulfilled = [first, second].filter((r) => r.status === "fulfilled");
    const rejected = [first, second].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      errorCode: "AUTH_UNAUTHORIZED",
    });
  });

  it("rolls back register writes when a later store write fails", async () => {
    const deps = createDeps();
    const usersCreated: string[] = [];
    const refreshCreated: string[] = [];
    const failingDeps = {
      ...deps,
      users: {
        ...deps.users,
        async create(input: { email: string; passwordHash: string }) {
          const user = await deps.users.create(input);
          usersCreated.push(user.id);
          return user;
        },
      },
      refresh: {
        ...deps.refresh,
        async create(input: { userId: string; tokenHash: string; expiresAt: Date }) {
          await deps.refresh.create(input);
          refreshCreated.push(input.tokenHash);
        },
      },
      idempotency: {
        ...deps.idempotency,
        async create() {
          throw new Error("injected idempotency failure");
        },
      },
      uow: {
        async run<T>(fn: (stores: typeof failingStores) => Promise<T>): Promise<T> {
          const snapshotUsers = new Map(deps.usersMap);
          const snapshotRefresh = new Set(refreshCreated);
          try {
            return await fn(failingStores);
          } catch (error) {
            deps.usersMap.clear();
            for (const [id, user] of snapshotUsers) {
              deps.usersMap.set(id, user);
            }
            for (const hash of [...refreshCreated]) {
              if (!snapshotRefresh.has(hash)) {
                await deps.refresh.deleteByHash(hash);
              }
            }
            throw error;
          }
        },
      },
    };
    const failingStores = {
      users: failingDeps.users,
      refresh: failingDeps.refresh,
      idempotency: failingDeps.idempotency,
    };
    const service = createAuthService(failingDeps as never);
    await expect(
      service.register({ email: "rollback@b.co", password: "password1" }, "idem-fail"),
    ).rejects.toThrow("injected idempotency failure");
    expect(deps.usersMap.size).toBe(0);
    expect(await deps.users.findByEmail("rollback@b.co")).toBeNull();
    expect(usersCreated.length).toBe(1);
  });

  it("maps unique email/key violations from the unit of work", async () => {
    const deps = createDeps();
    const service = createAuthService({
      ...deps,
      isUniqueViolation(error: unknown, field: "email" | "key") {
        return error instanceof Error && error.message === `unique:${field}`;
      },
      users: {
        ...deps.users,
        async create() {
          throw new Error("unique:email");
        },
      },
    } as never);
    await expect(
      service.register({ email: "a@b.co", password: "password1" }),
    ).rejects.toMatchObject({ errorCode: "AUTH_EMAIL_TAKEN" });

    const withKey = createAuthService({
      ...createDeps(),
      isUniqueViolation(error: unknown, field: "email" | "key") {
        return error instanceof Error && error.message === `unique:${field}`;
      },
      users: {
        ...createDeps().users,
        async create(input: { email: string; passwordHash: string }) {
          return {
            id: "user-1",
            email: input.email,
            passwordHash: input.passwordHash,
            role: "user" as const,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          };
        },
      },
      refresh: {
        async create() {
          return undefined;
        },
        async findByHash() {
          return null;
        },
        async consumeByHash() {
          return null;
        },
        async deleteByHash() {
          return undefined;
        },
      },
      idempotency: {
        async findByKey() {
          return null;
        },
        async create() {
          throw new Error("unique:key");
        },
      },
    } as never);
    await expect(
      withKey.register({ email: "a@b.co", password: "password1" }, "race-key"),
    ).rejects.toMatchObject({ errorCode: "IDEMPOTENCY_CONFLICT" });
  });
});
