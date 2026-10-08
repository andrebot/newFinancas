# Data Model / ERD

> **Data model review, Oct 2026** (`09-data-model-review-2026-10.md`,
> VBD Round 9): "Objective" → "Goal" (`goals`, `goal_allocations`,
> `completed_at`); `recurring_transaction_schedules` dropped; new
> `password_reset_tokens` and `index_rate_values`; preferences on
> `users`; category `icon` + `color` (18-token palette, OQ-85); holding
> `incentivised` / `archived_by` / `matured_notified_at`; snapshot
> `source` + transaction link; notifications `params` JSONB;
> `dashboard_widgets` parked until v3; rates as `bigint` × 10,000
> (OQ-86). **27 tables documented, 26 created by v1 migrations.**

The layer below the VBD decomposition (`docs/architecture/backend/01-vbd-decomposition.md`),
which fixed component *boundaries* but explicitly deferred column lists
and constraint syntax to this step (§7, "Still open"). This document
derives tables directly from the backend's Resource Accessors (**18
active as of VBD Round 9**) — each Accessor's owned entity/entities become one or more
tables here, and each Accessor's documented **validated-write invariant**
is resolved into either a real database constraint or an explicit
application-level check, closing the exact question §7 left open.

Parked Accessors (`PortfolioAccessor`, `OpenBankingConnectionAccessor`,
`OpenFinanceBrasilAccessor`, `USOpenBankingAccessor`,
`MarketAnalysisProviderAccessor`) are not modeled yet — same deferral as
the backend doc, revisited when their CUCs are un-deferred.

Stack: PostgreSQL + Drizzle ORM (per the project's stack table in
`README.md`).

**Cross-cutting design point, applies across every domain below:**
FR-1.17's GDPR/LGPD hard-delete distinguishes **personal** data (deleted
outright with the user) from **shared** household data the user
contributed to (retained, but with the actor reference cleared —
"anonymized," not deleted). Every table that can hold shared data needs
its creator/actor-reference column to be a **nullable** FK, with
anonymization implemented as an application-level routine (walk the
relevant tables for that user, null the reference) — not a DB cascade,
since cascading would delete the shared record itself, which is exactly
what FR-1.17 says must *not* happen to shared data. This is flagged
per-table below rather than re-explained each time.

**Trigger equivalence, confirmed during the Investments/Goals
pass:** this same personal-vs-shared branch fires on **two** triggers,
not just full account deletion — a user being deleted (FR-1.17) **and**
a user leaving or being removed from a household (FR-1.11). From that
household's perspective the effect on the user's personal data within it
is identical either way: "the user removed their finances from the
household." `household_memberships` already treats both triggers as
equivalent (see Identity & Household below, "deleted outright when a
user leaves or is deleted"); this extends the same equivalence to every
personal-data table in every domain below, including the Accounts
section already written. Shared data the user contributed simply has its
actor reference nulled and lives on either way, exactly as before — a
shared Goal's allocations to a departing member's now-deleted
Holdings just disappear along with the Holdings, and its progress
(derived live, FR-8.8) recomputes from whatever Holdings remain. No
blocking, no special-cased history preservation.

**Money representation, revised during the API design pass
(`docs/architecture/03-api-design.md`):** every monetary column in every
domain below — `target_amount`, `cost_basis`, `ending_balance`,
`opening_balance`, `spend_amount`, `valuation`, `amount`,
`ending_outstanding_balance`, `opening_outstanding_balance` — is a
**`bigint`, an integer count of the currency's minor unit (cents for
USD/BRL, the only two currencies in v1 scope), never `decimal`/
`numeric`**. Originally specified as `decimal` with a string wire format
at the API layer; revised because keeping `numeric` in Postgres would
have just relocated the string-parsing friction into the backend (the
Postgres driver returns `numeric` columns as JS strings by default,
specifically to avoid float precision loss) instead of eliminating it.
One representation, no conversion step anywhere in the stack — DB,
backend, API, and frontend all do plain integer arithmetic on the same
value.

`investment_holdings.quantity` gets the same treatment, closing the
question the first pass left open: also **`bigint`**, a fixed-point
integer count of **1e-8 units** (8 decimal places, scale factor
100,000,000) — `10` shares is `1_000_000_000`; Tesouro Direto's `0.01`
minimum increment is `1_000_000`. Unlike currency, there's no ISO
standard giving investment quantity a natural per-instrument exponent
(a whole-share stock, a 0.01-precision Treasury bond, and a
finer-grained fund unit all coexist), so this picks one fixed exponent
generous enough to losslessly represent every asset type in FR-5.1/
FR-11.1's scope, the same "one fixed convention, no lookup table" choice
already made for currency assuming 2 decimals. Realistic household
holdings stay many orders of magnitude below `Number.MAX_SAFE_INTEGER`
at this scale, so backend/frontend arithmetic never needs a bigint
library, only plain integers.

`goal_allocations.percentage` — **revised in the API review (Oct 2026):
whole-percent integer** (`60` = 60%, 1–100, OQ-87); the FR-8.3 100% cap
becomes exact integer arithmetic. Contribution = value × pct / 100,
rounded half-up to the cent.

**Rates (Oct 2026, OQ-86):** `investment_holdings.rate_value` (was
`numeric`, against this section's own rule) and the new
`index_rate_values.value` are **`bigint` fixed-point, percent ×
10,000** — 10.50% is `105000`, 4 decimal places. Same reason as money and
quantity: no float or string-parsing anywhere in the stack.

## Identity & Household

Backs `IdentityManager`'s Accessors: `UserAccessor`, `SessionAccessor`,
`HouseholdAccessor`, `InvitationAccessor`.

### Tables

- **`users`** — `id` (PK), `email` (unique), `password_hash`,
  `first_name`, `last_name` (OQ-29, resolved during this data-modeling
  pass — see `05-assumptions-and-open-questions.md`), `mfa_secret`,
  **`theme`** (`dark` | `light` | `system`, default `dark`) and
  **`language`** (`pt-BR` | `en-US`) — FR-1.21, columns not JSON (two
  known, always-set fields, Oct 2026), `created_at`.
- **`password_reset_tokens`** *(new, Oct 2026 — gap found in the data
  model review: Reset Password's sequence looks tokens up but nothing
  stored them)* — `id` (PK), `user_id` (FK → `users`, `ON DELETE
  CASCADE`), `token_hash` (hashed like refresh tokens, never stored raw),
  `expires_at`, `used_at` (nullable — single-use), `created_at`. A
  successful reset sets `used_at` and deletes every session (FR-1.13).
- **`mfa_recovery_codes`** — `id` (PK), `user_id` (FK → `users`),
  `code_hash`, `used_at` (nullable). Broken out as its own table rather
  than a blob column, since codes are consumed individually and
  single-use (FR-1.15/1.16).
- **`sessions`** — `id` (PK), `user_id` (FK → `users`),
  `refresh_token_hash`, `device_info`, `created_at`, `last_used_at`.
  Revoke/logout is a row delete, not a soft-delete flag — nothing in
  FR-1.3/1.9 needs a revoked session to remain visible.
- **`households`** — `id` (PK), `name`, `created_at`.
- **`household_memberships`** — `id` (PK), `household_id` (FK →
  `households`), `user_id` (FK → `users`), `role`, `joined_at`.
  `joined_at` isn't decorative — FR-1.18's succession rule
  ("longest-tenured Admin, else Member, else Viewer") reads it directly.
  This row is **deleted outright** when a user leaves or is deleted
  (they're no longer a member of anything) — the nullable-for-
  anonymization treatment does not apply here; it applies instead to
  other tables where this user appears as a creator/actor on *retained*
  shared data (transactions, budgets, goals — flagged in their own
  domains below).
- **`invitations`** *(own table, split from membership per the backend's
  Round-7 decision — own lifecycle independent of Membership)* — `id`
  (PK), `household_id` (FK), `invited_user_id` (FK → `users`, **not
  null**), `invited_by_user_id` (FK → `users`), `role`, `status`
  (pending/accepted/declined/revoked), `created_at`, `resolved_at`
  (nullable).

### Invariants — DB constraint vs. application-level

- **Exactly one Owner per household** → **real DB constraint**: a
  partial unique index on `household_memberships (household_id) WHERE
  role = 'Owner'`. This also makes ownership transfer atomic "for free"
  — demote-then-promote inside one transaction can never leave two Owner
  rows, because the second write would violate the index (OQ-28's "never
  zero or two Owners" requirement, satisfied structurally rather than by
  application discipline alone).
- **Owner can only be removed by their own action** (FR-1.11) →
  application-level (concerns *who the actor is*, not the data's shape).
- **Auto-succession on Owner departure** (FR-1.18) → application-level
  (multi-step "pick the next Owner" decision logic, not a single
  constraint).
- **Invitation targets an existing user only** (FR-1.19) → **real DB
  constraint**: `invited_user_id NOT NULL` with a `NOT NULL` FK is
  sufficient on its own — there's no separate "invite by email" column
  to reject in the first place.

## Account Setup / Containers

Backs `AccountManager`'s Accessors. Covered in sub-chunks; this pass:
**Financial Accounts + Credit Cards** (`AccountAccessor`,
`CreditCardAccessor`).

**Design principle established here, applies wherever it recurs below:**
the backend doc distinguishes two shapes of "reference data" — Category
is a real household-customizable **table** (`CategoryAccessor` exists
precisely because it needs one); Credit Card network, Transaction Kind,
Widget Type, and Role are developer-versioned **enums** validated
in-code, never their own table (§2.3's "considered and rejected
`RolePermissionAccessor`" reasoning). So `credit_cards.network` is a
plain `varchar` checked against an in-code list, not a FK to a lookup
table.

### Tables

- **`accounts`** — `id` (PK), `household_id` (FK), `owner_user_id` (FK →
  `users`, **nullable** — see below), `name`, `type` (`checking` | `savings` |
  `credit_card_only` | `investment` — OQ-76, Oct 2026; was six types incl.
  cash/other), `currency`, `visibility` (personal/
  shared), `archived_at` (nullable — one-way, FR-2.4/OQ-34, so a plain
  timestamp is enough, no unarchive path), `created_at`. **No
  `opening_balance` column — corrected this pass.** A single account-
  level value made no sense once balances are tracked per month below;
  keeping both invites the two copies to drift. FR-2.1's user-supplied
  starting figure now lives in exactly one place: the `opening_balance`
  of the account's *first* `account_month_balances` row.
- **`credit_cards`** — `id` (PK), `account_id` (FK → `accounts`),
  `network` (plain varchar, in-code reference list), `last4`,
  `closing_day`, `due_day`, `expiration_month`, `expiration_year`,
  `created_at`. No owner/anonymization column needed — a card's
  visibility is entirely inherited from its parent account. **No opening-
  balance concern here** — unlike Accounts (FR-2.1), FR-2.10 gives a
  Credit Card no user-supplied starting figure, so a card's first month
  row always opens at a fixed `0`, never a user input.
- **`account_month_balances`** *(confirmed — doubles as storage for
  FR-5.4/FR-6.6's balance-by-month and net-worth-trend reporting, not
  just a cache)* — `id` (PK), `account_id` (FK), `year`, `month`,
  **`opening_balance`** *(added this pass — see the chain-continuity
  invariant below)*, `ending_balance`, `updated_at`. Unique on
  `(account_id, year, month)`. "Current balance" is simply the
  `ending_balance` of the row for today's `(year, month)`.
- **`credit_card_month_balances`** *(same shape, same reasoning, extended
  the same way this pass)* — `id` (PK), `credit_card_id` (FK), `year`,
  `month`, **`opening_outstanding_balance`**, `ending_outstanding_balance`,
  `updated_at`. Unique on `(credit_card_id, year, month)`.

### Invariants — DB constraint vs. application-level

- **`accounts.owner_user_id` is one column serving two roles** — for a
  *personal* account it's who owns it (FR-1.17 hard-deletes the whole
  account when they're deleted, **or when they leave/are removed from the
  household** — same trigger equivalence, see the cross-cutting note
  above); for a *shared* account it's just provenance (who added it), and
  it gets nulled on either trigger while the account survives. A single
  FK can't conditionally cascade based on another column's value, so this
  branch (check `visibility`, then cascade-delete or null) is
  **application-level**, executed by the deletion/leave/removal routine —
  not a DB-level `ON DELETE` clause.
- **`type` and `currency` immutable once set** (OQ-32, FR-2.2) →
  **application-level** (no edit control exposed for these fields) —
  a DB trigger to block column updates felt like more machinery than the
  requirement calls for.
- **Credit Card can only attach to a checking/savings/credit_card-type
  account** (FR-2.7) → **application-level** (a cross-table condition on
  `accounts.type`, not expressible as a plain column constraint).
- **`account_month_balances`/`credit_card_month_balances` unique key**
  `(account_id/credit_card_id, year, month)` → **real DB constraint**.
- **`opening_balance` of month N equals `ending_balance` of month N-1 —
  chain continuity (new invariant, follows from adding `opening_balance`
  this pass)** → **application-level**: no `CHECK` can reference a
  different row, so this is maintained procedurally by whatever writes
  these rows, not declared. The one exception per account is its
  first-ever month row, where `opening_balance` is the FR-2.1
  user-supplied figure rather than a carried-forward value — every row
  after that is mechanical. Credit Cards have no exception case at all:
  every card's first row opens at `0`, so its whole chain is mechanical
  from the start.
- **Backdated-transaction cascade (confirmed, real complexity worth
  flagging):** because each month's balance is *cumulative*, not an
  independent per-period target like Budget Periods, a transaction
  entered today but dated in a past month has to update **every
  subsequent month's row up through the current one**, not just the
  month it lands in. With `opening_balance` now stored per row, the
  mechanic is simpler than it would otherwise be: adjust the landing
  month's `ending_balance` by the transaction's delta, then walk every
  later month forward shifting **both** `opening_balance` and
  `ending_balance` by that same delta — the chain-continuity invariant
  above guarantees the two columns always move together, so the cascade
  never needs to recompute a month's internal net movement, just carry
  one constant delta forward. This is unavoidably **application-level**
  (a forward walk across however many months separate the transaction's
  date from today), executed inside the Accessor's validated write.
  Editing or deleting a backdated transaction needs the same walk in
  reverse (delta negated). Investment Holdings keep their own
  already-established `ValuationSnapshotAccessor` pattern (event-driven,
  per-update snapshot, FR-5.2) rather than this monthly shape, since a
  Holding's valuation changes from both transactions *and* manual edits,
  not a pure ledger sum.

## Categories

Backs `AccountManager`'s `CategoryAccessor`. This is the domain where the
"Category is a real table, not an enum" design principle (stated above,
under Financial Accounts) actually cashes out.

### Tables

- **`categories`** — `id` (PK), `household_id` (FK → `households`),
  `name`, **`icon`** (in-code icon set), **`color`** (one of the 18
  palette **tokens** — `mint`, `sky`, … — never a hex, so it renders
  correctly in both themes; OQ-85, Oct 2026), `archived_at` (nullable, one-way — same pattern as
  `accounts.archived_at`, FR-10.3), `created_at`. **No owner/actor-
  reference column** — unlike Accounts/Budgets/Goals, FR-10 never
  gives Category a personal/shared visibility split; it's pure
  household-shared taxonomy, so it falls outside FR-1.17's anonymization
  pattern entirely — there's nothing to null when a user is deleted.
- **`subcategories`** — `id` (PK), `category_id` (FK → `categories`,
  **not null**), `name`, `archived_at` (nullable, independent lifecycle
  from its parent per FR-10.4), `created_at`.

### Invariants — DB constraint vs. application-level

- **Exactly two levels — a Subcategory cannot itself have subcategories
  (FR-10.2)** → **structural**, stronger than an ordinary DB constraint:
  `subcategories` simply has no parent-subcategory column, so there is no
  way to represent a third level in this schema no matter what's
  inserted — the same "no column to violate" shape as `invitations
  .invited_user_id` in the Identity domain above.
- **Archiving a Category cascades to archive all its Subcategories
  (FR-10.4)** → **application-level**, inside `CategoryAccessor`'s
  validated write (stamp the Category's `archived_at`, then loop its live
  Subcategories doing the same, one transaction) — a plain FK clause
  can't express "also stamp this timestamp on my children."
- **Archiving a Subcategory does not affect its parent Category or
  siblings (FR-10.4)** → nothing to enforce; it's a single-row `UPDATE`,
  which is the default behavior once nothing cascades.
- **Default Category set seeded per household (FR-10.1)** → not a
  constraint; `CategoryAccessor.seedDefaults(householdId)` is a plain
  multi-row `INSERT`, triggered by `AccountManager`'s subscription to
  `household.created` (VBD doc §3.1b), not something modeled in the
  schema itself.
- No hard delete exists for either table — FR-10.3 only defines archive,
  the same shape as Accounts/Holdings, not Budget's hard-delete shape.

## Budgets

Backs `AccountManager`'s `BudgetAccessor`. Two gaps the requirements
didn't resolve got closed during this pass, the same way `users.first_
name`/`last_name` closed OQ-29 earlier:

- **`budgets` gets a `name` column.** FR-4.1 never states one, but a
  Budget needs a label distinct from its target list for the FR-4.3/6.1
  status widget to display.
- **FR-4.4's configurable alert threshold is dropped, not modeled.** The
  user's call: per-transaction budget-crossing alerts would be too noisy
  in practice. **This leaves a cascading edit still outstanding** —
  FR-4.4, FR-6.5's "budget threshold crossed" notification-type entry,
  and the VBD doc's §3.1 pipeline (`accrueIfClaimed`'s "returns whether a
  threshold was crossed" and the resulting `NotificationDeliveryUtility
  .deliver` fire-and-forget) all still describe the dropped behavior and
  need updating — flagged in "Not yet done" below, not yet done.

### Tables

- **`budgets`** — `id` (PK), `household_id` (FK), `owner_user_id` (FK →
  `users`, **nullable** — same dual-role provenance pattern as
  `accounts.owner_user_id`: identity for a *personal* Budget, mere
  provenance for a *shared* one, FR-4.2/FR-1.17), `name`, `target_amount`,
  `currency` (see below — not an FR-4 requirement as stated, but a real
  gap), `visibility` (personal/shared), `created_at`.
- **`budget_targets`** *(the "one or more targets" join FR-4.1
  describes)* — `id` (PK), `budget_id` (FK → `budgets`), `category_id`
  (FK → `categories`, nullable), `subcategory_id` (FK → `subcategories`,
  nullable) — exactly one of the two is set per row. Also carries
  `household_id`, `visibility`, `owner_user_id`, denormalized from the
  parent Budget at insert time — see the FR-4.7 invariant below for why.
- **`budget_periods`** — `id` (PK), `budget_id` (FK → `budgets`,
  **nullable** — see the FR-4.10 invariant below), `year`, `month`,
  `target_amount` (immutable snapshot, FR-4.9), `spend_amount` (running
  accrual total, updated by `accrueIfClaimed`), `created_at`. Unique on
  `(budget_id, year, month)` — Postgres treats each `NULL` as distinct, so
  this naturally stops constraining a period once its `budget_id` has
  been cleared by a parent deletion, which is exactly the desired
  behavior for an orphaned historical row.

### Invariants — DB constraint vs. application-level

- **`target_amount`'s currency** — not stated in FR-4, but a real gap:
  there's no household base-currency concept anywhere in the
  requirements, only per-account currency (FR-2.2). Resolved by giving
  `budgets.currency` its own column, same shape as `accounts.currency`,
  and treating it as a scope filter: `accrueIfClaimed` only counts a
  Transaction whose Account currency matches the Budget's. Same "cross-
  currency blending isn't this layer's job" precedent already set for
  `ReportingEngine`/net worth (OQ-49) — **application-level**, since it's
  a per-call filter condition, not a stored relationship.
- **A Category/Subcategory claimed by at most one Budget in the same
  scope — the literal-duplicate half of FR-4.7** → **real DB constraint**,
  matching the VBD doc's own characterization ("a uniqueness constraint,
  not application logic," §2.3): partial unique indexes on
  `budget_targets (household_id, visibility, owner_user_id, category_id)
  WHERE category_id IS NOT NULL`, and the mirror-image index for
  `subcategory_id`. The three scope columns are denormalized onto
  `budget_targets` specifically so this can be a plain index — a unique
  constraint can't reach into a separate `budgets` row to read its
  `visibility`/`owner_user_id`.
- **Assigning a whole Category reserves all its Subcategories too —
  FR-4.6/4.7's rollup half** → **application-level**, and genuinely can't
  be folded into the index above: rejecting a Subcategory claim because
  its *parent Category* is already claimed elsewhere requires walking
  `subcategories.category_id` against other Budgets' claims — a
  cross-row hierarchy check no unique index can express. Executed inside
  `BudgetAccessor.assignTarget(...)` before the insert.
- **Budget deletion is a hard delete of the live definition only; Budget
  Periods survive (FR-4.10/OQ-40)** → **real DB constraint**, and simpler
  than the parallel `accounts.owner_user_id` case: Budget deletion has no
  personal/shared branching (it's unconditionally a hard delete, full
  stop — no "cascade for personal, null for shared" decision to make), so
  the history-preserving behavior is just `budget_periods.budget_id` as a
  nullable FK with `ON DELETE SET NULL` — no application code involved.
  `budget_targets.budget_id`, by contrast, is a plain `ON DELETE CASCADE`
  — those rows are the live definition's own claims, with no independent
  history to protect.
- **`budget_periods.target_amount` is immutable per period; editing a
  Budget's target only affects current/future periods (FR-4.9)** →
  **application-level**, by omission rather than an active check: only
  the currently-open period's row is ever written by `accrueIfClaimed`/
  the edit path; nothing in the Accessor's write surface ever revisits a
  past period's `target_amount`, so there's no code path to guard against.
- **Exactly one of `category_id`/`subcategory_id` set per `budget_targets`
  row** → **real DB constraint**: `CHECK ((category_id IS NULL) <>
  (subcategory_id IS NULL))`.

## Investments & Goals

Backs `AccountManager`'s `InvestmentHoldingAccessor`,
`ValuationSnapshotAccessor`, and `GoalAccessor`, plus the
`InvestmentProductEngine`/FR-11 schedule data those Accessors persist.

### Tables

- **`investment_holdings`** — `id` (PK), `account_id` (FK → `accounts`,
  **not null**, `ON DELETE CASCADE` — FR-5.1: a Holding "belongs to
  exactly one account... not a standalone record" — checking, savings or
  investment since OQ-76), `asset_type` (reference data, in-code list,
  FR-5.1/FR-11.1/OQ-79 — market-priced: stock, fii, fund, mutual_fund,
  currency, crypto, real_estate, other; fixed-term: cdb, lc, lf, lci,
  lca, cra, cri, debenture, tesouro_direto, cd, treasury), `ticker`,
  `quantity`, `cost_basis`, `rate_type`/`rate_value` (nullable —
  fixed-term types only, OQ-50; `rate_type` one of
  fixed/cdi/ipca/igpm/selic, `rate_value` **`bigint` percent × 10,000**
  (OQ-86), immutable once set at purchase), **`incentivised`** (boolean,
  nullable — debentures only, OQ-79), `archived_at` (nullable, one-way
  for user archives, FR-5.8/OQ-43), **`archived_by`** (`system` |
  `user`, nullable — a `system` archive is undone automatically if its
  zeroing transaction is edited/deleted, OQ-80), **`matured_notified_at`**
  (nullable — set by the daily job after the "past due" notification,
  OQ-72), `created_at`. The parent account must not be
  `credit_card_only` (OQ-76) — application-level, see invariants. **No `currency`
  column** — FR-2.2 already makes every account single-currency and a
  Holding never exists outside exactly one account, so it inherits
  currency the same way `credit_cards` inherits visibility from its
  account, rather than duplicating the column; FR-8.2's "Holdings in
  multiple currencies" reads as *different accounts* holding different
  currencies, not one account holding multi-currency Holdings. **No
  `owner_user_id`/`visibility`** either, for the same inheritance reason
  — a Holding's personal/shared status is entirely its parent account's.
  **One row per purchase for FR-11.1's fixed-term instrument types
  (OQ-50, resolved this pass)** — a CDB/LCI/LCA/Tesouro Direto/CD/Treasury
  bond purchase always inserts a new Holding, never accumulates into an
  existing one, since each is its own immutable contract with its own
  rate/purchase date/maturity date; only stock/FII/fund/other purchases
  match-by-ticker-and-accumulate the way FR-5.1 originally described.
- **`valuation_snapshots`** — `id` (PK), `holding_id` (FK, not null),
  `valuation` (the *total* dollar figure, not a per-unit price — FR-5.2:
  "current valuation is simply its latest snapshot"), `as_of_date`,
  **`source`** (`manual` | `transaction`, Oct 2026 — OQ-56),
  **`account_transaction_id`** (FK → `account_transactions`, nullable,
  unique, `ON DELETE CASCADE` — set for `transaction` snapshots so they
  die with their transaction), `created_at`. **Manual snapshots are
  editable/deletable** (OQ-56 — the old "never overwrite" rule is gone);
  `transaction` ones change only through their transaction. Quantity/cost basis stay as plain mutable columns on
  `investment_holdings` itself, updated in place by `applyTrade` — only
  valuation gets the snapshot treatment, per FR-5.2's explicit "record a
  snapshot, don't overwrite" language. **Never written for FR-11.1's
  fixed-term instrument types (OQ-51, resolved this pass)** — a
  fixed-term Holding's value is simply its `cost_basis`, constant from
  purchase until a `redemption`-kind schedule entry posts and zeroes it
  out, since nothing about its value moves between the contractual cash
  events `investment_schedule_entries` already tracks. This table exists
  purely for market-priced Holdings (stock/FII/fund/other), where there's
  no formula to reconstruct a past price from and no live market-data
  feed to read one off either (`MarketAnalysisProviderAccessor` is
  parked) — recording it at the time is the only way FR-5.4/FR-8.7's
  by-month history stays answerable later.
- **`investment_schedule_entries`** *(FR-11, persists
  `InvestmentProductEngine`'s output via `applySchedule`)* — `id` (PK),
  `holding_id` (FK), `kind` (`interest_payment`/`redemption`/`tax` —
  reference data; FR-11.3 lists these as three separately-posted
  Transaction kinds), `amount`, `date`, `posted_at` (nullable — set once
  the cron-driven `postDueInvestmentCashEvents()` (VBD doc §3.2a) actually
  posts it; `findDueScheduleEntries(today)` reads `WHERE posted_at IS
  NULL AND date <= today`), `created_at`. **No separate `maturity_date`
  column anywhere** — it's just the `date` of the row whose `kind` is
  `redemption`; one source of truth instead of two.
- **`index_rate_values`** *(new, Oct 2026 — FR-11.6/OQ-59)* — `id` (PK),
  `household_id` (FK → `households`), `index_code` (`selic` | `cdi` |
  `ipca` | `igpm` — reference data, in-code list; unit follows from the
  code: annual % for selic/cdi, trailing 12-month % for ipca/igpm),
  `value` (**`bigint` percent × 10,000**, OQ-86), `as_of_date`,
  `created_by_user_id` (FK → `users`, nullable — anonymized on user
  deletion, FR-1.17), `created_at`. Unique on `(household_id,
  index_code, as_of_date)`. Latest value per index = highest
  `as_of_date`. Backs `IndexRateAccessor`.
- **`goals`** — `id` (PK), `household_id` (FK), `owner_user_id` (FK
  → `users`, nullable — same dual-role personal/shared provenance pattern
  as `accounts`/`budgets`, including the trigger equivalence in the
  cross-cutting note above), `name`, `target_amount`, `target_currency`,
  `due_date`, `visibility`, **`completed_at`** (nullable — renamed from `archived_at`, OQ-78; **the one reversible lifecycle flag in the whole system**, FR-8.8/8.9: complete sets it, reopen nulls it), `created_at`.
- **`goal_allocations`** — `id` (PK), `holding_id` (FK →
  `investment_holdings`), `goal_id` (FK → `goals`),
  `percentage`, `created_at`.

### Invariants — DB constraint vs. application-level

- **Holding archive is one-way for users (FR-5.8/OQ-43)** →
  **application-level** (no unarchive endpoint exposed). **Oct 2026:** a
  `system` archive (quantity reached 0) is undone automatically by
  `unarchiveIfSystemArchived` when its zeroing transaction is edited or
  deleted (OQ-80); `archived_by` tells the two apart.
- **A Holding's account is not `credit_card_only` (OQ-76)** →
  **application-level** in `InvestmentHoldingAccessor` — a cross-table
  condition, same precedent as FR-2.7.
- **Only `manual` snapshots can be edited/deleted directly (OQ-56)** →
  **application-level** in `ValuationSnapshotAccessor`; `transaction`
  snapshots follow their transaction via the FK `ON DELETE CASCADE` and
  `updateAutomatic`.
- **One value per index per day** → **DB constraint**: unique
  `(household_id, index_code, as_of_date)` on `index_rate_values`.
- **A fixed-term instrument purchase always creates a new Holding, never
  accumulates (OQ-50)** → **application-level**, and deliberately not a
  DB constraint: the schema doesn't prevent two `investment_holdings`
  rows sharing a ticker/account, it's `TransactionManager`'s investment-
  buy branch that decides, based on `asset_type`, whether to match-and-
  accumulate or always-insert. Nothing in the row shape itself
  distinguishes the two behaviors. This also closes a latent bug the
  original accumulate-everywhere rule would have caused: `investment_
  schedule_entries` computes one schedule *per purchase*, so two
  differently-dated purchases sharing one Holding would have left no way
  to tell which schedule entries belonged to which purchase.
- **"Snapshot, don't overwrite" (FR-5.2)** → **application-level**:
  `ValuationSnapshotAccessor`'s write path only ever `INSERT`s a new row,
  never `UPDATE`s an existing one — a behavioral guarantee of the
  Accessor's code, not something the schema itself can force.
- **Reporting reads `cost_basis` directly for fixed-term Holdings,
  `valuation_snapshots` for everyone else (OQ-51)** → **application-
  level**, a branch in `ReportingEngine`'s FR-5.3/5.4/8.5/8.7 read paths
  on `asset_type`, mirroring the write-side OQ-50 branch above. Not a
  schema-level distinction — `valuation_snapshots` simply never
  accumulates rows for a fixed-term Holding, so there's nothing there to
  read even if the query didn't branch.
- **`investment_schedule_entries` unique on `(holding_id, date, kind)`**
  → **real DB constraint** — guards against double-computing the same
  cash event (e.g. `InvestmentProductEngine` accidentally invoked twice
  for one purchase).
- **A single Holding's allocated percentages across all Goals never
  exceed 100% (FR-8.3)** → **application-level**: a cross-row `SUM`
  aggregate is not expressible as a plain `CHECK`, so `GoalAccessor
  .allocate(...)` computes and rejects it directly. Contrast with
  `percentage` itself, which **is** a real constraint: `CHECK (percentage
  > 0 AND percentage <= 100)`, a single-row range check.
- **`goal_allocations` unique on `(holding_id, goal_id)`** →
  **real DB constraint** — adjusting or removing an allocation (FR-8.6)
  is an `UPDATE`/`DELETE` on the one existing row, never a second insert
  for the same pair.
- **Goal supports both hard delete (FR-8.6, no history) and
  reversible archive (FR-8.8/8.9) — OQ-47's "third lifecycle pattern"**
  → two independent, real mechanisms on the same table: `DELETE` for the
  former, the nullable `archived_at` column (settable **and** clearable)
  for the latter. Neither needs more machinery than that.
- **Cascade tension, resolved (confirmed this pass):** `investment_
  holdings.account_id` cascading with its account, transitively taking
  `valuation_snapshots`/`investment_schedule_entries`/`goal_
  allocations` with it, means a personal account's deletion — whether
  from FR-1.17 user deletion **or** the user leaving/being removed from
  the household (cross-cutting note above) — can remove a Holding that
  was funding a still-live *shared* Goal. **Confirmed behavior, not
  a gap:** this is intended, not blocked. The Goal record itself
  (shared data) survives untouched; its progress is derived live (FR-8.8
  already states this, no independent per-period snapshot the way Budget
  Periods have), so it simply recomputes from whatever Holdings remain —
  "the user removed their finances from the household." No pre-delete
  guard, no special-cased history preservation.

## Transactions

Backs `TransactionManager`'s `AccountTransactionAccessor` and
`CardTransactionAccessor`. **Open Banking sync (FR-3.3) is out of scope
for this pass** — deferred the same way the other Open Banking Accessors
are parked at the top of this doc, revisited when that CUC is
un-deferred. Everything below assumes manual entry and scheduled investment cash
events only (recurring transactions dropped, OQ-55).

### Tables

- **`account_transactions`** — `id` (PK), `account_id` (FK →
  `accounts`), `kind` (reference data — the 14 account-targeting kinds
  from FR-3.1: withdrawal, deposit, boleto payment, Pix payment/receipt,
  transfer sent/received, credit card bill payment, investment
  buy/sell/dividend/interest/redemption/tax), **`effect`** (reference
  data, derived from `kind` via `EFFECT_BY_KIND` — see below), `date`,
  `amount`, `currency`, `category_id`/`subcategory_id` (nullable FKs),
  `description`, `holding_id` (FK → `investment_holdings`, **nullable**,
  set only for the 6 investment kinds, FR-3.8), `credit_card_id` (FK →
  `credit_cards`, **nullable**, set only for Credit Card Bill Payment,
  FR-3.7), `source` (reference data: `manual` | `schedule` —
  `schedule` = posted by `investmentsDaily` from
  `investment_schedule_entries`; was `manual`/`recurring` until OQ-55; no
  `open_banking` value until v2), `created_at`. **Indexes (Browse &
  Filter, FR-3.12):** `(account_id, date DESC, id)` and `(holding_id)` —
  cursor pagination on `(date, id)`.
- **`card_transactions`** — `id` (PK), `credit_card_id` (FK →
  `credit_cards`), `kind` (`charge`/`refund` — reference data,
  extendable, per FR-3.1's explicit "not a hardcoded enum"), `date`,
  `amount`, `currency`, `category_id`/`subcategory_id` (nullable FKs),
  `description`, `created_at`. **No `effect` column** —
  `CreditCardAccessor.applyChargeOrRefund(cardId, amount, kind)` takes
  `kind` directly (VBD doc §2.3); with only two kinds an indirection
  layer buys nothing. **No `source` column** — sync (FR-3.3, v2) is
  Account-Transaction-only. **Index:** `(credit_card_id, date DESC, id)`
  for Browse & Filter.
- ~~**`recurring_transaction_schedules`**~~ — **dropped, Oct 2026**
  (FR-3.5 removed, OQ-55).

### Why `effect` exists, and its value set

`kind` is rich, extensible reference data; `effect` is a small, closed
set that both **dispatches** the write (which Accessor call happens) and
**classifies for reporting** (FR-3.6's transfer exclusion). Value set:
`movement` (deposit/withdrawal/boleto/Pix/dividend/interest/tax — all
plain cash ± movements via `AccountAccessor.applyMovement`; dividend/
interest/tax stay `movement` since FR-3.8 calls them "pure cash events,"
not quantity-changing), `transfer` (transfer sent/received — same
Accessor call as `movement`, tagged separately so `ReportingEngine` can
exclude it from income/expense, FR-3.6), `bill_payment` (→
`CreditCardAccessor.applyBillPayment`), `investment_trade` (buy/sell/
redemption → `InvestmentHoldingAccessor.applyTrade`).

**It's persisted, not recomputed at read time** — same reasoning as
`budget_periods.target_amount`: if `EFFECT_BY_KIND` reference data ever
changes, a historical transaction must keep the effect that was actually
in force when the money moved, or reports would silently rewrite
history.

### Invariants — DB constraint vs. application-level

- **Subcategory must belong to the chosen Category (FR-3.4)** →
  **application-level** — same precedent as FR-2.7: a cross-table
  condition no `CHECK` can express without a trigger.
- **Kind validity narrowed by target** — investment kinds for any
  account except `credit_card_only` (OQ-76, Oct 2026); a Credit Card target only offers
  charge/refund (FR-3.1) → **application-level** — another cross-table
  condition (needs `accounts.type`), and deliberately *not* a hardcoded
  `CHECK (kind IN (...))` either, since FR-3.1 explicitly wants `kind`
  extendable without a schema change.
- **Editing/deleting a transaction (FR-3.2) must reverse-then-reapply
  every downstream effect** — the balance movement or holding quantity,
  *and* the budget accrual — → **application-level**, real complexity
  worth flagging: the same reverse/reapply shape as the Accounts domain's
  backdated-balance cascade, just now touching two or three Accessors
  atomically instead of one.
- **Bill payment doesn't double-count as budget spend (FR-4.5)** → not a
  special-cased skip anywhere in the pipeline; `accrueIfClaimed` is
  unconditionally called either way, but a bill payment transaction
  simply wouldn't be tagged with a Budget-claimed spend category, so
  FR-4.8's own "uncategorized-for-budgets is just not tracked" rule
  handles it without any extra mechanism.
- **Two separate ledgers, one bridge (OQ-16/FR-3.7)** — not really an
  "invariant" to enforce so much as a structural fact: `account_
  transactions` and `card_transactions` are two distinct tables with no
  FK between them, except that a Credit Card Bill Payment *is* an
  `account_transactions` row carrying a non-null `credit_card_id` — the
  one documented bridge, nothing else crosses.

## Insights

Backs `InsightsManager`'s `DashboardAccessor`, `AuditLogAccessor`, and
`NotificationInboxAccessor`. FR-6.2/6.3/6.6 (spending by category, income
vs. expense trend, account balance by month) need **no new tables at
all** — FR-6.6 says this explicitly ("this is a reporting view over
existing history, not a new data-model concept") and it holds for the
other two as well: `ReportingEngine` computes all three purely from
`account_transactions`/`card_transactions`/`categories`/`account_month_
balances`, already modeled.

### Tables

- **`dashboard_widgets`** *(**parked until v3**, OQ-67 — documented, not created by v1 migrations; the v1 Dashboard is fixed)* — `id` (PK), `user_id` (FK → `users`, **not
  null**), `widget_type` (reference data — the FR-6.7 library: account
  balances summary, recent transactions, budget status, net worth trend,
  account balance by month, spending by category, income vs. expense
  trend, Goal progress by month), `position` (for reordering,
  FR-6.1/6.8), `settings` (**JSONB** — FR-6.9's per-widget config: date
  range, plus whichever account/Budget/Goal/currency is relevant),
  `created_at`. No unique constraint on `(user_id, widget_type)` — FR-6.8
  explicitly allows the same type twice with different settings. **No
  separate `dashboards` table** — FR-6.1 gives the Dashboard itself no
  attribute beyond "the widgets a user has"; a table holding only
  `id`/`user_id` would be pure overhead. **`settings` is JSONB, not
  columns** — the fields that matter differ by `widget_type`, and most
  would sit null for any given row if split into columns, the same "sea
  of nulls" reasoning behind `investment_schedule_entries`.
- **`notifications`** *(FR-6.10; reworked Oct 2026 — OQ-68, OQ-82)* —
  `id` (PK), `user_id` (FK → `users`, not null), `type` (reference data —
  v1 values `invitation.received`, `holding.matured`), **`params`**
  (**JSONB** — IDs and raw values, e.g. `{invitationId, householdId,
  inviterUserId, role}`; **no display text** — the frontend renders and
  localizes it, NFR-I18N-3; replaces the old `message` column), `seen_at`
  (nullable — set in bulk when the inbox is opened, FR-6.10),
  `created_at`. Index `(user_id, seen_at)`. Producers in v1: Invite User
  and the daily matured-holding job.
- **`audit_log_entries`** *(FR-7.1/FR-7.2)* — `id` (PK), `actor_id`,
  `household_id`, `action`, `entity_type`, `entity_id`, `created_at`.
  **None of `actor_id`/`household_id`/`entity_id` are real foreign
  keys** — see the invariant below. `household_id` is a necessary
  addition beyond FR-7.1's literal "actor ID, timestamp, action, entity
  type, entity ID" list — FR-7.2's export is explicitly scoped "for
  their household," unimplementable without a stored scoping key. It's
  an ID, not a PII/before-after value, so it doesn't conflict with
  FR-7.1's minimalism intent.

### Invariants — DB constraint vs. application-level

- **Dashboard is personal-per-user, never shared (FR-6.8)** → simplest
  anonymization case in this whole doc: no `visibility`, no nullable
  actor-reference, no FR-1.17 branch at all. `dashboard_widgets.user_id`
  is a plain `ON DELETE CASCADE` FK — when a user is deleted, their
  widgets just disappear with them, because this table never holds
  shared data in the first place.
- **`widget_type`/`notifications.type` are reference data, extendable
  without a schema change (FR-6.7)** → **application-level**, in-code
  list — same pattern as Transaction Kind, Category, Credit Card network.
- **Audit log has zero foreign keys, by design** → this is *the*
  confirmed answer, not an oversight: FR-7.1/OQ-25 require no rewrite is
  ever needed on deletion, and NFR-AUD-1 requires the table stay
  append-only. A real FK forces one of three wrong outcomes on a
  referenced row's hard delete — `CASCADE` destroys the log entry it's
  supposed to preserve, `RESTRICT` blocks the deletion entirely, `SET
  NULL` is still a mutation to a table required to be immutable. Storing
  plain, permanently orphan-tolerant ID values sidesteps all three.
- **Append-only (NFR-AUD-1)** → enforced at the **database-privilege
  level** (no `UPDATE`/`DELETE` grant for the application role on this
  table) — a third category alongside "real constraint" and
  "application-level" used everywhere else in this doc, since it holds
  even against a bug in the application code, not just code-path
  discipline.
- **Notification deletion is a hard delete, no archive (FR-6.10/OQ-45)**
  → **application-level** (no archive column exists) — unlike most
  delete/archive decisions in this project, there's no history-dependency
  reason to keep a read/deleted notification around.

## Not yet done — resume here

- **Oct 2026 data model review: done** (`09-data-model-review-2026-10.md`)
  — applied D1–D24 plus two gaps (no reset-token table; `numeric`
  `rate_value`). ERD updated to match. Entries below are kept as history.

- **VBD doc cascade from OQ-50/OQ-51: done, Round 8.** The backend
  decomposition doc's §2.2 (`ReportingEngine`), §3.1 (investment-buy
  pipeline + pseudocode), §4 (component diagram — new `ReportingEngine`
  → `InvestmentHoldingAccessor` edge), §5 (sequence diagram), and §6
  (validation trace) all now reflect the `asset_type` branch in both
  `TransactionManager`'s buy path and `ReportingEngine`'s read paths.
- **Requirements/VBD cascade from dropping FR-4.4's alert threshold:
  done, Round 8.** FR-4.4 struck through and marked removed (OQ-52
  added); FR-6.5 no longer names it as a trigger; the VBD doc's
  `BudgetAccessor` row, §3.1 pipeline, §3.3 call table, §4 component
  diagram (edge removed, `NotificationDeliveryUtility` now unwired), §5
  sequence diagram, and §6 validation trace all updated to match.
- **Account Setup / Containers: all sub-chunks done** — Financial
  Accounts + Credit Cards, Categories, Budgets, Investments + Goals.
- **Transactions: done** (`AccountTransactionAccessor`,
  `CardTransactionAccessor`, `recurring_transaction_schedules`). Open
  Banking sync (FR-3.3) deferred, not modeled — revisit alongside the
  other parked Open Banking Accessors. **VBD doc cascade: done, Round 8.**
  `EFFECT_BY_KIND` is now enumerated explicitly in §3.1 (was "inline
  reference-data lookup"), and a new §3.2b walks through the
  recurring-transaction scheduled trigger as its own flow — a fourth
  entry point into the pipeline, backed by a new
  `RecurringTransactionScheduleAccessor` (18th active Accessor, up from
  17), reflected in §2.3's table and the §4 component diagram (`CRON_RECUR`).
- **Insights: done** (`DashboardAccessor`, `AuditLogAccessor`,
  `NotificationInboxAccessor`). **All domains now drafted in text form.**
  `notifications` is standing infrastructure with no active producer yet
  (both of FR-6.5's stated v1 triggers are currently inactive — see the
  Insights section above); wire a real trigger to it whenever Open
  Banking or some other feature un-defers one.
- **Full ERD diagram: done** — `docs/design/diagrams/04-database-erd.html`, one
  panel per domain (mermaid `erDiagram`, since none of the 5 Harmonic
  Diagrams types cover an ER diagram — confirmed via the
  `harmonic-diagrams` skill), cross-domain tables shown as minimal stubs
  pointing back to their owning panel.
- **Cross-domain relationships consolidated summary: done** — folded
  into the ERD's own notes section rather than a separate write-up, since
  that's exactly where a reader would already be looking for it.
