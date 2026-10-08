# Data model review — October 2026

Fifth review (requirements ✅ → use cases ✅ → call chains ✅ → sequences ✅
→ **data model** → API). Applies change-log rows D1–D24 to
`02-data-model.md` and `docs/design/diagrams/04-database-erd.html`, plus two gaps
found while checking the sequences against the tables.

## Changes by domain

**Identity & Household**
- `users` + **`theme`** (`dark` | `light` | `system`, default `dark`) and
  **`language`** (`pt-BR` | `en-US`) — FR-1.21. *(Q3)*
- **New `password_reset_tokens`** — `id`, `user_id` (FK, cascade),
  `token_hash`, `expires_at`, `used_at` (nullable), `created_at`. **Gap:**
  Reset Password's sequence looks tokens up (`findByResetToken`), but no
  table stored them. Hashed like refresh tokens; single-use.
- `invitations.invited_by_user_id` already exists — covers "who invited
  you" (FR-1.10). `sessions` unchanged ("sign out all others" deletes
  rows).

**Account Setup**
- `accounts.type` → `checking` | `savings` | `credit_card_only` |
  `investment` (OQ-76).

**Categories**
- `categories` + **`icon`** (in-code icon set) and **`color`** (palette
  **token**, e.g. `mint`, `sky` — not a hex, so the same category renders
  correctly in dark and light themes). Seeded defaults get preset values.
  *(Q1)*

**Investments & Goals**
- `investment_holdings`:
  - `asset_type` → full reference list (OQ-79): stock, fii, fund,
    mutual_fund, currency, crypto, real_estate, other | cdb, lc, lf, lci,
    lca, cra, cri, debenture, tesouro_direto, cd, treasury.
  - **`incentivised`** boolean, nullable (debentures only).
  - **`archived_by`** (`system` | `user`, nullable) beside `archived_at` —
    drives auto-unarchive (OQ-80).
  - **`matured_notified_at`** (nullable) — the daily job's "already
    notified" mark.
  - Account rule: the parent account is not `credit_card_only` (OQ-76) —
    application-level check in the Accessor (a cross-table check).
- `valuation_snapshots` + **`source`** (`manual` | `transaction`) and
  **`account_transaction_id`** (FK, nullable, unique, `ON DELETE
  CASCADE`) — automatic snapshots die with their transaction; update/
  delete of `transaction` rows refused by the Accessor (OQ-56).
- **New `index_rate_values`** — `id`, `household_id` (FK), `index_code`
  (`selic` | `cdi` | `ipca` | `igpm` — reference data), `value` *(Q2)*,
  `as_of_date`, `created_by_user_id` (nullable, anonymized on user
  deletion), `created_at`. Unique `(household_id, index_code,
  as_of_date)`. Unit (annual vs trailing 12 months) follows from the code.
- `objectives` → **`goals`**; `archived_at` → **`completed_at`** (OQ-78).
  `objective_allocations` → **`goal_allocations`**, `objective_id` →
  `goal_id`.
- Expected payout/taxes and payout series are **not stored** — computed on
  read (FR-5.9, FR-11.2).

**Transactions**
- **Drop `recurring_transaction_schedules`** (OQ-55).
- `account_transactions.source` → `manual` | `schedule` (investment cash
  events; was `manual` | `recurring`).
- Browse & Filter indexes: `account_transactions (account_id, date DESC,
  id)`, `(holding_id)`; `card_transactions (credit_card_id, date DESC,
  id)` — cursor = `(date, id)`.

**Insights**
- `notifications`: drop `message`; add **`params` JSONB**; `type` values
  `invitation.received`, `holding.matured` (OQ-82). Index `(user_id,
  seen_at)`.
- `dashboard_widgets` → **parked (v3)**: kept in the doc, not created by
  v1 migrations. *(Q4)*

Net effect: **26 tables documented → 27** (−1 recurring schedules, +1
password reset tokens, +1 index rate values; renames don't change the
count), of which **26 are created by v1 migrations** (`dashboard_widgets`
parked until v3). The ERD gets the same
changes.

## Decisions (stakeholder) — applied

- **Q1 — palette token, 18 colours** (OQ-85). The stakeholder rejected 6
  swatches as too few for a growing category list; the 18-colour palette
  (each with dark/light values ≥ 4.5:1 contrast) is in `docs/design/mockups/README.md`.
- **Q2 — yes, rates as `bigint` × 10,000** (OQ-86) — "so we can avoid the
  float issues"; `rate_value` fixed too.
- **Q3 — preference columns on `users`.**
- **Q4 — `dashboard_widgets` parked until v3** (documented, not migrated).

Applied to `02-data-model.md` (+ invariants for the holding account rule,
manual-only snapshot edits, unique index value per day, system vs user
archive) and `docs/design/diagrams/04-database-erd.html` (also fixes: `rate_type` /
`rate_value` were missing from the ERD; a stale "outstanding" list
replaced by a status note).

## Questions (as asked)

- **Q1** Category colour stored as a palette token (theme-aware), not a
  hex? *(recommend yes)*
- **Q2** Rates as `bigint` fixed-point, like money and quantity: **percent
  × 10,000** (10.50% → `105000`; 4 decimal places). Applies to the new
  `index_rate_values.value` **and fixes `investment_holdings.rate_value`**,
  which is `numeric` today — against the doc's own "no numeric anywhere"
  rule. *(recommend yes)*
- **Q3** Preferences as two columns on `users` rather than a separate
  table or JSON? *(recommend yes — two known fields, both always set)*
- **Q4** Keep `dashboard_widgets` documented but parked (not migrated)
  until v3? *(recommend yes)*
