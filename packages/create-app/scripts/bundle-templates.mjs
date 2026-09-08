#!/usr/bin/env node
/**
 * Copy monorepo templates/ into this package for npm publish / npx.
 * Source of truth remains repo-root templates/ (pnpm templates:sync).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pkgRoot, "../..");
const src = join(repoRoot, "templates");
const dest = join(pkgRoot, "templates");

if (!existsSync(join(src, "base", "package.json"))) {
  console.error(`Missing templates at ${src}. Run from the monorepo after pnpm templates:sync.`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

const result = spawnSync(
  "rsync",
  [
    "-a",
    "--delete",
    "--exclude",
    "node_modules",
    "--exclude",
    "dist",
    "--exclude",
    ".turbo",
    "--exclude",
    ".turbo-out",
    "--exclude",
    "coverage",
    "--exclude",
    ".venv",
    "--exclude",
    "__pycache__",
    `${src}/`,
    `${dest}/`,
  ],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  console.error("Failed to bundle templates");
  process.exit(result.status ?? 1);
}

console.log(`Bundled templates → ${dest}`);
