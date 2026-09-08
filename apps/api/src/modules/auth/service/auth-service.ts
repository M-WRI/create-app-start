import {
  AppError,
  type AuthSessionResponse,
  type LoginRequest,
  type RegisterRequest,
} from "@repo/contracts";
import * as argon2 from "argon2";
import {
  createRefreshTokenValue,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from "../../../lib/tokens.js";
import { toAuthUser } from "../types/auth-types.js";

export type AuthUserRow = {
  id: string;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  createdAt: Date;
};

export type AuthUserStore = {
  findByEmail: (email: string) => Promise<AuthUserRow | null>;
  findById: (id: string) => Promise<AuthUserRow | null>;
  create: (input: { email: string; passwordHash: string }) => Promise<AuthUserRow>;
};

export type AuthRefreshStore = {
  create: (input: { userId: string; tokenHash: string; expiresAt: Date }) => Promise<unknown>;
  findByHash: (tokenHash: string) => Promise<{
    tokenHash: string;
    expiresAt: Date;
    user: AuthUserRow;
  } | null>;
  /** Atomically take ownership of a refresh session (delete + return), or null if missing/lost race. */
  consumeByHash: (tokenHash: string) => Promise<{
    tokenHash: string;
    expiresAt: Date;
    user: AuthUserRow;
  } | null>;
  deleteByHash: (tokenHash: string) => Promise<unknown>;
};

export type AuthIdempotencyStore = {
  findByKey: (key: string) => Promise<{ responseBody: unknown } | null>;
  create: (input: {
    key: string;
    method: string;
    path: string;
    statusCode: number;
    responseBody: unknown;
  }) => Promise<unknown>;
};

export type AuthStores = {
  users: AuthUserStore;
  refresh: AuthRefreshStore;
  idempotency: AuthIdempotencyStore;
};

export type AuthUnitOfWork = {
  run: <T>(fn: (stores: AuthStores) => Promise<T>) => Promise<T>;
};

export type AuthServiceDeps = {
  users: AuthUserStore;
  refresh: AuthRefreshStore;
  idempotency: AuthIdempotencyStore;
  /** When provided, register/refresh multi-writes run inside this unit of work. */
  uow?: AuthUnitOfWork;
  /** Map persistence unique violations to domain fields (email | key). */
  isUniqueViolation?: (error: unknown, field: "email" | "key") => boolean;
  jwtSecret: string;
  now?: () => Date;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = {
  session: AuthSessionResponse;
  tokens: AuthTokens;
};

type TokenUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: Date;
};

const defaultIsUniqueViolation: NonNullable<AuthServiceDeps["isUniqueViolation"]> = () => false;

export function createAuthService(deps: AuthServiceDeps) {
  const now = deps.now ?? (() => new Date());
  const isUniqueViolation = deps.isUniqueViolation ?? defaultIsUniqueViolation;
  const rootStores: AuthStores = {
    users: deps.users,
    refresh: deps.refresh,
    idempotency: deps.idempotency,
  };
  const uow: AuthUnitOfWork = deps.uow ?? {
    run: async (fn) => fn(rootStores),
  };

  async function issueTokens(refreshStore: AuthRefreshStore, user: TokenUser): Promise<AuthResult> {
    const accessToken = await signAccessToken(
      { sub: user.id, email: user.email, role: user.role },
      deps.jwtSecret,
    );
    const refreshToken = createRefreshTokenValue();
    const expiresAt = new Date(now().getTime() + 1000 * 60 * 60 * 24 * 30);
    await refreshStore.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });
    return {
      session: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      },
      tokens: { accessToken, refreshToken },
    };
  }

  async function replayIdempotentRegister(
    storedBody: unknown,
    input: RegisterRequest,
  ): Promise<AuthResult> {
    const stored = storedBody as AuthSessionResponse;
    const user = await deps.users.findById(stored.user.id);
    if (!user) {
      throw new AppError({
        status: 409,
        errorCode: "IDEMPOTENCY_CONFLICT",
        errorMessage: "Idempotent replay failed",
      });
    }
    const emailMatches = user.email.toLowerCase() === input.email.toLowerCase();
    const passwordMatches = await argon2.verify(user.passwordHash, input.password);
    if (!emailMatches || !passwordMatches) {
      throw new AppError({
        status: 409,
        errorCode: "IDEMPOTENCY_CONFLICT",
        errorMessage: "Idempotency key reused with different credentials",
      });
    }
    return issueTokens(deps.refresh, user);
  }

  return {
    async register(input: RegisterRequest, idempotencyKey?: string): Promise<AuthResult> {
      if (idempotencyKey) {
        const existing = await deps.idempotency.findByKey(idempotencyKey);
        if (existing) {
          return replayIdempotentRegister(existing.responseBody, input);
        }
      }

      const existingUser = await deps.users.findByEmail(input.email);
      if (existingUser) {
        throw new AppError({
          status: 409,
          errorCode: "AUTH_EMAIL_TAKEN",
          errorMessage: "Email already registered",
        });
      }

      const passwordHash = await argon2.hash(input.password);

      try {
        return await uow.run(async (stores) => {
          const user = await stores.users.create({ email: input.email, passwordHash });
          const result = await issueTokens(stores.refresh, user);

          if (idempotencyKey) {
            await stores.idempotency.create({
              key: idempotencyKey,
              method: "POST",
              path: "/api/v1/auth/register",
              statusCode: 201,
              responseBody: result.session,
            });
          }

          return result;
        });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        if (idempotencyKey && isUniqueViolation(error, "key")) {
          const existing = await deps.idempotency.findByKey(idempotencyKey);
          if (existing) {
            return replayIdempotentRegister(existing.responseBody, input);
          }
          throw new AppError({
            status: 409,
            errorCode: "IDEMPOTENCY_CONFLICT",
            errorMessage: "Idempotent replay failed",
          });
        }
        if (isUniqueViolation(error, "email")) {
          // Concurrent same-key register may surface as email unique after the
          // winner commits; prefer credential-verified idempotent replay.
          if (idempotencyKey) {
            const existing = await deps.idempotency.findByKey(idempotencyKey);
            if (existing) {
              return replayIdempotentRegister(existing.responseBody, input);
            }
          }
          throw new AppError({
            status: 409,
            errorCode: "AUTH_EMAIL_TAKEN",
            errorMessage: "Email already registered",
          });
        }
        throw error;
      }
    },

    async login(input: LoginRequest): Promise<AuthResult> {
      const user = await deps.users.findByEmail(input.email);
      if (!user) {
        throw new AppError({
          status: 401,
          errorCode: "AUTH_INVALID_CREDENTIALS",
          errorMessage: "Invalid credentials",
        });
      }

      const valid = await argon2.verify(user.passwordHash, input.password);
      if (!valid) {
        throw new AppError({
          status: 401,
          errorCode: "AUTH_INVALID_CREDENTIALS",
          errorMessage: "Invalid credentials",
        });
      }

      return issueTokens(deps.refresh, user);
    },

    async me(accessToken: string | undefined): Promise<AuthSessionResponse> {
      if (!accessToken) {
        throw new AppError({
          status: 401,
          errorCode: "AUTH_UNAUTHORIZED",
          errorMessage: "Missing access token",
        });
      }

      let payload: Awaited<ReturnType<typeof verifyAccessToken>>;
      try {
        payload = await verifyAccessToken(accessToken, deps.jwtSecret);
      } catch {
        throw new AppError({
          status: 401,
          errorCode: "AUTH_UNAUTHORIZED",
          errorMessage: "Invalid access token",
        });
      }

      const user = await deps.users.findById(payload.sub);
      if (!user) {
        throw new AppError({
          status: 401,
          errorCode: "AUTH_UNAUTHORIZED",
          errorMessage: "User not found",
        });
      }

      return { user: toAuthUser(user) };
    },

    async refresh(refreshToken: string | undefined): Promise<AuthResult> {
      if (!refreshToken) {
        throw new AppError({
          status: 401,
          errorCode: "AUTH_UNAUTHORIZED",
          errorMessage: "Missing refresh token",
        });
      }

      return uow.run(async (stores) => {
        const session = await stores.refresh.consumeByHash(hashToken(refreshToken));
        if (!session || session.expiresAt.getTime() < now().getTime()) {
          throw new AppError({
            status: 401,
            errorCode: "AUTH_UNAUTHORIZED",
            errorMessage: "Invalid refresh token",
          });
        }

        return issueTokens(stores.refresh, session.user);
      });
    },

    async logout(refreshToken: string | undefined): Promise<void> {
      if (refreshToken) {
        await deps.refresh.deleteByHash(hashToken(refreshToken));
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
