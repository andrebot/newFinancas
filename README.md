# Finance APP

A household finance application: personal and shared budgeting, expense
tracking, and investment / net-worth tracking for Brazil (BRL, primary)
and the US (USD). Several people share one household, each with their own
role, and manage both shared and personal money — mainly through manual
entry. Open Banking sync is planned for v2.

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
