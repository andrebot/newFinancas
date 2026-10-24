# Slice review — slice 2, October 2026

The gate at the end of slice 2 (account setup: accounts, cards, categories,
budgets, goals and the guided onboarding wizard — tasks 67–98), run by the
method in `13-slice-review.md` (OQ-164). Work happens on the
`review/slice-2` branch, cut from `main` after PR #118 (`I8`).
**Status: in progress — phase 1.**

## Scope

- **Backend:** `U3` ValidationUtility; the Accessors `A5`, `A6`, `A9`–`A14`;
  `M2` AccountManager (PRs #85–#89); the routes under
  `/households/{householdId}`; the `I2` seam suite and `I5` pub/sub.
- **Web:** `FU6` FormattingUtility; the kit pieces `K7`–`K9`, `K15`, `K18`–`K20`,
  `K33`, `K42`, `K48`–`K50`; the Flows `FL6`, `FL11`–`FL14`; the
  Experience `X5` and Onboard's Guided Setup step (`X2G`).
- **E2E:** the `I8` journeys (`tests/e2e/accountSetup/`) and the default
  Categories checks added by `I5`.

## Carry-overs

- **`captureLogs` clean-up** (PR #117, OQ-199): a test whose awaited call
  throws skips `logs.stop()`, so the logger stays on for the rest of its
  file. Decide repo-wide whether `captureLogs` cleans up after itself (e.g.
  registering its own Vitest clean-up) rather than each test remembering
  `stop()`. Decided in phase 3.

## Phase 1 — are the tests meaningful? (mutation testing)

### Step 1 — backend (`pnpm mutation:api`)

Limited to slice 2 (stakeholder decision): `BASE=7ca8206` (the merge of
PR #75, which closed the slice-1 review). Files added since then are
mutated whole; files changed since then only on their changed lines. The
whole API is 4,588 mutants, about 4 hours; slice-1 code already passed its
own review.

Tooling fixed on the way:

- `stryker.api.config.json` left all of `docs/` out of Stryker's sandbox,
  so the contract-routes test (OQ-163, added after slice 1's run) could not
  read `docs/architecture/api/openapi.yaml` and the dry run failed. The
  sandbox now keeps `docs/architecture/api/`.
- `scripts/mutation.sh` takes `BASE=<ref>` for both `api` and `web`, so each
  later review mutates only its own slice.

**Result (2026-10-23, ~30 min, run detached from the session):** 2,338
mutants in 54 files, 2,244 killed, **94 survived — score 96.0%**. The 4-hour
estimate was wrong: each mutant runs the suite once (~3 s with 4 workers),
not 13 s. Every survivor is triaged below; the doubtful ones were
hand-applied and their test files run (the card chain end and the three
Budget ones).

#### Gaps — what could break and nobody would notice (15 mutants, 9 findings)

| # | Where | What could break unnoticed | Proposed test |
|---|---|---|---|
| T1 | `CreditCardAccessor` `chainEnd` (L168) | A charge in a cycle after the chain's end copies the **first** cycle's balance into the gap cycles instead of the last one. The tests only grow a one-cycle chain, where first and last are the same row. | Charges in two cycles, then one two cycles later: the gap cycle carries the second cycle's ending. |
| T2 | `BudgetAccessor` `inScope` (L143) | Shared-scope claims and spends could be matched **by who created the Budget**. Every test's shared Budget is Ana's and every shared spend is Ana's, so a check that also compared the creator would pass. In production, a Category claimed by Bia's shared Budget would then not block Ana's rollup claim, and a shared spend recorded by Ana would not count in Bia's shared Budget. | A shared Budget created by Bia: Ana's shared claim on one of its Subcategories is refused (rollup), and a shared spend in Ana's scope accrues to it. |
| T3 | AccountManager `CARD_ACCOUNT_TYPES` (L31 ×2) | Savings and credit-card-only accounts could stop taking cards. Only a checking account is created with a card. | Create a savings and a credit-card-only account with a card. |
| T4 | AccountManager card-type check (L153 ×3, L309 ×2) | The "this type takes no cards" refusal could fire with **no cards** — creating an investment account, or editing one, would fail. No test creates or edits an investment account successfully. | Create an investment account without cards; rename one. |
| T5 | AccountManager `requireEditable` (L134) | A rename by someone who isn't the creator could be treated as a visibility change and refused. No test has an Admin editing a shared account someone else created. | An Admin renames Ana's shared account (no visibility sent) → saved. |
| T6 | AccountManager `writeCardChanges` (L182, L187) | An edit with no card edits or removals could still call `update`/`remove` on a phantom card; the mocks answer yes, so nothing notices. | An edit that only adds a card makes no `update`/`remove` calls. |
| T7 | `growsCompletedGoal` (L66) | A completed Goal's share could be "grown" unnoticed when its new percentage equals another Goal's current one — the check could ignore which Goal holds it. | Completed Goal at 20 moved to 30 while another Goal holds 30 → refused. |
| T8 | Edit Holding (L203) | The current split could be read without the Holding's id (the mock answers anyway). | Assert `listAllocations({ holdingId })` in the edit test. |
| T9 | Market values `readBack` (L80) | After an edit, the **first** snapshot of the Holding could be returned instead of the edited one. Tests have one snapshot per Holding. | Two snapshots, edit the second → the second comes back. |

#### Not gaps (79 mutants)

- **Equivalent — can't change behaviour (55):**
  - *Empty-list short-circuits* (13: `if (ids.length === 0) return []` in AccountAccessor, BudgetAccessor, CategoryAccessor, CreditCardAccessor, GoalAccessor, InvestmentHoldingAccessor, ValuationSnapshotAccessor) — Drizzle turns `inArray(column, [])` into `false`, so the query answers the same empty result; the guard only saves a round trip.
  - *Dropping `undefined` fields before an update* (12: the Accessors' `set` and `cardChangesOf`) — Drizzle already skips `undefined` keys in `set`.
  - *Existence checks selecting `{ id }`* (8) — selecting every column answers the same "is it there".
  - *`chainEnd(…, 'last')` → `''`* (2: Account and card) — anything but `'first'` already reads the last row.
  - *`'data.view'` → `''`* (5: list Accounts, account status, list Budgets, list Goals, list index rates) — `accessToOwned(undefined, action)` ignores the action when there is no entity and asks only the membership check. The argument is dead; see phase 3.
  - *Guards repeated elsewhere* (6): BudgetAccessor `sameTarget` (the literal duplicate is also the unique index, OQ-166) and the `!budgetId` guard in `accrueIfClaimed` (the period query then finds nothing either); the Budget edit's name check (also done in `requireValidRequest`); CategoryAccessor's `renamed` filter (×2 — updating a row whose id is `undefined` matches nothing); the market-value refusal `'automatic'` → `''` (both map to the same 409).
  - *Shape-only* (9): a new Subcategory's `{ id: undefined }` vs no `id` (`changesOf`), `subcategories ?? []` checked as a phantom item (no name, passes), the snapshot route's `from`/`to` set to `undefined`, and ValidationUtility's five `undefined` bound/rule guards (a comparison with `undefined` is always false; every rule key has a function).
- **Defensive — not testable here (3):** the row locks' `of` clause (BudgetAccessor ×2, CreditCardAccessor). Without it Postgres locks every table in the query instead of one — a concurrency difference a single-connection PGlite test can't observe.
- **Not worth a test (21):** the English `message` of every ApiError in `managers/account/errors.ts` and `managers/access.ts` — developer-only text, never shown (OQ-83).

#### Proposed fixes

One commit per finding group: T1–T2 (Accessors), T3–T6 (AccountManager accounts and cards), T7–T9 (holdings and market values). Verified by a second `BASE=7ca8206` run: the 15 killed, none new.

#### Fixed (2026-10-23)

Tests added, one commit per group — T1–T2 (`CreditCardAccessor`,
`BudgetAccessor` DB tests), T3–T6 (AccountManager accounts suite), T7–T9
(holdings unit and integration, market values). Each new test was first
checked against its own mutant, applied by hand from the report.
**Second run:** 2,259 killed, 79 survived — **96.6%**; all 15 gap mutants
killed, no new survivor; the 79 left are exactly the triaged ones above.

### Step 2 — web app and packages (`pnpm mutation:web`)

Not started.

## Phase 2 — the Playwright suite

Not started.

## Phase 3 — code and architecture

Not started.
