import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateLocales, writeLocaleStubs } from "./locales.js";
import type { GenerateOptions } from "./options.js";
import { resolveTemplatesRoot } from "./paths.js";

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, {
    recursive: true,
    filter: (source) => {
      const base = source.split("/").pop() ?? "";
      return ![
        "node_modules",
        "dist",
        ".turbo",
        ".turbo-out",
        "coverage",
        ".venv",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        ".env",
      ].includes(base);
    },
  });
}

/** Consumer apps are not the generator monorepo — drop generator-only CI. */
function rewriteGithubCi(targetDir: string, backend: GenerateOptions["backend"]): void {
  const path = join(targetDir, ".github", "workflows", "ci.yml");
  if (!existsSync(path)) return;

  let yaml = readFileSync(path, "utf8");
  yaml = yaml.replace(/\n {2}generator:[\s\S]*?(?=\n {2}[a-zA-Z]|$)/, "\n");
  yaml = yaml.replace(
    /\n {6}- name: Templates in sync with working tree\n {8}run: pnpm templates:check\n/,
    "\n",
  );
  if (backend === "node") {
    yaml = yaml.replace(/\n {2}python-api:[\s\S]*$/, "\n");
  }
  writeFileSync(path, yaml.endsWith("\n") ? yaml : `${yaml}\n`);
}

function rewriteRootPackageJson(targetDir: string, options: GenerateOptions): void {
  const path = join(targetDir, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  pkg.name = options.name;

  const dropScripts = new Set(["templates:sync", "templates:check", "create-app"]);
  const checkScriptKey = "check";
  const scripts = Object.fromEntries(
    Object.entries(pkg.scripts ?? {}).filter(([key]) => !dropScripts.has(key)),
  );

  if (options.backend === "node") {
    scripts["check:contracts"] =
      "pnpm contracts:schema && git diff --exit-code packages/contracts/schemas/contracts.json";
    scripts[checkScriptKey] =
      "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:a11y && pnpm build && pnpm check:contracts";
  } else {
    scripts["check:contracts"] =
      "pnpm contracts:schema && git diff --exit-code packages/contracts/schemas/contracts.json && pnpm --filter @repo/api-python schema:sync";
    scripts[checkScriptKey] =
      "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:a11y && pnpm build && pnpm check:contracts";
  }

  pkg.scripts = scripts;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

/** Generated apps are single-backend — drop dual-track and generator-repo instructions. */
function rewriteAgentsMd(targetDir: string, backend: GenerateOptions["backend"]): void {
  const path = join(targetDir, "AGENTS.md");
  if (!existsSync(path)) return;

  const apiTrack = backend === "node" ? "`apps/api` (Fastify)" : "`apps/api-python` (FastAPI)";

  const body = `# Agent notes

This generated app follows \`.cursor/rules/\` (especially **fail-rubric**).

**Backend:** single track only — ${apiTrack}. There is no second API to keep in parity.

## Subagents (\`.cursor/agents/\`)

Use the project agents for parallel work: \`frontend\`, \`backend\`, \`testing\`, plus extras (\`contracts\`, \`auth-security\`, \`i18n\`, \`ci-quality\`, \`reviewer\`) as needed.

Prefer:

1. Contracts first (\`@repo/contracts\`) for API/error changes
2. i18n keys for UI; httpOnly cookies for auth
3. Keep \`pnpm check\` green
4. Run the API on \`API_PORT\` (web proxies \`/api\`)

See README for setup. This app does not include the \`create-app\` generator or template-sync tooling.
`;

  writeFileSync(path, `${body}\n`);
}

/** Generated apps include one API track — rewrite backend rule to match. */
function rewriteBackendRule(targetDir: string, backend: GenerateOptions["backend"]): void {
  const path = join(targetDir, ".cursor", "rules", "backend.mdc");
  if (!existsSync(path)) return;

  const isNode = backend === "node";
  const trackLabel = isNode ? "Fastify (`apps/api`)" : "FastAPI (`apps/api-python`)";
  const globs = isNode ? "apps/api/**/*.{ts,js}" : "apps/api-python/**/*.py";
  const stackHint = isNode ? "Prisma" : "SQLModel";

  const body = `---
description: Backend modular layers for ${isNode ? "Fastify" : "FastAPI"}
globs: ${globs}
alwaysApply: false
---

# Backend module layers

This generated app has **one** API track: ${trackLabel}. Dual-backend parity does not apply.

Keep layers separate for non-trivial modules:

1. **router** — HTTP wiring, status codes, cookies, rate-limit annotations
2. **controller/handlers** — parse input, call service, map response (thin)
3. **service** — business logic (auth, hashing, token issue, idempotency)
4. **model/store** — persistence adapters (${stackHint})

Trivial one-liner handlers may call a service directly; do not invent empty controller files for ceremony.

## API surface

- All routes under \`/api/v1/...\`
- Shared behavior: health, auth register/login/logout/refresh/me
- Emit \`x-request-id\`; redact secrets in logs
- Global rate limit + stricter limits on login/register
- Helmet/CSP security headers on responses

Stay aligned with \`@repo/contracts\`. Prefer updating contracts first, then this API track.
`;

  writeFileSync(path, `${body}\n`);
}

function writeProjectReadme(targetDir: string, options: GenerateOptions): void {
  const apiLabel =
    options.backend === "node" ? "Fastify (`apps/api`)" : "FastAPI (`apps/api-python`)";
  const apiDev =
    options.backend === "node"
      ? "pnpm --filter @repo/api db:migrate\npnpm --filter @repo/api dev"
      : "pnpm --filter @repo/api-python db:migrate\npnpm --filter @repo/api-python dev";

  const body = `# ${options.name}

Generated from [app-start-architecture](https://github.com/M-WRI/create-app-start) templates.

- **Backend:** ${apiLabel}
- **Default locale:** \`${options.defaultLocale}\`${
    options.extraLocales.length
      ? `\n- **Extra locales:** ${options.extraLocales.map((l) => `\`${l}\``).join(", ")}`
      : ""
  }
- **Deploy preference:** \`${options.deploy}\`

## Setup

\`\`\`bash
cp .env.example .env
pnpm install
# Postgres: docker compose up -d
${apiDev}
pnpm --filter @repo/web dev
\`\`\`

Same-origin cookies: the web app proxies \`/api\` → the API on port \`API_PORT\` (default 3000).

See \`docs/deploy.md\` for ${options.deploy} notes.
`;

  writeFileSync(join(targetDir, "README.md"), body);
}

function writeScaffoldMeta(targetDir: string, options: GenerateOptions): void {
  writeFileSync(
    join(targetDir, ".asa-scaffold.json"),
    `${JSON.stringify(
      {
        name: options.name,
        backend: options.backend,
        defaultLocale: options.defaultLocale,
        extraLocales: options.extraLocales,
        deploy: options.deploy,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

export type GenerateResult = {
  targetDir: string;
  backendAppDir: string;
};

export function generateApp(
  options: GenerateOptions,
  templatesRoot = resolveTemplatesRoot(),
): GenerateResult {
  if (existsSync(options.targetDir)) {
    throw new Error(`Target directory already exists: ${options.targetDir}`);
  }

  // Fail fast on locales before any copy — no partial project on invalid tags
  const defaultLocale = validateLocales([options.defaultLocale])[0] ?? "en";
  const extraLocales = validateLocales(options.extraLocales);

  const base = join(templatesRoot, "base");
  const web = join(templatesRoot, "web");
  const apiTemplate =
    options.backend === "node"
      ? join(templatesRoot, "api-node")
      : join(templatesRoot, "api-python");

  for (const required of [base, web, apiTemplate]) {
    if (!existsSync(required)) {
      throw new Error(`Missing template: ${required}`);
    }
  }

  const normalizedOptions: GenerateOptions = {
    ...options,
    defaultLocale,
    extraLocales,
  };

  mkdirSync(options.targetDir, { recursive: true });
  try {
    copyDir(base, options.targetDir);
    copyDir(web, join(options.targetDir, "apps", "web"));

    const backendAppDir =
      options.backend === "node"
        ? join(options.targetDir, "apps", "api")
        : join(options.targetDir, "apps", "api-python");
    copyDir(apiTemplate, backendAppDir);

    // Drop the unused API Dockerfile companion is fine to leave; prune meta-only scripts.
    rewriteRootPackageJson(options.targetDir, normalizedOptions);
    rewriteGithubCi(options.targetDir, normalizedOptions.backend);
    rewriteAgentsMd(options.targetDir, normalizedOptions.backend);
    rewriteBackendRule(options.targetDir, normalizedOptions.backend);
    writeProjectReadme(options.targetDir, normalizedOptions);
    writeScaffoldMeta(options.targetDir, normalizedOptions);

    writeLocaleStubs({
      i18nLocalesDir: join(options.targetDir, "packages", "i18n", "src", "locales"),
      defaultLocale: normalizedOptions.defaultLocale,
      extraLocales: normalizedOptions.extraLocales,
    });

    // Ensure .env.example exists (from base)
    if (!existsSync(join(options.targetDir, ".env.example"))) {
      throw new Error("Generated project is missing .env.example");
    }

    return { targetDir: options.targetDir, backendAppDir };
  } catch (error) {
    rmSync(options.targetDir, { recursive: true, force: true });
    throw error;
  }
}
