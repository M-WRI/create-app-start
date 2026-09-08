import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import type {
  AuthIdempotencyStore,
  AuthRefreshStore,
  AuthStores,
  AuthUnitOfWork,
  AuthUserStore,
} from "../service/auth-service.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export function createAuthUserModel(db: DbClient): AuthUserStore {
  return {
    findByEmail(email: string) {
      return db.user.findUnique({ where: { email } });
    },
    findById(id: string) {
      return db.user.findUnique({ where: { id } });
    },
    create(input: { email: string; passwordHash: string }) {
      return db.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
        },
      });
    },
  };
}

export function createAuthRefreshModel(db: DbClient): AuthRefreshStore {
  return {
    create(input: { userId: string; tokenHash: string; expiresAt: Date }) {
      return db.refreshSession.create({ data: input });
    },
    findByHash(tokenHash: string) {
      return db.refreshSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
    },
    async consumeByHash(tokenHash: string) {
      const session = await db.refreshSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!session) {
        return null;
      }
      const deleted = await db.refreshSession.deleteMany({ where: { tokenHash } });
      if (deleted.count !== 1) {
        return null;
      }
      return session;
    },
    deleteByHash(tokenHash: string) {
      return db.refreshSession.deleteMany({ where: { tokenHash } });
    },
  };
}

export function createAuthIdempotencyModel(db: DbClient): AuthIdempotencyStore {
  return {
    findByKey(key: string) {
      return db.idempotencyRecord.findUnique({ where: { key } });
    },
    create(input: {
      key: string;
      method: string;
      path: string;
      statusCode: number;
      responseBody: unknown;
    }) {
      return db.idempotencyRecord.create({
        data: {
          key: input.key,
          method: input.method,
          path: input.path,
          statusCode: input.statusCode,
          responseBody: input.responseBody as object,
        },
      });
    },
  };
}

export const authUserModel = createAuthUserModel(prisma);
export const authRefreshModel = createAuthRefreshModel(prisma);
export const authIdempotencyModel = createAuthIdempotencyModel(prisma);

export function createPrismaAuthUnitOfWork(client: PrismaClient = prisma): AuthUnitOfWork {
  return {
    run<T>(fn: (stores: AuthStores) => Promise<T>): Promise<T> {
      return client.$transaction(async (tx) =>
        fn({
          users: createAuthUserModel(tx),
          refresh: createAuthRefreshModel(tx),
          idempotency: createAuthIdempotencyModel(tx),
        }),
      );
    },
  };
}

export function isPrismaUniqueViolation(error: unknown, field: "email" | "key"): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const meta = error.meta as { target?: string | string[] } | undefined;
  const target = meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? [target]
      : [];
  if (field === "email") {
    return fields.some((value) => value === "email" || value.includes("email"));
  }
  return fields.some(
    (value) => value === "key" || value.endsWith("_key_key") || value.includes("key"),
  );
}
