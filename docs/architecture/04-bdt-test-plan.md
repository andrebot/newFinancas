# BDT Test Plan

Boundary-Driven Testing applied to the backend VBD decomposition
(`docs/architecture/backend/01-vbd-decomposition.md`, **Round 9**) and the
frontend EBD decomposition (`docs/architecture/frontend/01-ebd-decomposition.md`,
**October 2026 re-decomposition**). **Revised Oct 2026** (design round:
`docs/architecture/00-design-round-change-log.md`, D1–D24, OQ-55 – OQ-87).
Test level and mock placement are **derived from each component's tier**,
never chosen by convention — see the framework recap in
`~/.claude/CLAUDE.md`'s BDT section for the four-tier rule this document
applies mechanically below.

Nothing here is a fresh test-strategy design. Every scenario in the
integration, E2E, and load-testing sections below already exists, fully
worked out, in this project's own artifacts — the 59 backend sequence
diagrams (`docs/design/diagrams/sequences/`), the 22 EBD sequence diagrams
(`docs/design/diagrams/ebd-sequences/`), the connection-pool capacity diagram
(`docs/design/diagrams/05-connection-pool-capacity.html`), and the two widest-fan-out
flows already called out by name (Delete User, Record Transaction's
investment-buy sub-case). This document's job is to say, for each one,
*what level of test it becomes and what gets mocked* (or, for load
testing, *what gets measured*) — not to re-derive the behavior.

Deferred whole, no test files needed for any of it yet: Open Banking
(FR-2.5/2.6/3.3 — `OpenBankingConnectionAccessor`,
`OpenFinanceBrasilAccessor`, `USOpenBankingAccessor`; v2), the Portfolio
Builder (CUC-7 — `PortfolioAccessor`, `MarketAnalysisProviderAccessor`;
v2), ad-hoc reports + CSV export (v2, OQ-71) and Dashboard widgets
(`DashboardAccessor`; v3, OQ-67). Removed, so their tests go too:
recurring transactions (`RecurringTransactionScheduleAccessor`, OQ-55).
Same treatment as everywhere else in this project: parked, not deleted,
revisit when the CUC is un-deferred.

**Two independent dimensions, not one.** BDT answers *where the
boundary is* (which tier a component belongs to, what gets mocked) — it
says nothing about *how exhaustive* to be within that boundary or *how
to organize execution for CI economics*. Both of those are covered
explicitly below, layered on top of the tier placement, never
substituting for it:

- **Coverage policy per tier**: Unit tests (Engines, Resource Accessors,
  Utilities, Flows, Interactions) target **100% code coverage**,
  enforced by a CI coverage gate — cheap to demand because these tests
  are cheap to run. Integration tests (Managers, Experiences) target
  **every vertical slice** — every response-state combination across
  every method the component exposes — not just the highest-risk
  scenarios; the "richest" scenarios called out explicitly below are the
  most complex slices of that space, not a substitute for the rest of
  it. E2E deliberately does **not** get a completeness target — see
  below for why.
- **CI cadence**, corrected during review — smoke tests are the one tier
  that doesn't run on every push, since they need a built/running
  instance rather than just source code:

  | Test tier | Runs on | Blocks merge? |
  |---|---|---|
  | Unit | every push, every MR | Yes |
  | Integration | every push, every MR | Yes |
  | Smoke | every MR | Yes |
  | Core E2E | post-merge on `main` | No — protects the deploy pipeline, doesn't slow down merging |
  | Full E2E | nightly / pre-release gate | No — a release gate, not a merge gate |
  | Load | nightly / pre-release, + on-demand before any pool-sizing or hot-path change | No — a capacity signal, not a merge gate |

  The Core E2E row is an inference, not something specified directly —
  it's heavier than Smoke (14 journeys vs. a handful) but far lighter
  than Full E2E, so running it after merge rather than on every MR seemed
  like the right cost/signal trade-off. Flag it if that's wrong.

## Backend

### Engines — unit, mock the Accessor beneath

**100% coverage target.** The "response states to cover" column below is
the *minimum* — every branch each Engine's logic contains (including
input validation and error paths, not just the domain-interesting ones)
needs its own assertion, backed by a CI coverage gate on these files.

| Component | Mock | Response states to cover |
|---|---|---|
| `ReportingEngine` | `AccountAccessor`, `CreditCardAccessor`, `ValuationSnapshotAccessor`, `InvestmentHoldingAccessor`, `AccountTransactionAccessor`, `CardTransactionAccessor`, `BudgetAccessor`, `GoalAccessor` | **Round 9 shapes:** month overview (in/out/net per currency — own-account transfers and bill payments excluded via `effect`; 12-month strip; month-end balances; budgets over-budget first), payout series (only dividend/interest transactions *linked to a Holding*; a month with no payout is zero, not missing; multiple currencies never summed), net worth **change vs previous month** (incl. first month with no previous = null), goal progress per currency (whole-percent allocation: `value × pct / 100`, half-up to the cent — assert the rounding on an odd-cent case). Plus the v1-retained shapes (net worth, budget status, balance-by-month) × at least: normal data, empty data (new household), and — specifically for Objective progress/net worth — the OQ-51 branch (market-priced Holding reads `ValuationSnapshotAccessor`; fixed-term Holding reads `InvestmentHoldingAccessor.cost_basis` instead, zero snapshot rows). Income-vs-expense must assert transfers are excluded via the persisted `effect` column (FR-3.6), not recomputed from `kind`. |
| `InvestmentProductEngine` | `InvestmentHoldingAccessor` (write side, `schedule`), `IndexRateAccessor` (read side, `project` — Round 9) | **`schedule`:** one scenario per FR-11.1 type (OQ-79: CDB, LC, LF, LCI, LCA, CRA, CRI, Debenture incentivised/not, Tesouro Direto; CD, Treasury) — the coded tax rules must differ where the law differs: regressive IR by holding period (assert each bracket boundary), exemption for LCI/LCA/CRA/CRI/incentivised debentures, US = taxes not estimated. **`project`:** fixed-rate (no index read), index-linked with a latest value, index-linked with **no value yet** (defined fallback, not a crash), US instrument (`estimated: false`); rates are integers × 10,000 — assert no float drift on a long term. Plus: an instrument type *not* in FR-11.1's list never reaches this Engine at all (asserted at the `TransactionManager` integration level, not here — there's nothing to unit-test for a call that never happens). |

### Resource Accessors — unit, mock only the DB driver; assert the validated-write invariant

Every row below is "translation + the one invariant documented in the
VBD doc's component table" — if a test needs more than the DB driver
mocked, that's the BDT smell (see "Structural signals to watch for"
below), not a reason to add scope here. **100% coverage target**, same
as Engines — every CRUD method each Accessor exposes gets a test, not
just the validated-write invariant highlighted below (that's the
interesting part worth documenting by name; the coverage gate catches
the rest).

| Accessor | Validated-write scenarios to cover |
|---|---|
| `UserAccessor` | Insert (success, duplicate email → real DB unique constraint surfaces as a driver error this Accessor translates); preferences update (`theme`, `language` — unknown values rejected); **password reset tokens** (`password_reset_tokens`): insert stores only the hash, find by token valid / expired / already used, mark used |
| `SessionAccessor` | Insert; delete (revoke); `deleteAllForUser`; `deleteAllExceptCurrent` (also serves "sign out all others" — assert the current session survives) |
| `HouseholdAccessor` | `transitionMembership`: normal removal, Owner removed by non-self → rejected (FR-1.11/OQ-27), Owner leaves with a successor available → atomic promotion, Owner leaves with none available → household deleted (FR-1.18). `transferOwnership`: atomic dual-role swap (OQ-28) — assert via a concurrency-shaped test that the partial unique index genuinely prevents an observable zero/two-Owner state, not just that the two writes look sequential in a mock. |
| `InvitationAccessor` | Insert: target exists (success) vs. no matching user (rejected, FR-1.19/OQ-26 — this should be the real `NOT NULL` FK constraint surfacing, not an app-level pre-check masking it). Accept/decline/revoke: pending → resolved (each of the three), and reject-if-not-pending for all three. |
| `AccountAccessor` | `applyMovement`: currency match (success) vs. mismatch (rejected, FR-2.2) |
| `CreditCardAccessor` | `applyChargeOrRefund`/`applyBillPayment`: cycle-bucket resolution on both sides of the closing-day boundary (FR-2.8) — this is the one Accessor whose "invariant" is actually a small computation (which cycle), worth two explicit boundary-day test cases, not just one generic case |
| `AccountTransactionAccessor` | Insert with each `effect` value (FR-3.1's `EFFECT_BY_KIND` table in the VBD doc §3.1); the persisted `effect` must round-trip unchanged even if `EFFECT_BY_KIND`'s reference data changes after the row was written (construct the test so the "current" mapping and the row's stored value can disagree, and assert the stored value wins) |
| `CardTransactionAccessor` | Insert (charge, refund) |
| `CategoryAccessor` | Insert (`icon` + `color` must be one of the 18 palette tokens — unknown token rejected); `seedDefaults` (correct default set with preset icon/colour, exactly once per household); archive cascades to live Subcategories, does not touch already-archived ones (FR-10.4) |
| `BudgetAccessor` | `assignTarget`: available (success) vs. already claimed in scope (rejected, FR-4.7 — assert this is the partial unique index firing, not an app-level pre-check); `accrueIfClaimed`: claimed vs. unclaimed (no-op); delete releases claimed targets |
| `InvestmentHoldingAccessor` | `applyTrade` quantity delta sign for buy/sell/redemption; **OQ-50**: fixed-term `assetType` always inserts a new Holding, non-fixed-term matches-and-accumulates; **Round 9:** quantity reaching 0 → `archive(by=system)`; `unarchiveIfSystemArchived` undoes a `system` archive and is a **no-op on a `user` archive** (OQ-80 — the asymmetry is the invariant); `archive(by=user)` is one-way; account type `credit_card_only` rejected (OQ-76); `findMaturedWithPosition` (past due + quantity > 0 + not yet notified — and excludes already-notified rows); `markMaturedNotified` |
| `ValuationSnapshotAccessor` | **Revised (OQ-56):** `insertManual` / `updateManual` / `deleteManual` succeed on `source = manual`; `updateManual`/`deleteManual` **rejected on `source = transaction`**; `insertAutomatic` links the transaction, and deleting that transaction cascades the snapshot (FK `ON DELETE CASCADE`); fixed-term Holdings never get a snapshot |
| `IndexRateAccessor` *(new, Round 9)* | Insert (unique per household + index + day — a second value for the same day is the real unique index firing); update / delete; `latest(index)` picks the highest `as_of_date`, returns none when empty; values stored as integers × 10,000 |
| `GoalAccessor` *(renamed from `ObjectiveAccessor`)* | `allocate` / `replaceAllocations` with **whole-percent integers** (OQ-87): exactly 100 (success), 101 (rejected, FR-8.3 — cross-row `SUM`, so set up at least two prior rows), 0 or > 100 per row rejected; complete/reopen (the one reversible pair) vs. delete (hard, allocations cascade away, Holdings untouched) |
| `AuditLogAccessor` | Insert (via `recordAudit` only — never directly); `exportCsv` over a date range. Separately, at the schema/migration level (not a unit test): assert no `UPDATE`/`DELETE` grant exists for the app role — this is a database-privilege check, the third BDT category alongside unit/integration, and belongs in a migration or infra test, not application code. |
| `NotificationInboxAccessor` | Insert stores `type` + `params` JSON (no text column exists — OQ-82); `listByUser`; `markAllSeen` (bulk); delete (hard) |

### Managers — integration, mock the Engines/Accessors they call directly

**Complete vertical-slice coverage, not a curated subset.** Every
response state each dependency can emit must be handled — this is where
the 59 backend sequence diagrams pay for themselves: each `alt` branch
already drawn there is one integration scenario here. The scenario lists
below name the richest/highest-risk slices explicitly because they're
the ones worth understanding by name; they are the floor, not the
ceiling — every Manager method and every dependency response-state
combination needs its own test, including the "boring" ones (a plain
success path with no branching) these lists don't bother spelling out.

**Route this through Vitest's coverage tooling, not manual tracking**:
since each Manager method's full state-space is enumerable (a finite set
of mocked dependencies, each with a finite set of documented response
shapes), a coverage report against the Manager's own source is a
reasonable proxy for "every vertical slice is actually tested" — treat a
gap there as a missing scenario, not an acceptable gap.

**`IdentityManager`** — mocks `UserAccessor`, `SessionAccessor`,
`HouseholdAccessor`, `InvitationAccessor`, `AuthenticationUtility`,
`AuthorizationUtility`, `ServiceBusUtility`, `LoggingUtility`.
- Register: email available/taken, **password < 12 → `password.too_short`**, first/last name required (`uc-11-create-user.html`)
- Login: user found/not-found, password valid/invalid, MFA valid/invalid (`uc-14-login.html`) — all three failure branches must assert the *same* 401, not leak which one failed
- MFA recovery: code valid/invalid/already-used (`uc-20-mfa-recovery.html`)
- Password reset request/confirm: user exists/doesn't (still 202 either way), token valid/expired, new password < 12; **request calls `NotificationDeliveryUtility.deliver(channel=email, type="password.reset", params, language)`** — assert the type, params and language, never a rendered body (OQ-84) (`uc-18-reset-password.html`)
- Remove Member / Leave Household: not-authorized, target-is-Owner-removed-by-other (rejected), self-leave-as-non-Owner, self-leave-as-Owner-with-successor, self-leave-as-Owner-with-no-successor (`uc-07`/`uc-08`)
- Transfer Ownership: not-authorized, target-not-a-member, success (`uc-10-transfer-ownership.html`)
- Invite User: invitee not registered (404 `invitation.invitee_not_registered`), success → **`NotificationDeliveryUtility.deliver(type="invitation.received", params={invitationId, householdId, inviterUserId, role})`** — IDs only, no names (OQ-82) (`uc-03`)
- Revoke session(s): one (not-yours → 404) and **all others** (`deleteAllExceptCurrent` with the current session id) (`uc-17`)
- Edit User: preferences valid/invalid (`uc-13`); List My Households: memberships + pending invitations with inviter (`uc-21`)
- **Delete User — the richest integration test in this Manager, deliberately given its own scenario list**, one assertion per Accessor in the cascade actually being called with the right arguments, in an order that doesn't violate FK dependencies: `HouseholdAccessor.transitionMembership` per household (with the Owner-successor sub-branch), `AccountAccessor` (personal cascade-delete vs. shared null), `InvestmentHoldingAccessor` (cascade with personal Accounts), `AccountTransactionAccessor`/`CardTransactionAccessor` (anonymize shared), `BudgetAccessor`/`GoalAccessor` (cascade vs. null), `UserAccessor.delete`, `SessionAccessor.deleteAllForUser` (`uc-12-delete-user.html`). No rejection-path scenario exists for this one — that absence is itself worth a test (assert it succeeds unconditionally).
- Create Household → publishes `household.created`: assert the publish call happens with the right payload; **do not** assert `AccountManager`'s subscription fires from this test — that's `AccountManager`'s own integration test (see below), not a Manager↔Manager coupling to verify here (VBD doc §3.0's fractal-Manager rule)

**`AccountManager`** — mocks `AccountAccessor`, `CreditCardAccessor`,
`CategoryAccessor`, `BudgetAccessor`, `InvestmentHoldingAccessor`,
`ValuationSnapshotAccessor`, `GoalAccessor`, `IndexRateAccessor`,
`ValidationUtility`, `AuthorizationUtility`, `ServiceBusUtility`,
`NotificationDeliveryUtility`.
- Subscribes `household.created` → `CategoryAccessor.seedDefaults`: this is where the Manager↔Manager effect actually gets verified from the *receiving* side — assert the subscription handler calls `seedDefaults` with the published `householdId`
- Create/Edit Account: validation fail, type/currency-change-attempted (rejected, OQ-32), card-attach-on-wrong-account-type (rejected, FR-2.7), success (`uc-01`/`uc-02` financial-accounts)
- Archive Account: success, Open-Banking-linked branch (currently unreachable — assert it's *not* called rather than mocking a parked Accessor)
- Category/Subcategory CRUD and archive-cascade (`categories/uc-01..03`)
- Budget CRUD: target overlap rejected (FR-4.7), success (`budget-spending/uc-01..03`)
- Edit Holding (allocations only): not-authorized, > 100% → 409 `goal.allocation_exceeds_100`, success (`track-investments/uc-02`)
- Archive Matured Holding: not-authorized, success with `by=user` (`uc-03`)
- Market value record/edit/delete: fixed-term Holding → 409 `holding.not_market_priced`; edit/delete of an automatic snapshot → 409 `snapshot.automatic_not_editable`; success (`uc-05..07`)
- Index rate record/edit/delete: invalid value → 422 `index_rate.invalid`, duplicate day → conflict, success (`uc-08..10`)
- Subscribes `holding.matured` → per owner `NotificationDeliveryUtility.deliver(type="holding.matured", params)` then `markMaturedNotified` — assert both, and that a delivery failure does **not** mark it notified (`uc-11`)
- Create Account: the 4 types only (OQ-76); Create/Edit Category with icon + colour token
- Goal CRUD / complete / reopen / delete (`goals/uc-01..05`)

**`TransactionManager`** — mocks `AccountAccessor`, `CreditCardAccessor`,
`InvestmentHoldingAccessor`, `ValuationSnapshotAccessor`,
`InvestmentProductEngine`, `BudgetAccessor`, `GoalAccessor`,
`AccountTransactionAccessor`, `CardTransactionAccessor`,
`AuthorizationUtility`, `ServiceBusUtility`.
- Record: not-authorized, currency-mismatch, kind-invalid-for-target,
  each `effect` dispatch branch (`movement`/`transfer`/`bill_payment`/
  `investment_trade`) — and **within `investment_trade`**, both OQ-50
  sub-branches (fixed-term always-new vs. match-and-accumulate) crossed
  with both the fixed-term-schedule-computed and not-a-scheduled-
  instrument-type paths (`uc-01-record-transaction.html` — this single
  diagram's `alt`/`opt` nesting maps to roughly six distinct integration
  scenarios on its own)
- Record, **Round 9 branches:** investment kind on a `credit_card_only` account → 422 `transaction.investment_not_allowed_on_account`; full sell/redemption → `archive(by=system)`; automatic snapshot written for market-priced only; bundled allocations > 100 → 409 (and nothing else persisted — assert the rollback); debenture `incentivised` passed to the Engine
- Edit/Delete: reverse-then-reapply for each of the three effect shapes; **zeroing transaction edited/deleted → `unarchiveIfSystemArchived`**, automatic snapshot updated/deleted with it (`uc-02`/`uc-03`)
- Browse & Filter (`uc-04`, owned here by stakeholder decision): visibility scope applied before filters; both ledgers merged newest-first; cursor continuation returns no duplicates across the page boundary (two rows on the same date)
- Scheduled investment cash event (from `investmentsDaily`): subscribes `transaction.import.requested`, re-enters the same Record pipeline with `kind = interest/redemption/tax`, `source = schedule`, linked to the Holding (`track-investments/uc-04-generate-scheduled-cash-event.html`) — no user, no authorization check, assert that absence explicitly; a redemption that zeroes the Holding auto-archives it

**`InsightsManager`** — mocks `ReportingEngine`, `InvestmentProductEngine`,
`AuditLogAccessor`, `NotificationInboxAccessor`, `AuthorizationUtility`.
- Dashboard (v1 fixed panels): one `ReportingEngine.dashboard` call, visibility scope passed through (`insights-reports/uc-01`)
- Reports: `month-overview`, `investments-overview`, `payouts` each route to their Engine shape; unknown type → 400 `report.unknown_type_or_range`
- View Investments: `InvestmentProductEngine.project` called **once per fixed-term Holding and never for market-priced ones**; an Engine failure for one holding returns the others with that projection marked unavailable (`track-investments/uc-12`)
- View Goals (`goals/uc-06`): contributions returned per currency, never converted
- Notifications: list + bulk mark-seen, delete not-yours (404)
- Audit log export: not-authorized (403), success (`audit-review/uc-01`)

### Utilities

**100% coverage target**, same as every other Unit-tier component.

| Utility | Test level | Mock |
|---|---|---|
| `AuthenticationUtility` | Unit | Nothing (pure crypto primitives — hash/verify, TOTP, recovery codes) |
| `AuthorizationUtility` | Unit | `HouseholdAccessor` (reads role), in-code permission table stays real (it's the thing under test) |
| `ValidationUtility` | Unit | Nothing (pure) |
| `CorrelationIdUtility` | Unit | Nothing (pure) |
| `ServiceBusUtility` | Unit | The in-process event emitter it wraps — assert publish/subscribe semantics only, not any Manager's handler logic |
| `LoggingUtility` | Unit | Winston (the external sink) for `logActivity`; `AuditLogAccessor` for `recordAudit` — assert the two entry points stay schema-distinct (rich context vs. locked-down `{actor, timestamp, action, entityType, entityId}`, FR-7.1) |
| `NotificationDeliveryUtility` | Unit | `NotificationInboxAccessor` (in-app) and the **email provider client** (the external sink, configured — OQ-84). In-app stores `type` + `params` only; email renders the template from the shared i18n catalog in the requested language — assert one test per v1 email type (`password.reset`) × each locale, and that switching the configured provider changes no call site |

### Schema checks — embedded Postgres, unit speed, no running system

Added Oct 2026 (N5, OQ-95). Not a BDT tier: these check that the
**migrations themselves** produce the constraints and privileges the
data model requires.
- **Where:** `apps/api/tests/db/`.
- **How:** the real migration SQL is applied to **PGlite**, an embedded
  Postgres 18 running in the test process, and each check runs as the
  application role.
- **What they check:**
  - the 26 tables and `uuidv7` ids;
  - one Owner per household;
  - the FR-4.7 claim scopes;
  - the append-only audit log;
  - that the app role cannot change the schema.
- **When:** in `pnpm check` (pre-commit and CI), so they run without
  Docker in under a second.
- The real container is still what E2E runs against.

### Cross-boundary contract checks — CI, unit speed, no running system

Added Oct 2026 for NFR-I18N-3 / OQ-82 / OQ-83. Not a BDT tier — a static
check that the shared contracts can't silently drift:

- **Catalog completeness:** every notification `type` in the OpenAPI
  `Notification` union and every error `code` used by the backend has an
  entry in **every supported locale** of `packages/i18n` (pt-BR, en-US).
  A missing key fails CI — users never see a raw code.
- **Error envelope:** every non-2xx response the API produces matches
  `components/schemas/Error` (`code`, `params`, `message`,
  `correlationId`); `message` is never rendered by the frontend (lint
  rule on the API client).
- **Generated types:** frontend API types are regenerated from
  `openapi.yaml` in CI and diffed — a spec change without regenerated
  types fails.

## Frontend

**Revised Oct 2026** for the re-decomposition (8 Experiences + App Shell,
21 Flows, 6 Utilities — `frontend/01-ebd-decomposition.md`). Same order
as the backend: Unit tier first (Flows, Interactions), then Integration
(Experiences, App Shell).

### Flows — unit, mock the Interaction(s) beneath

Flows are Unit tier (corrected in an earlier review): a Flow never calls
the backend or a sibling, so everything it fakes is local. The Experience
is the caller, represented by a stub callback. **100% coverage target.**

| Flow (Experience) | Real accumulated state | Response states to cover |
|---|---|---|
| Sign In (Authenticate) | step (credentials / challenge), active challenge | credentials → MFA code or → backup code (escape event); 401 codes surfaced via I18nUtility, never `message` |
| Account Recovery (Authenticate) | email, token, new password | request → (email out of band) → new password; `password.too_short`, `password_reset.token_invalid` |
| Registration (Onboard) | form fields, errors | first/last name required; password < 12 inline; `user.email_taken`; success hands off to MFA Enrollment |
| MFA Enrollment (Onboard) | method, secret, code, codes, ack | verify fail/retry/success → codes → acknowledged (no skip) |
| Household Setup (Onboard) | name | success → Guided Setup; also reached from the shell for an additional household |
| Guided Setup (Onboard) | step, per-step skippable flags | account step **not** skippable (Next disabled until an account exists); category and budget steps skippable; summary renders counts |
| Security (Manage Profile) | sessions, active action | revoke one / sign out all others (current session kept) / change password |
| Delete Account (Manage Profile) | ownership result, confirmation text | blocked while owning households without a successor → review → type-to-confirm |
| Membership Management (Manage Household) | selected row, open role menu | role change, invite (404 invitee), revoke pending, remove member, transfer ownership |
| Household Deletion (Manage Household) | confirmation text | review → type-to-confirm |
| Account & Card Management (Account Setup) | selection, draft account + cards | 4 types only; card entry emits network + last4 only (never the full number); archive confirm |
| Category Management (Account Setup) | selection, draft, open picker | icon + colour from palette tokens; inline subcategory add; archive cascade visible |
| Budget Management (Account Setup) | selection, draft, claimed map | claimed categories disabled with owner; 409 `budget.target_already_claimed` refreshes the picker |
| Goal Management (Account Setup) | status filter, draft, **entered FX rate** | complete/reopen per status; the FX rate never leaves the Flow (no request on change); mixed-currency estimate recomputes locally |
| Record Transaction (Manage Finances) | kind group, kind, fields, allocation rows | group → kind narrows accounts; investment buy branch; allocation total kept ≤ 100 client-side; 4xx codes rendered; edit mode pre-filled from a ledger row |
| Browse Transactions (Manage Finances) | filters, pages, cursor, expanded row | lazy pages append without duplicates; filter change resets cursor; expanded row emits edit/delete up — never opens Record Transaction itself |
| Month Overview (Manage Finances) | year, month, currency | period change requests a new overview; currency switch is local only; rails re-label Month/Year |
| Portfolio Overview (Track Investments) | selected payout holdings | selector change refetches only the payout series; top 5 + Others grouping is local |
| Holding Maintenance (Track Investments) | account, expanded holding, drafts | allocations (whole %), market value (market-priced only — entry hidden for fixed-term), value history edit/delete |
| Rates Maintenance (Track Investments) | rates, drafts | update, edit/delete history; values shown via FormattingUtility from × 10,000 integers |
| Dashboard (Review Insights) | selected payout holdings | fixed panels render; selector refetches payouts only |

### Interactions — unit, mock nothing but the parent's callbacks

Rendering given props + events emitted on user action, nothing else.
**100% coverage target.** By owner:

- **Authenticate** — Credential Entry, MFA Code Entry, Backup Code Entry, Recovery Request, New Password Entry, **Sign Out** (standalone)
- **Onboard** — Registration Form Entry, MFA Method Selection, MFA Setup Verification, Backup Codes Acknowledgement, Household Name Entry, Wizard Navigation, Setup Complete Summary
- **Manage Profile** — Password Change, Session List, Sign Out All Others, Ownership Check, Consequences Review, Type-to-Confirm, **Edit Personal Info** (standalone), **Edit Preferences** (standalone), **Respond to Invitation** (standalone)
- **Manage Household** — Member List, Role Menu, Invite Member, Pending Invitations, Remove Member Confirm, Transfer Ownership, Consequences Review, Type-to-Confirm, **Leave Household** (standalone), **Switch Household** (standalone)
- **Account Setup** — Account Form, Card Entry with Live Preview, Archive Confirm, Category Card, Icon & Colour Picker, Inline Subcategory Entry, Archive Confirm, Budget Form, Claim-Aware Category Picker, Delete Confirm, Goal Form, Goal Progress Card, Exchange-Rate Calculator, Complete / Reopen Confirm
- **Manage Finances** — Kind Group & Kind Selection, Transaction Entry, Investment Buy Entry, Goal Allocation Entry, Filter Panel, Ledger (lazy, grouped by month/day), Expanded Row, Delete Confirm, Period Bar, Currency Switch, Balance Rail, Budget Rail, Goal Rail
- **Track Investments** — Net Worth Cards, Payout This Month, Payout Holding Selector, Payout Chart, Allocation Cards, Coming Due, Account Picker, Holdings Table, Goal Allocation Editor, Market Value Entry, Value History Editor, Rate Card, Rate Update Entry, Rate History Editor, **Archive Matured Holding** (standalone)
- **Review Insights** — Net Worth Cards, Coming Due, Payout Holding Selector, Payout Chart, Balance / Budget / Goal Rails, **Export Audit Log** (standalone), **Notification Inbox** (standalone)

Interactions that render user-facing text get one extra assertion each:
the text comes from `I18nUtility` keys, not literals.

### Experiences — integration, mock the Flows they compose and the API client

**Complete vertical-slice coverage** — every response state of every API
call each Experience makes (2xx, each documented 4xx code, network
failure). Highest-risk slices:

| Experience | Integration scenarios |
|---|---|
| Authenticate | Sign In success → shell takes over; each 401 code mapped to the right Interaction; recovery token invalid |
| Onboard | full order Registration → MFA → Household → Guided Setup; **signed-in entry skips Registration + MFA by configuration** (additional household); composed Account Setup Flows' calls go through Onboard |
| Manage Profile | sessions list + revoke one / all others; preferences change applies ThemeUtility + I18nUtility immediately; Respond to Invitation (accept/decline) reached from the shell |
| Manage Household | unified member + invitation list; role menu; Switch Household updates the shell's active household and every Experience re-fetches |
| Account Setup | section switch keeps state; categories written are visible to Budget Management in the same session; Guided Setup can host its Flows |
| Manage Finances | after Record Transaction completes the **Experience** refreshes Browse + Month Overview (no Flow-to-Flow); edit from a ledger row opens Record Transaction pre-filled; 'See in Transactions' arrives with `holdingId` and pre-filters |
| Track Investments | payout selector refetches only `/reports/payouts`; holdings for the chosen account include projections; Archive Matured Holding from a routed notification |
| Review Insights | fixed dashboard; audit export dialog visible to Owner/Admin only and calls the export with the chosen range |

### App Shell — integration, mock the Experiences it routes to

The shell is a layout, not an Experience, but its **routing table** is
real logic: for each notification type (`invitation.received`,
`holding.matured`) assert the action reaches the owning Experience with
the notification's params and that the notification is deleted only
after that Experience reports success; an **unknown type** renders the
generic fallback and routes nowhere; Switch Household propagates the
active household; Create household starts Onboard in signed-in mode.

### Frontend Utilities

**100% coverage target.**

| Utility | Test level | Mock |
|---|---|---|
| `ValidationUtility` | Unit | Nothing (pure — incl. password ≥ 12, whole percent 1–100) |
| `PasswordStrengthUtility` | Unit | Nothing |
| `AlertUtility` | Unit | The rendering sink |
| `ThemeUtility` | Unit | `matchMedia` (for `system`) and `<html data-theme>` — every one of the 18 palette tokens resolves in both themes |
| `I18nUtility` | Unit | The catalog loader — ICU plurals/params per locale; unknown key → fallback + logged |
| `FormattingUtility` | Unit | Nothing — minor units → `R$ 1.234,56` / `$1,234.56`, rates × 10,000 → `10.50%`, whole percent, dates per locale; a BRL amount stays BRL-formatted for an en-US user (NFR-I18N-2) |

## E2E — three tiers by CI cadence, not one undifferentiated tier

BDT's top tier exists to catch what integration tests structurally
cannot: real seams across the frontend/backend boundary and real
database constraints firing. Spending here scales with risk, not with
use-case count. Three tiers, same real infrastructure, different scope
and different cadence (see the CI cadence table at the top of this
document):

### Smoke — every MR, a handful of tests, is the system fundamentally wired

Not business-logic regressions — deployment/build/wiring breakage. Fast
enough to gate every merge without anyone noticing the wait:

1. Register a new user → MFA enrollment data returned.
2. Login with valid credentials → tokens returned.
3. Create a household → default Categories exist.
4. Record one simple transaction → account balance reflects it.
5. Backend health check / a Dashboard request returns `200`.
6. The frontend loads in both themes and both locales without a missing catalog key (the contract check's runtime twin).

### Core E2E — post-merge on `main`, the 14 highest-risk journeys

The original 12 journeys, revised Oct 2026 (#6, #10, #11 updated for
Round 9; #13 `investmentsDaily` and #14 the bell-to-Experience routing
added) — 14 in total:

1. **Register → verify MFA → create household → default Categories exist.** The one Manager↔Manager pub/sub effect in the whole system, proven end-to-end rather than asserted at the publish call.
2. **Invite → accept → membership established with the invited role.**
3. **Leave Household as Owner with a successor available** → correct member promoted, exactly one Owner, atomically (OQ-25/28's real invariant, not a mocked assertion of it).
4. **Transfer Ownership** → same atomicity guarantee, deliberate hand-off path instead of departure.
5. **Record a simple expense → Budget accrual visible → Dashboard reflects the new balance.** The View-pattern capstone, cross-domain, nothing mocked.
6. **Record an investment buy against a fixed-term instrument** (e.g. a CDB) → Holding created (never accumulated, OQ-50) → schedule computed by `InvestmentProductEngine` → no Valuation Snapshot written (OQ-51) → Holdings view shows expected payout + expected taxes from `project` with the latest CDI value. The richest single flow in the system.
7. **Edit a transaction to a backdated month** → every subsequent month's account balance shifts by the same delta, not just the landing month.
8. **Delete User (GDPR)** → personal Accounts/Budgets/Goals gone; this user's contributions to shared household data survive with the actor reference nulled, not deleted; `audit_log_entries` naming this actor is untouched. The other widest-fan-out flow, and the one with real compliance stakes if it's wrong.
9. **Create a Budget claiming a Category already claimed elsewhere in scope** → rejected with the real partial-unique-index conflict, not an app-level pre-check that could drift from the constraint.
10. **Allocate a Holding to two Goals totaling 101%** → rejected (409 `goal.allocation_exceeds_100`), first allocation intact.
11. **Sell a whole position, then delete that sell** → Holding auto-archived (`system`), then back to active; a Holding the user archived is **not** unarchived by the same delete (OQ-80). Replaces the old Objective archive round-trip (Goals' complete/reopen moved to Full E2E).
12. **Export the household audit log as a Viewer** → rejected (403) before any CSV is generated; **as an Owner** → succeeds. The permission gate on the system's only access path to that data.
13. **`investmentsDaily` run** (trigger invoked directly, clock fixed) → a due fixed-term interest/redemption transaction is recorded once (re-running the same day records nothing new); a matured Holding with a position produces exactly one `holding.matured` notification; accepting its "Archive holding" action through the bell archives it (`user`).
14. **Invite → bell → accept** in the browser: the invitee sees the localized notification with the inviter's *current* name, the accept is performed by Manage Profile, and the notification disappears.

### Full E2E — nightly / pre-release gate, the remaining coverage

Not a fresh list — a **coverage-completion policy** applied to inventory
this document already has: one true end-to-end journey for every
backend use case (`docs/design/diagrams/sequences/`, 59 total) and every frontend
Flow **not already exercised by
a Core E2E journey above** (59 backend use cases, 21 Flows after the Oct 2026 revision). Concretely, this is where the "boring"
CRUD journeys Core deliberately skipped finally get their real-infra
proof once: Category/Subcategory create-edit-archive, Financial Account
+ Credit Card create-edit-archive, non-conflicting Budget create-edit-
delete, Goal create-edit-complete-reopen, market value record-edit-delete
+ Value history, index rate record-edit-delete, Browse & Filter with
cursor paging, Month Overview per period, payout chart holding selection,
Notification list/delete, Session view/revoke + sign out all others,
preferences (theme/language), one report per v1 `reportType`, password
reset (email via the configured provider's test sink)/change, MFA
recovery, additional household from the switcher. Slow
and expensive by design — that's exactly why it doesn't gate a merge.

## Load Testing — a different axis: capacity, not correctness

Every tier above proves the system does the *right* thing. Load testing
proves it keeps doing the right thing — and keeps responding at all —
under realistic concurrent volume. It's the empirical counterpart to
`docs/design/diagrams/05-connection-pool-capacity.html`, which flagged pool sizing
as illustrative rather than fixed by an NFR: this is where that number
actually gets exercised against reality instead of assumed. Same
discipline as everywhere else in this document — no fresh scenario
design, every load scenario below is anchored to a panel that diagram
already drew or a flow the sequence-diagram sweep already documents.

Needs a real deployed instance and a realistically-sized database — the
same infrastructure requirement as E2E — but it measures
throughput/latency/error-rate/pool-occupancy under sustained concurrent
volume, rather than asserting one journey's outcome once.

**Target scenarios, each traceable to an existing artifact:**

1. **Baseline** — steady concurrent traffic across a realistic mix of
   flows (Record Transaction, Browse with cursor paging, Dashboard and Month Overview reads, ordinary CRUD), sized to
   stay inside the pool per the capacity diagram's Panel 1. Pass
   condition: zero request errors/timeouts, pool occupancy stays below
   capacity throughout.
2. **Burst / pool exhaustion** — reproduce the capacity diagram's Panel
   3 (12 concurrent requests against a 10-slot pool) against the real
   pool. Pass condition: excess requests queue and eventually succeed —
   they must not error or time out — and pool occupancy returns to
   baseline once the burst subsides (no leaked/orphaned connections).
3. **Delete User cascade under concurrent load — the empirical
   tie-breaker for the diagram's still-open Option A/B question.** Once
   an implementation shape is built, run concurrent Delete User requests
   (mixed with ordinary background traffic) against it — one atomic
   transaction (Option A) vs. nine separate checkouts (Option B), tested
   independently if both get prototyped — and measure contention/timeout
   rate on shared-household reads happening at the same time. This is an
   infrastructure question, not a correctness one, so BDT's functional
   tiers can't settle it; load testing can.
4. **Fan-out-heavy read/write paths** — View Investments (one
   `InvestmentProductEngine.project` call per fixed-term Holding, each
   reading the latest index rate) and Record
   Transaction's investment-trade branch (this document's other
   already-named widest-fan-out flow) — the two single user-facing
   requests most likely to multiply Accessor/connection usage per
   request, so the most likely to surface a pool problem first as
   concurrent volume rises.
5. **`investmentsDaily` burst** — `track-investments/uc-04-generate-
   scheduled-cash-event.html`'s system-triggered path plus the
   `holding.matured` sweep, firing for every due Holding at once (e.g. a
   month-end or a common maturity date) has no user
   pacing it the way the other scenarios do — the one genuine
   unthrottled burst source in the system, and worth its own scenario
   rather than being assumed to behave like user-driven traffic.

**Tooling**: a JS-scriptable load generator (k6 is the natural fit —
scripts in JS, runs standalone against a deployed instance, no new
language added to the stack) — named as a candidate, not locked in, the
same illustrative status as the diagram's pool-size number.

**Cadence**: not merge-blocking (see the CI cadence table above) — needs
a deployed instance under sustained synthetic load, which would make
every push/MR painfully slow if it gated either. Runs nightly/pre-release
like Full E2E, **plus on-demand before any change that touches pool
sizing, a hot-path Accessor call pattern, or infra sizing** — a
calendar-only cadence would miss exactly the changes most likely to move
the numbers.

**Pass/fail thresholds are deliberately qualitative for now** — no
errors/timeouts at baseline, queue-not-fail at the diagram's flagged
burst level, clean return to baseline pool occupancy afterward. Concrete
numeric thresholds (p95 latency, max tolerable queue depth) wait for
whichever NFR eventually fixes the pool size the diagram left
illustrative; tying a hard number to an admittedly-illustrative pool
size would manufacture false precision.

## Structural signals to watch for once implementation starts

Per BDT's own diagnostic framing — these aren't hypothetical, they're
what to check if a test starts feeling expensive to write:

- A Resource Accessor test needing more than the DB driver mocked →
  either it has absorbed Manager-level workflow logic, or a second
  Accessor call is hiding inside it that belongs at the Manager tier
  instead.
- A Manager integration test needing to mock something *inside* an
  Engine or Accessor (not just the Engine/Accessor itself) → a tier
  boundary has gone missing.
- Any test reaching for a real Manager→Manager call → this project's
  fractal-Manager rule (VBD doc §3.0) has been violated; the fix is
  routing through `ServiceBusUtility`, not adjusting the test.
- A frontend Interaction test needing a real Flow, or a Flow test
  needing a real Experience → the same absorption smell, one tier up.
- A Flow test needing the API client mocked → the Flow is calling the
  backend; move the call up to its Experience.
- A Flow test needing a *sibling* Flow → the coordination belongs in the
  Experience (e.g. Record Transaction → refresh Month Overview).
- An App Shell test needing to know a notification's business logic →
  routing has absorbed an Experience's work; the shell only routes.
- A `NotificationDeliveryUtility` test needing per-type branching logic
  beyond template lookup → the OQ-84 trigger: it has become an Engine.
- An `InvestmentProductEngine` test needing more than one Accessor
  mocked for a single method → `schedule` and `project` must each touch
  one Accessor only.
