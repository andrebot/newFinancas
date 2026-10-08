# Glossary

- **Household** — A group of one or more users who share visibility over
  shared accounts, budgets, and the audit log (FR-1.4).
- **Role** — A household member's permission level: Owner, Admin, Member,
  or Viewer (FR-1.6).
- **Financial Account** — A manually created or Open-Banking-linked record
  of money held in exactly one currency. Types: checking, savings, credit
  card only, investment (OQ-76).
- **Credit Card** — A physical card attached to a Financial Account,
  storing only its network/brand and last 4 digits — never the full card
  number or CVV (FR-2.7–FR-2.9). Also carries a running outstanding balance
  and its own Card Transaction ledger (FR-2.10). Distinct from a "credit
  card"-type Financial Account, which represents the credit line/balance
  itself. Has three distinct dates (FR-2.8), easy to conflate:
  - **Closing Date** — cutoff for tallying a billing cycle's spend.
  - **Bill Due Date** — when the closed cycle's bill must be paid.
  - **Expiration Date** — when the physical card itself stops being valid.
- **Account Transaction** — A single recorded cash-flow event against a
  Financial Account (withdrawal, deposit, boleto, Pix, transfer, credit
  card bill payment, or investment activity). Entered through one unified
  entry point regardless of kind (FR-3.1–FR-3.8).
- **Card Transaction** — A purchase (charge) or refund recorded directly
  against a Credit Card. A separate ledger from Account Transactions —
  never appears in the parent account's history and never directly changes
  the account's balance; only a Credit Card Bill Payment bridges the two
  (FR-3.9–FR-3.11).
- **Transaction Kind** — The specific label on a Transaction (withdrawal,
  boleto, Pix, dividend, ...), stored as reference data rather than a
  hardcoded enum, so new kinds don't require schema/logic changes.
- **Transaction Effect** — The small, stable set of behaviors a Transaction
  can have beyond a simple cash movement: paired transfer, investment trade
  (changes a Holding's quantity), or investment cash event (references a
  Holding, no quantity change). This is what Engine logic branches on —
  Kind is just a label for categorization/display.
- **Category** — A top-level classification label applied to a transaction
  for budgeting and reporting purposes; household-scoped (shared, not
  personal-per-user), predefined-or-custom, with an icon and colour that
  identify it across the UI (FR-10.1).
- **Subcategory** — A classification nested one level under a Category
  (e.g., "Food" → "Groceries"). The hierarchy is exactly two levels — a
  Subcategory can't have its own subcategories (FR-10.2).
- **Budget** — The current, editable spending target over a recurring
  period, assigned to one or more Category and/or Subcategory targets
  (FR-4.1). Assigning a whole Category rolls up to include all its
  Subcategories (FR-4.6); a given Category/Subcategory can be claimed by
  at most one Budget per scope/period, to keep "actual spend" unambiguous
  (FR-4.7). Tracked on an accrual basis — a credit card charge counts
  immediately, its later bill payment does not count again (FR-4.5).
- **Budget Period** — An immutable, per-month record of the target
  amount(s) a Budget actually had in effect that month (FR-4.9). Editing a
  Budget only changes current/future periods; past Budget Periods never
  change retroactively, so multi-year budget history stays trustworthy.
- **Investment Holding** — A manually tracked position in an asset (stock,
  FII, fund, other) with quantity and cost basis. Always belongs to
  exactly one checking, savings, or investment Financial Account — not a
  standalone record
  (FR-5.1). Its valuation is a **history**, not a single field — see
  Valuation Snapshot.
- **Valuation Snapshot** — A timestamped record of an Investment Holding's
  market value — entered manually for market-priced Holdings (stock, FII,
  fund, other), where manual snapshots can be edited/deleted to fix
  mistakes, plus one recorded automatically by every buy/sell/redemption
  (FR-5.2). Fixed-term
  Holdings never have snapshots (FR-5.4). A Holding's "current" value is just its
  latest snapshot; "value as of month M" is its latest snapshot at or
  before that month's end. The single mechanism behind net worth history
  (FR-5.4) and Goal progress-by-month (FR-8.7).
- **FII (Fundo de Investimento Imobiliário)** — A Brazilian real-estate
  investment fund; a first-class investment holding type and the subject of
  the v1 Portfolio Builder.
- **Net Worth** — Total assets minus liabilities, computed and reported per
  currency (no cross-currency conversion — see OQ-3).
- **Portfolio Builder** — A tool that helps a user compose a target
  allocation of holdings. The FII Portfolio Builder ships in v1; a Stock
  Portfolio Builder follows later, same design shape.
- **Goal** *(called "Objective" before October 2026 — renamed, OQ-66)* —
  A financial goal with a name, target amount, target
  currency, and due date, funded by allocating a percentage of one or more
  Investment Holdings to it — possibly Holdings in different currencies
  (FR-8.1–FR-8.6). The one place in the system where currencies are
  deliberately blended into a single combined figure, via a Currency
  Reference Rate.
- **Goal Allocation** — The link between an Investment Holding and a
  Goal, expressed as a percentage of that Holding. A Holding's
  allocations across all its Goals must never sum past 100% (FR-8.3).
- **Currency Reference Rate** — A manually entered, manually updated
  exchange rate between two currencies (e.g., "1 USD = 5.20 BRL"), used
  **only** to convert Investment Holding contributions into a Goal's
  target currency for progress calculations (FR-9). Never automated, and
  never used for account balances, transactions, or net worth.
- **Index Reference Rate** — A manually entered, dated value of a market
  index (Selic, CDI, IPCA, IGP-M), kept as a history. The investment engine
  uses the latest value to project expected payout and taxes for
  fixed-term Holdings whose rate tracks that index (FR-11.6). Unrelated to
  Currency Reference Rates.
- **Dashboard** — A user's home view. **v1:** a fixed set of panels
  (FR-6.0). **v3:** personal and customizable, composed of Widgets the
  user adds, removes, reorders, and configures (FR-6.1, FR-6.8, deferred —
  OQ-67). Not shared at the household level, even when a Widget shows
  shared data — see OQ-22.
- **Widget** — One report/data view (net worth trend, spending by
  Category, Goal progress, etc.) placed on a Dashboard. Widget type
  is reference data drawn from a growing library (FR-6.7), not a hardcoded
  part of the Dashboard — the same "grows as data, not code" pattern as
  Transaction Kind and Category.
- **Open Banking Connection** — A link between a Financial Account and an
  external bank via an Open Banking / Open Finance API, enabling automatic
  balance/transaction sync.
- **Audit Log Entry** — An immutable record of a create/modify/delete
  action on financial or household data (FR-7.1). Business/compliance
  facing; viewable by a household Owner/Admin.
- **Application Log** — A broader, engineering-facing log of every
  activity and error the system processes, tagged with the acting user's
  ID, used for debugging and bug tracking (NFR-OBS-1 through NFR-OBS-4).
  Every Audit Log entry is also an Application Log entry, but not the
  reverse; it has no end-user-facing view. Shipped via Winston's
  **Transport** mechanism — stdout/console for v1, with more transports
  addable later purely as configuration (NFR-OBS-5).
