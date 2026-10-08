# Project Design — Step 2: Dependency network (v1)

**Status: done (stakeholder: proceed without approval when no questions
arise).** Activities from `docs/planning/01-pd-activity-list.md`. The network lives as
data in `docs/design/diagrams/scripts/pd_network.py` (rerun to validate); step 3 adds
durations and the critical path to the same file.

**Result:** 145 activities, **410 dependencies** after removing 95
transitive ones (if A → B → C, A → C is dropped), **no cycles**, **15
levels**. A level is the longest chain of prerequisites in front of an
activity; everything on one level can be done in any order.

## How the dependencies were derived

- **Backend** — straight from the VBD communication rules: Accessors need
  the schema (three also need the reference data: categories, holdings'
  asset types, index codes); Engines need the Accessors they read or
  write; Managers need their Accessors, Engines, Utilities and the API
  contract tooling (they own their routes). `LoggingUtility` needs
  `AuditLogAccessor` (recordAudit); `AuthorizationUtility` needs
  `HouseholdAccessor` (role lookup); `NotificationDeliveryUtility` needs
  the inbox Accessor and the i18n catalog (email templates).
- **UI kit** — each component needs the foundations and the kit pieces it
  is built from (e.g. history editor ← money / rate / date inputs, inline
  confirm, line chart). Money, rate and date inputs need
  `FormattingUtility`.
- **Frontend** — Flows need the kit components and frontend Utilities
  they use (kit core — button, text field, toast, loading states, panel —
  is implied for every UI package). Experiences need their Flows, the App
  Shell and the API client.
- **Frontend never waits on backend code.** Experiences call the API
  through the client generated from `openapi.yaml` (N7 → FU7) and are
  integration-tested against a mocked client (BDT). The two sides meet
  only at the integration activities I7–I12.
- **Integration and verification** — each I activity needs both sides of
  its seam; smoke needs the identity, setup, finances and insights seams;
  Core E2E needs every seam; first real use needs Full E2E plus the
  security, accessibility and backup work.

## Build levels

| Level | # | Activities |
|---|---|---|
| L1 | 1 | N1 Project plan |
| L2 | 1 | N2 Repository + monorepo setup |
| L3 | 11 | FU1 ValidationUtility (web), FU2 PasswordStrengthUtility, K1 Tailwind theme + tokens, N3 Local CI (scripts + hooks), N4 Local environment (Docker Postgres, console email), N7 API contract tooling, N8 i18n catalog package, U1 CorrelationIdUtility, U3 ValidationUtility, U4 AuthenticationUtility, U6 ServiceBusUtility |
| L4 | 7 | FU4 ThemeUtility, FU5 I18nUtility, FU7 API client, K2 Typography, K3 Icon set, N5 Schema + migrations baseline, N9 Local scheduler for investmentsDaily |
| L5 | 33 | A1 UserAccessor, A2 SessionAccessor, A3 HouseholdAccessor, A4 InvitationAccessor, A5 AccountAccessor, A6 CreditCardAccessor, A7 AccountTransactionAccessor, A8 CardTransactionAccessor, A10 BudgetAccessor, A12 ValuationSnapshotAccessor, A13 GoalAccessor, A15 AuditLogAccessor, A16 NotificationInboxAccessor, FU6 FormattingUtility, K4 Button, K5 Text field, K13 Segmented control, K14 Option card, K15 Switch, K16 Checkbox, K22 Popover, K28 Skeleton + loading + empty state, K30 Badge / tag / pill, K31 Avatar, K32 Progress ring, K33 Progress bar, K34 Card / panel + section header + layouts, K42 Expandable row / accordion, K44 Key–value list, K49 Stepper, K50 Category chip, N6 Reference data + seeds, N12 Local operations (backup/restore) |
| L6 | 25 | A9 CategoryAccessor, A11 InvestmentHoldingAccessor, A14 IndexRateAccessor, K6 Password field, K7 Money input, K8 Number / percent / rate input, K9 Date input, K11 Select / combobox, K17 Code input (6 digits), K18 Icon picker, K19 Colour swatch picker, K20 Drawer / sheet, K21 Dialog, K23 Menu, K24 Tooltip, K25 Toast + inline banner, K26 Inline confirm, K27 Type-to-confirm, K29 Amount, K35 Card rail, K43 Table, K48 Credit-card preview, U2 LoggingUtility, U5 AuthorizationUtility, U7 NotificationDeliveryUtility |
| L7 | 25 | E1 InvestmentProductEngine, E2 ReportingEngine, FL1 Sign In, FL2 Account Recovery, FL3 Registration, FL4 MFA Enrollment, FL5 Household Setup, FL8 Delete Account, FL10 Household Deletion, FL11 Account & Card Management, FL12 Category Management, FL13 Budget Management, FL14 Goal Management, FU3 AlertUtility, K10 Date range picker, K12 Multi-select with search + presets, K36 Rail cards (balance / budget / goal), K38 Line chart / sparkline, K39 Stacked bar chart + legend, K40 Period bar, K41 Grouped list + infinite scroll, K45 List row, K47 Allocation editor, M1 IdentityManager, M2 AccountManager |
| L8 | 14 | FL6 Guided Setup, FL7 Security, FL9 Membership Management, FL15 Record Transaction, FL16 Browse Transactions, FL17 Month Overview, I1 IdentityManager seam suite, I2 AccountManager seam suite, K37 Stat tile, K46 History editor, M3 TransactionManager, M4 InsightsManager, S1 App Shell, X1 Authenticate |
| L9 | 12 | FL18 Portfolio Overview, FL19 Holding Maintenance, FL20 Rates Maintenance, FL21 Dashboard, I3 TransactionManager seam suite, I4 InsightsManager seam suite, I5 Manager pub/sub (household.created, holding.matured), X2 Onboard, X3 Manage Profile, X4 Manage Household, X5 Account Setup, X6 Manage Finances |
| L10 | 6 | I6 investmentsDaily trigger end to end, I7 Frontend ↔ backend: identity, I8 Frontend ↔ backend: account setup, I9 Frontend ↔ backend: finances, X7 Track Investments, X8 Review Insights |
| L11 | 4 | I10 Frontend ↔ backend: investments, I11 Frontend ↔ backend: insights, I12 Shell notification routing, N10 Security review (light) |
| L12 | 2 | N11 Accessibility audit, V1 Smoke suite |
| L13 | 1 | V2 Core E2E (14 journeys) |
| L14 | 2 | V3 Full E2E, V4 Load tests (k6) |
| L15 | 1 | N13 First real use + stabilization |

## Most depended-on activities

Delays here ripple furthest, so they should be built early and solidly.

| ID | Activity | Direct dependents |
|---|---|---|
| K25 | Toast + inline banner | 21 |
| K28 | Skeleton + loading + empty state | 21 |
| K34 | Card / panel + section header + layouts | 19 |
| K2 | Typography | 17 |
| N5 | Schema + migrations baseline | 15 |
| K5 | Text field | 12 |
| N2 | Repository + monorepo setup | 11 |
| K26 | Inline confirm | 8 |
| K4 | Button | 7 |
| S1 | App Shell | 7 |
| K3 | Icon set | 6 |
| K22 | Popover | 6 |

## What the network says

1. **Two independent tracks until integration.** Backend (N5 → Accessors →
   Engines → Managers) and frontend (K1 → kit → Flows → Experiences) share
   only N2, N7 (API contract) and N8 (i18n catalog). With one developer
   this doesn't shorten anything by itself, but it means the order can
   follow **vertical slices** (one area end to end) instead of "all
   backend, then all frontend" — finished, testable features earlier and
   less risk of a late integration surprise.
2. **The kit is the frontend's bottleneck.** Every Flow sits at level 7
   or later because of it. Building the kit first, against the design
   pages, is the PD-correct move and is what makes the 21 Flows fast.
3. **The longest chain (by count) runs through the frontend:** N1 → N2 →
   K1 Theme → K2 Typography → K22 Popover → K24 Tooltip → K38 Line chart →
   K37 Stat tile → FL21 Dashboard → X8 Review Insights → I11 → V1 Smoke →
   V2 Core E2E → V3 Full E2E → N13. Charts sit on it, so the chart pieces
   are the kit's riskiest part. Step 3 confirms with durations.
4. **Hubs:** the kit core (toast, loading/empty states, panel,
   typography, text field), the schema (N5) and the repo setup (N2) feed
   most of the network — mistakes there are the most expensive. The App
   Shell (S1) gates six Experiences.
5. **Guided Setup (FL6) waits for three Account Setup Flows** (FL11–FL13)
   — the composition is a real dependency, so Onboard (X2) finishes after
   Account Setup's Flows.

## Note for step 3

With **one developer**, the project's duration is close to the **sum of
the effort**, not the longest path: the network decides *order* and
which activities can be swapped without blocking anything (float), not
parallelism. Step 3 therefore estimates effort per activity, schedules it
for one developer + Claude, and presents options as different
**sequencing and scope** choices (e.g. layer-first vs. vertical slices,
what to cut first), not different team sizes.
