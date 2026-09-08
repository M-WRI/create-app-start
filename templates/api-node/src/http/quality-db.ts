import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROTECTED_DB_NAMES = new Set(["asa", "postgres", "template0", "template1"]);

function failEnv(message: string): never {
  throw new Error(
    `Quality DB environment failure: ${message}. Ensure Postgres is running and reachable (e.g. postgresql://asa:asa@localhost:5432/postgres).`,
  );
}

function readEnv(key: string): string | undefined {
  return process.env[key];
}

function writeEnv(key: string, value: string): void {
  process.env[key] = value;
}

export function qualityDatabaseName(): string {
  // Separate from the Python quality DB so Prisma/Alembic do not race on one catalog.
  return readEnv("QUALITY_DATABASE_NAME") ?? "asa_quality_test_node";
}

export function resolveAdminDatabaseUrl(): string {
  const adminOverride = readEnv("QUALITY_ADMIN_DATABASE_URL");
  if (adminOverride) {
    return adminOverride;
  }
  const fromEnv = readEnv("DATABASE_URL");
  if (fromEnv) {
    try {
      const url = new URL(fromEnv);
      url.pathname = "/postgres";
      return url.toString();
    } catch {
      // fall through
    }
  }
  return "postgresql://asa:asa@localhost:5432/postgres";
}

export function resolveQualityDatabaseUrl(): string {
  const override = readEnv("QUALITY_DATABASE_URL");
  if (override) {
    return override;
  }
  const admin = resolveAdminDatabaseUrl();
  try {
    const url = new URL(admin);
    url.pathname = `/${qualityDatabaseName()}`;
    return url.toString();
  } catch {
    return `postgresql://asa:asa@localhost:5432/${qualityDatabaseName()}`;
  }
}

function psql(adminUrl: string, args: string[]): string {
  try {
    return execFileSync("psql", [adminUrl, "-v", "ON_ERROR_STOP=1", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    failEnv(`psql failed: ${detail}`);
  }
}

/**
 * Create the Node quality DB if missing and run Prisma migrate deploy.
 * Never drops or truncates the `asa` development database.
 */
export async function ensureQualityDatabase(): Promise<string> {
  const name = qualityDatabaseName();
  if (PROTECTED_DB_NAMES.has(name)) {
    failEnv(`refusing to use protected database name "${name}"`);
  }

  const adminUrl = resolveAdminDatabaseUrl();
  const existing = psql(adminUrl, [
    "-tAc",
    `SELECT 1 FROM pg_database WHERE datname = '${name.replace(/'/g, "''")}'`,
  ]).trim();

  if (existing !== "1") {
    try {
      psql(adminUrl, ["-c", `CREATE DATABASE "${name}"`]);
    } catch (error) {
      const again = psql(adminUrl, [
        "-tAc",
        `SELECT 1 FROM pg_database WHERE datname = '${name.replace(/'/g, "''")}'`,
      ]).trim();
      if (again !== "1") {
        throw error;
      }
    }
  }

  const qualityUrl = resolveQualityDatabaseUrl();
  if (qualityUrl.includes("/asa?") || qualityUrl.endsWith("/asa")) {
    failEnv("refusing to point quality tests at the asa database");
  }

  writeEnv("DATABASE_URL", qualityUrl);

  const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  try {
    execFileSync(path.join(apiRoot, "node_modules/prisma/build/index.js"), ["migrate", "deploy"], {
      cwd: apiRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: qualityUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    failEnv(`prisma migrate deploy failed: ${detail}`);
  }

  return qualityUrl;
}
