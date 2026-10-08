# Finance APP — Documentation

A household finance application: personal and shared budgeting, expense
tracking, and investment / net-worth tracking for Brazil (BRL, primary)
and the US (USD). Open Banking sync is planned for v2.

## Status

**Implementation in progress — see the checklist for the next task.** No application code is
written until the design is done, by project convention. As of
2026-10-02 every design artifact has been reviewed against the approved
October 2026 UI design:

| Step | State | Where |
|---|---|---|
| Look & feel | ✅ approved page by page (34 pages, dark + light) | `docs/design/mockups/` (open `docs/design/mockups/index.html`) |
| Requirements | ✅ reviewed — OQ-55 – OQ-87 decided | `docs/requirements/`, review: `06-review-2026-10.md` |
| Use cases | ✅ 59 v1 use cases, 9 domains | `docs/design/diagrams/use-cases/`, review: `docs/architecture/05-use-case-review-2026-10.md` |
| Call chains | ✅ 59 | `docs/design/diagrams/call-chains/`, review: `06-call-chain-review-2026-10.md` |
| Backend (VBD) | ✅ Round 9 — 4 Managers, 2 Engines, 16 active Accessors (+ 6 parked), 7 Utilities | `docs/architecture/backend/01-vbd-decomposition.md`, reviews `07-` (Managers), `08-` (sequences) |
| Backend sequences | ✅ 59 | `docs/design/diagrams/sequences/` |
| Data model | ✅ 27 tables documented, 26 created by v1 migrations | `docs/architecture/02-data-model.md`, `docs/design/diagrams/04-database-erd.html`, review `09-` |
| API | ✅ OpenAPI v1.1.0 — 59 paths, 82 operations, validated | `docs/architecture/api/openapi.yaml` (+ `index.html`), `03-api-design.md`, review `10-` |
| Frontend (EBD) | ✅ 8 Experiences + App Shell, 21 Flows, 6 Utilities | `docs/architecture/frontend/01-ebd-decomposition.md`, `docs/design/diagrams/ebd-tiers/`, review `11-` |
| Frontend sequences | ✅ 22 (21 Flows + shell notification routing) | `docs/design/diagrams/ebd-sequences/` |
| Test plan (BDT) | ✅ revised — unit / integration / contract checks / smoke / 14 Core E2E / full E2E / load | `docs/architecture/04-bdt-test-plan.md` |
| Project design (PD) | ✅ activity list (148, incl. a 50-component UI kit) → dependency network → execution order in 7 vertical slices | `docs/planning/01-` … `03-pd-*.md`, `docs/design/diagrams/scripts/pd_network.py` |
| **Implementation** | **in progress** — one task at a time, in the order of `docs/planning/03-pd-execution-order.md` | — |

The design-round tracker, D1–D24, is
`docs/architecture/00-design-round-change-log.md`.

**v1 scope in one paragraph.** Households with roles and invitations;
mandatory MFA; four account types (checking, savings, credit card only,
investment) with credit cards; categories with icon and colour;
budgets that claim categories; goals funded by holdings
(whole-percent allocations); manual transactions across cash, transfer,
credit-card and investment kinds; holdings created only by transactions,
with expected payout and taxes computed from manually entered index rates
(Selic, CDI, IPCA, IGP-M); a daily job for scheduled fixed-income
cash events and maturity notifications; a fixed dashboard, month
overview and payout charts; audit-log CSV export; pt-BR + en-US.

**Deferred, not dropped:** Open Banking, Portfolio Builders, ad-hoc
reports + CSV export (v2); customizable dashboard widgets (v3).
**Removed:** recurring transactions (OQ-55).

**Runs locally** (OQ-88): no hosting; email prints to the console until a
provider is hooked up. **No compliance review** — personal use (OQ-89).

**Known gap:** the mobile mock in `docs/design/mockups/` still shows the old
month-scoped ledger; the desktop pages are the reference.

## Design Method: Harmonic Design (HD)

This project is designed and built using Harmonic Design — organizing the
system by *how it changes* rather than by what it currently does:

- **VBD** (Volatility-Based Decomposition) — backend: Managers, Engines,
  Resource Accessors, Utilities.
- **EBD** (Experience-Based Decomposition) — frontend: Experiences, Flows,
  Interactions, Utilities.
- **BDT** (Boundary-Driven Testing) — test level derived from VBD/EBD tier.
- **PD** (Project Design) — work packages, critical path, and risk derived
  from the architecture.

## Design Sequence

1. Requirements — done
2. Use cases + core process patterns — done
3. VBD decomposition (backend) — done, Round 9
4. EBD decomposition (frontend) — done, Oct 2026
5. Data model / ERD — done
6. API design — done, v1.1.0
7. BDT test plan — done
8. Diagrams (call chains, sequences, components, tiers) — done
9. Look & feel (Superdesign round) — done; every step above was then
   re-reviewed against it
10. **PD project plan** — work packages from the components, dependency
    network, critical path, options with cost / schedule / risk ← next
11. Implementation

Each step is presented for review and confirmation before moving on.

## Stack

| Layer | Choice |
|---|---|
| Frontend framework | React + Tailwind CSS + own component kit (headless primitives: Radix UI / Headless UI) |
| Frontend state | Redux Toolkit (RTK) |
| Frontend bundler | Vite |
| Backend runtime/framework | Node.js + Hono |
| Database | PostgreSQL |
| ORM | Drizzle |
| Logging | Winston (backend) |
| Language | TypeScript everywhere |
| Frontend/backend unit & integration tests | Vitest (+ Supertest on backend) |
| E2E tests | Playwright |
| Linting | ESLint 9, Airbnb style guide via `eslint-config-airbnb-extended` (OQ-90), enabled from the start |
| Monorepo | pnpm workspaces (OQ-90) |
| Programming style | Purely functional — no classes |
| Test code location | Separate from `src/`, not co-located |

## Repository Layout (code)

```
newFinancas/
├── apps/
│   ├── api/                Hono backend — src/, tests/{unit,integration}/
│   └── web/                Vite + React frontend — src/, tests/unit/
├── packages/
│   ├── i18n/               shared ICU catalog (pt-BR, en-US)
│   └── api-types/          types generated from openapi.yaml (task N7)
├── tests/e2e/              Playwright specs (span api + web), tiers by tag: @smoke, @core
├── .husky/                 git hooks: pre-commit `pnpm check`, pre-push smoke
├── .github/workflows/      CI: check + smoke on PRs, + Core E2E on main (OQ-91)
├── eslint.config.js        one flat config for the whole repo
├── vitest.config.ts        runs every workspace's vitest.config.ts as a project
└── playwright.config.ts    starts api + web, then runs tests/e2e
```

## Repository Layout (docs)

```
newFinancas/
├── README.md
└── docs/
    ├── README.md               this file
    ├── requirements/           00-overview … 05-assumptions-and-open-questions,
    │                           06-review-2026-10
    ├── architecture/
    │   ├── 00-core-process-patterns.md
    │   ├── 00-design-round-change-log.md    D1–D24 tracker
    │   ├── 02-data-model.md
    │   ├── 03-api-design.md
    │   ├── 04-bdt-test-plan.md
    │   ├── 05- … 11-*-review-2026-10.md      one per review step
    │   ├── api/                openapi.yaml (v1.1.0), index.html, build_index.py
    │   ├── backend/01-vbd-decomposition.md
    │   └── frontend/01-ebd-decomposition.md
    ├── planning/               01-pd-activity-list, 02-pd-dependency-network,
    │                           03-pd-execution-order (the task checklist)
    └── design/
        ├── mockups/            approved UI — index.html, README.md (design system,
        │                       tokens, 18-colour palette, patterns, widget backlog),
        │                       pages/ (34), source/ (kit + generators)
        └── diagrams/
            ├── 01-system-context.html
            ├── 02-vbd-component-diagram.html
            ├── 03-backend-layered-architecture.html
            ├── 04-database-erd.html
            ├── 05-connection-pool-capacity.html
            ├── use-cases/  call-chains/  sequences/    59 each, same 9 domain folders:
            │       identity-household 21 · track-investments 11 · goals 6 ·
            │       insights-reports 6 · record-transactions 5 · financial-accounts 3 ·
            │       categories 3 · budget-spending 3 · audit-review 1
            ├── ebd-tiers/              8 Experiences + app-shell
            ├── ebd-sequences/          22
            └── scripts/                generators (gen_*.py, uc_lib.py, seq_diagram_lib.py,
                                        pd_network.py) — diagrams are generated; rerun,
                                        don't hand-edit
```

## Design history

<details>
<summary>How the design got here (pre-October 2026 log, kept for context —
counts and names in it are historical)</summary>

**Design phase.** Per project convention, no application code is written until
the design is complete. Requirements enumeration is done (see
`docs/requirements/`, open questions tracked and mostly resolved — see
`05-assumptions-and-open-questions.md` for the current count and the one
genuinely open item, OQ-29). **Use-case diagrams** (`docs/design/diagrams/use-cases/`)
— granular use cases listed and confirmed first, then a swim-lane
(frontend/backend) activity diagram per use case — are done for seven of
the ten core use cases: Identity & Household (CUC-1/CUC-2, 20), Manage
Financial Accounts (CUC-3, 3 of 6), Record Transactions (CUC-4, 3 of 4),
Budget Spending (CUC-5, 3), Track Investments & Net Worth (CUC-6, 4 —
surfaced FR-11, a new Engine-shaped volatility), View Insights & Reports
(CUC-8, 6), Audit & Review Activity (CUC-9, 1), and Define & Track
Investment Objectives (CUC-10, 5). **Deferred, not dropped:** CUC-7
(Build FII/Stock Portfolios, whole) and the Open Banking trio
(Connect/Disconnect/Sync) within CUC-3/CUC-4 — their FRs remain valid
requirements.

**Milestone: the real core use cases turned out to be process patterns,
not CUCs.** Comparing all 45 diagrammed use cases against each other
surfaced 4 generic workflow shapes — Create, Edit, Lifecycle Transition
(unifying Delete/Archive/Unarchive), and View (Export is a specialization
of View, not a 5th) — that essentially everything derives from, including
Auth once you separate "which entity" from "what operation." See
`docs/architecture/00-core-process-patterns.md`, which also holds the
7-entry evidenced-volatility list (reconciled down from 15 — several
were invariants or pure speculation, not real volatility) and now drives
the VBD/EBD decomposition, superseding the CUC list for that purpose (the
CUCs remain valid for domain scoping).

**Round 7 of the VBD backend decomposition is complete, all of §§1–7** —
see the revision history at the top of
`docs/architecture/backend/01-vbd-decomposition.md`. Headline deltas:
Engines 1→2 (`InvestmentProductEngine` added for FR-11, called by
`TransactionManager` inline within the investment-buy path, not
`AccountManager`), Resource Accessors ~20→17 active + 4 parked
(`CurrencyReferenceRateAccessor` removed, `InvitationAccessor` split out),
Utilities 9→7 (`LoggingUtility` merge, `AuthenticationUtility`/
`AuthorizationUtility` split). Managers stay at 4. The communication-rules
table, component diagram, and sequence diagram (§§3–6) are all reworked
and confirmed against the full component list, including two flows never
previously traced: `IdentityManager`'s household-succession/ownership-
transfer pipeline (§3.1a) and the scheduled investment-cash-event trigger
(§3.2a).

**Architecture validation pass: done, all 45 use cases.** Every use case
now has a call chain diagram (`docs/design/diagrams/call-chains/`) — the actual calls
for that one flow plotted on the same fixed layered layout as
`03-backend-layered-architecture.html`, everything else dimmed, solid/
dotted arrows for sync/async, numbered for call order. Purpose: scan for
smells (Manager sprawl, unexpected fan-out, hidden Manager↔Manager
coupling) with the whole architecture visible as context on every single
diagram, not just the flow itself. Findings so far: no smells — the two
places with the widest fan-out (Delete User; Record Transaction's
investment-buy sub-case) are legitimately complex, not overloaded;
`InvestmentProductEngine` is confirmed reached only from
`TransactionManager`, never `AccountManager`; the OQ-48
Holding-owns-allocation decision holds up structurally (no Objective use
case has an edge to `ObjectiveAccessor.allocate`); Export Transactions CSV
and Export Audit Log correctly have *different* chains (one routes through
`ReportingEngine`, one doesn't) for a real reason, not an inconsistency.
**Backend architecture confirmed correct** by the user after reviewing
the full call-chain batch.

**Frontend EBD decomposition: Steps 1–3 complete for all 6 Experiences**
— see `docs/architecture/frontend/01-ebd-decomposition.md`. Six
Experiences identified from the same 45 backend use cases, grouped by
user *purpose* (not by backend Manager/CUC boundaries, a different axis):
Authenticate, Onboard, Manage Household, **Account Setup** (occasional
configuration — Accounts, Cards, Categories, Budgets, Objectives,
Holdings), Manage Finances (narrowed to day-to-day Transaction recording
— Objective *progress-viewing* stays inline here even though Objective
*setup* moved to Account Setup), Review Insights. **This pass surfaced
and closed a real gap:** Category management (FR-10) never had its own
backend use case — 3 use cases added (`docs/design/diagrams/use-cases/categories/`,
`docs/design/diagrams/call-chains/categories/`), which in turn surfaced the VBD
decomposition's **first real Manager↔Manager pub/sub example** (creating
a Household seeds default Categories via `AccountManager` subscribing to
`household.created` — see the backend doc's §3.1b).

Every Experience got full Step 2/3 detail (volatility axes, precise
tier/Interaction breakdown) plus a verified EBD tier diagram
(`docs/design/diagrams/ebd-tiers/*.html`, all 6 done). Headline findings, one per
Experience:
- **Authenticate** — Sign Out demoted from Flow to standalone
  Interaction (single atomic action, no accumulated state — the "Flow
  Proliferation" smell). First and richest sequence diagram
  (`docs/design/diagrams/ebd-sequences/authenticate-sign-in.html`).
- **Onboard** — its Guided First Setup Flow *composes* three of Account
  Setup's own Flows as wizard steps rather than duplicating them
  (Holding Management deliberately excluded — portfolio backfill can
  wait). Introduced the dashed cross-Experience reference-box diagram
  convention, and the sequence diagram tracing it
  (`docs/design/diagrams/ebd-sequences/onboard-guided-setup.html`): a composed
  Flow's backend calls route through whichever Experience currently
  hosts it, not a hardcoded owner.
- **Account Setup** — all 5 Flows (Account & Card, Category, Budget,
  Holding, Objective Management) reduce to the same Create/Edit/
  Lifecycle-Transition shape, confirming the backend's process-pattern
  discovery holds on the frontend side. Objective's lifecycle Interaction
  is named "Status Transition," not "Archive"/"Delete" separately, since
  it's the one entity with two lifecycle directions (OQ-47).
- **Manage Household** — the most Flow-vs-Interaction corrections of any
  Experience: three rough-pass "Flows" (Invitation Response, Leave
  Household, Edit Profile) demoted to standalone Interactions, and
  **Delete Account promoted to its own Flow** (split out of the old
  "Profile & Account Flow" — real multi-step state: ownership check,
  consequences review, type-to-confirm, the same shape as Household
  Deletion).
- **Manage Finances** — Record Transaction Flow splits Transaction Entry
  and **Investment Trade Entry** into siblings by Transaction Kind
  (mirroring Authenticate's MFA-code-vs-backup-code split); its
  Objective Progress Feedback Interaction makes the "one Flow, two
  backend Managers" pattern concrete. Transaction Correction Flow reuses
  Record Transaction Flow's entry Interactions pre-filled, rather than
  duplicating — same-Experience sibling-Flow sharing, not Flow-to-Flow
  coordination.
- **Review Insights** — Notification Inbox demoted to a standalone
  Interaction (same view+act merge logic as elsewhere); Export Report and
  Export Audit Log deliberately kept separate despite looking identical
  (different backend paths/permissions/shapes). **Capstone validation:**
  every Flow/Interaction here is the View pattern with Export as its
  specialization, exactly as originally discovered — confirming the
  pattern holds across all six Experiences with no exceptions.

**Sequence-diagram sweep: done — all 15 Flows.** Generated via a Python
template script (same technique as the backend's call-chain batch),
covering every Flow across all 6 Experiences — the frontend counterpart
to the backend's 48-use-case validation pass. Spot-checked in the browser
(the most structurally complex diagram, Account Setup's Objective
Management with nested `alt` blocks for its Status Transition branch,
plus two others covering distinct mechanics) and all rendered correctly;
the rest are trusted since every file shares the identical proven
template. Nothing new was designed in this sweep — no gaps or
corrections surfaced, unlike the earlier Category gap.

**Frontend EBD decomposition is now structurally complete** — Steps 1–3
and 6 done for all 6 Experiences. Wireframing (superdesign.dev) is
deliberately being held until the data model and remaining design steps
are further along, to support a more detailed UX pass later rather than
wireframing against an incomplete picture.

**Data model: complete** — all domains drafted in text form and the full
ERD diagram done (`docs/design/diagrams/04-database-erd.html`) — see
`docs/architecture/02-data-model.md`.
Tables are derived directly from the backend's 17 active Resource
Accessors, with each Accessor's validated-write invariant resolved into
either a real DB constraint or an explicit application-level check —
closing the exact question the VBD doc's §7 left open. **Identity &
Household confirmed:** `users` (now including `first_name`/`last_name` —
this resolved OQ-29, the project's one remaining open question), `sessions`,
`mfa_recovery_codes`, `households`, `household_memberships`,
`invitations`. Notable finding: "exactly one Owner per household" and
ownership-transfer atomicity (OQ-28) both resolve to **one partial unique
index** (`household_memberships (household_id) WHERE role = 'Owner'`) —
a real DB constraint, not just application discipline.

**Account Setup / Containers: all sub-chunks confirmed.** Financial
Accounts + Credit Cards (`accounts`, `credit_cards`,
`account_month_balances`, `credit_card_month_balances` — **revised after
review:** `accounts.opening_balance` was dropped as a nonsensical
account-level value once balances are tracked per month; it now lives as
`opening_balance` on the account's first `account_month_balances` row,
with every later row's opening balance mechanically carried forward from
the prior row's ending balance, and the backdated-transaction cascade
shifting both columns by one delta); Categories (`categories`,
`subcategories` — exactly-two-levels enforced structurally, no
parent-subcategory column exists at all); Budgets (`budgets`,
`budget_targets`, `budget_periods` — FR-4.7's Category/Subcategory-
claimed-once rule resolves to a **partial unique index**, matching the
VBD doc's own "uniqueness constraint, not application logic" call, via
scope columns denormalized onto `budget_targets`); Investments +
Objectives (`investment_holdings`, `valuation_snapshots`,
`investment_schedule_entries` for FR-11's computed cash events,
`objectives`, `objective_allocations` — **confirmed cascade behavior:** a
personal account's deletion, whether from full user deletion **or**
leaving/being removed from the household (now treated as equivalent
triggers everywhere personal data is scoped, not just full deletion),
cascades down through its Holdings and removes any allocations those
Holdings made to shared Objectives; the Objective survives and its
live-derived progress (FR-8.8) simply recomputes from whatever Holdings
remain — "the user removed their finances from the household," not a
data-integrity gap. **Refined after review, closing OQ-50/OQ-51:**
fixed-term instrument types (CDB/LCI/LCA/Tesouro Direto/CDs/Treasury
bonds) never accumulate — every purchase creates a new Holding, since
each is its own immutable contract with its own rate/maturity, not more
units of the same thing (this also fixed a latent bug: `investment_
schedule_entries` computes one schedule per purchase, which would have
had no way to disambiguate purchases sharing one accumulated Holding);
and these Holdings never get Valuation Snapshots at all — their value is
just `cost_basis`, constant until a redemption schedule entry posts.
Snapshots are now understood to exist purely for market-priced Holdings
(stock/FII/fund/other), which have no formula and no live price feed to
reconstruct a past value from. FR-5.1/FR-5.4 were updated accordingly;
the VBD backend doc still owes a matching revision pass, tracked in
`02-data-model.md`'s "Not yet done" section).

**Scope change made during the Budgets pass:** FR-4.4's configurable
alert threshold is dropped — the user judged per-transaction
budget-crossing alerts too noisy — leaving a cascading edit still owed to
FR-4.4, FR-6.5, and the VBD doc's §3.1 pipeline (not yet done, tracked in
`02-data-model.md`'s "Not yet done" section).

**Transactions confirmed:** `account_transactions`, `card_transactions`
— two separate ledgers (OQ-16), one shared entry point (OQ-39), bridged
only by a Credit Card Bill Payment (an `account_transactions` row
carrying a `credit_card_id`) — plus `recurring_transaction_schedules`
(FR-3.5), which re-enters the exact same recording pipeline a manual
entry would rather than posting itself. Introduced a persisted `effect`
column on `account_transactions` (`movement`/`transfer`/`bill_payment`/
`investment_trade`) derived from `kind` via an `EFFECT_BY_KIND` mapping —
persisted rather than computed live so a historical transaction keeps
the effect that was actually in force at the time, same reasoning as
`budget_periods.target_amount`. **Open Banking sync (FR-3.3) is
deferred, not modeled**, same as the other parked Open Banking
Accessors.

**Insights confirmed — all data-model domains now drafted in text
form.** `dashboard_widgets` (JSONB `settings`, since per-widget
configuration shape differs by widget type — the same "sea of nulls"
reasoning applied to `investment_schedule_entries`); `audit_log_entries`
(the notable finding: **zero foreign keys, on purpose** — FR-7.1/OQ-25's
"no rewrite ever needed on deletion" plus NFR-AUD-1's append-only
guarantee together rule out a real FK, since `CASCADE`/`RESTRICT`/`SET
NULL` are all wrong for different reasons; append-only itself is enforced
at the database-privilege level, not a schema constraint); `notifications`
(FR-6.10) — **modeled as standing infrastructure with no active
producer**, confirmed deliberately: both of FR-6.5's stated v1 triggers
(budget threshold crossed, Open Banking sync failure) are currently
inactive given this session's own earlier decisions, so the inbox
mechanism exists and is ready, but nothing writes to it yet.

**Full ERD diagram: done** — `docs/design/diagrams/04-database-erd.html`, one panel
per domain (26 tables total) rather than one giant interconnected graph,
using mermaid's `erDiagram` since none of the project's 5 Harmonic
Diagrams types cover an entity-relationship diagram (confirmed via the
`harmonic-diagrams` skill before building it). Cross-domain tables appear
as minimal `id`-only stubs pointing back to their owning panel. Its notes
section also delivers the consolidated anonymization-pattern summary
`02-data-model.md` had tracked as still owed, and calls out
`audit_log_entries` as the one entity drawn with zero connecting lines —
visual confirmation of its "no foreign keys, by design" invariant.

**Data model step is now fully complete**, text and diagram both. The
three tracked doc-cascade debts are also closed — **VBD backend doc,
Round 8** (`docs/architecture/backend/01-vbd-decomposition.md`): FR-4.4's
threshold removal (OQ-52) propagated through `BudgetAccessor`, the
`TransactionManager` pipeline, call table, component diagram, sequence
diagram, and validation trace; OQ-50/51's `asset_type` branching
propagated the same way, plus a new `ReportingEngine` →
`InvestmentHoldingAccessor` edge; `EFFECT_BY_KIND` is now enumerated
explicitly; and a new §3.2b traces the recurring-transaction scheduled
trigger as its own flow, backed by a new 18th Accessor,
`RecurringTransactionScheduleAccessor`. `docs/design/diagrams/02-vbd-component-diagram.html`
(the rendered copy of the VBD doc's two diagrams) was updated to match
throughout.

**Backend sequence-diagram sweep: done — 48 of 48 use cases**
(`docs/design/diagrams/sequences/`) — one diagram per use case rather than one
richest-flow per area, deliberately more detailed than the EBD sequence
sweep's precedent: exact HTTP method/URL, function-level Accessor/
Utility calls, response status codes, and alt-flow branches for every
rejection path, not just the happy path. Mirrors `docs/design/diagrams/use-cases/`
1:1 across all 9 areas: Identity & Household (20), Financial Accounts
(3), Categories (3), Budget Spending (3), Record Transactions (3), Track
Investments (4), Investment Objectives (5), Insights & Reports (6),
Audit & Review (1).

This is also the project's first concrete REST route surface — none
existed anywhere before this sweep (e.g. `POST /households`, `DELETE
/households/:householdId/members/:userId`, `POST /auth/login`,
`POST /transactions`) — worth a review pass on naming/conventions since
nothing else in the project constrained these choices yet.

**Generated via reusable Python scripts, not hand-written HTML** —
`docs/design/diagrams/scripts/seq_diagram_lib.py` (shared page template) plus one
`gen_<area>.py` per area, all committed to the repo for reuse. The
library's `check_mermaid_source()` guards against a real gotcha hit
partway through this sweep: mermaid's sequence-diagram grammar treats a
bare `;` inside message/note text as a statement terminator, silently
breaking the diagram with no useful error location — HTML entities like
`&mdash;`/`&#39;` are safe (decoded before mermaid ever sees them), only
a literal standalone `;` is dangerous. Every generator now raises before
writing a file if it finds one. Full writeup in the `harmonic-diagrams`
skill.

**API design: done** — `docs/architecture/api/openapi.yaml`, a complete
OpenAPI 3.1 document (validated clean with `openapi-spec-validator`): 77
operations across 57 paths, derived from the 48 sequence diagrams' routes/
status codes/schemas plus every list/retrieval endpoint the use-case
sweep never covered (state-changing actions only, not bulk retrieval —
`GET /households`, `GET /transactions`, balance/valuation/period history,
etc.; all flagged as new design surface in the companion doc below).
Companion rationale doc: `docs/architecture/03-api-design.md` — the
cross-cutting conventions decided once rather than per-endpoint
(reference-data fields like `kind`/`assetType`/`widgetType` stay plain
strings, not closed `enum`s, so a new value is additive per
FR-3.1/6.7/2.8's own "data addition, not a schema/code change" language;
`403` vs `404` enumeration-avoidance conventions; pagination shape), plus
explicit call-outs of two places this pass made a real interpretive
decision beyond what any requirement spelled out (recurring transactions
as a field on `POST /transactions` rather than a separate endpoint; the
exact request/response shape for Account+Credit-Card combined edits
extended to Category+Subcategory).

**Money and Quantity representation, both revised:** money was
originally decimal-as-string (to dodge float precision loss); changed
to **integer minor units** (cents for USD/BRL — `$1,234.56` transmitted
as `123456`) after review, because decimal-as-string just relocates the
parse/stringify friction onto every consumer instead of removing it.
This reaches into the data model too — `02-data-model.md`'s money
columns are now `bigint`, not `decimal`/`numeric`
(`docs/design/diagrams/04-database-erd.html` updated to match) — so the same integer
flows unchanged through DB, backend, API, and frontend, no conversion
step anywhere in the stack. `investment_holdings.quantity` (fractional
shares/bonds) closes the same way, one pass later: also `bigint`, scaled
by **1e-8** (8 decimal places — `10` shares is `1000000000`, Tesouro
Direto's `0.01` minimum increment is `100000`) rather than currency's 2,
since quantity has no ISO-4217-style standard giving it a natural
exponent — one fixed convention covering every `assetType`, not a
per-instrument lookup table.

**Interactive API docs: done** — `docs/architecture/api/index.html`, a
self-hosted Swagger UI (CDN-loaded, same pattern as mermaid elsewhere in
this project). **Fixed after the first version broke on a plain
double-click**: Swagger UI's default setup has it `fetch()` the spec
from a `url`, and browsers block that fetch when the page is opened as a
`file://` origin ("Fetch error failed to fetch ./openapi.yaml") — every
other artifact in this project opens with no server, so this one needed
to as well. Fix: `docs/architecture/api/build_index.py` reads
`openapi.yaml`, parses it, and embeds the spec directly in the page as a
JSON blob (`SwaggerUIBundle({spec: ...})` instead of `{url: ...}`) — no
fetch call exists in the generated page at all, so there's nothing left
for `file://` to block. `openapi.yaml` stays the single source of
truth; **`index.html` is generated, never hand-edited — rerun
`build_index.py` after every spec change**, same discipline as the
sequence-diagram generators never letting their HTML output drift from
the Python source. Verified live in the browser (served, since the
Chrome extension driving this session can't itself navigate to a bare
`file://` URL to reproduce that exact case, but the fix is
scheme-agnostic by construction — removing the fetch call removes the
only thing that scheme-dependent): all 77 operations render across
every tag, per-endpoint public-vs-authenticated overrides show correctly
(no lock icon on `/auth/register`/`/auth/login`/`/auth/password-reset/request`,
locked everywhere else), and a sample request body (`POST /accounts`)
renders `openingBalance` as a plain integer, not a quoted string — the
money convention holding up end-to-end.

**BDT test plan: done, revised after review** —
`docs/architecture/04-bdt-test-plan.md`. Test level and mock placement
derived mechanically from tier, not chosen by convention: full
per-component tables for the backend (2 Engines, 17 in-scope Resource
Accessors, 4 Managers with integration scenarios pulled directly from
the 48 sequence diagrams' `alt` branches, 7 Utilities) and the frontend
(6 Experiences, 20 Flows — a fresh count from the EBD doc's Step 3
content, not the same "15" the earlier sequence-diagram sweep covered —
~58 Interactions listed by owner rather than repeated as identical table
rows, since they all get the same unit-test treatment, 4 shared
Utilities).

**Real correction found during the revision**: Flows were originally
mistiered as Integration; they're actually Unit, the same tier as
Engines — a Flow never calls the backend or coordinates with sibling
Flows (EBD's own rule), so everything it mocks is local and synchronous,
same shape as an Engine mocking its one Accessor. Fixed, with the
document's Frontend section now ordered Unit-tier-first (Flows,
Interactions) then Integration (Experiences), mirroring how the Backend
section was already ordered.

**Two dimensions, not one, per further discussion**: tier placement
(BDT, unchanged) plus a completeness/cadence policy layered on top —
**100% coverage target** for every Unit-tier component (cheap tests,
demand rigor); **complete vertical-slice coverage** for Integration
(every response-state combination each Manager/Experience method can
hit, not just the highest-risk ones highlighted by name); and **E2E
split into three CI-cadence tiers** instead of one undifferentiated
list — Smoke (a handful of tests, every MR, catches broken
wiring/deploys, not business logic), Core E2E (the original 12 curated
journeys, post-merge on `main`), and Full E2E (a coverage-completion
policy over every remaining backend use case/frontend Flow not already
in Core, nightly/pre-release gate, not a merge gate). Unit + Integration
run on every push *and* gate every MR; only Smoke, Core E2E, and Full
E2E have a different cadence.

**Connection/thread pool capacity diagram: done** —
`docs/design/diagrams/05-connection-pool-capacity.html`, a new diagram type (added to
the harmonic-diagrams skill as Step 7) answering "how much concurrent
load can this system take before requests queue or fail" — an
infrastructure-capacity question, not an architectural-decomposition one,
so it's hand-crafted CSS Grid (with `subgrid` for sub-row timelines)
rather than mermaid, same reasoning as the layered static architecture
diagram needing precise banding mermaid won't guarantee. Three panels,
every occupancy block anchored to a real Resource Accessor call from the
existing sequence diagrams, not an invented request shape: (1) normal
load, 6 concurrent requests comfortably inside a 10-slot Postgres
connection pool; (2) Delete User's cascade shown as two side-by-side
options rather than one, since the real implementation shape is
genuinely undecided — **Option A** (one atomic transaction, 1 slot held
for the whole cascade) vs **Option B** (9 separate checkouts, slot
released between each) — flagged in-diagram as an open question for the
implementation phase, not silently resolved here; (3) a burst of 12
concurrent requests against the same 10-slot pool, 2 visibly queued
(dashed "waiting" styling transitioning to "served" once a slot frees) —
the pool-exhaustion case a plain sequence diagram can't show, since
sequence diagrams don't carry resource-hold duration. Pool size (10) is
stated as illustrative, not yet fixed by an NFR.

**A real CSS Grid bug found and fixed during this diagram's own
verification** (not user-reported): bare `repeat(N, 1fr)` time-axis
columns don't clip an unwrapped long label ("BEGIN … 9 statements …
COMMIT"), so one long note silently blew out the whole grid's width even
with `overflow: hidden` set on the item — fixed with
`repeat(N, minmax(0, 1fr))` plus `min-width: 0` on the occupancy-block
class, now documented as a named gotcha in the skill so it isn't
re-discovered per diagram. Verified via JS DOM measurement
(`getBoundingClientRect()`/`scrollWidth`), not just a screenshot, after a
stale screenshot briefly looked like the fix hadn't landed.

**Thread pool (libuv/CPU-bound) variant: not built yet, by design** —
the skill's Step 7 covers it as a secondary, conditional case (this
project's candidate trigger would be `AuthenticationUtility`'s password
hashing), built only if/when a specific CPU-bound path becomes the
actual concern, not as a default second diagram alongside the
connection-pool one.

**BDT test plan revised again: Load Testing added as a new category** —
`docs/architecture/04-bdt-test-plan.md`, a different axis from every
other tier in the document (capacity, not correctness), and the
empirical counterpart to the connection-pool capacity diagram: it's
where that diagram's illustrative pool-size number actually gets
exercised against reality. Same no-fresh-design discipline as the rest
of the plan — every scenario traces to a panel the diagram already drew
(baseline load; burst/exhaustion, reproducing the diagram's 12-requests-
vs-10-slots panel; Delete User's Option A vs. Option B under concurrent
load, the empirical tie-breaker BDT's functional tiers structurally
can't provide since it's an infra question, not a correctness one) or a
flow already named elsewhere in the plan (Dashboard's N-widget fan-out,
Record Transaction's investment-trade branch, the scheduled-cash-event
trigger as the one genuinely unthrottled burst source). Cadence:
nightly/pre-release like Full E2E, plus on-demand before any pool-sizing
or hot-path change — added as its own non-merge-blocking row in the CI
cadence table. Pass/fail criteria stay deliberately qualitative
(no errors/timeouts at baseline, queue-not-fail at burst, clean return
to baseline after) rather than inventing numeric thresholds against a
pool size the diagram itself already flagged as illustrative.

**Look & feel: done — October 2026 design round.** The whole app was
redesigned on Superdesign and approved page by page. The result lives in
`docs/design/mockups/` (open `docs/design/mockups/index.html`; decisions, design system and colour
tokens in `docs/design/mockups/README.md`) and **replaces the old Python-generated
HTML mockups, which were deleted**. Highlights: Tailwind + own component
kit instead of MUI, token-based dark/light themes, a time-context bar on
Transactions, all-transactions ledger with expandable rows, card rails
with progress rings, drawers for every focused form, and a nav drawer
with a household switcher. The round also produced 12 requirement
decisions (OQ-55 – OQ-66): "Objective" renamed to "Goal", recurring
transactions removed, editable valuation snapshots, category icon/colour,
manual index rates (Selic/CDI/IPCA/IGP-M) with engine-computed expected
payout and taxes, and more. They're applied to `docs/requirements/`;
`docs/architecture/00-design-round-change-log.md` tracks carrying them
into the architecture artifacts.

Next: review requirements → use cases → call chains → sequence diagrams →
data model → API (applying the change log at each step), then project
design (activity list, dependency analysis, detail design) and
execution.

</details>
