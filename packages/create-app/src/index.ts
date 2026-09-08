#!/usr/bin/env node
import { relative, resolve } from "node:path";
import * as p from "@clack/prompts";
import { defineCommand, runMain } from "citty";
import { generateApp } from "./generate.js";
import {
  type Backend,
  type DeployPreference,
  assertValidName,
  parseLocalesList,
} from "./options.js";

function cancelIfNeeded(value: unknown): asserts value is string {
  if (p.isCancel(value)) {
    p.cancel("Scaffold cancelled.");
    process.exit(0);
  }
}

/** pnpm often forwards a lone `--` before script args; citty treats it as end-of-flags. */
function normalizeArgv(argv: string[]): string[] {
  return argv.filter((arg, index) => !(arg === "--" && index >= 2));
}

const main = defineCommand({
  meta: {
    name: "create-app-start",
    description: "Scaffold a monorepo app from app-start-architecture templates",
  },
  args: {
    name: {
      type: "positional",
      description: "Project directory / package name",
      required: false,
    },
    backend: {
      type: "string",
      description: "Backend track: node | fastapi",
    },
    locale: {
      type: "string",
      description: "Default locale (default: en)",
      default: "en",
    },
    locales: {
      type: "string",
      description: "Extra locales, comma-separated (e.g. de,fr)",
    },
    deploy: {
      type: "string",
      description: "Deploy preference: paas | docker-compose | ci-only",
    },
    yes: {
      type: "boolean",
      description: "Non-interactive (requires name + --backend)",
      default: false,
    },
    outDir: {
      type: "string",
      description: "Parent directory for the project (default: cwd)",
    },
  },
  async run({ args }) {
    p.intro("create-app-start");

    let name = args.name ? assertValidName(String(args.name)) : "";
    let backend = (args.backend as Backend | undefined) ?? undefined;
    let deploy = (args.deploy as DeployPreference | undefined) ?? undefined;
    const defaultLocale = String(args.locale ?? "en").toLowerCase();
    let extraLocales = parseLocalesList(
      typeof args.locales === "string" ? args.locales : undefined,
    );

    const skipPrompts = Boolean(args.yes) || Boolean(name && backend);

    if (skipPrompts) {
      if (!name || !backend) {
        throw new Error("Non-interactive mode requires a name and --backend");
      }
      if (backend !== "node" && backend !== "fastapi") {
        throw new Error("--backend must be node or fastapi");
      }
      deploy = deploy ?? "paas";
    } else {
      if (!name) {
        const answered = await p.text({
          message: "Project name",
          placeholder: "my-app",
          validate: (value) => {
            try {
              assertValidName(value);
              return undefined;
            } catch (error) {
              return error instanceof Error ? error.message : "Invalid name";
            }
          },
        });
        cancelIfNeeded(answered);
        name = assertValidName(answered);
      }

      if (!backend) {
        const answered = await p.select({
          message: "Backend",
          options: [
            { value: "node", label: "Node (Fastify + Prisma)" },
            { value: "fastapi", label: "Python (FastAPI + SQLModel)" },
          ],
        });
        cancelIfNeeded(answered);
        backend = answered as Backend;
      }

      if (args.locales === undefined) {
        const answered = await p.text({
          message: "Extra locales (comma-separated, optional)",
          placeholder: "de,fr",
          defaultValue: "",
        });
        cancelIfNeeded(answered);
        extraLocales = parseLocalesList(answered);
      }

      if (!deploy) {
        const answered = await p.select({
          message: "Deploy preference",
          options: [
            { value: "paas", label: "PaaS (recommended)" },
            { value: "docker-compose", label: "Docker Compose on a VPS" },
            { value: "ci-only", label: "CI only (deploy later)" },
          ],
        });
        cancelIfNeeded(answered);
        deploy = answered as DeployPreference;
      }
    }

    const initCwdKey = "INIT_CWD";
    const parent = resolve(String(args.outDir ?? process.env[initCwdKey] ?? process.cwd()));
    const targetDir = resolve(parent, name);

    const spin = p.spinner();
    spin.start(`Scaffolding ${name}`);
    const result = generateApp({
      name,
      targetDir,
      backend: backend as Backend,
      defaultLocale,
      extraLocales,
      deploy: (deploy ?? "paas") as DeployPreference,
    });
    spin.stop(`Created ${result.targetDir}`);

    const cdPath = relative(parent, result.targetDir) || name;
    p.note(
      [
        `cd ${cdPath}`,
        "cp .env.example .env",
        "pnpm install",
        "docker compose up -d   # or other Postgres",
        backend === "node"
          ? "pnpm --filter @repo/api db:migrate && pnpm --filter @repo/api dev"
          : "pnpm --filter @repo/api-python db:migrate && pnpm --filter @repo/api-python dev",
        "pnpm --filter @repo/web dev",
      ].join("\n"),
      "Next steps",
    );
    p.outro("Done.");
  },
});

process.argv = normalizeArgv(process.argv);
runMain(main);
