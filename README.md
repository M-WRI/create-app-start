# App Start Architecture

Production-minded monorepo starter **and** app generator: Vite React web, dual backends (Fastify + FastAPI), shared contracts/UI/auth/i18n, CI quality gates toward ~9/10.

## Prerequisites

- Node.js **22+** (`.nvmrc`)
- **pnpm** 9: `corepack enable && corepack prepare pnpm@9.15.9 --activate`
- **Postgres** (Docker Compose, Homebrew, or hosted)
- **uv** + Python 3.12 only if you pick the FastAPI track (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

---

## Create an app (`npx`)

```bash
npx create-app-start@latest my-app
# Non-interactive:
npx create-app-start@latest my-app --backend node --locales de --deploy paas --yes
```

Then:

```bash
cd my-app
cp .env.example .env
pnpm install
docker compose up -d    # Postgres (or point DATABASE_URL elsewhere)
# Node track:
pnpm --filter @repo/api db:migrate && pnpm --filter @repo/api dev
# Web:
pnpm --filter @repo/web dev
```

| Flag | Values | Default |
|------|--------|---------|
| (name) | kebab-case project folder | prompted |
| `--backend` | `node` \| `fastapi` | prompted |
| `--locale` | default locale | `en` |
| `--locales` | extra locales, comma-separated | none |
| `--deploy` | `paas` \| `docker-compose` \| `ci-only` | prompted / `paas` with `--yes` |
| `--yes` | skip prompts (needs name + `--backend`) | off |
| `--outDir` | parent directory for the project | cwd |

---

## Clone path (contribute / customize templates)

Use this repo as the **generator**. Scaffold into a sibling folder (keeps this monorepo as template source):

```bash
git clone <this-repo-url> app-start-architecture
cd app-start-architecture
pnpm install

# Interactive wizard (creates ./<name> under the directory you run from)
pnpm create-app

# Or non-interactive
pnpm create-app -- my-app --backend node --locales de --deploy paas --yes
```

Default `--outDir` is the cwd where you ran `pnpm create-app` (`INIT_CWD`).

---

## Develop this monorepo (templates source)

```bash
cp .env.example .env
# Postgres: docker compose up -d   OR   brew services start postgresql@16
pnpm install
pnpm --filter @repo/api db:migrate   # Prisma (Node track)
pnpm check                           # full quality gate
```

Run **one** API on `:3000` (web proxies `/api` → that origin — same-origin cookies):

```bash
# Node
pnpm --filter @repo/api dev

# OR Python (stamp if Prisma already migrated the schema)
pnpm --filter @repo/api-python db:stamp
pnpm --filter @repo/api-python dev

# Web
pnpm --filter @repo/web dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3000` (`GET /api/v1/health`)

After changing apps/packages/root config: `pnpm templates:sync` (CI runs `templates:check`).

## Apps & packages

| Path | Role |
|------|------|
| `apps/web` | Vite React SPA — auth routes, CSP, no prod sourcemaps, `/api` proxy |
| `apps/api` | Fastify + Prisma + Postgres |
| `apps/api-python` | FastAPI + SQLModel + Alembic (behavior mirror) |
| `packages/contracts` | ApiError, auth/RBAC DTOs, JSON Schema |
| `packages/ui` | Tokens + seed atoms |
| `packages/i18n` | Auth/error catalogs |
| `packages/auth` | Cookie client, forms, guards, axe smoke |
| `packages/create-app` | Published as `create-app-start` (`npx` / `pnpm create-app`) |
| `templates/*` | Folded copies for the generator |

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm create-app` | Wizard / flags → new app from `templates/` |
| `pnpm check` | format + lint + typecheck + test + axe + build + contract + templates |
| `pnpm templates:sync` / `templates:check` | Rewrite / verify `templates/` vs working tree |
| `pnpm test:a11y` | axe smoke on auth forms |
| `pnpm check:contracts` | Zod→JSON Schema drift + Python schema sync |
| `pnpm format` / `lint` / `typecheck` / `test` / `build` | Turbo pipelines |

## Quality gates (toward ~9)

CI (`.github/workflows/ci.yml`):

1. Biome format + ESLint (a11y/boundaries) + typecheck  
2. Vitest with **coverage floors** (contracts/auth **≥80%**; API auth/health floors)  
3. **axe** smoke on auth forms  
4. Build (web **without** public sourcemaps)  
5. **Contract** JSON Schema up to date  
6. **Templates** in sync with the working tree  
7. **Generator smoke** — `create-app` for `node` and `fastapi` → install / lint / typecheck / test / build  
8. Python job: Ruff + mypy + pytest (**80%** floor) + schema sync  

Cursor rules in `.cursor/rules/` encode FE/BE placement, ApiError, auth cookies, i18n keys, and an explicit **fail rubric**.

## Security defaults

- httpOnly access/refresh cookies — never JS token storage  
- Same-origin `/api` proxy (dev + prod reverse-proxy pattern)  
- `/api/v1` only; request-id; auth rate limits; Idempotency-Key on register  
- RBAC roles `user` \| `admin` (`RequireAuth` / `requireRole`)  
- Secrets only via env (see `.env.example`)

## Deploy

See [`docs/deploy.md`](docs/deploy.md) for PaaS / docker-compose / ci-only and same-origin `/api` wiring.

## Publish the CLI

From the monorepo (after `pnpm templates:sync`):

```bash
pnpm --filter create-app-start pack   # dry-run tarball with bundled templates
npm login
pnpm --filter create-app-start publish --access public
```

`prepack` builds the CLI and copies `templates/` into the package.
