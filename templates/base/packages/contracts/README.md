# @repo/contracts

Shared API contracts for FE and both backends (Zod is the source of truth).

## Includes

- **ApiError** — `{ status, errorMessage, errorCode, errorKey }`
- **Error catalog** — stable `ERROR_CODES` + i18n `ERROR_KEYS`
- **Auth DTOs** — register / login / session / me
- **RBAC** — `user` | `admin` + `hasRequiredRole`
- **Idempotency** — `Idempotency-Key` header helpers

## JSON Schema

Build exports [`schemas/contracts.json`](./schemas/contracts.json) for Python/Pydantic sync (CI contract check in later steps).

```bash
pnpm --filter @repo/contracts build
```

## Coverage

Tests must stay ≥ **80%** lines/functions/branches/statements (`vitest --coverage`).
