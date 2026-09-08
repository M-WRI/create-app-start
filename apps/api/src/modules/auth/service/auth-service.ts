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

export type AuthUserStore = {
  findByEmail: (email: string) => Promise<{
    id: string;
    email: string;
    passwordHash: string;
    role: "user" | "admin";
    createdAt: Date;
  } | null>;
  findById: (id: string) => Promise<{
    id: string;
    email: string;
    passwordHash: string;
    role: "user" | "admin";
    createdAt: Date;
  } | null>;
  create: (input: {
    email: string;
    passwordHash: string;
  }) => Promise<{
    id: string;
    email: string;
    passwordHash: string;
    role: "user" | "admin";
    createdAt: Date;
  }>;
};

export type AuthRefreshStore = {
  create: (input: { userId: string; tokenHash: string; expiresAt: Date }) => Promise<unknown>;
  findByHash: (tokenHash: string) => Promise<{
    tokenHash: string;
    expiresAt: Date;
    user: {
      id: string;
      email: string;
      passwordHash: string;
      role: "user" | "admin";
      createdAt: Date;
    };
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

export type AuthServiceDeps = {
  users: AuthUserStore;
  refresh: AuthRefreshStore;
  idempotency: AuthIdempotencyStore;
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

export function createAuthService(deps: AuthServiceDeps) {
  const now = deps.now ?? (() => new Date());

  async function issueTokens(user: TokenUser): Promise<AuthResult> {
    const accessToken = await signAccessToken(
      { sub: user.id, email: user.email, role: user.role },
      deps.jwtSecret,
    );
    const refreshToken = createRefreshTokenValue();
    const expiresAt = new Date(now().getTime() + 1000 * 60 * 60 * 24 * 30);
    await deps.refresh.create({
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

  return {
    async register(input: RegisterRequest, idempotencyKey?: string): Promise<AuthResult> {
      if (idempotencyKey) {
        const existing = await deps.idempotency.findByKey(idempotencyKey);
        if (existing) {
          const stored = existing.responseBody as AuthSessionResponse;
          const user = await deps.users.findById(stored.user.id);
          if (!user) {
            throw new AppError({
              status: 409,
              errorCode: "IDEMPOTENCY_CONFLICT",
              errorMessage: "Idempotent replay failed",
            });
          }
          return issueTokens(user);
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
      const user = await deps.users.create({ email: input.email, passwordHash });
      const result = await issueTokens(user);

      if (idempotencyKey) {
        await deps.idempotency.create({
          key: idempotencyKey,
          method: "POST",
          path: "/api/v1/auth/register",
          statusCode: 201,
          responseBody: result.session,
        });
      }

      return result;
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

      return issueTokens(user);
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

      const session = await deps.refresh.findByHash(hashToken(refreshToken));
      if (!session || session.expiresAt.getTime() < now().getTime()) {
        throw new AppError({
          status: 401,
          errorCode: "AUTH_UNAUTHORIZED",
          errorMessage: "Invalid refresh token",
        });
      }

      await deps.refresh.deleteByHash(session.tokenHash);
      return issueTokens(session.user);
    },

    async logout(refreshToken: string | undefined): Promise<void> {
      if (refreshToken) {
        await deps.refresh.deleteByHash(hashToken(refreshToken));
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
