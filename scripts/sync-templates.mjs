#!/usr/bin/env node
/**
 * Sync working monorepo trees → templates/* (source of truth = apps/ + packages/ + root).
 * Usage:
 *   node scripts/sync-templates.mjs          # write templates
 *   node scripts/sync-templates.mjs --check  # exit 1 if templates drift
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkOnly = process.argv.includes("--check");

const excludes = [
  "node_modules",
  "dist",
  ".turbo",
  ".turbo-out",
  "coverage",
  ".coverage",
  ".coverage.*",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  "*.egg-info",
  ".DS_Store",
  "*.log",
  ".env",
  ".env.local",
  ".env.*.local",
];

function rsync(src, dest, extraExcludes = []) {
  mkdirSync(dest, { recursive: true });
  const args = ["-a", "--delete"];
  for (const pattern of [...excludes, ...extraExcludes]) {
    args.push("--exclude", pattern);
  }
  args.push(`${src}/`, `${dest}/`);
  const result = spawnSync("rsync", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`rsync failed: ${src} → ${dest}`);
  }
}

function syncInto(destRoot) {
  const base = join(destRoot, "base");
  mkdirSync(base, { recursive: true });

  const rootFiles = [
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "turbo.json",
    "biome.json",
    "ruff.toml",
    "tsconfig.json",
    ".nvmrc",
    ".gitignore",
    ".env.example",
    "AGENTS.md",
    "docker-compose.yml",
    "docker-compose.prod.yml",
  ];

  for (const file of rootFiles) {
    const from = join(root, file);
    if (!existsSync(from)) continue;
    const result = spawnSync("rsync", ["-a", from, join(base, file)], { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`failed copying ${file}`);
  }

  rsync(join(root, ".github"), join(base, ".github"));
  rsync(join(root, ".cursor"), join(base, ".cursor"));
  rsync(join(root, "docker"), join(base, "docker"));
  rsync(join(root, "docs"), join(base, "docs"));
  rsync(join(root, "packages"), join(base, "packages"), ["create-readyframe"]);

  // Generated apps land under apps/ — templates carry only the app trees.
  rsync(join(root, "apps/web"), join(destRoot, "web"));
  rsync(join(root, "apps/api"), join(destRoot, "api-node"));
  rsync(join(root, "apps/api-python"), join(destRoot, "api-python"));
}

function main() {
  if (checkOnly) {
    const staging = mkdtempSync(join(tmpdir(), "readyframe-templates-"));
    try {
      syncInto(staging);
      const diff = spawnSync(
        "diff",
        ["-ru", "--exclude=.DS_Store", "--exclude=README.md", join(root, "templates"), staging],
        { encoding: "utf8" },
      );
      if (diff.status === 0) {
        console.log("templates/ are in sync with the working monorepo.");
        return;
      }
      console.error("templates/ are out of sync. Diff:\n");
      console.error(diff.stdout || diff.stderr);
      console.error("\nRun: pnpm templates:sync");
      process.exit(1);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }

  const templatesRoot = join(root, "templates");
  mkdirSync(templatesRoot, { recursive: true });
  syncInto(templatesRoot);
  console.log("Synced templates/base, templates/web, templates/api-node, templates/api-python");
}

main();
