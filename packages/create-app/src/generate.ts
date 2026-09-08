import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeLocaleStubs } from "./locales.js";
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
  yaml = yaml.replace(
    /\n {2}generator:[\s\S]*?(?=\n {2}[a-zA-Z]|$)/,
    "\n",
  );
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

  const scripts = { ...(pkg.scripts ?? {}) };
  delete scripts["templates:sync"];
  delete scripts["templates:check"];
  delete scripts["create-app"];

  if (options.backend === "node") {
    scripts["check:contracts"] =
      "pnpm contracts:schema && git diff --exit-code packages/contracts/schemas/contracts.json";
    scripts["check"] =
      "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:a11y && pnpm build && pnpm check:contracts";
  } else {
    scripts["check:contracts"] =
      "pnpm contracts:schema && git diff --exit-code packages/contracts/schemas/contracts.json && pnpm --filter @repo/api-python schema:sync";
    scripts["check"] =
      "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:a11y && pnpm build && pnpm check:contracts";
  }

  pkg.scripts = scripts;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

function writeProjectReadme(targetDir: string, options: GenerateOptions): void {
  const apiLabel = options.backend === "node" ? "Fastify (`apps/api`)" : "FastAPI (`apps/api-python`)";
  const apiDev =
    options.backend === "node"
      ? "pnpm --filter @repo/api db:migrate\npnpm --filter @repo/api dev"
      : "pnpm --filter @repo/api-python db:migrate\npnpm --filter @repo/api-python dev";

  const body = `# ${options.name}

Generated from [app-start-architecture](https://github.com/) templates.

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
    rewriteRootPackageJson(options.targetDir, options);
    rewriteGithubCi(options.targetDir, options.backend);
    writeProjectReadme(options.targetDir, options);
    writeScaffoldMeta(options.targetDir, options);

    writeLocaleStubs({
      i18nLocalesDir: join(options.targetDir, "packages", "i18n", "src", "locales"),
      defaultLocale: options.defaultLocale,
      extraLocales: options.extraLocales,
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
