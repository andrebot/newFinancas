# Finance APP

A household finance application: personal and shared budgeting, expense
tracking, and investment / net-worth tracking for Brazil (BRL, primary)
and the US (USD). Several people share one household, each with their own
role, and manage both shared and personal money — mainly through manual
entry. Open Banking sync is planned for v2.

## Getting started

Requires Node 24.10+ (`.nvmrc`), pnpm (`corepack enable pnpm`) and Docker.

```sh
pnpm install        # also installs the git hooks (husky)
cp .env.example .env
pnpm db:up          # Postgres 18 on 127.0.0.1:5432 (db:down, db:reset, db:psql)
pnpm --filter @financas/api db:migrate   # apply migrations (db:generate after schema changes)
pnpm db:backup       # back up the database (restore + drill: docs/operations/backup-restore.md)
pnpm dev            # api on :3000, web on :5173
pnpm check          # lint + typecheck + API contract + unit + integration, 100% coverage gate
pnpm generate:api   # regenerate types + Zod from docs/architecture/api/openapi.yaml
pnpm test:smoke     # Playwright @smoke
pnpm test:e2e:core  # Playwright @core (Core E2E)
pnpm test:e2e       # every Playwright test (Full E2E)
```

Git hook: **pre-commit** runs `pnpm check`, including the schema checks
on an embedded Postgres (PGlite), so no database needs to be running.
E2E (`test:smoke` and the rest) needs `pnpm db:up`; it resets and
migrates the `financas_test` database before each run.
GitHub Actions runs `check` and smoke on every PR (both required to
merge), plus Core E2E after a merge to `main` (OQ-91).

Playwright needs a browser: `pnpm exec playwright install chromium`, or
point it at a local one (fish: `set -Ux PLAYWRIGHT_CHROMIUM_PATH /usr/bin/chromium`).

## Documentation

Start with the [documentation overview](docs/README.md) — status, design
method, stack and how everything fits together.

| Area | Where |
|---|---|
| Requirements | [docs/requirements/](docs/requirements/00-overview.md) |
| Backend architecture (VBD) | [docs/architecture/backend/01-vbd-decomposition.md](docs/architecture/backend/01-vbd-decomposition.md) |
| Frontend architecture (EBD) | [docs/architecture/frontend/01-ebd-decomposition.md](docs/architecture/frontend/01-ebd-decomposition.md) |
| Data model | [docs/architecture/02-data-model.md](docs/architecture/02-data-model.md) |
| API (OpenAPI v1.1.0) | [docs/architecture/api/openapi.yaml](docs/architecture/api/openapi.yaml) · [design notes](docs/architecture/03-api-design.md) |
| Test strategy (BDT) | [docs/architecture/04-bdt-test-plan.md](docs/architecture/04-bdt-test-plan.md) |
| UI design (mockups) | [docs/design/mockups/](docs/design/mockups/README.md) — open `index.html` to browse the 34 pages |
| Diagrams | [docs/design/diagrams/](docs/design/diagrams/) — use cases, call chains, sequences, EBD tiers, ERD |

## Planning

Implementation follows a dependency-ordered checklist, one task at a time:

- [Execution order — the task checklist](docs/planning/03-pd-execution-order.md) (tick tasks here)
- [Activity list](docs/planning/01-pd-activity-list.md)
- [Dependency network](docs/planning/02-pd-dependency-network.md)
