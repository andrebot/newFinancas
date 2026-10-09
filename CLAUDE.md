# CLAUDE.md — Finance APP

Household finance app (budgeting, expense tracking, investments / net
worth; BRL + USD). Overview in `README.md`; full status, method and stack
in `docs/README.md`.

## Where things are

- `docs/requirements/` — FRs, NFRs, glossary, open questions (OQ-n = decisions).
- `docs/architecture/` — VBD (`backend/`), EBD (`frontend/`), data model,
  API (`api/openapi.yaml` is the contract), BDT test plan, review logs.
- `docs/design/mockups/` — approved UI, the visual reference for every
  screen; `README.md` there holds the design system and tokens.
- `docs/design/diagrams/` — generated HTML diagrams. Never hand-edit:
  change the generator in `scripts/` and rerun it.
- `docs/planning/03-pd-execution-order.md` — **the task checklist**.

## How we work

- One task at a time, in checklist order; tick the task there when done.
  No effort estimates or schedules.
- Each task: detail design first → ask only the questions that block it →
  implement → tests → tick. If a step raises no questions, continue
  without waiting for approval.
- When code and docs disagree, raise it — don't silently diverge. Record
  new decisions in the docs (OQ list / relevant architecture doc).

## Code rules

- TypeScript everywhere; purely functional — no classes.
- Every function documented; every function unit-tested (100% coverage).
  Exception: tooling config files (`eslint.config.js`, `*.config.ts`) —
  documented but not unit-tested (OQ-91).
- Cyclomatic complexity ≤ 7; at most 7 parameters per function.
- Tests live outside `src/`, never co-located.
- Configuration (OQ-101): env vars and secrets in `config/env.ts`; fixed,
  tunable settings in `config/constants.ts`, grouped by area — never as
  loose constants inside a module. Algorithm-intrinsic facts stay put.
- Test level follows the component's role (BDT): Engines/Flows unit,
  Accessors/Interactions translation-only unit, Managers/Experiences
  integration with the tier below mocked. Mocking more than the one
  boundary below is a design smell, not a tooling problem.
- Respect VBD/EBD call rules: only Experiences call the backend; Engines
  don't call Engines; Accessors don't call Accessors.
- Stack: React + Vite + Tailwind + own component kit (not MUI) + Redux
  Toolkit; Node + Hono + Drizzle + PostgreSQL; Winston; Vitest
  (+ Supertest), Playwright; ESLint Airbnb.

## Decisions easy to get wrong

- No automatic FX conversion anywhere; money is shown per currency
  (In/Out/Total uses a $ / R$ switch). Goals are the one scoped exception
  (manual FX input).
- UI says "Goals", never "Objectives". No recurring transactions.
- The Transactions ledger is NOT scoped by the period bar — it lists all
  transactions (lazy-loaded, month headers).
- Mockups show representative states; build the FULL forms from the
  requirements (e.g. every investment kind on Record Transaction).
- Locales pt-BR (primary) and en-US from day one; no hard-coded UI strings.
- Theming via CSS color variables (dark/light token sets) — seed table in
  `docs/design/mockups/source/themeify.py`.

## Design tooling

`.claude/skills/superdesign` + the git-ignored `.superdesign/` workspace
(canvas ids, drafts) are for editing designs on superdesign.dev via
`npx @superdesign/cli`. AI generation costs credits — ask first. After a
design change, re-export the page into `docs/design/mockups/pages/`.
