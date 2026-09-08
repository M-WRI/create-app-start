import { PrismaClient } from "@prisma/client";

let prismaSingleton: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}

/** Disconnect and rebuild the client (quality tests may swap DATABASE_URL). */
export async function resetPrismaClient(databaseUrl?: string): Promise<PrismaClient> {
  if (prismaSingleton) {
    await prismaSingleton.$disconnect();
    prismaSingleton = undefined;
  }
  if (databaseUrl) {
    const key = "DATABASE_URL";
    process.env[key] = databaseUrl;
  }
  prismaSingleton = new PrismaClient();
  return prismaSingleton;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: never[]) => unknown).bind(client)
      : value;
  },
});
