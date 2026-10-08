# Design-round change log (October 2026)

The October 2026 design round (`docs/design/mockups/`) produced decisions that are
already applied to the **requirements** (`docs/requirements/`, OQ-55 –
OQ-66). This file is the checklist for carrying them into every
downstream artifact. Each review in the sequence below applies its rows
and ticks them off — so no artifact is edited twice and nothing is missed.

**Review sequence:** requirements ✅ → use cases ✅ → call chains ✅ → sequences ✅ (backend) → data model ✅ → API ✅ → EBD ✅ → BDT ✅ → README ✅. Design round closed; next: PD project plan.

## Decisions to propagate

| # | Decision | Source |
|---|---|---|
| D1 | "Objective" → "Goal" everywhere (names, files, folders, accessors, endpoints, tables) | OQ-66 |
| D2 | Recurring transactions removed | FR-3.5, OQ-55 |
| D3 | Manual Valuation Snapshots editable/deletable; position read-only (transactions only) | FR-5.2, OQ-56 |
| D4 | Category icon + colour | FR-10.1, OQ-57 |
| D5 | Engine computes expected payout + expected taxes; tax rules code-configured | FR-11.2, OQ-58 |
| D6 | Index Reference Rates (Selic/CDI/IPCA/IGP-M), manual dated history | FR-11.6, OQ-59 |
| D7 | Household switcher in nav menu | FR-1.8, OQ-60 |
| D8 | Transaction list = all transactions, lazy; filter by holding + any date range | FR-3.12, OQ-61 |
| D9 | Sign out all other sessions; inviter on invitations; theme/language preferences; net worth change vs previous month; over-budget first | FR-1.3/1.10/1.21, FR-5.3, FR-4.3, OQ-62 |
| D10 | Guided setup: first account mandatory | FR-1.22, OQ-63 |
| D11 | Password ≥ 12 characters | NFR-SEC-4, OQ-64 |
| D12 | Tailwind + own component kit, design tokens, dark/light | NFR-UX-1/2, OQ-65 |
| D13 | Deferrals: Dashboard widgets (v3), Open Banking, Portfolio Builders, Reporting + CSV export (remove from v1 use cases/API/scope; keep documented) | OQ-67, 69, 70, 71 |
| D14 | Notifications stay v1: triggers = invitation received, fixed-term Holding past due | FR-6.5, OQ-68, OQ-72 |
| D15 | Holdings auto-archive at quantity 0 via the transaction | FR-5.8, OQ-72 |
| D16 | Payout derived from linked dividend/interest transactions; payout-over-time endpoint | FR-5.9, OQ-73 |
| D17 | Monthly in/out/total per currency + 12-month strip | FR-6.11, OQ-74 |
| D18 | Create additional household from the switcher | FR-1.4, OQ-75 |
| D19 | Account types = checking, savings, credit card only, investment; holdings in any non-credit-card account | FR-2.1, FR-3.8, FR-5.1, OQ-76 |
| D20 | Audit log export dialog (date range), Owner/Admin only | FR-7.2, OQ-77 |
| D21 | Goal archive/unarchive → complete/reopen | FR-8.8/8.9, OQ-78 |
| D24 | Email channel inside `NotificationDeliveryUtility` (provider = configuration), v1 for password reset only; templated from shared i18n catalog | OQ-84 |
| D23 | Notifications = type + params (IDs resolved at display), frontend localizes from shared catalog; API errors = code + params, `message` dev-only | OQ-82, OQ-83, NFR-I18N-3 |
| D22 | Asset-type reference data (market-priced + fixed-term lists), debenture `incentivised` flag, engine tax rules per type, US taxes "not estimated"; payout chart = multi-select dropdown, top 5 + Others | FR-5.1, FR-11.1/11.2, OQ-79 |

## Checklist by artifact

### Use cases (`docs/design/diagrams/use-cases/`, generators in `docs/design/diagrams/scripts/`)
- [x] D1 — rename folder `investment-objectives/` → `goals/`, files `uc-0x-*-objective` → `*-goal`, generator `gen_investment_objectives.py` → `gen_goals.py`, all labels.
- [x] D2 — Record Transaction: drop any recurring branch.
- [x] D3 — new use case(s): edit / delete a valuation snapshot; "Edit Holding" narrows to goal allocation + add market value.
- [x] D6 — new use cases: record / edit / delete an index rate value.
- [x] D7 — switch active household (or fold into an existing identity use case — decide in review).
- [x] D8 — browse/filter transactions (View pattern) incl. holding filter.
- [x] D9 — sign out all other sessions; update preferences.
- [x] D10 — guided setup wording (mandatory account).

- [x] Applied Oct 2026 — see `05-use-case-review-2026-10.md`; generator `docs/design/diagrams/scripts/gen_use_cases_oct2026.py` (+ `uc_lib.py`). 59 diagrams: 56 active v1 + 3 deferred (Insights UC-2/3/4). Also fixed pre-existing staleness: budget-threshold notification in Record Transaction (OQ-52), missing first/last name on registration (OQ-29), email invitation notice (in-app only, OQ-68), inconsistent "N of M" set totals.

### Call chains (`docs/design/diagrams/call-chains/`)
- [x] Same rows as use cases (D1, D2, D3, D6, D7, D8, D9) — one chain per new use case; renamed accessors (D1).

- [x] Applied Oct 2026 — `06-call-chain-review-2026-10.md` (VBD Round 9 C1–C10); generator `docs/design/diagrams/scripts/gen_call_chains_oct2026.py`. 59 chains. Browse & Filter owned by TransactionManager (stakeholder).

### Sequence diagrams (`docs/design/diagrams/sequences/`, `docs/design/diagrams/ebd-sequences/`)
- [x] D1 rename; D2 remove recurring-generation trigger; D3/D5/D6/D8/D9 new or changed flows; D10 Onboard guided-setup sequence.

- [x] Backend sequences applied Oct 2026 (`08-sequence-review-2026-10.md`): 59 diagrams, OQ-83 error codes everywhere, routes under `/reports` for fixed v1 reports. **EBD sequences moved to the EBD review** (after the API review).

### Data model (`docs/architecture/02-data-model.md`, `docs/design/diagrams/04-database-erd.html`)
- [x] D1 — `objectives` → `goals`, `objective_allocations` → `goal_allocations` (+ FK names).
- [x] D2 — drop recurring schedule table/columns.
- [x] D3 — `valuation_snapshots.source` (manual | transaction, + transaction FK); updatable/deletable manual rows.
- [x] D4 — `categories.icon`, `categories.color`.
- [x] D23 — `notifications.type` + `payload jsonb` (IDs, no display text).
- [x] D6 — new `index_rates` (household_id, index code, value, unit, as_of) with history.
- [x] D8 — index for filtering transactions by holding / date.
- [x] D9 — user preferences (theme, language); invitation `invited_by`.

- [x] Applied Oct 2026 — `09-data-model-review-2026-10.md`; + gaps: `password_reset_tokens`, rates `bigint` × 10,000 (OQ-86), 18-colour category palette (OQ-85).

### API (`docs/architecture/api/openapi.yaml`, `03-api-design.md`; rebuild `api/index.html`)
- [x] D1 — `/objectives` → `/goals`, schemas `Objective*` → `Goal*`, `allocations` field docs.
- [x] D2 — remove recurring fields from transaction schemas.
- [x] D3 — `PATCH`/`DELETE /holdings/{holdingId}/valuation-snapshots/{snapshotId}`; manual snapshot create.
- [x] D4 — category `icon`, `color`.
- [x] D5 — holding response: `expectedPayout`, `expectedTaxes` (fixed-term only).
- [x] D6 — `/index-rates` CRUD (list per index with history).
- [x] D7 — list my households / set active household.
- [x] D8 — `GET /transactions` filters: `holdingId`, `from`/`to`, kinds, accounts, cards, categories; cursor pagination.
- [x] D9 — `DELETE /sessions` (all others); invitation `invitedBy`; `PATCH /me` preferences; net worth series exposes previous-month delta (or client derives).
- [x] D11 — password `minLength: 12`.
- [x] D23 — error envelope: namespaced `code` + `params`, details `{field, code, params}`, `message` dev-only, correlation ID; notification schemas as a discriminated union by `type`.

- [x] Applied Oct 2026 — `10-api-review-2026-10.md`; openapi v1.1.0 (59 paths, 82 ops, valid), `api/index.html` rebuilt, `03-api-design.md` updated. Allocation percentage → whole-percent integer (OQ-87).

### Added after the requirements review (D13–D21) — apply in every layer above
- [ ] D13 deferred scope out of v1 use cases, chains, sequences, API (keep docs, mark v2).
- [ ] D14 notification triggers (invitation, matured holding) in use cases/sequences/API; header bell in EBD.
- [ ] D15 auto-archive inside the transaction pipeline (sell/redemption to zero).
- [ ] D16 payout query + chart; D17 monthly summary query.
- [ ] D18 create-household entry from switcher; D19 account type enum + holding account rule (data model check constraint, API validation); D20 export dialog (API already has the export); D21 rename status values/endpoints (`archive`→`complete`, `unarchive`→`reopen`).

### VBD / EBD / BDT / README
- [x] VBD: Round 9 written into `backend/01-vbd-decomposition.md` (+ `docs/design/diagrams/02-vbd-component-diagram.html`, `03-backend-layered-architecture.html`) after the Manager review (`07-manager-review-2026-10.md`): rename, recurring removed, IndexRateAccessor, snapshot edit/delete, engine `project`, read-ownership rule, AccountManager spin-out criteria, `investmentsDaily`.
- [x] EBD: re-decomposed Oct 2026 (`11-ebd-review-2026-10.md`) — 8 Experiences + App Shell, 21 Flows, 22 sequences; covers D1–D24 on the frontend side.
- [x] BDT: `04-bdt-test-plan.md` revised for Round 9 + EBD Oct 2026 (contract checks, App Shell routing, Core E2E 12 → 14).
- [x] README: current-status table + repository map on top; old log kept under "Design history".
