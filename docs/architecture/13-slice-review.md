# Slice review — the gate at the end of every slice

**Stakeholder decision (Oct 2026, OQ-164):** every slice ends with this
review, before the next slice's first task. It is a task in the plan
(`docs/planning/03-pd-execution-order.md`, the `R<n>` items). The first one,
for slice 1, is `12-code-review-2026-10.md`; each later review gets its own
file, `<nn>-slice-<n>-review.md`, with the same sections.

Coverage is already at 100%; the review asks whether the tests actually
check the logic, whether the end-to-end journeys prove what they claim, and
whether the architecture still keeps its boundaries.

## How it runs

- **Three phases, one at a time.** The stakeholder confirms each before the
  next.
- **Findings first.** Each phase writes its findings into the slice's review
  doc (where, why it matters, proposed fix) and shows them before any fix.
  Decisions the findings need are asked, then logged in the OQ list.
- **Fixes after.** One commit per finding group, and one PR per phase. Each
  PR is verified the same way the finding was found: a mutation rerun, a
  repeated E2E run, the import check.
- **Plain language.** Findings are shown to the stakeholder as "what could
  break and nobody would notice", not as mutant ids.

## Phase 1 — are the tests meaningful? (mutation testing)

- **Backend:** `pnpm mutation:api`. StrykerJS with the command runner, the
  whole API suite per mutant, 4 workers, about 30 minutes.
- **Web and packages:** `pnpm mutation:web`. One Stryker run per web source
  file over `vitest related <file>`, then each package over its own suite;
  6 workers, about 50 minutes. Reports go to the git-ignored
  `reports/mutation/` folder.
- **Only the slice.** `BASE=<ref>` (the merge that closed the previous
  review) limits either run to what changed since: added files whole,
  changed files on their changed lines. Slice 2's whole API was ~4 hours.
- **Safety.** `scripts/mutation.sh` stops Stryker when available memory
  drops under 6 GB. Never run more workers than the config says: 16
  workers once crashed the machine. `@stryker-mutator/vitest-runner` is not
  used; it reports false survivors under Vitest 5.
- **Triage every survivor** as one of:
  - a **gap** — a real test to add;
  - **equivalent** — it can't change behaviour;
  - **defensive** — a guard for inputs the system can't produce;
  - **not worth a test** — styling, log text, never-displayed messages, demo
    data;
  - **deferred** — code the next slices exercise.
- **Before calling something a gap or a tooling fault:** read the mutant's
  exact span (a `true` on `a && b` may replace only `a`), and hand-apply a
  doubtful one and run its test.
- **Verify the fixes** with a second run: the gap mutants killed, none new.

## Phase 2 — the Playwright suite

- **Read every spec and helper.** Check that each journey asserts an end
  state, preferably through the API (the thing really changed), and that the
  journeys sit at the right BDT tier: smoke, core or full.
- **Run it repeatedly**, e.g. 3× and 10× in a row with `--repeat-each`. A
  journey that fails once in a hundred runs is either a flaky test or a real
  race; find out which. Phase 2 of slice 1 found a real bug this way
  (OQ-162).
- **Check the CI cadence** (`ci.yml`, `nightly.yml`) runs every tier the BDT
  plan promises, and that the BDT plan's smoke and core lists for the slice
  are written.
- Locally: `pnpm db:up`, and `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium`
  when Playwright's own browser isn't installed.

## Phase 3 — code and architecture (Harmonic Design)

- **The `harmonic-review` skill** runs over the slice's code.
- **Extract the import graph per layer** and read every cross-boundary edge:
  - VBD: no Engine → Engine, no Accessor → Accessor at runtime, routes call
    only Managers;
  - EBD: only Experiences call the backend (ESLint enforces it), no Flow →
    sibling Flow, no Experience → another Experience's pieces without an OQ.
- **Check mock discipline:** each test mocks only the tier directly below.
- **Check the plan against the code.** The slice's checklist is complete,
  and no screen calls an endpoint the API doesn't serve (the contract-routes
  test, OQ-163: when a slice lands an area, take it off that test's plan
  list).
- **Carry-overs.** Security or design questions earlier phases raised are
  decided here.

## Closing

- The review doc's status says complete, with the PRs.
- What stays open is listed there and, if it is work, added to the plan.
- The next slice starts.
