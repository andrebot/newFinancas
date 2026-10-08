# Functional Requirements

Grouped by the core use cases in
[01-core-use-cases.md](01-core-use-cases.md). Items marked **[TBD: OQ-n]**
depend on an open question in
[05-assumptions-and-open-questions.md](05-assumptions-and-open-questions.md)
and carry the document's current default assumption.

## FR-1: Identity & Household (CUC-1, CUC-2)

- **FR-1.1** A person can register an account using email, password,
  first name, and last name (OQ-29).
- **FR-1.2** Login requires multi-factor authentication (MFA) in addition to
  password.
- **FR-1.3** A user can view and revoke their own active sessions/devices,
  one at a time or **all other sessions at once** ("sign out all others"
  — every session except the current one; see OQ-62).
- **FR-1.4** A user can create a household — their first one during
  onboarding, or another one at any time from the household switcher in
  the main menu (FR-1.8, OQ-75). Creating one also seeds the
  predefined default Category set (FR-10.1) — a Manager↔Manager effect
  routed through the Service Bus, not a direct call (found while closing
  a gap; see `docs/architecture/backend/01-vbd-decomposition.md` §3.1b).
- **FR-1.5** A household Owner/Admin can invite another user to the
  household by email.
- **FR-1.6** A household member has exactly one role: **Owner, Admin,
  Member, or Viewer**.
- **FR-1.7** Role determines permitted actions:
  - *Owner* — full control, including deleting the household.
  - *Admin* — manage members/roles and all shared data.
  - *Member* — record transactions and manage shared data they created.
  - *Viewer* — read-only access to shared data.
- **FR-1.8** A user may belong to more than one household. The user
  **switches the active household** from the main navigation menu, which
  also surfaces their pending invitations (see OQ-60).
- **FR-1.9** Logout terminates the current session only; other active
  sessions/devices are unaffected (see FR-1.3).
- **FR-1.10** A household invitation (FR-1.5) is **pending** until the
  invitee accepts or declines it, or the inviting Owner/Admin revokes it
  first. Accepting establishes membership with the role specified in the
  invitation. The invitee sees which household invited them, **who sent
  the invitation**, and the offered role (see OQ-62).
- **FR-1.11** A household Owner/Admin can remove another member from the
  household, **except the Owner** — an Admin cannot depose the Owner; only
  the Owner can end their own membership (Leave, Delete Household, or
  Delete Account), each with its own succession/deletion rule (see OQ-27).
  Any member can voluntarily leave a household they belong to — a distinct
  actor/authorization path from being removed, even though the effect on
  membership is the same — subject to the Owner-succession rule (FR-1.18).
- **FR-1.12** A household Owner/Admin can change another member's role
  among Admin, Member, or Viewer, subject to FR-1.7's permission model.
  This action never assigns or removes the Owner role — see FR-1.20 for
  the dedicated ownership-transfer action that's the only way the Owner
  role moves without the Owner leaving/deleting their account (FR-1.18).
- **FR-1.13** A user unable to log in can request a password reset: a
  time-limited reset token is issued (e.g., via email), and submitting a
  valid token with a new password replaces the stored password hash
  (NFR-SEC-4) and invalidates all of that user's active sessions.
- **FR-1.14** An authenticated user can change their password by
  re-supplying their current password; this invalidates every other active
  session (FR-1.3) except the one used to make the change.
- **FR-1.15** Every account enrolls a TOTP-based MFA method (NFR-SEC-1) at
  registration, before the account can be used to log in. Enrollment issues
  a set of single-use recovery codes at the same time.
- **FR-1.16** A user who has lost access to their MFA device can regain
  access with an unused recovery code (FR-1.15). **v1 scope limitation:** if
  recovery codes are also exhausted or lost, self-service recovery is not
  supported — a manual/support-assisted process outside this system, same
  treatment as email verification (see OQ-24).
- **FR-1.17** A user can request deletion of their own account. This is a
  **hard delete** in support of GDPR/LGPD right-to-erasure (NFR-COMP-4):
  credentials, sessions, and any data visible only to that user (personal
  accounts, personal budgets/goals, etc.) are permanently removed.
  Data the user contributed to a **shared** household resource is retained
  — it is now a joint household record, not solely the deleted user's data
  — but **anonymized**: the actor reference is cleared rather than the
  record being deleted (see OQ-25).
- **FR-1.18** If a household's Owner deletes their account or leaves the
  household (FR-1.11), the system automatically promotes another member to
  Owner so the household continues uninterrupted: the longest-tenured
  remaining Admin, or if none, the longest-tenured Member, or if none, the
  longest-tenured Viewer. If no other member remains, the household itself
  is deleted along with the Owner's account. A household has exactly one
  Owner at all times its membership is non-empty (see OQ-25).
- **FR-1.19** An invitation (FR-1.5) can only target an **existing,
  registered user**, matched by email. There is no invite-a-non-user flow —
  inviting an email with no matching account is rejected (see OQ-26).
- **FR-1.20** A household Owner can voluntarily **transfer ownership** to
  another existing member, in a single atomic operation: the target member
  becomes Owner and the transferring user is demoted to Admin — the
  household is never left with zero or two Owners at any point (see
  OQ-28). This is distinct from FR-1.18's auto-succession, which only
  triggers when the Owner leaves or deletes their account; transfer lets
  the Owner hand off deliberately while remaining a household member.
- **FR-1.21** A user can set personal **preferences**: theme (**dark,
  light, or system** — following the device setting) and language (pt-BR
  or en-US). Preferences are per user, not per household (see OQ-62).
- **FR-1.22** Right after creating a household (FR-1.4) — the first one
  or any additional one (OQ-81) — the user goes through a **guided
  setup**: adding a first financial account
  is **mandatory** (it cannot be skipped); reviewing the seeded Categories
  (FR-10.1) and creating a first Budget are optional. Main navigation is
  unavailable until the mandatory step is done (see OQ-63).

## FR-2: Financial Accounts (CUC-3)

- **FR-2.1** A user can manually create a financial account with: name,
  type (**checking, savings, credit card only, investment** — OQ-76),
  currency,
  and opening balance. **Type is immutable once set** (see OQ-32) — the
  Credit Card and Investment Holding attachment rules (OQ-11, OQ-14) are
  keyed off it. Currency is likewise fixed at creation, already implied by
  FR-2.2's no-conversion rule.
- **FR-2.2** Each account is denominated in exactly one currency; the
  system does not convert between currencies.
- **FR-2.3** An account can be marked **personal** (visible only to its
  owner) or **shared** (visible to the household). Unlike type/currency,
  this can be **changed later** via editing the account (see OQ-33).
- **FR-2.4** A user can archive/close an account without deleting its
  transaction history. **One-way — an archived account cannot be
  reactivated** (see OQ-34), consistent with the Category/Subcategory
  archive pattern (FR-10.3). If the account has an active Open Banking
  connection (FR-2.5), archiving it **automatically disconnects** the
  sync (FR-2.6) — an archived account never keeps pulling in new
  transactions (see OQ-36).
- **FR-2.5** **[Deferred to v2 — OQ-69]** A user can connect an account to an Open Banking provider
  appropriate to its region/currency (e.g., Open Finance Brasil for BRL
  accounts, a US-oriented provider for USD accounts) to enable automatic
  balance and transaction sync. The integration must support multiple
  providers behind a common interface, not a single hardcoded provider.
- **FR-2.6** **[Deferred to v2 — OQ-69]** An Open-Banking-linked account can be manually disconnected,
  reverting to manual entry without losing prior imported history.
- **FR-2.7** A user can attach one or more physical Credit Cards to a
  financial account of type checking, savings, or credit card; there is no
  limit on the number of cards per account.
- **FR-2.8** Each Credit Card stores: network/brand ("flag" — e.g. Visa,
  Mastercard, Elo, Amex, other — **reference data, not a hardcoded enum**,
  flagged during volatility reconciliation: the "other" catch-all already
  implied extensibility was intended, so it gets the same treatment as
  Transaction Kind/Widget Type/Category), last 4 digits, and three
  distinct dates that must not be conflated:
  - **Closing date** (day of month) — the cutoff for tallying a cycle's
    spend. Card Transactions dated after the most recent closing date
    belong to the *next* cycle's bill, not the one about to be paid.
  - **Bill due date** (day of month) — when the most recently closed
    cycle's bill must be paid (via a Credit Card Bill Payment, FR-3.7).
  - **Expiration date** (month/year) — when the physical card itself stops
    being valid/usable. Unrelated to billing; a card can be well within its
    billing cycle and still be expired, or vice versa.
  The system never stores the full card number (PAN), CVV/CVC, or any other
  sensitive cardholder data (see NFR-SEC-7).
- **FR-2.9** A user can edit or remove a Credit Card from an account
  without affecting the account's transaction history. **Interaction
  shape (see OQ-35):** attaching, editing, and removing Credit Cards are
  exposed as part of the same combined Edit Financial Account form/submit
  — not separate stand-alone actions — since the card list already lives
  on that same screen (FR-2.7).
- **FR-2.10** Each Credit Card carries a running **outstanding balance**:
  increased by its Card Transaction charges, decreased by its Card
  Transaction refunds and by Credit Card Bill Payments made against it (see
  FR-3.7, FR-3.9, FR-3.10). The **closing date** (FR-2.8) is used to group
  Card Transactions into cycles, so "this month's total" and "the bill now
  due" are both derivable without a separate frozen statement record.
  **v1 scope limitations (explicitly deferred, not addressed now):**
  - No modeling of partial bill payments or revolving-credit interest on an
    unpaid balance carried past its due date — see OQ-19.
  - No per-cycle historical statement archive (e.g., "show me exactly what
    March's statement looked like") — cycle totals are computed on demand
    from Card Transactions plus the closing date, not stored as a frozen
    snapshot.
  - No automatic installment (parcelamento) splitting — confirmed manual
    only, see FR-3.9 and OQ-18.

## FR-3: Transactions (CUC-4)

All of the below are entered through **one unified entry point** (one "add
transaction" experience), regardless of kind — the variety lives in the
data (kind, links), not in separate screens or separate code paths per
kind. **Account Transactions** and **Card Transactions** (FR-3.9) are two
separate ledgers, per the stakeholder's explicit direction — a card's
activity does not appear in its parent account's transaction list, and
vice versa; only a Credit Card Bill Payment (FR-3.7) bridges the two.

- **FR-3.1** A user can manually record a transaction — against either a
  Financial Account (an **Account Transaction**) or a Credit Card (a
  **Card Transaction**, FR-3.9) — through **one combined entry point**:
  date, amount, currency, category, description, **target** (which
  account or card), and **kind**. Kind is reference data (e.g. withdrawal,
  deposit, boleto payment, Pix payment, Pix receipt, transfer sent,
  transfer received, credit card bill payment, investment buy, investment
  sell, investment dividend, investment interest, investment redemption,
  investment tax, card charge, card refund) — not a hardcoded enum baked
  into branching logic. **Target narrows which kinds are valid** (e.g.
  investment kinds apply to any account except a credit-card-only one; a
  Credit Card target only offers charge/refund) — that narrowing is itself
  data-driven, not a second code path (see OQ-39). A new kind, for either
  target, is a data addition, not a schema/code change.
- **FR-3.2** A user can edit or delete a manually entered transaction —
  Account Transaction or Card Transaction alike (FR-3.9/OQ-37) — through
  the same combined edit/delete flow as FR-3.1's combined entry point
  (see OQ-39).
- **FR-3.3** **[Deferred to v2 — OQ-69]** Account Transactions from Open-Banking-linked accounts are
  imported automatically and flagged as synced; their category remains
  editable even though their core transaction data is read-only.
- **FR-3.4** A user can assign a Category, and optionally one of that
  Category's Subcategories, to an Account Transaction (or Card Transaction,
  FR-3.9), from the household's predefined-or-custom taxonomy (see FR-10).
  A chosen Subcategory must belong to the chosen Category.
- ~~**FR-3.5**~~ **Removed (OQ-55):** recurring/scheduled transactions
  will not be implemented. Every transaction is recorded individually,
  manually or by a system trigger (Open Banking sync, FR-11.3's scheduled
  cash events). The Record Transaction entry point (FR-3.1) has no
  "make this recurring" option.
- **FR-3.6** A transfer between two accounts is represented so it does not
  double-count as income/expense in reports.
- **FR-3.7** A **Credit Card Bill Payment** is an Account Transaction that
  additionally links to a specific Credit Card (FR-2.7). Recording one
  debits the linked account (per FR-3.1) and reduces that Credit Card's
  outstanding balance by the paid amount (see FR-2.10).
- **FR-3.8** An investment-related Account Transaction — buy, sell,
  dividend, interest, redemption, or tax — links to a specific Investment
  Holding within that same account (see FR-5.1). Buy, sell,
  and redemption change the Holding's quantity; dividend, interest, and tax
  do not (they're pure cash events referencing the Holding for traceability
  and reporting). Redemption reduces quantity like a sell — typically to
  zero, closing the position — rather than being treated as a pure cash
  event.
- **FR-3.9** A user can manually record a **Card Transaction** — a purchase
  (charge) or a refund — against a specific Credit Card, with date, amount,
  category, and description, through the **same combined entry point** as
  an Account Transaction (FR-3.1, targeting the Credit Card instead of an
  account — see OQ-39). Card Transactions are their **own ledger**,
  separate from the parent account's Account Transactions (see the note
  above), and never directly change the linked account's balance — the
  shared entry point changes *where the flow starts*, not the ledger
  separation (OQ-16). **A Card Transaction can also be edited or
  deleted**, the same as an Account Transaction (FR-3.2) — this wasn't
  originally stated here, an oversight now closed (see OQ-37).
  **Confirmed:** the system does not track installment purchases
  (parcelamento) automatically or split one purchase across future cycles
  — if a user makes an installment purchase, they manually record each
  installment as its own Card Transaction when it occurs (see OQ-18).
- **FR-3.10** Recording a Card Transaction updates its Credit Card's
  outstanding balance (FR-2.10): a charge increases it, a refund decreases
  it.
- **FR-3.11** A Card Transaction (charge) counts as spend against its
  category's budget at the time it's recorded — **accrual basis**, not
  when the bill is later paid. The corresponding Credit Card Bill Payment
  (FR-3.7) does **not** count again as spend, to avoid double-counting the
  same expense once as a charge and once as a payment (see FR-4.5).
- **FR-3.12** A user can browse **all** their Account and Card
  Transactions in one list, newest first, loaded incrementally — the list
  is not limited to a single month. A user can filter it by any
  combination of: kind, account, credit card, category, **investment
  Holding**, and a date range that may span any months (presets such as
  "last 90 days" plus a custom From/To). Filtering by Holding is how a
  Holding's page links to "its" transactions (see OQ-61).

## FR-4: Budgeting (CUC-5)

- **FR-4.1** A user can define a Budget with a target amount per recurring
  period (monthly), assigned to **one or more** targets from the household's
  category taxonomy (see FR-10) — a mix of whole Categories and specific
  Subcategories is allowed in the same Budget (e.g., one Budget covering
  all of "Transport" plus just "Shopping > Clothing").
- **FR-4.2** A budget can be personal or shared at the household level,
  mirroring the account's visibility model (FR-2.3).
- **FR-4.3** The system tracks actual spend against each Budget, across all
  of its assigned Category/Subcategory targets combined, per period, and
  surfaces the remaining/overspent amount. Summaries that list Budgets
  together show **over-budget ones first** (see OQ-62).
- ~~**FR-4.4**~~ **Removed (OQ-52):** per-transaction budget-crossing
  alerts were judged too noisy in practice — decided during the
  data-modeling pass (`docs/architecture/02-data-model.md`, Budgets
  domain). `BudgetAccessor.accrueIfClaimed` no longer reports a
  threshold-crossed signal, and FR-6.5's notification list no longer
  names this trigger.
- **FR-4.5** "Actual spend" (FR-4.3) is computed on an **accrual basis**:
  Account Transaction expenses and Card Transaction charges (FR-3.11) count
  at the time they're recorded. A Credit Card Bill Payment (FR-3.7) is
  never itself counted as spend — it would double-count expenses already
  captured as charges.
- **FR-4.6** Assigning a whole Category to a Budget implicitly includes
  **all** of that Category's Subcategories — a Transaction tagged with any
  of them counts toward the Budget without listing each Subcategory
  individually, and a Subcategory added later under that Category is
  automatically covered too.
- **FR-4.7** A given Category or Subcategory can be claimed by **at most
  one Budget** within the same scope (personal vs. shared, FR-4.2) and
  overlapping period. Assigning a whole Category to a Budget reserves all
  of its Subcategories — none of them can be separately assigned to a
  different Budget in that scope/period. The system rejects an assignment
  that would create this kind of overlap, since it would make "actual
  spend" ambiguous between two Budgets.
- **FR-4.8** A Transaction's spend counts toward the Budget whose target
  set includes, in order of specificity: (a) its exact Subcategory, if one
  is set, otherwise (b) its Category as a rollup target. A Transaction
  whose Category/Subcategory isn't claimed by any Budget is simply not
  tracked against a budget — categorizing something doesn't obligate it to
  a Budget.
- **FR-4.9** Each recurring period (month) a Budget is active for has its
  own immutable **Budget Period** record of the target amount(s) in effect
  for that month, taken at whatever they were when that month started.
  Editing a Budget's target amount only affects the **current and future**
  periods — every past Budget Period keeps showing the target that was
  actually in effect at the time, so historical actual-vs-target reporting
  never gets silently rewritten by a later change.
- **FR-4.10** A user can delete a Budget. This is a **hard delete of the
  live definition only** (see OQ-40) — unlike Account/Category archiving
  (FR-2.4/FR-10.3), it doesn't need to be an archive, because the
  immutable per-month Budget Period records (FR-4.9) already stand on
  their own and are unaffected. Deleting a Budget releases its claimed
  Category/Subcategory targets (FR-4.7), making them available to a new
  Budget in the same scope/period.

## FR-5: Investments & Net Worth (CUC-6, CUC-7)

- **FR-5.1** A Holding's **primary creation path is transaction-driven, not
  a standalone form (see OQ-41):** recording an investment-buy Account
  Transaction (FR-3.8) against a ticker/identifier not already held in
  that account auto-creates the Holding; buying more of an existing one
  just increases its quantity — **except for one of FR-11.1's defined
  fixed-term instrument types (CDB, LCI, LCA, Tesouro Direto, CDs,
  Treasury bonds), where every purchase always creates a new Holding and
  never accumulates into an existing one (see OQ-50):** each such
  purchase is its own immutable contract with its own rate, purchase
  date, and maturity date — not more units of the same thing, unlike
  stocks/FIIs/funds, which legitimately average together into one
  position. Fields: asset type (reference data, extendable without a
  schema change — OQ-79: **market-priced** stock, FII, fund, mutual fund,
  currency, crypto, real estate, other; **fixed-term** per FR-11.1),
  ticker/identifier, quantity, cost basis, and — fixed-term instrument
  types only — rate (indexer type + value) and due date, both
  user-supplied on the triggering transaction since neither is
  derivable from asset type alone (see OQ-50). A Holding always belongs
  to exactly one account — checking, savings, or investment; in Brazil
  investments commonly sit inside a regular bank account (OQ-76) — it is
  not a standalone record. (A
  separate manual-backfill onboarding path once existed alongside this;
  retired — see OQ-53.)
- **FR-5.2** A Holding's position (quantity, cost basis) changes only
  through its investment transactions (FR-3.8) — it is never edited
  directly. For **market-priced** Holdings (stock, FII, fund, other — not
  FR-11.1's fixed-term types, see FR-5.4) a user additionally records the
  **market value** manually as a timestamped **Valuation Snapshot**; the
  Holding's "current" valuation is its latest snapshot. A buy, sell, or
  redemption also records a snapshot automatically (system-generated, so
  the position change shows up in net worth without waiting for the next
  manual value); that one changes only when its transaction is edited or
  deleted. Snapshots are a history, not a single overwritten field — this is what makes FR-5.4's
  history and Goal progress-by-month (FR-8.7) possible. **A user can edit
  (date, value) or delete any manually entered Valuation Snapshot** to
  correct mistakes; net worth and Goal progress for every month the
  change affects are recomputed (see OQ-56).
- **FR-5.3** The system computes and displays net worth (assets minus
  liabilities), trended over time, **reported per currency** (no
  cross-currency aggregation), including the **change versus the previous
  month** for each currency (see OQ-62).
- **FR-5.4** A user can view historical net worth snapshots by month, for
  any past year. For a given month, each Holding's contribution uses its
  latest Valuation Snapshot at or before that month's end (FR-5.2) — there
  is no requirement that a snapshot exists for every single month; the
  last known value simply carries forward, the same way a brokerage
  statement would. **Exception (see OQ-51):** a Holding of one of
  FR-11.1's fixed-term instrument types never has a Valuation Snapshot to
  use in the first place — its contribution is simply its cost basis
  (principal), constant from purchase until a redemption schedule entry
  zeroes it out, since nothing about its value changes between
  contractual cash events.
- **FR-5.5** **[Deferred to v2 — OQ-70]** A user can use the **FII Portfolio Builder** to compose a
  target portfolio of FIIs based on allocation goals, using manually
  entered/available data (v1).
- **FR-5.6** **[Deferred to v2 — OQ-70]** A user can use a **Stock Portfolio Builder**, equivalent to
  FR-5.5 for stocks (later phase, same design shape as FR-5.5).
- **FR-5.7** *(Future phase, explicitly out of scope for v1)* The system
  integrates external market/analysis APIs to suggest FIIs/stocks and
  provide graph-based analysis. The v1 Portfolio Builder must not hardcode
  assumptions that would block this later addition.
- **FR-5.8** An Investment Holding is **archived automatically** when an
  investment transaction brings its quantity to zero (full sell or
  redemption) — no separate user action. For a fixed-term Holding whose
  due date has passed while it still has a position, the system sends the
  user a **notification suggesting they archive it** (FR-6.5), and the
  user can archive it from there (OQ-72). If the transaction that
  brought a Holding to zero is later **edited or deleted** so its
  quantity is no longer zero, the system **un-archives** it automatically
  — an archive the system made, the system undoes. An archive the user
  made stays one-way (OQ-80). Archiving is **one-way, same
  archive pattern as Accounts/Categories** (FR-2.4/FR-10.3), not a hard
  delete (see OQ-43) — a Holding's Valuation Snapshot history (FR-5.2)
  and any Goal allocations referencing it (FR-8.2) depend on the
  Holding continuing to exist.
- **FR-5.9** **Payout** (income an investment pays out — dividends,
  interest) is **derived from transactions**: every payout is a dividend or
  interest Account Transaction linked to its Holding (FR-3.8, FR-11.3),
  crediting the account that holds it. The app shows each Holding's payout
  for the current month, and a **payout-over-time chart** where the user
  picks which Holding(s) to show — on the Investments overview and the
  Dashboard (OQ-73). No separately stored yield figure.

## FR-6: Insights & Reporting (CUC-8)

- **FR-6.1** **[Deferred to v3 — OQ-67]** A user's **Dashboard** is composed of **Widgets** they choose,
  add, remove, and reorder themselves — not a fixed, one-size-fits-all
  summary. Each Widget renders one report/data view from the library in
  FR-6.7. New users start from a sensible default set of Widgets (account
  balances, recent transactions, budget status, net worth trend) which
  they're free to customize immediately.
- **FR-6.0** **v1 Dashboard (OQ-67):** a fixed set of panels — net worth
  per currency with change vs previous month (FR-5.3), coming-due
  fixed-income list, balances, budgets (over-budget first), goals, and
  the payout-over-time chart (FR-5.9). Not user-configurable in v1.
- **FR-6.2** **[Deferred to v2 — OQ-71]** A user can view spending-by-category reports over a selectable
  date range, drillable from Category down to Subcategory (FR-10).
- **FR-6.3** **[Deferred to v2 — OQ-71]** A user can view income vs. expense trends over time.
- **FR-6.6** A user can view an account's balance by month, for any past
  year. This requires no new stored data — every Transaction and Card
  Transaction is dated (FR-3.1, FR-3.9), so a balance as of any past date
  is always derivable by summing everything up to that date; this is a
  reporting view over existing history, not a new data-model concept.
- **FR-6.4** **[Deferred to v2 — OQ-71]** A user can export transactions to CSV at minimum; a formatted
  PDF report is a nice-to-have, not a v1 commitment.
- **FR-6.5** A user receives notifications for: **a household invitation
  addressed to them** (FR-1.10, v1); **a fixed-term Holding past its due
  date that still has a position**, suggesting they archive it (FR-5.8,
  v1); and Open Banking sync failure (**dormant** until Open Banking is
  un-deferred, OQ-69). More triggers are expected (OQ-68). Budget
  threshold crossed was removed (FR-4.4/OQ-52). The notification **mechanism** (FR-6.10) is standing
  infrastructure independent of which triggers are currently active.
  Delivered **in-app at minimum** (v1); the delivery channel is expected
  to expand later (email, push, etc.) and must sit behind an abstraction
  so new channels don't require changing this requirement's trigger
  logic. *(Reminders for upcoming recurring transactions no longer apply —
  recurring transactions were removed, FR-3.5/OQ-55.)*
- **FR-6.7** **[Deferred to v3 — OQ-67]** The system offers a library of **Widget** types, each backed
  by a report/data view that already exists elsewhere in these
  requirements: account balances summary, recent transactions, budget
  status (per Budget, FR-4.3), net worth trend (FR-5.4), account balance by
  month (FR-6.6), spending by Category/Subcategory (FR-6.2), income vs.
  expense trend (FR-6.3), and Goal progress by month (FR-8.7). Widget
  type is reference data the Dashboard composes, not a hardcoded layout —
  the same pattern used for Transaction Kind (FR-3.1) and Category
  (FR-10) — so a new Widget type is a data addition, not a rework of the
  Dashboard itself.
- **FR-6.8** **[Deferred to v3 — OQ-67]** A user can add, remove, and reorder Widgets on their own
  Dashboard, and can add the same Widget type more than once with
  different settings (e.g., two net-worth-trend Widgets, one per
  currency). Dashboard layout is **personal per user** — not shared at the
  household level — even when a Widget displays shared household data;
  each household member arranges their own view independently.
- **FR-6.9** **[Deferred to v3 — OQ-67]** Each Widget can be configured independently of others of the
  same type — at minimum a date range, and where relevant, which
  account/Budget/Goal/currency it focuses on. A Widget only ever
  shows data the viewing user already has permission to see (personal vs.
  shared visibility rules, FR-2.3/FR-4.2/FR-8.1, apply exactly as they do
  everywhere else — a Dashboard Widget is not a way around them).
- **FR-6.10** The in-app notification channel (FR-6.5) is a **notification
  inbox in the app header** (see OQ-45): a bell/icon showing unseen count,
  opening into a list stored persistently in the database. Each
  notification has a **seen/unseen** state; opening the inbox marks every
  notification currently shown as seen. A user can leave a notification in
  the inbox indefinitely or **delete** it — deletion is a **hard delete**,
  not an archive (unlike most other delete/archive decisions in this
  project, there's no history-dependency reason to keep it around).
- **FR-6.11** For each currency, the app shows a month's **inflow,
  outflow, and net total**, plus a 12-month strip of inflow/outflow per
  month for the selected year. Transfers between the user's own accounts
  (FR-3.6) and credit card bill payments (FR-3.11) are excluded so nothing
  counts twice; investment buys/sells count as outflow/inflow of the
  account (OQ-74).

## FR-7: Security & Audit (CUC-9)

- **FR-7.1** Every create/modify/delete action on financial or household
  data (accounts, transactions, budgets, holdings, membership/roles) is
  recorded as an immutable audit log entry with **actor ID, timestamp,
  action, entity type, and entity ID only** — no field-level before/after
  values and no other PII. This is deliberate: it lets FR-1.17's hard
  delete leave the Audit Log completely untouched, since an orphaned ID in
  a log entry reveals nothing once the record it pointed to is gone (see
  OQ-25).
- **FR-7.2** A household Owner/Admin can **export** the audit log for
  their household as a CSV file over a selected date range — through a
  small dialog that asks for the date range and starts the download; the
  option is shown only to Owners/Admins (OQ-77) — this is the
  log's only access method in v1, not an in-app browsable table (see
  OQ-46).
- ~~**FR-7.3**~~ **Removed (OQ-31):** end-user login-history viewing is
  not a product feature — that's a system-admin concern served directly
  against the database/logs. A user's own active-session viewing/revocation
  stays covered by FR-1.3, unaffected by this removal.

## FR-8: Investment Goals (CUC-10)

*(Added after the initial requirements pass — see CUC-10.)*

- **FR-8.1** A user can create a Goal with a name, a target amount, a
  target currency, and a due date. A Goal is personal or shared,
  mirroring the account/budget visibility model (FR-2.3/FR-4.2).
- **FR-8.2** A user can allocate a percentage of an Investment Holding to
  one or more Goals, **regardless of the Holding's currency** — a
  Goal can be funded by Holdings in multiple different currencies. A
  single Holding can be split across multiple Goals by percentage.
  **Direction of control (see OQ-48): the Holding is the entry point** —
  a user allocates *from* a Holding (selecting which Goal(s) it
  funds and each one's percentage), not from a Goal picking which
  Holdings fund it. A Goal's page can still *display* which
  Holdings fund it (read-only), but editing an allocation always happens
  via the Holding — either **at creation**, bundled into the same
  investment-buy Account Transaction that creates the Holding (one call,
  see OQ-54), or **later**, via editing the Holding directly.
- **FR-8.3** The sum of a single Investment Holding's allocated percentages
  across all of its Goals must never exceed 100%. The system rejects
  an allocation that would push the total over 100%. This check is
  currency-independent — it's about the Holding's own percentage budget,
  not the target it's contributing to.
- **FR-8.4** When an allocated Holding's currency differs from the
  Goal's target currency, its contribution is converted using a
  Currency Reference Rate the user enters **on the progress view itself**
  (see FR-9, OQ-49) — the backend has nothing stored to convert with. A
  pair with no rate entered stays unconverted/excluded from the combined
  total until the user types one in.
- **FR-8.5** The backend computes each allocated Holding's contribution
  (current valuation × allocated percentage) **in the Holding's own
  currency** and returns the set of per-currency contributions plus the
  Goal's target amount/currency. The frontend combines them into a
  single progress figure using FR-8.4's on-the-fly rate(s), comparing the
  result against the target.
- **FR-8.6** A user can adjust or remove a Holding's allocation to a
  Goal — via editing the Holding (FR-8.2), same direction of
  control — and can **delete** a Goal without deleting the
  underlying Investment Holdings. Deleting is a **hard delete — no
  history kept** (see OQ-47), distinct from completing (FR-8.8): for
  "this goal no longer makes sense," not "this goal is done."
- **FR-8.7** A Goal's progress (FR-8.5) can be viewed by month, for
  any past year, using each allocated Holding's Valuation Snapshot (FR-5.2)
  at or before that month's end — the same mechanism that powers net worth
  history (FR-5.4), applied per Goal instead of in aggregate.
- **FR-8.8** A user can **mark a Goal completed** — for "this goal is
  done," as opposed to delete's "this goal no longer makes sense"
  (FR-8.6). Unlike the one-way archives elsewhere (Account/Category/
  Holding), **a completed Goal can be reopened** (FR-8.9, see OQ-47,
  OQ-78). Completing keeps the Goal record
  intact specifically so its historical progress-by-month (FR-8.7) stays
  viewable — deleting it instead would make that history uncomputable,
  since progress is derived live from the Goal's own record, not
  stored independently the way a Budget Period is (FR-4.9).
- **FR-8.9** A user can **reopen** a completed Goal, restoring it to
  active status (able to receive new allocations again).

## FR-9: Currency Reference Rates (supports CUC-10)

*(Added alongside Goals — see OQ-13. Manual only; no automated FX
fetching anywhere in the system. Revised to be frontend-only — see
OQ-49 — after the initial "persisted server-side" design was
simplified away.)*

- **FR-9.1** A user can manually enter a reference exchange rate between
  two currencies (e.g., "1 USD = 5.20 BRL") **directly on the Goal
  progress view, as an on-the-fly calculator input** — not a saved
  setting. The backend never stores a Currency Reference Rate (see
  OQ-49); there is no `CurrencyReferenceRateAccessor`.
- **FR-9.2** Re-entering a rate simply recomputes the displayed estimate
  immediately (client-side) — there is nothing to "update" server-side,
  and no historical rate tracking, since nothing is persisted.
- **FR-9.3** Currency Reference Rates are used **only** for the Goal
  progress **display** (FR-8.4/FR-8.5): the backend returns each allocated
  Holding's contribution in its own native currency; the frontend blends
  them into one combined figure using whatever rate the user currently has
  entered for each required pair. A pair with no rate entered is shown
  unconverted/excluded from the combined total, the same flagging concept
  as before, just resolved client-side instead of server-side. This never
  touches account balances, transactions, or net worth, which remain
  strictly per-currency (FR-5.3) — unchanged, still a scoped exception,
  not a reversal of the no-FX-conversion policy.

## FR-10: Categories & Subcategories (supports CUC-4, CUC-5)

*(Added alongside the Budget/Category discussion. Shared, household-scoped
taxonomy — not personal-per-user, consistent with how custom categories
were already described in FR-3.4.)*

- **FR-10.1** A user can create a **Category** with a name, an **icon**,
  and a **colour** (from a fixed 18-colour palette, OQ-85). Icon and colour identify the
  Category everywhere it appears (transactions, budgets, category lists).
  The system ships with a set of predefined default Categories — each with
  a preset icon and colour — that the household can use as-is, edit, or
  supplement with custom ones (see OQ-57).
- **FR-10.2** A user can create a **Subcategory** with a name under a
  specific Category. The hierarchy is exactly **two levels** — a
  Subcategory cannot itself have subcategories.
- **FR-10.3** A user can archive a Category or Subcategory that's already
  in use (on Transactions and/or Budgets) rather than deleting it —
  mirroring the account-archive pattern (FR-2.4) — so existing
  categorizations and Budget targets remain intact and meaningful.
- **FR-10.4** Archiving a Category also archives all of its Subcategories
  (they can't meaningfully outlive their parent); archiving a Subcategory
  does not affect its parent Category or sibling Subcategories.

## FR-11: Investment Product Rules & Scheduled Cash Events (supports CUC-6)

*(Added after a design discussion surfaced a real volatility the original
CUC-6 pass missed — see OQ-42. Distinct from the Portfolio Builder's
external-analysis-API volatility, FR-5.7/CUC-7 — this is about an
instrument's own contractual terms, not third-party recommendations.)*

**Tax rules are code-configured** inside the investment engine
(`InvestmentProductEngine`), per country/instrument — not user-editable
data. The engine owns both the schedule and every tax/payout calculation
(see OQ-58).

- **FR-11.1** A **defined set of fixed-term instrument types**, per
  region, carries contractual terms beyond a plain stock/FII buy: a due
  date, an interest-payment schedule (where applicable), and a tax rule.
  **v1 scope (OQ-79):** Brazil — CDB, LC, LF, LCI, LCA, CRA, CRI,
  Debenture (with an "incentivised" flag: incentivised debentures are
  income-tax exempt for individuals), Tesouro Direto; US — CD, Treasury.
  "Treasury" resolves by the account's currency (BRL → Tesouro Direto,
  USD → US Treasury). This list is reference data (same "extendable without a schema
  change" principle as Transaction Kind, FR-3.1, and Widget type, FR-6.7),
  not a hardcoded enum — a stock, FII, or generic fund buy has none of
  these terms and is unaffected.
- **FR-11.2** Recording an investment-buy Account Transaction (FR-3.8)
  against one of FR-11.1's instrument types takes the user-supplied
  purchase date, maturity date, and rate (none of these three are
  derivable from asset type alone — a CDB's term and rate are negotiated
  per contract) and computes from them: its interest-payment date(s) if
  the instrument pays periodic interest (e.g. Tesouro Direto's
  semi-annual coupon), and the tax owed at each cash event. This
  computation is genuinely instrument/region-specific — the rule for a
  Brazilian CDB's income tax is nothing like a US Treasury bond's. The
  engine also exposes, per fixed-term Holding, its **expected payout**
  (gross, at maturity) and **expected taxes**, shown on the Holding
  (see OQ-58). For index-linked rates (e.g. "110% of CDI", "IPCA +
  5.50%") the projection uses the latest Index Reference Rate (FR-11.6);
  fixed-rate contracts need none. **US instruments: expected taxes are
  shown as "not estimated" in v1** — they depend on the user's personal
  income-tax bracket, which the app doesn't know (OQ-79).
- **FR-11.3** On each date computed by FR-11.2, the system **automatically
  generates and posts** the resulting Account Transaction (interest
  received, redemption, tax paid) against the same investment account and
  Holding — no user confirmation step. Same auto-post trigger pattern as
  Open Banking sync (§3.2 of the VBD decomposition): a system trigger
  re-enters the
  same unified Record Transaction pipeline (CUC-4, UC-1) that a manual
  entry would use.
- **FR-11.4** A Holding whose asset type isn't one of FR-11.1's defined
  instruments (stocks, FIIs, generic funds, "other") has no computed
  schedule — it only ever changes via manual valuation updates or manual
  buy/sell/dividend transactions (FR-5.2/FR-3.8), unchanged from before
  this section existed.
- ~~**FR-11.5**~~ **Removed (OQ-53):** the onboarding backfill path
  (FR-5.1) this described no longer exists — every Holding, fixed-term or
  otherwise, is created transaction-driven, and its schedule is always
  computed by `InvestmentProductEngine` (FR-11.2), never manually
  entered.
- **FR-11.6** A user can manually maintain **Index Reference Rates** —
  Selic, CDI, IPCA, IGP-M in v1 (reference data; the list can grow) —
  each as a dated history of values (annual % for Selic/CDI, trailing
  12-month % for IPCA/IGP-M). The user can add a new value and edit or
  delete past ones. The latest value of each index feeds FR-11.2's
  projections for Holdings whose rate tracks that index. There is no
  automated feed in v1 (see OQ-59). Rates are household-scoped, like the
  Category taxonomy.
