# create-app-start

Scaffold a production-minded monorepo app (Vite React + Fastify or FastAPI) from the [create-app-start](https://github.com/M-WRI/create-app-start) templates.

## Usage

```bash
npx create-app-start@latest my-app
# or non-interactive:
npx create-app-start@latest my-app --backend node --locales de --deploy paas --yes
```

Requires **Node.js 22+**. After scaffold: `cp .env.example .env`, `pnpm install`, Postgres, then API + web `dev` scripts printed by the CLI.

## Flags

| Flag | Values | Default |
|------|--------|---------|
| (name) | kebab-case project folder | prompted |
| `--backend` | `node` \| `fastapi` | prompted |
| `--locale` | default locale | `en` |
| `--locales` | extra locales, comma-separated | none |
| `--deploy` | `paas` \| `docker-compose` \| `ci-only` | prompted / `paas` with `--yes` |
| `--yes` | skip prompts (needs name + `--backend`) | off |
| `--outDir` | parent directory for the project | cwd |

## Monorepo development

In the generator repo: `pnpm create-app` (uses live `templates/`). Publish packs a copy of `templates/` into this package via `prepack`; `postpack` removes that bundled copy so local lint stays clean (`templates/**` is also eslint-ignored).
