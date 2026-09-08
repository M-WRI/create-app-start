# Agent notes

This monorepo is the **known-good** starter before templates/CLI.

Follow `.cursor/rules/` especially **fail-rubric** (always on).

## Subagents (`.cursor/agents/`)

One purpose each. Prefer launching **in parallel** only when file ownership does not overlap.

### Core parallel set

| Agent | Purpose |
|-------|---------|
| `frontend` | `apps/web`, `@repo/ui`, auth UI |
| `backend` | One API track (`apps/api` *or* `apps/api-python`) |
| `testing` | Vitest/pytest, coverage floors, axe |

### Strong extras

| Agent | Purpose |
|-------|---------|
| `contracts` | `@repo/contracts`, ApiError, schema — usually **first** |
| `auth-security` | Cookie auth, RBAC, Idempotency-Key end-to-end |
| `i18n` | `@repo/i18n` catalogs + `errorKey` copy |
| `dual-backend` | Mirror Fastify ↔ FastAPI after one track changes |
| `ci-quality` | CI workflows, `pnpm check` / templates gates |
| `reviewer` | Fail-rubric audit before merge |

### Suggested orchestration

1. **contracts** (serial) if API/error shape changes  
2. **frontend** ∥ **backend** (and **i18n** / **auth-security** if that is the slice)  
3. **dual-backend** if the other API track must match  
4. **testing**  
5. **reviewer** (and **ci-quality** only for tooling/CI)

Prefer:

1. Contracts first (`@repo/contracts`) for API/error changes  
2. Mirror behavior on **both** `apps/api` and `apps/api-python` when changing auth/health  
3. i18n keys for UI; httpOnly cookies for auth  
4. Keep `pnpm check` and the Python package scripts green  
5. Scaffold apps with `pnpm create-app` (uses `INIT_CWD` so the project lands where you ran the command); published CLI is `npx create-app-start@latest`

Local APIs share Postgres schema; run one backend at a time on `API_PORT`.

After changing apps/packages/root config, run `pnpm templates:sync` so `templates/` stay aligned (`pnpm templates:check` / CI enforce this). Do not nest scaffolds under `packages/create-app/`.
