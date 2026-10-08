# Sequence diagram review — October 2026

Fourth review (requirements ✅ → use cases ✅ → call chains ✅ →
**sequences** → data model → API). Sequence diagrams add what call chains
don't show: the **HTTP route**, method names, status codes and `alt`
branches. So this review also fixes the **routes** the API review will
then write into `openapi.yaml`.

## Scope

- **Backend sequences** (`docs/design/diagrams/sequences/`, 47 generated from
  `docs/design/diagrams/scripts/gen_<set>.py`): updated here.
- **Frontend (EBD) sequences** (`docs/design/diagrams/ebd-sequences/`, 15 Flows):
  **recommend reviewing them together with the EBD decomposition**,
  after the API review. The design round changed the frontend structure
  itself (nav drawer + household switcher, Rates tab, Value history,
  notification inbox, fixed Dashboard, guided setup per household), so
  the Experiences/Flows have to be re-decomposed first; redrawing their
  sequences now would mean drawing them twice.

## Conventions applied to every touched diagram

- **Error responses use OQ-83's codes**: `alt` branches name the code,
  e.g. `422 goal.allocation_exceeds_100`, `409 holding.not_market_priced`.
- **"Objective" → "Goal"** everywhere (participant `GoalAccessor`, routes).
- **Notifications are type + params** (OQ-82) wherever one is delivered.

## Routes

Existing routes keep their shape; new or changed ones:

| Use case | Route | Status |
|---|---|---|
| Goals (5) | `/objectives…` → **`/goals`**, `/goals/{goalId}`, `POST /goals/{goalId}/complete`, `POST /goals/{goalId}/reopen`, `GET /goals/{goalId}/progress` | renamed |
| View Goals | `GET /goals` — list **with progress per currency** | changed |
| Edit Holding (allocations) | `PATCH /holdings/{holdingId}` — body `{allocations}` only | narrowed |
| Record Market Value | `POST /holdings/{holdingId}/valuation-snapshots` | new |
| Edit / Delete Market Value | `PATCH` / `DELETE /holdings/{holdingId}/valuation-snapshots/{snapshotId}` | new |
| Record Index Rate | `POST /index-rates/{index}/values` | new |
| Edit / Delete Index Rate | `PATCH` / `DELETE /index-rates/{index}/values/{valueId}` | new |
| (read for Rates tab) | `GET /index-rates` — every index with its history | new |
| View Investments | `GET /reports/investments-overview` (net worth + change, payout this month, allocations, coming due); `GET /reports/payouts?holdingIds=…` (12-month series — refetched alone when the dropdown changes); `GET /accounts/{accountId}/holdings` gains `expectedPayout` / `expectedTaxes` | new / changed |
| Browse & Filter | `GET /transactions` — now **both ledgers merged**, filters `kinds, accountIds, creditCardIds, categoryIds, holdingId, from, to`, cursor pagination | changed |
| View Month Overview | `GET /reports/month-overview?year=&month=` | new |
| List My Households | `GET /households` + `GET /users/me/invitations` (both exist) | unchanged |
| Revoke all other sessions | `DELETE /users/me/sessions` (keeps the current one) | new |
| Edit User (preferences) | `PATCH /users/me` gains `preferences {theme, language}` | changed |
| View Dashboard | `GET /dashboard` — fixed panels | changed |
| Archive Matured Holding | `POST /holdings/{holdingId}/archive` (exists) | unchanged |
| Notify Matured Holding | no route (daily trigger) | new |
| Recurring | `/accounts/{accountId}/recurring-schedules`, `/recurring-schedules/{scheduleId}/end` | **removed** |
| Dashboard widgets | `PATCH /dashboard/widgets` | **deferred v3** |
| Reports | `GET /reports/{reportType}` is **v1** for the fixed types `month-overview`, `investments-overview`, `payouts`; ad-hoc types (spending by category, income vs expense) and `/reports/transactions/export` are **deferred v2** | changed |

## Diagram changes

**Rewritten (8):** Record Transaction (no recurring, no threshold
notification, automatic snapshot, bundled allocations, auto-archive),
Edit Transaction and Delete Transaction (auto-unarchive, automatic
snapshot), Edit Holding (allocations only), Archive Holding (from the
notification, `by=user`), Generate Scheduled Cash Event
(`investmentsDaily`), View Dashboard (fixed), Revoke Session (+ all
others).
**Light edits (6):** Invite User (type + params notification), Create
User / Reset / Change Password (12 chars → `422 password.too_short`), Edit
User (preferences), View Notifications (rendered from type + params).
**Renamed (5):** Goals set, with Complete / Reopen.
**Marked deferred (3):** Edit Dashboard Layout (v3), View Report, Export
CSV (v2).
**New (12):** one per new use case, following the call chains.

Result: **47 → 59 backend sequence diagrams**, matching the use cases and
call chains one-to-one.

## Decisions (stakeholder)

- **Q1 — keep the new reads under `/reports`**: month overview, investments
  overview and payouts are reports, and reports will expand later. They
  are fixed v1 types of `GET /reports/{reportType}`.
- **Q2 — yes**: EBD sequences are reviewed with the EBD decomposition after
  the API review; expected to diverge a lot from the current EBD doc,
  since the design round didn't follow it.

## Applied

59 backend sequences (was 47), regenerated from the per-set generators
(`gen_record_transactions.py`, `gen_track_investments.py`, `gen_goals.py` —
renamed from `gen_investment_objectives.py` — `gen_insights_reports.py`,
`gen_identity_household.py`, `gen_categories.py`,
`gen_financial_accounts.py`, `gen_budget_spending.py`,
`gen_audit_review.py`). Every error branch now carries an OQ-83 code (e.g.
`409 goal.allocation_exceeds_100`, `401 auth.invalid_credentials` — kept
identical for unknown user and wrong password). Found while applying:
- Archive Holding had no authorization check — added.
- "Sign out all others" reuses the existing
  `SessionAccessor.deleteAllExceptCurrent` (from Change Password) instead
  of a new method; VBD doc and call chains aligned.
- **Open — email in v1.** Reset Password delivers the reset link by
  **email** through `NotificationDeliveryUtility` (FR-1.13; the user isn't
  logged in, so in-app can't work). That contradicts "in-app only in v1"
  (OQ-68) and needs server-side text in the user's language (OQ-82's
  Engine trigger). See the question below.

- **Q3 — decided (OQ-84): email goes through `NotificationDeliveryUtility`**,
  not a new accessor — sending is static, only the provider changes, and
  that's the Utility's configuration. v1 email = password reset only.

## Questions (as asked)


- **Q1** Approve the route table? *(Main judgement calls: `/month-overview`
  and `/investments/*` as their own resources rather than under
  `/reports`, since reports are v2; payout series split out so the
  dropdown refetches only the chart.)*
- **Q2** Review the EBD sequences together with the EBD decomposition,
  after the API review, rather than now? *(recommend yes)*

- **Q3 (raised while applying)** How should the password-reset email be
  sent? *Recommend:* an `EmailChannelAccessor` (external provider) behind
  `NotificationDeliveryUtility`'s channel port, used in v1 **only** for
  transactional auth email (password reset). It's sent as type
  `password.reset` + params + the user's language; the channel accessor
  fills a template from the shared `packages/i18n` catalog — a format
  translation, the same kind of work any Accessor does for its external
  system — so it doesn't yet trigger the `NotificationEngine` (that stays
  reserved for preferences, digests, quiet hours). In-app remains the only
  channel for notifications.
