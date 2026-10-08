# Core Use Cases

Per VBD/EBD method, core use cases are identified first; functional and
non-functional requirements are then derived from them. Each use case notes
its primary actor and a volatility assessment to seed the later
VBD/EBD decomposition.

## CUC-1: Manage Household & Membership

A user creates a household and invites other people into it, assigning each
a role that governs what they can see and do. Every new household — first
or additional — starts with a guided setup in which adding a first account
is mandatory (FR-1.22). A user who belongs to several households switches
between them from the main menu, where pending invitations also show
(FR-1.8).

- **Primary actor:** Household Owner
- **Volatility:** Moderate. Role definitions and permission granularity are
  likely to evolve as real usage surfaces edge cases (e.g., a role that can
  spend but not see net worth).
- **Volatility (role set): [under-specified, flagged during volatility
  reconciliation]** the example above already implies a 5th role is
  plausible, yet FR-1.6 hardcodes exactly four roles and FR-1.7's
  permission mapping is prose, not data — unlike every other enumerable
  "kind" in this project (Transaction Kind, Widget Type, Category), which
  got the reference-data treatment specifically because this same signal
  appeared. Role and its permission matrix should get the same treatment:
  data a Utility reads, not a hardcoded enum plus hardcoded prose rules.
- **Note — a real invariant, belongs in an Accessor, not scattered across
  UI validation:** "a household has exactly one Owner at all times its
  membership is non-empty" (FR-1.18) is a genuine invariant, not a
  workflow nicety — same pattern as the Budget overlap check (CUC-5) and
  the Goal allocation cap (CUC-10). Two different actions converge on
  it: an Owner voluntarily leaving (FR-1.11) and an Owner's account being
  hard-deleted (FR-1.17, CUC-2) both trigger the same auto-succession
  check, so it must be resolved once, at the point of membership removal,
  not duplicated per trigger.

## CUC-2: Authenticate Securely

A user registers (enrolling MFA at the same time), logs in with a password
plus a second factor (MFA), logs out, resets a forgotten password or
changes a known one, recovers MFA access via a backup code, and can
review/revoke active sessions and devices. A user can also delete their own
account.

- **Primary actor:** Any user
- **Volatility:** Low functionally, but **high non-functional volatility** —
  auth providers, MFA methods, and session policy are exactly the kind of
  cross-cutting concern that changes independently of business logic.
  Strong candidate for isolation behind a Utility/Resource Accessor
  boundary from the start.
- **Note — account deletion is a hard delete, and it reaches into CUC-1:**
  deleting a user (FR-1.17) is not local to this use case — it must also
  resolve the Owner-succession invariant (FR-1.18, see the CUC-1 note)
  whenever the deleted user was a household Owner, and anonymize (not
  delete) that user's contributions to any shared household data. Sits at
  the same seam as `IdentityManager` already owning both CUC-1 and CUC-2
  (§2.1 of the VBD decomposition) — this is one workflow, not two.

## CUC-3: Manage Financial Accounts

A user creates and maintains financial accounts (checking, savings, credit
card only, investment — OQ-76), each denominated in a single currency,
optionally attaches one or more physical credit cards to an account, and
— **deferred to v2 (OQ-69)** — optionally connects an account to an Open
Banking provider for automatic sync.

- **Primary actor:** Household Member
- **Volatility (credit cards):** Low. A credit card attached to an account
  (network/brand, last 4 digits, closing date, bill due date, expiration
  date) is simple reference data with no external dependency — unlike the
  Open Banking connection below, it doesn't need its own Resource Accessor,
  just its own entity nested under the account. **Confirmed:** a Credit
  Card carries its own running outstanding balance and its own transaction
  ledger (Card Transactions), kept deliberately separate from the parent
  account's Account Transactions — see CUC-4. Its **closing date** groups
  Card Transactions into monthly cycles (so "this month's total" is
  computable) without a separate frozen statement entity; **bill due
  date** and **expiration date** are two more distinct, easily-conflated
  dates — payment deadline vs. physical card validity.
- **Volatility: [volatile]** The Open Banking connection is the single most
  volatile element of this use case: providers, auth flows (e.g., consent
  renewal), and data formats differ by institution/region and will change
  over time. This must be isolated as its own Resource Accessor, fully
  decoupled from manual account management. **Confirmed multi-region:** the
  target market is Brazil (BRL) plus US-based users (USD), so this Resource
  Accessor boundary must support at least two regional providers (e.g. Open
  Finance Brasil for BRL, a US-oriented provider for USD) behind one
  interface from day one — not a single-provider assumption with region
  bolted on later.

## CUC-4: Record Transactions

A user manually records any cash-flow event against an account through
**one unified entry point** — withdrawals, deposits, boleto payments, Pix
(sent/received), transfers (sent/received), credit card bill payments, and
investment activity (buy, sell, dividend, interest, redemption, tax) — or
such transactions arrive automatically from a synced Open Banking
connection (**deferred to v2**, OQ-69). Separately, a user records
purchases and refunds directly against a specific Credit Card. Everything
is categorized for budgeting and reporting. The user browses all their
transactions in one list and filters it (FR-3.12), and sees each month's
inflow, outflow and net per currency alongside that month's balances,
budgets and goals (FR-6.11).

- **Primary actor:** Household Member
- **Volatility:** The *list of kinds* (withdrawal, boleto, Pix, dividend,
  ...) is the volatile part — new payment rails and investment event types
  will keep appearing (particularly in the Brazilian market, an evidenced
  signal, not a guess). **Kind must be modeled as reference data, not a
  hardcoded enum with branching logic per case** — a small, stable set of
  *effects* (simple cash movement, paired transfer, investment trade,
  investment cash event) is what the Engine actually branches on; kind is
  just a label riding along for categorization/display. (**Corrected
  during volatility reconciliation:** this note previously also claimed
  "categorization rules and recurring-transaction logic tend to grow in
  complexity" as a volatility — that was speculation with no actual
  signal behind it, the same mistake later caught and fixed on CUC-5 and
  CUC-10's notes. Removed.)
- **Note — two separate ledgers, by explicit stakeholder direction:**
  **Account Transactions** (this use case) and **Card Transactions**
  (purchases/refunds against a specific Credit Card) are kept apart. A
  card's activity never appears in its parent account's transaction list;
  the only bridge between them is a Credit Card Bill Payment, which is an
  Account Transaction that also reduces the card's outstanding balance.
  This mirrors real credit card behavior: a purchase accrues on the card's
  bill; the account balance only moves when that bill is paid.
- **Note — investments live inside their account:** an investment buy/sell
  moves money between an account's cash and one of its
  Holdings' quantity; dividend/interest/tax/redemption are cash movements
  against that same account, referencing the Holding for traceability. No
  separate "funding account" link is needed — see CUC-6 and CUC-3.

## CUC-5: Budget Spending

A user manages a two-level Category/Subcategory taxonomy (FR-10), sets a
spending budget per period (personal or shared at the household level)
against one or more Categories and/or Subcategories, and the system tracks
actual spend against it, alerting as thresholds are crossed.

- **Primary actor:** Household Member
- **Volatility: none identified.** The budgeting model (simple
  category/period budgets) is a stable, well-defined business rule.
  (**Corrected during volatility reconciliation:** this note previously
  called the budgeting model "a plausible future volatility point if
  envelope-style or zero-based budgeting is added later" — that was
  speculation with no stakeholder signal behind it, not an evidenced
  volatility. "I can imagine an alternative design" isn't sufficient
  grounds; removed.)
- **Note — a real invariant, belongs in an Engine:** "a Category/Subcategory
  can be claimed by at most one Budget in the same scope/period, and
  assigning a whole Category reserves all its Subcategories" (FR-4.6/FR-4.7)
  is a genuine business rule, not UI validation — same pattern as the
  Goal allocation cap in CUC-10. Resolving "which Budget does this
  Transaction's spend count toward" (FR-4.8) is Engine logic that both
  Budget creation/editing and Transaction recording depend on, so it
  shouldn't be duplicated in either place.
- **Note — accrual, not cash, timing:** a credit card charge counts as
  spend the moment it's recorded, not when the card's bill is later paid
  (FR-4.5) — otherwise spend would be invisible until weeks after the
  purchase, defeating the point of a budget.
- **Note — Budget vs. Budget Period:** a **Budget** is the current, editable
  definition (which categories, what target); a **Budget Period** (FR-4.9)
  is an immutable per-month record of the target that was actually in
  effect. Editing a Budget's target only ever affects periods from now on —
  past periods must never change retroactively. This distinction exists
  specifically so multi-year history stays trustworthy, and it's a genuine
  Engine-level concern (when does a new period "lock in" its target?), not
  something to bolt on as an afterthought in reporting.

## CUC-6: Track Investments & Net Worth

A user primarily acquires investment holdings (stocks, FIIs, fixed-income
instruments, funds, other) by recording a buy transaction (CUC-4) — which
creates the Holding automatically (a pre-existing investment is just a
buy dated in the past, OQ-53). A Holding's position changes only through
its transactions; market-priced Holdings (stocks, FIIs, funds) also get
manually entered market values, which the user can later correct. The
user maintains the index rates (Selic, CDI, IPCA, IGP-M) used to project
fixed-income payouts, and views net worth (assets minus liabilities)
trended over time, reported per currency. Payout (dividends, interest) is
derived from the transactions linked to each Holding (FR-5.9), and the
investment engine projects each fixed-term Holding's expected payout and
taxes (FR-11.2).

- **Primary actor:** Household Member
- **Volatility:** Low-to-moderate for v1 (pure manual entry + arithmetic)
  regarding valuation itself. Will become **highly volatile** once live
  pricing is introduced (see CUC-7) — the boundary between "holding
  record" (stable) and "holding valuation source" (volatile) should be
  drawn now even though v1 only implements the manual side.
- **Volatility: [volatile] — instrument-specific product rules
  (FR-11, OQ-42):** a second, distinct volatility axis surfaced during
  use-case verification, separate from valuation-source volatility above.
  A fixed-term instrument (CDB, LCI, LCA, Tesouro Direto in Brazil; CDs,
  Treasury bonds in the US) carries contractual terms — maturity date,
  interest schedule, tax rule — that a stock/FII buy doesn't have, and
  those rules are genuinely instrument- and region-specific (the US has no
  CDB/LCI/LCA equivalent at all). Computing them, and auto-generating the
  resulting future transactions (interest, redemption, tax) on schedule,
  is real computation — this reopens the Engine question the VBD
  decomposition's Round 6 had closed for Holdings (it had removed
  `HoldingValuationEngine` because, at the time, "update a holding" was
  only ever a workflow decision + a validated write). The VBD backend
  decomposition needs a revision pass for this.
- **Confirmed:** a Holding is not standalone — it always belongs to one
  checking, savings, or investment account (OQ-76), the same way a Credit Card always belongs to one
  checking/savings/credit-card account (CUC-3). Buying, selling, and
  investment cash events all flow through that account, giving the
  stakeholder's "full control of account cash flow" goal a consistent home
  for investment activity too, not a separate silo.
- **Note — valuation is a history, not a field:** a Holding's "current"
  value being a single mutable field would make month-by-month net worth
  (FR-5.4) and Goal progress (FR-8.7, CUC-10) impossible to
  reconstruct after the fact — there'd be nothing left to look back at.
  Every valuation change (manual, or via buy/sell/redemption, FR-3.8)
  instead records a timestamped **Valuation Snapshot** (FR-5.2); "value as
  of month M" is just the latest snapshot at or before that month ends.
  Manual snapshots are editable/deletable to fix typos (OQ-56) — history
  that can be corrected is still history. One
  mechanism serves net worth history, per-holding value charts, and
  Goal history at once — it shouldn't be built three times.

## CUC-7: Build FII / Stock Portfolios

**Deferred to v2 (OQ-70).** Entry points stay visible on Investments,
disabled.

A user uses a Portfolio Builder to compose a target allocation across FIIs
(v1) and, later, stocks — first purely from user-provided data, later
augmented by external analysis/recommendation APIs (e.g., suggested FIIs,
graph-based stock analysis).

- **Primary actor:** Household Member (investment-focused)
- **Volatility: [volatile]** The most explicitly forward-looking use case in
  scope: the external analysis/recommendation integration is named as
  future work by the stakeholder. The v1 Portfolio Builder logic must be
  designed so that "analysis provider" is a pluggable boundary, not
  hardcoded, so its later arrival doesn't require reworking the builder
  itself.

## CUC-8: View Insights & Reports

A user composes their own **Dashboard** from a library of **Widgets** —
account balances, budget status, net worth trend, account balance by
month, spending by Category/Subcategory, income vs. expense, Goal
progress by month, and more over time — rather than seeing one fixed,
hardcoded summary screen. Separately, the user views ad-hoc reports over a
date range and receives notifications.

**Phasing (Oct 2026 review):** the customizable Dashboard remains the goal
but arrives in **v3** (OQ-67); **v1** ships a fixed Dashboard (FR-6.0).
Ad-hoc reports and CSV export arrive in **v2** (OQ-71). Notifications are
**v1** — triggers: household invitation received and fixed-term Holding
past due (OQ-68); Open Banking sync failure is dormant until v2; budget
thresholds were removed (OQ-52).

- **Primary actor:** Household Member
- **Volatility:** Moderate for reports; **[volatile]** for notification
  *delivery*. In-app is the confirmed v1 minimum channel, but the
  stakeholder explicitly flagged that delivery channels (email, push, SMS)
  will expand over time. The decision of *whether/what* to notify must be
  fully decoupled from *how* it's delivered, so the channel is a Utility
  boundary, not logic embedded alongside each trigger.
- **Volatility (dashboard): [volatile]** The Widget *library* will keep
  growing — every new report this system ever adds is a candidate Widget.
  This is exactly the EBD principle of composing an Experience from
  configuration rather than hardcoded structure: the Dashboard Experience
  must read "which Widgets, in what order, with what settings" as data (a
  per-user layout), not assemble a fixed screen. A new Widget type should
  never require changing the Dashboard itself — only adding one new entry
  to the library (FR-6.7), the same discipline already applied to
  Transaction Kind and Category.
- **Note — account balance by month needs no new data:** unlike net worth
  and Goal history, an account's balance as of any past date is
  always derivable by summing its dated Transactions/Card Transactions
  (FR-6.6) — there's no valuation-style gap here, because a Transaction
  ledger already *is* a complete history, not a mutable current value.

## CUC-9: Audit & Review Activity

A Household Owner/Admin exports an audit log (CSV, over a date range) of
who did what to shared financial data; any user can review and revoke
their own active sessions (already covered by CUC-2). End-user
login-history viewing was considered and dropped — see the note below.

- **Primary actor:** Household Owner/Admin (audit log), any user (own
  active sessions)
- **Volatility:** Low functionally (the requirement to log is stable) but
  cross-cutting — every other use case that mutates state feeds this one,
  making audit logging a Utility concern rather than logic embedded in each
  use case.
- **Note — end-user login-history viewing removed, not built (OQ-31):**
  originally FR-7.3. Dropped because it's not something end users actually
  need or ask for — reviewing login activity is a system-admin concern,
  served directly against the database/logs, not a product feature behind
  a UI. **Active session** viewing/revocation (FR-1.3) stays — that one
  *is* user-facing, since it's how a user protects their own account (e.g.,
  revoking a device they no longer recognize).
- **Note — two distinct logs, don't conflate them:** the **Audit Log**
  above (FR-7.1/FR-7.2) is a business/compliance-facing record scoped to
  create/modify/delete actions on financial and household data, viewable by
  a household Owner/Admin. It is a *subset* of a broader, engineering-facing
  **Application Log** that records all activity and all errors across the
  system for debugging/bug-tracking, tagged with the acting user's ID (see
  NFR-OBS-1 through NFR-OBS-4). The Application Log has no end-user-facing
  view in this design; it exists purely to support the engineering team.
- **Note — Audit Log content is deliberately minimal (IDs + action only,
  no before/after values, FR-7.1):** this is what makes account deletion
  (CUC-2, FR-1.17) a **hard** delete without ever touching audit history —
  an orphaned ID left in a log entry after its record is gone means
  nothing on its own, so GDPR/LGPD erasure (NFR-COMP-4) never has to break
  the Audit Log's append-only guarantee (NFR-AUD-1). See OQ-25.

## CUC-10: Define & Track Investment Goals

A user defines a Goal (a target amount, currency, and a due date —
e.g., "down payment, R$50,000 by 2028") and allocates a percentage of one
or more Investment Holdings toward it — potentially Holdings in different
currencies, whose contributions are converted via a manually-maintained
Currency Reference Rate (FR-9) and summed into one combined progress figure
— so progress toward the goal can be tracked independently of the
holdings' other purposes. Progress can also be viewed by month for any
past year (FR-8.7), using the same Valuation Snapshot history that powers
net worth over time (see the CUC-6 note).

- **Primary actor:** Household Member (investment-focused)
- **Volatility: none identified.** The core rule — a holding's allocated
  percentages across all its Goals must never exceed 100% — is a
  stable invariant: a validated write on the Resource Accessor
  (`GoalAccessor.allocate(...)` in the VBD decomposition), not an
  Engine and not UI validation. The Goal↔Holding allocation is
  modeled as its own join concept (not fields embedded directly on
  Investment Holding), which is good data-model hygiene, not evidence of
  volatility. (**Corrected during volatility reconciliation:** this note
  previously called funding-source-restricted-to-Holdings "more volatile"
  because "a natural future extension is funding a Goal from a
  regular savings account too" — same unevidenced-speculation mistake as
  CUC-4 and CUC-5's notes; removed. It also said the 100% cap "belongs in
  an Engine," contradicting the actual VBD decomposition's own Wave-2
  guidance that a percentage cap is a validated write, not Engine work —
  corrected to match.)
- **Note (currency conversion) — superseded, no longer volatile on the
  backend (OQ-49):** this used to be marked `[volatile]` on the
  assumption that "get the reference rate for a currency pair" would be
  its own Resource Accessor/Engine seam, swappable for a live-rate feed
  later. That assumption is gone — the rate is a frontend-only, on-the-fly
  calculator input, never persisted, with no backend accessor at all. The
  backend's remaining surface (return each allocated Holding's
  contribution in its own currency) is now genuinely stable, not
  volatile — this volatility was eliminated by a design decision, not
  resolved by building the swappable seam it originally called for.
