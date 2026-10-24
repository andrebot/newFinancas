# Slice review — slice 2, October 2026

The gate at the end of slice 2 (account setup: accounts, cards, categories,
budgets, goals and the guided onboarding wizard — tasks 67–98), run by the
method in `13-slice-review.md` (OQ-164). Work happens on the
`review/slice-2` branch, cut from `main` after PR #118 (`I8`).
**Status: complete — phase 1 PR #120, phase 2 PR #121, phase 3
`review/slice-2-code`; decisions in OQ-202.**

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

**Run (2026-10-23, detached, `BASE=7ca8206`):** 91 changed files, one Stryker
run each over `vitest related <file>` (packages over their own suite).
5,721 mutants: 5,220 killed, 6 timed out, **495 survived — 91.3%** (slice 1:
90.1%). Triaged with slice 1's rules (`12-code-review-2026-10.md`); the
doubtful ones hand-applied. The counts below are by group, rounded where a
line holds several mutants; the exact list is
`reports/mutation/web/mutation.json`.

#### Gaps — what could break and nobody would notice (~240 mutants)

| # | Sev. | Where | What could break unnoticed |
|---|---|---|---|
| W1 | **High** | `CoverPicker.tsx` (~16) | The claim-aware picker's row states. **Hand-applied: every Category row disabled — all 188 related tests still pass.** Also: a taken row enabled, a free one marked taken, `aria-invalid` on checked rows, the chevron on a Category with no Subcategories. |
| W2 | **High** | `BudgetManagementFlow:89`, `CategoryManagementFlow:132,213`, `categoryManagementState:169,188`, `accountManagementState:400,425`, the card slots of `Create/EditAccountDrawer` and `FirstAccountEntry`, `CardFields:39` (~25) | **Which one, among several** (slice 1's W3 again): the edit drawer could open the first Budget instead of the clicked one; the busy spinner, the edit form and the archive confirm could sit on the wrong Category; removing or editing card 2 could change card 1. Tests hold one item. |
| W3 | **High** | `budgetClaims.ts:117,316,336`, `budgetForm.ts:44,131,182,185` (~9) | The web twin of T2: another member's **shared** Budget could stop blocking the picker. Also: any refusal read as "already claimed", a claimer holding two targets misnamed, a Subcategory under the second Category not named. |
| P1 | **High** | `packages/reference/src/cards.ts` (14) | Card-number validity in the package's own suite: each network's allowed lengths, digits-only (both anchors) and the `&&` joining the checks are unasserted — a 13-digit Visa or `"4111x…"` could pass. |
| W4 | Medium | The Flows' `out`/`busy` wiring — Account, Category, Budget, Goal Flows and drawers (~35) | **While a request is out**, its control should spin and the others wait. Every one of these flags could be stuck on or off. |
| W5 | Medium | `useFocusFirstInvalid` in `EditAccountDrawer`, `BudgetEntry`, `FirstAccountEntry`, and the refusal counters (9) | Focus on the first invalid field after a refused submit — the call could go, and a second refusal could leave focus where it was. |
| W6 | Medium | `BudgetEntry:50,130,131`, `GoalDrawer:69,352`, `BudgetDrawer:249`, `CardFields:225,230`, `CategoryCard:150`, `FirstAccountEntry:206,210,250` (~25) | Inline-form rules: the "budget typed, not saved" check (OQ-196) could compare wrong, a form could submit with an objection, a blank Subcategory could be added, a card with only a closing day could pass. |
| W7 | Medium | `setNameError(undefined)` ×2, `setErrors(undefined)`, `{ ...current, field: undefined }` ×7 | Editing one field could keep its stale error, or wipe every other field's. |
| W8 | Medium | Field-label catalog keys (~25: currency, visibility, type, opening balance, icon, colour, rate, stepper, tabs, new-Subcategory placeholder), `id`/`htmlFor`/`aria-describedby` templates (~8), `AccountSetupExperience:290` | **Accessible names and wiring.** A control could lose its label or its label link, or every tab could be `aria-selected`, with no test noticing — the tests don't find these controls by their label. |
| W9 | Medium | `EditAccountDrawer:124,209` (4) | The visibility control could show to someone who isn't the creator (the API refuses, OQ-169), and the read-only label could say "personal" for a shared Account. |
| W10 | Medium | `FirstAccountEntry:134`, the opening-balance label/hint keys (3) | The starting-balance explanation that OQ-169 requires could disappear. |
| W11 | Low | `AccountList:83,177,184`, `CategoryManagementFlow:218,226`, `GuidedSetupFlow:184,329`, `AccountCardsField:58`, `GoalCard:281` (~17) | Placeholders shown when they don't apply — "no cards" next to cards, an empty Archived section, empty-state copy beside items. |
| W12 | Low | `alert && <InlineBanner …/>` ×7 and five more `x && <…>` (~13) | An empty error banner or empty element on the happy path. |
| W13 | Low | `categoryManagementState` `formClosed`/`archiveConfirmCancelled`/`afterAction`, `goalManagementState:142,265,281`, `accountManagementState:359`, `budgetManagementState:183` (~10) | Closing one thing could drop the rest of the state (a request in flight, another card's open form, the exchange rates). |
| W14 | Low | `NumberInput:149,173`, `MoneyInput:209,218,224,225`, `useMaskedInput:94` (~9) | Kit defaults: a NumberInput accepting negatives by default, the compact/hero looks, an `onChange` for an unchanged value, the caret at a separator. |
| W15 | Low | `GoalDrawer:167`, `EditAccountDrawer:354,357`, `goalProgress.ts:113`, `GoalCard:65,296,307` (~10) | A delete confirm in the reversible tone (or the reverse), the archive confirm without the Account's name, goal progress in its own currency. |
| P2 | Low | `dateMask.ts:20`, `decimal.ts:108,122` (3) | ISO date check unanchored; leading zeros stripped one at a time. |

#### Not gaps (~255)

| Kind | Survivors | Why |
|---|---|---|
| Tailwind class strings, class arrays and `join(' ')`/`filter(Boolean)` | ~110 | Styling — reviewed through Storybook (OQ-128) and the mockups, as in slice 1. |
| Secondary copy keys (captions, subtitles, hints, notes) and icon names | ~70 | Presentation; titles and actions are asserted (slice 1's rule). |
| Equivalent | ~75 | Effect/memo dependency arrays; the `current` mounted guard (React 18 ignores a late update); the formatter cache; `count - 1` refusal counters (still a change); reducers' `{}` where every field was being cleared (`budgetManagementState` ×3); `useRole`'s default role (`dialog`); `Intl.ListFormat` defaults; RTK `addTagTypes` (slice 1 W1); `padStart` on values that are always two hex digits or four-digit years; Luhn's `total -` and `digit >= 9` (a doubled digit is never 9, and `-s % 10 === 0` iff `s % 10 === 0`); `parent \|\| sub` in `targetName` (the same predicate finds both); conditional spreads checked with `toEqual`. |

**Proposed order:** W1–W3 and P1 first (a broken picker, the wrong item
edited, a shared Budget not blocking, invalid card numbers accepted), then
W4–W10, then the Low groups. One commit per group of findings; verified by a
second `BASE=7ca8206` web run.

#### Fixed (2026-10-24) — all groups, stakeholder decision

Only tests changed. Each new test was checked against the mutants it
targets, applied one at a time from the report (a scratch helper that
applies a mutant's replacement at its span, runs `vitest related` on the
file and restores it). Commits:

| Commit | Groups |
|---|---|
| Card numbers and input parsing | P1, P2 |
| Budget picker and claim rules | W1, W3 |
| The right item, busy flags and state (Budget, Category, Account Flows) | W2, W4, W13 |
| Account drawers, card fields and list | W2, W5–W12 |
| Goal Management | W4–W8, W12, W13, W15 |
| Budget drawer and Category cards | W4–W8, W12 |
| Guided Setup | W2, W5–W10, W12 |
| Experience, kit inputs and Expandable | W8, W13, W14 |

**Triage corrected while fixing** (checked by applying the mutant):

- **Luhn's `digit >= 9` is a gap, not equivalent** — an undoubled 9 would
  count as 0. Now tested (P1); `total -` stays equivalent.
- **Empty lists and spans are not gaps** — `live.length === 0`,
  `budgets.length > 0`, `saved.length > 0` and the plain `note && <span>` /
  `error && <span>` render an empty, invisible element. Only the
  `InlineBanner` cases (an empty `role="alert"`) were real.
- **Equivalent on inspection:** `target === null` beside `target < 1`
  (`null < 1`); the picker's checkbox-box colour on an invalid row
  (styling); the decorative Category disc; the picker labels' `htmlFor`/`id`
  (the label wraps its input); `positionBeforeClean`'s loop bounds; an
  archived Account card's `editable` (it has no edit handler); a successful
  card save counted as a refusal (focus finds nothing invalid).

**Second run (2026-10-24, detached, `BASE=7ca8206`):** 5,461 killed, 6
timed out, 254 survived — **95.6%** (first run 91.3%). 239 of the first
run's survivors are now killed. One mutant survived that the first run had
killed: `correlationIdFrom`'s `padStart(2, '0')` for an ordinary byte
(`api/environment.ts:38`). It was caught only when the random bytes held one
under 16, so it now has a deterministic test (all bytes `0x05`); the masked
bytes on lines 36–37 are always 64 or more, so their padding stays
equivalent. The remaining survivors are the triaged styling, copy and
equivalent ones above.

**Phase 1 is complete.** Phase 2 (the Playwright suite) and phase 3 (code
and architecture, with the `captureLogs` carry-over) are next — in another
session.

## Phase 2 — the Playwright suite

The slice's journeys (`tests/e2e/accountSetup/`): 6 tests, one tagged
`@core` (core journey #9); the rest Full E2E. Together they cover every
slice-2 use case (`sequences/` financial-accounts ×3, categories ×3,
budget-spending ×3, goals ×6) and the five Flows (FL6, FL11–FL14).
Preconditions are arranged through the API, the browser does only the
journey, and each end state is read back through the API. The Guided Setup
gate's cross-seam case from PR #115 (a Member whose Owner has only personal
accounts) has its journey in `identity/onboard.spec.ts`.

**Runs (2026-10-24, local, 15 workers):** the slice 3× — 18/18 in 16 s;
10× — 60/60 in 35 s; the whole suite 3× (the identity journeys pass through
the household gate slice 2 added) — 102/102 in 36 s. No flaky journey, no
race.

**CI cadence holds.** `ci.yml` runs `@smoke` on every PR and `@core` after
merge on `main`; `nightly.yml` runs everything at 06:00 UTC and on demand.
The BDT plan's slice-2 lists are written (the `I8` paragraph: #9 core, the
rest Full E2E; smoke has nothing new for slice 2).

| # | Finding | Severity | Proposed fix |
|---|---|---|---|
| E1 | **The Budget journey checks how many Categories it claims, not which.** After create and edit it asserts `targets` has length 1, then 2. A form that sent the wrong Category's id (a neighbour row, a Subcategory's id) would pass. | Low | Assert the target `categoryId`s: Groceries, then Groceries and Healthcare, from the seeded Categories. |
| E2 | **The Goal journey's delete is half proven.** After Delete it checks the *active* list is empty. A Delete that reached the complete route instead would move the Goal to the completed list and still pass. | Low | Also check the completed list is empty. |
| E4 | **The Goal journey's `takeStep` can return before its request is answered.** It waits for the step's success message, which an earlier run of the same step may still show. Found while checking E2's fix against a Delete swapped for a second Mark completed: the API still listed the Goal as active, because the first completion's message was on screen. Nothing is masked today (each step runs once). | Low | Wait for the drawer to close first: it closes only once the answer is in. |
| E3 | **Core #9's comment says "someone else" claims Groceries, but the Owner does it.** The constraint is scoped to the household's shared Budgets, so who claims it doesn't matter — the test is right, the wording isn't. `createBudget`'s doc says "as another member would". | Note | Say what happens: a second request, from any member, claims it first. |

### Phase 2 — fixes (2026-10-24)

E1–E4 fixed, tests and comments only, no app code:
- **E1:** the Budget journey checks the claimed Categories by id
  (Groceries, then Groceries and Healthcare).
- **E2:** after Delete, the Goal is checked gone from the completed list too.
- **E4:** `takeStep` waits for the drawer to close before the message.
- **E3:** core #9's comment and `createBudget`'s doc say what happens.

Each new check was run against the wrong outcome it guards: Healthcare
expected in place of Groceries, and a second Mark completed in place of
Delete. Both journeys failed on the new line, then the file was restored.
Then the slice 10× in a row: 60/60.

**Not findings.**
- **Structural locators in the Category journey** (the swatch's parent via
  `xpath=..`, the card as the innermost `div` holding both buttons). Both are
  commented and stable; the card has no landmark of its own, and giving it
  one only for a test isn't worth an app change.
- **"All accounts archived → back to the wizard"** (OQ-198) has no journey.
  `hasAccountInUse` ignoring archived Accounts is proven on real Postgres
  (PGlite) and the gate's redirect in its unit tests; the seam between them
  is the same `account-status` call `onboard.spec.ts` already crosses.

## Phase 3 — code and architecture

A Harmonic Design pass over slice 2's code (`7ca8206..main`): VBD call rules
(backend), EBD tiers (web), BDT mock placement, and the plan against what's
built. Runtime and type imports were extracted per layer and every
cross-boundary edge read; a cycle search ran over both apps.

**What holds.**
- **Backend.** No Engine calls another Engine. No Accessor calls another
  Accessor: `calendarMonth` and `billingCycle` are pure helpers in
  `accessors/`, and resolving a movement's cycle is the Accessor's own
  storage key by decision (OQ-170). Routes import the Managers as types
  only; everything is injected in `server.ts`. AccountManager → the
  Notification Engine is a plain Manager → Engine call (a matured Holding's
  notice, OQ-171).
- **Web.** Only Experiences call the backend (the ESLint rule holds). No
  Flow imports a sibling Flow at runtime. Guided Setup reuses Account
  Setup's Interactions (`CardFields`, `ScopeFields`, `CoverPicker`) and
  helpers (`budgetForm`, `budgetClaims`, `ownership`), and Onboard composes
  Category Management: decided in OQ-196, and the EBD doc allows sibling
  Flows to share a child Interaction ("as two Managers calling the same
  Accessor"). Interactions import pure helpers from their own Flow's state
  (`takesCards`, `cardChangesOf`, `progressOf`): they reason about what the
  user typed, and the event types are the Flow's own, not the contract.
  That is not slice 1's A4, which was a cross-cutting formatter left in one
  Flow. No module-level import cycle in either app.
- **Tests.** Experiences mock only their Flows, Flows only their
  Interactions; the backend has no module mocks (injected fakes only).
- **Plan.** Slice 2's checklist is complete (33 tasks). The contract-routes
  test lists nothing of slice 2 as unbuilt. The one screen that calls an
  unserved endpoint, the Goals tab's `goal-progress`, does so by decision
  (OQ-195): it shows the definitions under a banner until `M4` (task 104,
  slice 3) builds it.

| # | Finding (symptom → cause → where else to look) | Severity | Proposed fix |
|---|---|---|---|
| A1 | **`api/` and `shell/` depend on each other again.** Slice 1's A5 removed it. `api/activeHousehold.ts` (FL11/FL12 review fixes) reads `selectActiveHouseholdId` from `shell/shellState`, which imports `api/backendApi`. *Cause (EBD):* `useActiveHousehold` combines the Shell's state with the identity reads, which is Shell-tier work, but it was put with the endpoints. *Counterpart:* nothing enforces direction between `api/`, `shell/` and `experiences/`: the ESLint boundary rule only stops the lower tiers from calling the backend. So it came back, and A2 is the same gap. | Low | Move it to `shell/activeHousehold.ts` (Experiences already import `shell/`). Add an ESLint boundary: `src/api/**` may not import `shell/**` or `experiences/**`. |
| A2 | **`api/setupRequests.ts` imports the Flows' prop types.** It holds the hooks that bind the setup endpoints to Account, Category and Budget Management's props. Both Account Setup and Onboard host those Flows, so it sits "in one place neither Experience owns" (OQ-198). That is a sound aim, but the place it picked is the layer below the Experiences, so `api/` now depends on `experiences/`. *Counterpart:* the rule A1 adds would refuse it. | Low | Move it to the Experience tier's shared folder, next to `experiences/interactions/stepParts`: `experiences/setupRequests.ts`. |
| A3 | **ValidationUtility depends on the HTTP layer.** `utilities/validation.ts` (U3) types its result as `FieldDetail` from `http/apiError`. A Utility knows nothing of its callers. *Counterpart:* `managers/validation.ts` turns those problems into the 422, which is A4's question. | Low | Define the field problem type in the utility; `http/apiError` builds its `details[]` from it. |
| A4 | **Slice 1's accepted A6 now covers all of AccountManager.** Every AccountManager error is an `ApiError` with an HTTP status (`managers/account/errors.ts`, `managers/access.ts`, `managers/validation.ts`). The recorded cost is that a non-HTTP caller gets HTTP-shaped errors. The first such caller is the local scheduler for `investmentsDaily` (task 123, `N9`, slice 4). | Note | Nothing now. Add to task 123's line in the plan: decide there whether the scheduler maps `ApiError` or the Managers move to domain errors mapped at the HTTP edge. |
| A5 | **Carry-over: "members only" is spelled `accessToOwned(undefined, 'data.view')`.** Five list actions (accounts ×2, budgets, goals, index rates) pass an action that is ignored when nothing is owned. It reads as a view check, but it is only a membership check. | Low | Give it a name in `managers/access.ts`: a `memberOnly` request (or `requireMembership`) and use it at the five sites. |
| A6 | **Carry-over (OQ-199): `captureLogs` relies on each test calling `stop()`.** 107 call sites (API 24 files, web 4, logging 2). A test whose awaited call throws skips `stop()`, so the logger stays on, still recording, for the rest of its file. Both versions (`@financas/logging` and `/browser`) hand the clean-up back to the caller. | Low — a decision | (a) **Recommended:** `captureLogs(onTestFinished)`. The caller passes the runner's clean-up hook, `captureLogs` registers `stop` on it, and the package still imports no test framework. Every call site then drops its `stop()`. (b) `using logs = captureLogs()` with `Symbol.dispose`. It's exception-safe too, but it needs the disposable lib and syntax, which are new to the codebase. (c) Keep it, with `try/finally` at each site. |

### Phase 3 — fixes (2026-10-24)

Decisions (OQ-202): fix A1–A3 and A5; A6 by option (a); A4 waits for task 123.

| Commit | Findings |
|---|---|
| Review A6 | Both `captureLogs` take the runner's hook (`captureLogs(onTestFinished)`) and register their own stop; `stop()` is no longer returned. The 107 call sites changed, along with the `try/finally` helper and the `afterEach` stops. The logging tests prove a capture whose test throws (`it.fails`) is still stopped by the runner, and they fail with the registration taken out. |
| Review A5 | `memberOnly` in `managers/access.ts`, asked by the five list actions; `accessToOwned` falls back to it. |
| Review A3 | `FieldDetail` moves to `utilities/validation.ts`; `http/apiError` imports and re-exports it. No Utility imports `http/`. |
| Review A1, A2 | `useActiveHousehold` → `shell/activeHousehold.ts`; the shared setup requests → `experiences/setupRequests.ts`. ESLint `project/web-api-direction` refuses `shell/` and `experiences/` imports in `src/api/` (checked against a probe import). EBD doc and the Onboard tier and Guided Setup sequence diagrams updated through the generator. |
| A4 | First left for task 123; decided right after the review instead (OQ-202): Managers refuse by code, `http/errorStatus.ts` gives each code its status, its own PR. |

## Closing (OQ-164)

The review is closed:
- **Phase 1:** the slice's tests catch 96.6% of backend mutants and 95.6%
  of web mutants. Every real gap has a test.
- **Phase 2:** the journeys aren't flaky. Four small assertion gaps were fixed.
- **Phase 3:** the architecture holds. Four small direction fixes were made,
  with an ESLint boundary so the `api/` one can't come back unnoticed.
  Both carry-overs are decided.

**Still open, on the plan:** checking at task
104 that the Goals tab's progress banner goes once `goal-progress` is served
(OQ-195). Slice 3 starts with task 99.
