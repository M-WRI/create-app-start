import { prisma } from "../../../lib/prisma.js";

export const authUserModel = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  create(input: { email: string; passwordHash: string }) {
    return prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
      },
    });
  },
};

export const authRefreshModel = {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshSession.create({ data: input });
  },
  findByHash(tokenHash: string) {
    return prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  },
  deleteByHash(tokenHash: string) {
    return prisma.refreshSession.deleteMany({ where: { tokenHash } });
  },
  deleteAllForUser(userId: string) {
    return prisma.refreshSession.deleteMany({ where: { userId } });
  },
};

export const authIdempotencyModel = {
  findByKey(key: string) {
    return prisma.idempotencyRecord.findUnique({ where: { key } });
  },
  create(input: {
    key: string;
    method: string;
    path: string;
    statusCode: number;
    responseBody: unknown;
  }) {
    return prisma.idempotencyRecord.create({
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
