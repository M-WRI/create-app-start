# Templates

Frozen copies of the known-good monorepo trees for the generator (Step 11+).

| Template | Source | Generator maps to |
|----------|--------|-------------------|
| `base/` | Root workspace + `packages/` + CI + Cursor rules + docker/docs | project root |
| `web/` | `apps/web` | `apps/web` |
| `api-node/` | `apps/api` | `apps/api` |
| `api-python/` | `apps/api-python` | `apps/api-python` |

**Source of truth** is still the working monorepo (`apps/`, `packages/`, root config). Sync before releasing the CLI:

```bash
pnpm templates:sync    # rewrite templates/ from the working tree
pnpm templates:check   # fail if templates drifted (CI)
```
