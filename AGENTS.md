# Agent notes

This monorepo is the **known-good** starter before templates/CLI.

Follow `.cursor/rules/` especially **fail-rubric** (always on).

## Subagents (`.cursor/agents/`)

Use the project agents for parallel work: `frontend`, `backend`, `testing`, plus extras (`contracts`, `auth-security`, `i18n`, `dual-backend`, `ci-quality`, `reviewer`) as needed.

Prefer:

1. Contracts first (`@repo/contracts`) for API/error changes
2. Frontend ∥ backend once contracts are stable
3. `dual-backend` after one API track changes and the other must match
4. i18n keys for UI; httpOnly cookies for auth
5. Keep `pnpm check`, `pnpm --filter @repo/api-python test`, and template/generator checks green
6. Scaffold apps with `pnpm create-readyframe` (uses `INIT_CWD` so the project lands where you ran the command); published CLI is `npx create-readyframe@latest`

Architecture overview (contracts-first modular monolith, layers, dual tracks): [`docs/architecture.md`](docs/architecture.md).

## Cross-boundary notes

- **Contracts first:** new `errorCode` / `errorKey` / DTOs land in `@repo/contracts` (+ schema export) before API or UI consume them
- **Dual-backend parity:** auth, health, shared error handling, and route behavior must stay aligned between `apps/api` and `apps/api-python`
- **Session cache isolation:** on login/logout/refresh identity change, clear prior-account React Query caches so private data cannot leak across users
- **Destructive operations:** destructive bulk actions must confirm intent and stay aligned with API ownership/authz; no silent mass deletes
- **Domain invariants:** register creates a personal workspace with `lead_owner` membership; keep service + DB tests honest about that
- **List pagination:** bounded list APIs must expose continuation (`nextCursor`) and clients that need complete datasets must walk until it is null. Multi-page walks are eventually consistent under concurrent writes; never treat a truncated page as complete export data

Local APIs share Postgres schema; run one backend at a time on `API_PORT`.

After changing apps/packages/root config, run `pnpm templates:sync` so `templates/` stay aligned (`pnpm templates:check` / CI enforce this). Do not nest scaffolds under `packages/create-readyframe/`.
