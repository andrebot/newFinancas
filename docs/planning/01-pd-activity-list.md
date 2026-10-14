# Project Design — Step 1: Activity list (v1)

**Status: confirmed (Q1–Q6 answered, Oct 2026).** No dependencies, durations or
critical path yet — those are Step 2 onward. Derived from VBD Round 9
(`docs/architecture/backend/01-vbd-decomposition.md`), EBD Oct 2026
(`docs/architecture/frontend/01-ebd-decomposition.md`), the BDT plan (`docs/architecture/04-bdt-test-plan.md`)
and the approved design (`docs/design/mockups/`). Team: one developer working with
Claude.

Every code work package covers its full lifecycle: detail design →
implementation → unit tests (100% coverage, per BDT) → docs (every
function documented) → review.

**Totals:** 14 non-code / infrastructure · 50 UI-kit · 7 backend Utilities ·
16 Accessors · 2 Engines · 4 Managers · 7 frontend Utilities (6 + API client) · 21 Flows ·
8 Experiences + App Shell · 12 integration · 4 verification =
**146 activities** (149 after three splits made for the execution order — see `docs/planning/03-pd-execution-order.md`; `N14` was added during slice 1, OQ-128). The kit is 50 of them on purpose: it replaces MUI,
and every Interaction is built from it, so it sits early in the network
and pays for itself across the 81 Interactions.

---

## 1. Non-code and infrastructure (N)

These usually account for 30–50% of the effort and are the ones most
often missing from plans. Sized for **local-only v1** (OQ-88), with **no
compliance review** (OQ-89).

| ID | Activity | Notes |
|---|---|---|
| N1 | Project plan (this PD round) | Activity list → dependencies → critical path → options |
| N2 | Repository + monorepo setup | git init; `apps/api`, `apps/web`, `packages/i18n`, `packages/api-types`; TypeScript, ESLint (Airbnb), Vitest, Playwright |
| N3 | Local CI | npm scripts + git hooks running the BDT cadence locally (unit / integration / contract before commit; smoke before push; Core E2E, Full E2E and load on demand); coverage gates. Moves to a hosted CI unchanged if a remote is added |
| N4 | Local environment | Docker Compose with Postgres; `.env` config; console email provider |
| N5 | Database schema + migrations baseline | Drizzle schema for the 26 v1 tables, indexes, constraints, the audit-log no-UPDATE/DELETE grant |
| N6 | Reference data + seeds | Asset types, index codes, default categories (icon + colour), 18-colour palette, kind groups; a demo household for development |
| N7 | API contract tooling | Type generation from `openapi.yaml`, request validation in Hono, error-envelope helper, contract checks |
| N8 | i18n catalog package | `packages/i18n` ICU catalog (pt-BR, en-US), every notification type + error code, completeness check |
| N9 | Local scheduler for `investmentsDaily` | In-process daily trigger + idempotency guard; a manual "run now" command for testing |
| N10 | Security review (light) | Authentication, MFA, tokens, sessions, authorization table, dependency audit — personal use, but money data |
| N11 | Accessibility audit | Keyboard, focus, contrast in both themes, labels |
| N12 | Local operations | Postgres backup + restore script (and one restore drill), log files |
| N13 | First real use + stabilization | Enter your real accounts and a month of data, fix what it surfaces |
| N14 | Component library (Storybook) — OQ-128 | A browsable library of the UI kit, to review each component in both themes and both locales as it is built. **Tool:** Storybook 10 (`@storybook/react-vite`, which supports our Vite 8 and React 19), dev-only: `pnpm storybook` runs it locally; a static build goes to a git-ignored folder; not part of `pnpm check`. **Stories** live in `apps/web/stories/`, outside `src/` like the tests, mirroring `src/kit/`; CSF with `args`, so the controls panel can change every prop. They are example data, not functions: no unit tests and outside the coverage gate. **Preview** loads the real `theme.css` and `typography.css`; toolbar globals switch the theme (dark / light, `data-theme` as ThemeUtility sets it) and the locale (pt-BR / en-US through `I18nProvider`). **Addons:** docs + controls (essentials) and a11y (axe checks on every story). **Backfill:** colour tokens + category palette (swatches), typography roles, the Icon registry (searchable grid of UI and category icons), card-network logos, SegmentedControl (md / sm / xs, tiles, icon and count). **From this task on, every kit task ships its stories.** **Settled in the design step** (OQ-128): `eslint-plugin-storybook` recommended config; every story is rendered by a jsdom smoke test (`composeStories`) inside `pnpm check`, not by `@storybook/addon-vitest`; story-only helpers are documented tooling, not unit-tested. |

Dropped by decision: hosting + environments, email provider setup
(console provider instead), compliance review, data migration from the
current app.

## 2. UI kit (K) — shared components, Tailwind + headless primitives

Derived from the 34 design pages and `docs/design/mockups/README.md`. Every Interaction
is composed from these; none of them knows a journey (same rule as an EBD
Utility). Headless behaviour (focus traps, keyboard, ARIA) comes from
Radix UI / Headless UI; we only style it. **Reused by** shows why each one
is worth building once.

### K-A Foundations

| ID | Component | Reused by |
|---|---|---|
| K1 | Tailwind theme + design tokens (`--c-*`, dark/light, 18 palette colours) | everything |
| K2 | Typography (Manrope / Inter, tabular numbers) | everything |
| K3 | Icon set (UI icons + category icon set) | everything; Icon Picker |

### K-B Inputs

| ID | Component | Reused by |
|---|---|---|
| K4 | Button (primary / secondary / ghost / danger, icon button, loading) | every page |
| K5 | Text field (label, hint, inline error) | every form |
| K6 | Password field (show / hide + strength slot) | sign in, register, reset, change password |
| K7 | Money input (currency prefix, minor units) | record, account balance, budget target, goal target, market value |
| K8 | Number / percent / rate input (quantity, whole %, × 10,000 rates) | investment buy, allocations, rates |
| K9 | Date input | record, filter, as-of dates, goal due date |
| K10 | Date range picker | filter drawer, audit export dialog |
| K11 | Select / combobox (groups, disabled options with a reason) | account picker, claim-aware category picker, role |
| K12 | Multi-select with search + presets, full width | payout holding selector (×2), filter kinds / accounts / categories |
| K13 | Segmented control (radio group; pills md / sm / xs, or tiles — OQ-127) | $ / R$, BRL / USD, goal status, kind groups |
| K14 | Option card (radio cards with description; list rows or tiles with an optional preview — OQ-129) | account type, MFA method, theme (preview cards) |
| K15 | Switch | visibility, incentivised debenture |
| K16 | Checkbox (label with links, description, error, disabled; plus the shared `FOCUS_RING` kit helper used by K13/K14/K16 — OQ-129, OQ-130) | terms, multi-select rows |
| K17 | Code input (6 digits) | MFA setup, MFA challenge |
| K18 | Icon picker | category form |
| K19 | Colour swatch picker (18 tokens) | category form |

### K-C Overlays and feedback

| ID | Component | Reused by |
|---|---|---|
| K20 | Drawer (right side; full-screen sheet on mobile) | record, filter, edit, add budget/goal, value history |
| K21 | Dialog | audit export |
| K22 | Popover (non-modal dialog panel; plus the shared `overlayMiddleware` / `OVERLAY_SURFACE` and the `shadow-overlay` token every floating panel uses — OQ-131) | notification inbox; base of K11, K18, K19, K23, K24 |
| K23 | Menu (dropdown actions; its trigger look also styles the static Owner role pill — OQ-133) | role menu, row actions |
| K24 | Tooltip | chart points, disabled reasons ("v2", "claimed by") |
| K25 | Toast + inline banner (renders AlertUtility) | every save / error |
| K26 | Inline confirm (coral irreversible / mint reversible) | archive, delete, complete / reopen, revoke |
| K27 | Type-to-confirm | delete account, delete household |
| K28 | Skeleton + loading row + empty state (`Skeleton` shapes, ledger-style `SkeletonRows`, centred `EmptyState` — OQ-132) | ledger paging, every list |

### K-D Data display

| ID | Component | Reused by |
|---|---|---|
| K29 | Amount (formatted, sign colour, tabular; uses FormattingUtility) | everywhere money shows |
| K30 | Badge / tag / pill (`Tag` — tones, sizes, icon — and the bell's `CountBadge`; the Owner role pill takes K23's trigger look — OQ-133) | bell, members, builders, contract panel |
| K31 | Avatar (initials) | members, profile, nav drawer |
| K32 | Progress ring | budget + goal rail cards |
| K33 | Progress bar (pill with value inside) | goal cards, allocation total |
| K34 | Card / panel surface + section header (title + "Month/Year" label + actions) | every page |
| K35 | Card rail (horizontal scroll, snap, edge fade, arrows) | balances, budgets, goals — on Dashboard and Transactions |
| K36 | Rail cards: balance, budget, goal | Dashboard, Transactions |
| K37 | Stat tile (big number + delta + sparkline) | net worth, payout this month, rates |
| K38 | Line chart / sparkline | net worth, market value, rate history |
| K39 | Stacked bar chart + legend (top N + Others) | payout over time (Dashboard, Investments) |
| K40 | Period bar (year switcher + 12 months with in/out mini bars) | Month Overview |
| K41 | Grouped list (sticky month / day headers + day totals) + infinite-scroll sentinel | ledger |
| K42 | Expandable row / accordion | ledger rows, holdings, category cards |
| K43 | Table (columns, group rows, expandable) | holdings by account |
| K44 | Key–value list | contract details, position, transaction details |
| K45 | List row (avatar / icon, title, meta, trailing actions) | members, sessions, invitations, notifications, coming due |
| K46 | History editor (dated values: add / edit / delete) | **value history and rate history — same component** |
| K47 | Allocation editor (goal + whole %, remaining, ≤ 100) | **investment buy and holding maintenance — same component** |
| K48 | Credit-card preview (network detected, masked). Detection (OQ-126): `detectCardNetwork(digits)` in `@financas/reference` next to `CARD_NETWORKS`, with BIN ranges as data. It must work on a partial number as the user types: compare against the same count of leading digits, not a fixed 6. Check Elo and Hipercard before Visa, Discover and Diners, since their ranges overlap. Elo: 401178–9, 431274, 438935, 451416, 457393, 457631–2, 504175, 506699–506778, 509000–509999, 627780, 636297, 636368, 650031–650033, 650035–650051, 650405–650439, 650485–650538, 650541–650598, 650700–650718, 650720–650727, 650901–650978, 651652–651679, 655000–655019, 655021–655058. Hipercard: 606282, 384100, 384140, 384160, 637095, 637568, 637599, 637609, 637612 (both lists from public BIN tables: re-check them when K48 starts). A test checks every network has a rule and a logo. The old app's `utils/creditCard.ts` has the right idea, but its 3-digit `inRange` calls never match. | account setup, wizard |
| K49 | Stepper (step n of m) | setup wizard |
| K50 | Category chip (icon + palette colour) | ledger, pickers, budgets |

### K-E Layouts

The App Shell layout itself is the shell work package (S1). The auth
layout (split screen with brand panel), wizard layout and page header
(title + tabs + actions) are kit layouts — **folded into K34** so the kit
count stays at 50.

## 3. Backend (U, A, E, M)

### Utilities (7)

| ID | Utility |
|---|---|
| U1 | `CorrelationIdUtility` |
| U2 | `LoggingUtility` (logActivity + recordAudit) |
| U3 | `ValidationUtility` |
| U4 | `AuthenticationUtility` (hashing, TOTP, recovery codes, tokens) |
| U5 | `AuthorizationUtility` (role permission table) |
| U6 | `ServiceBusUtility` (in-process pub/sub) |
| U7 | `NotificationEngine` + `EmailAccessor` (was `NotificationDeliveryUtility`, OQ-113: routing by type, email rendering; the Accessor sends through the configured provider) |

### Resource Accessors (16 built in v1)

A1 `UserAccessor` (incl. password-reset tokens) · A2 `SessionAccessor` ·
A3 `HouseholdAccessor` · A4 `InvitationAccessor` · A5 `AccountAccessor` ·
A6 `CreditCardAccessor` · A7 `AccountTransactionAccessor` ·
A8 `CardTransactionAccessor` · A9 `CategoryAccessor` · A10 `BudgetAccessor` ·
A11 `InvestmentHoldingAccessor` · A12 `ValuationSnapshotAccessor` ·
A13 `GoalAccessor` · A14 `IndexRateAccessor` · A15 `AuditLogAccessor` ·
A16 `NotificationInboxAccessor`.

Not built (parked): `PortfolioAccessor`, `DashboardAccessor`,
`OpenBankingConnectionAccessor`, `OpenFinanceBrasilAccessor`,
`USOpenBankingAccessor`, `MarketAnalysisProviderAccessor`.

### Engines (2)

E1 `InvestmentProductEngine` (`schedule`, `project`, coded tax rules) ·
E2 `ReportingEngine` (dashboard, month overview, investments overview,
payouts, goal progress).

### Managers (4)

M1 `IdentityManager` · M2 `AccountManager` · M3 `TransactionManager`
(incl. the `investmentsDaily` subscription) · M4 `InsightsManager`.
Each includes its HTTP routes for its own use cases.

## 4. Frontend (FU, FL, X, S)

### Utilities (6)

FU1 `ValidationUtility` · FU2 `PasswordStrengthUtility` ·
FU3 `AlertUtility` · FU4 `ThemeUtility` · FU5 `I18nUtility` ·
FU6 `FormattingUtility`. Plus **FU7 API client** (generated types,
error-envelope handling, token refresh) — infrastructure that only
Experiences call.

### Flows (21) — each package includes its Interactions

| ID | Flow | Interactions |
|---|---|---|
| FL1 | Sign In | 3 |
| FL2 | Account Recovery | 2 |
| FL3 | Registration | 1 |
| FL4 | MFA Enrollment | 3 |
| FL5 | Household Setup | 1 |
| FL6 | Guided Setup | 2 (+ composes FL11–FL13) |
| FL7 | Security | 3 |
| FL8 | Delete Account | 3 |
| FL9 | Membership Management | 6 |
| FL10 | Household Deletion | 2 |
| FL11 | Account & Card Management | 3 |
| FL12 | Category Management | 4 |
| FL13 | Budget Management | 3 |
| FL14 | Goal Management | 4 |
| FL15 | Record Transaction | 4 |
| FL16 | Browse Transactions | 4 |
| FL17 | Month Overview | 5 |
| FL18 | Portfolio Overview | 6 |
| FL19 | Holding Maintenance | 5 |
| FL20 | Rates Maintenance | 3 |
| FL21 | Dashboard | 5 |

Plus 9 standalone Interactions, built inside their Experience package:
Sign Out, Edit Personal Info, Edit Preferences, Respond to Invitation,
Leave Household, Switch Household, Archive Matured Holding, Export Audit
Log, Notification Inbox.

### Experiences (8) + App Shell

X1 Authenticate · X2 Onboard · X3 Manage Profile · X4 Manage Household ·
X5 Account Setup · X6 Manage Finances · X7 Track Investments ·
X8 Review Insights · **S1 App Shell** (layout, header + bell, nav drawer +
switcher, routing table, auth guard, responsive breakpoints).

## 5. Integration (I) — one per seam that crosses a work-package boundary

| ID | Seam |
|---|---|
| I1–I4 | Each Manager ↔ its Engines / Accessors (BDT integration suites) |
| I5 | `household.created` and `holding.matured` pub/sub (Manager ↔ Manager via the bus) |
| I6 | `investmentsDaily` trigger → TransactionManager + AccountManager |
| I7–I12 | Frontend ↔ backend per area: identity (X1–X4), account setup (X5), finances (X6), investments (X7), insights (X8), shell routing (S1) |

Experience ↔ Flow integration tests are inside each X package (BDT).

## 6. System verification (V)

| ID | Activity |
|---|---|
| V1 | Smoke suite (6 checks) |
| V2 | Core E2E — the 14 journeys in the BDT plan |
| V3 | Full E2E — every remaining use case and Flow |
| V4 | Load tests (k6) — the 5 scenarios in the BDT plan |

---

## Findings while building the list

- **Accessor count:** the VBD doc says "18 active + 5 parked", but its
  table has 22 rows: **16 active + 6 parked** (`PortfolioAccessor` is
  parked with CUC-7). The doc's count needs a fix.
- **Kit reuse that cuts work:** the history editor serves value history
  *and* rates; the allocation editor serves investment buy *and* holding
  maintenance; the multi-select serves the payout selector *and* the
  filter drawer; card rails and rail cards serve Dashboard *and*
  Transactions.
- **Transactions header "Import" button** — renders disabled in v1 (Open
  Banking, v2, OQ-74); no work beyond the disabled state.

## Decisions (stakeholder, Oct 2026)

- **Q1 — yes:** each Flow's package includes its Interactions (21
  packages, not 81).
- **Q2 — purely local** for now (OQ-88): no hosting work.
- **Q3 — no email provider:** "send email" prints to the console; a real
  provider gets hooked up later through configuration (OQ-88, OQ-84).
- **Q4 — no compliance review:** personal use (OQ-89).
- **Q5 — no data migration** from the current app.
- **Q6 — kit list accepted** as is.
- **Accessor count fixed** in the VBD doc and the README (16 active + 6
  parked).
