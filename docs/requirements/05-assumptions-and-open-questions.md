# Assumptions & Open Questions

Tracks decisions that started as defaults and have since been confirmed (or
refined) by the stakeholder, plus what's genuinely still open. Resolved
items are kept here rather than deleted so the *reasoning* stays visible —
useful once VBD/EBD decomposition starts making structural decisions that
depend on them.

## Resolved

### OQ-1: Household role set & permissions
**Confirmed:** Owner, Admin, Member, Viewer, with the permission sketch in
FR-1.7.

### OQ-2: Personal vs. shared account visibility
**Confirmed:** Every account is explicitly marked personal (owner only) or
shared (whole household), per FR-2.3.

### OQ-3: Net worth aggregation across currencies
**Confirmed:** Net worth is computed and displayed **per currency**; there
is no blended single number. Consistent with "no FX conversion."

### OQ-6: Multi-household membership
**Confirmed:** A user may belong to more than one household (FR-1.8).

### OQ-7: Report/data export formats
**Confirmed:** CSV export of transactions at minimum (FR-6.4); PDF for
formatted reports remains a nice-to-have, not a v1 commitment.

### OQ-8: Audit log retention period
**Confirmed:** Audit log entries are retained **indefinitely** for now — no
automatic purge/deletion. Revisit this if a future regulatory review (see
OQ-4) mandates a maximum retention period.

### OQ-9: Recurring/scheduled transactions vs. bill reminders
**Confirmed:** These are two separate things and were conflated in the
original question:
- Recurring/scheduled transaction **generation** (FR-3.5) stays in v1 — it's
  useful for automating manual entry independent of reminders.
  **Superseded by OQ-55:** recurring transactions were later dropped
  entirely.
- Bill/recurring-transaction **reminder notifications** (originally part of
  FR-6.5) are deferred to a **later phase**.

### OQ-11: Which account types can have Credit Cards attached
**Confirmed:** checking, savings, or credit-card-type accounts (FR-2.7).
Cash, investment, and "other" accounts cannot have a Credit Card attached.
**Updated by OQ-76:** "cash" and "other" no longer exist as types; an
investment account still can't have a Credit Card.

### OQ-12: Goal personal vs. shared visibility
**Confirmed:** Goals follow the same personal/shared model as accounts
and budgets (FR-2.3/FR-4.2) — a Goal is either visible only to its
creator or to the whole household (FR-8.1).

### OQ-13: Goal currency vs. allocated Holdings' currency
**Confirmed:** Goals **do** allow multi-currency funding — Holdings in
different currencies can be allocated to the same Goal and their
contributions must sum to a single combined progress figure against the
target amount. This is a deliberate, scoped exception to the app's
otherwise-firm "no FX conversion" stance (net worth stays per-currency,
unchanged — see OQ-3).

**How, without automating FX:** the same principle already applied
elsewhere ("no *automated* conversion," not "no conversion, ever") extends
here. The user manually enters and maintains a **Currency Reference Rate**
per currency pair (e.g., "1 USD = 5.20 BRL"), with no live rate fetching.
Goal progress converts each allocated Holding's contribution into the
Goal's target currency using the latest manually-set rate for that
pair, then sums. See FR-9 (new) for the Currency Reference Rate
requirements and the updated FR-8.4/FR-8.5.

**Known tradeoff, accepted:** progress accuracy now depends on the user
keeping the reference rate reasonably current — the system does not warn
if a rate is stale in v1 (a plausible later enhancement, not committed to
now).

### OQ-14: Investment Holdings standalone vs. account-linked
**Confirmed:** an Investment Holding always belongs to one investment-type
Financial Account *(**updated by OQ-76:** any checking, savings, or
investment account)* — "an investment will need to live under one bank
account." Mirrors how a Credit Card always belongs to one
checking/savings/credit-card account. See FR-5.1, CUC-6.

### OQ-15: Credit card purchases — immediate debit vs. deferred billing
**Confirmed:** deferred billing. A card purchase (Card Transaction charge)
increases the Credit Card's own outstanding balance and does **not**
touch the linked account's balance. A separate Credit Card Bill Payment
(an Account Transaction) later debits the account and reduces the card's
outstanding balance. This gives the "bill due date" field (FR-2.8) its
intended purpose. See FR-2.10, FR-3.7, FR-3.9, FR-3.10.

### OQ-16: Account Transactions vs. Card Transactions — one ledger or two?
**Confirmed:** two separate ledgers, by explicit stakeholder direction. A
Credit Card's purchases/refunds never appear in its parent account's
transaction history; only a Credit Card Bill Payment bridges the two. See
FR-3.7–FR-3.11.

### OQ-17: Credit card statement/billing-cycle modeling
**Confirmed, partially:** a **Closing Date** field was added (FR-2.8) —
distinct from Bill Due Date and Expiration Date — specifically so the
system can group Card Transactions into monthly cycles and answer "what's
this month's total." What remains a deliberate v1 simplification (not
asked for, not built): no frozen historical statement snapshots, and no
partial-payment/revolving-interest modeling (spun out as its own item,
OQ-19, since it's a distinct question). See FR-2.8, FR-2.10.

### OQ-18: Installment purchases (parcelamento)
**Confirmed:** not tracked automatically. The system does not split a
purchase into future installments or auto-schedule them — if a user makes
an installment purchase, they manually record each installment as its own
Card Transaction when it occurs. See FR-3.9.

### OQ-20: Category rollup — automatic or explicit?
**Confirmed:** assigning a whole Category to a Budget automatically rolls
up to include all its Subcategories (FR-4.6), including ones added later —
no manual re-listing needed. See FR-4.6, FR-4.8.

### OQ-21: One Budget per Category/Subcategory — enforced or advisory?
**Confirmed:** enforced. A Category or Subcategory can be claimed by at
most one Budget per scope (personal/shared)/period; the system rejects an
assignment that would create overlap (FR-4.7) — this is Engine-level logic
(see the CUC-5 note in 01-core-use-cases.md), not UI validation. See
FR-4.7.

### OQ-22: Dashboard layout — personal per user, or shared per household?
**Confirmed:** personal per user. Each household member arranges their own
Dashboard independently, even when its Widgets display shared household
data — the layout itself is a display preference, not financial data. See
FR-6.8.

### OQ-23: Email verification on registration
**Confirmed:** deferred, not in v1 scope. FR-1.1 registration (email +
password) does not require verifying the email address is reachable before
the account can be used.

### OQ-24: MFA recovery when backup codes are also exhausted/lost
**Confirmed:** out of scope for v1 as a self-service backend flow. FR-1.16
covers recovery via an unused backup code; beyond that, regaining access is
a manual/support-assisted process outside this system, same treatment as
email verification (OQ-23) — not something the architecture needs to model
as a use case yet.

### OQ-25: Account/data deletion — GDPR/LGPD erasure mechanics
**Confirmed, several parts:**
- **Hard delete, not soft-delete/deactivate.** Deleting a user's account
  (FR-1.17) permanently removes credentials, sessions, and any data
  visible only to that user. This is the mechanism behind
  NFR-COMP-4's right-to-erasure claim.
- **Audit Log content changed to make this safe.** FR-7.1 no longer
  records before/after field values — only actor ID, timestamp, action,
  entity type, and entity ID. Once a user (or any entity) is hard-deleted,
  the IDs left behind in old audit entries are orphaned and meaningless on
  their own, so **no audit-log rewrite or purge is ever needed on
  deletion** — the append-only/immutable guarantee (NFR-AUD-1) never has
  to be broken to satisfy erasure.
- **Shared household data is anonymized, not deleted, on member
  deletion.** A deleted user's contributions to *shared* resources
  (shared Account Transactions, shared Budgets, etc.) are retained — the
  household jointly owns that data, and other members depend on it staying
  in their ledger/history — but the actor reference on those records is
  cleared. Only data visible *exclusively* to the deleted user is actually
  erased.
- **Owner departure/deletion has a defined succession rule (FR-1.18).** If
  the departing/deleting user is a household's Owner, the system
  auto-promotes the longest-tenured remaining Admin (falling back to the
  longest-tenured Member, then Viewer) so the household is never left
  without an Owner. If the departing Owner was the household's only
  member, the household is deleted along with the account. This applies
  identically whether the Owner leaves voluntarily (FR-1.11) or deletes
  their account (FR-1.17) — same succession mechanism, two different
  triggers.

### OQ-26: Can a household invitation target someone who isn't yet a user?
**Confirmed:** No. An invitation (FR-1.5) can only be sent to an email
address that already matches a registered user account. There is no
invite-triggers-signup flow in this design — inviting a non-existing email
is simply rejected. See FR-1.19.

### OQ-32: Can a financial account's type be changed after creation?
**Confirmed:** No, immutable. See FR-2.1.

### OQ-33: Can an account's personal/shared visibility be changed after creation?
**Confirmed:** Yes. Unlike type, visibility can be edited later — no
attachment rule is keyed off it the way Credit Cards/Holdings are keyed
off type. See FR-2.3.

### OQ-34: Can an archived/closed financial account be reactivated?
**Confirmed:** No — one-way, same as the Category/Subcategory archive
pattern (FR-10.3). See FR-2.4.

### OQ-35: Are Credit Card attach/edit/remove separate actions, or folded into Edit Account?
**Confirmed:** Fully folded together. Editing a Financial Account, and
attaching/editing/removing any of its Credit Cards, are one combined
form submitted as a single request — not four separate use cases with
their own submits. See FR-2.9.

### OQ-36: Does archiving an Open-Banking-linked account auto-disconnect it?
**Confirmed:** Yes. Archiving an account automatically disconnects its
Open Banking sync (FR-2.6) — an archived account never keeps pulling in
new transactions. See FR-2.4.

### OQ-37: Can a Card Transaction be edited or deleted like an Account Transaction?
**Confirmed:** Yes. FR-3.9 didn't originally state this explicitly; the
omission is closed — Card Transactions get the same edit/delete
capability as Account Transactions (FR-3.2).

### OQ-38: Is creating a recurring transaction its own use case, or folded into Record Transaction?
**Confirmed:** Folded in. "Recurring" is a toggle + schedule on the same
unified Record Account Transaction entry point (FR-3.1) — not a separate
flow/diagram, same principle as kind and category. See FR-3.5.
**Superseded by OQ-55** — recurring transactions were dropped, so there is
no toggle at all.

### OQ-39: Are Account Transactions and Card Transactions recorded/edited/deleted through separate flows?
**Confirmed: No, one combined entry point.** Recording, editing, and
deleting a transaction is the same flow whether the target is a Financial
Account or a Credit Card — target is just another data field, like kind,
that narrows what's valid (a Credit Card target only offers charge/refund
kinds; investment kinds only apply to investment-account targets). This
is a distinct decision from OQ-16 (the two ledgers stay separate storage/
display) — collapsing the *entry point* doesn't reopen the ledger-
separation question. See FR-3.1/FR-3.2/FR-3.9.

### OQ-40: Is deleting a Budget a hard delete or an archive?
**Confirmed:** Hard delete of the live definition. Unlike Account/Category
archiving, past Budget Periods (FR-4.9) are their own immutable record and
don't depend on the Budget still existing, so there's nothing left that a
soft-delete/archive would protect. Deleting also frees the Budget's
claimed Category/Subcategory targets (FR-4.7). See FR-4.10.

### OQ-41: Is a Holding created via a standalone form, or as a side effect of buying?
**Confirmed:** Transaction-driven only — recording an investment-buy
Account Transaction against a new ticker auto-creates its Holding; buying
more of an existing one increases quantity. A standalone "manually add a
Holding" action once existed alongside this, for onboarding backfill; it
has since been retired (see OQ-53) — there is exactly one creation path
now. See FR-5.1.

### OQ-42: Should instrument-specific maturity/interest/tax rules be computed by the system in v1?
**Confirmed:** Yes, for a defined instrument list (not open-ended) — see
FR-11.1. This reopens a question the VBD decomposition's Round 6 had
closed: computing a maturity date, an interest schedule, or tax owed from
an instrument's own terms is genuine computation (Engine-shaped), unlike
"decide a workflow step + validated write," which is what closed off
`HoldingValuationEngine` before. **The backend VBD decomposition
(`docs/architecture/backend/01-vbd-decomposition.md`) needs a revision
pass for this** once all core-use-case verification is done — flagged
there too. Computed cash events (interest, redemption, tax) **auto-post**
without user confirmation (FR-11.3), same pattern as Open Banking sync and
recurring transactions.

### OQ-43: Is deleting an Investment Holding a hard delete or an archive?
**Confirmed:** Archive, one-way — same pattern as Accounts/Categories
(FR-2.4/FR-10.3), not Budget's hard-delete treatment (OQ-40). Unlike a
Budget Period, a Holding's Valuation Snapshot history and any Goal
allocations referencing it directly depend on the Holding continuing to
exist, so there's real history a hard delete would orphan. See FR-5.8.

### OQ-44: Can the onboarding backfill form set up a fixed-term instrument's schedule too?
**Superseded by OQ-53** — the onboarding backfill path this question
assumed no longer exists. Originally confirmed yes; moot now that every
Holding, fixed-term or otherwise, is created transaction-driven (FR-5.1).

### OQ-45: What does the in-app notification channel actually look like?
**Confirmed:** A header-mounted notification inbox (bell icon + unseen
count), backed by persistent DB storage, with seen/unseen state per
notification. Opening the inbox marks the shown notifications as seen.
Deletion is a hard delete — no archive, no undo. See FR-6.10.

### OQ-46: Is the Audit Log browsable in-app, or export-only?
**Confirmed:** Export-only — a household Owner/Admin downloads it as a
CSV over a selected date range, same shape as Export Transactions to CSV
(FR-6.4). No in-app browsable table. See FR-7.2.

### OQ-47: Goal removal — archive, delete, or both?
**Confirmed: both, with distinct meanings — a third lifecycle pattern.**
This project now has three different delete/archive shapes, each for a
real reason, not inconsistency:
- **Budget** (OQ-40): delete only, hard. Past Budget Periods are an
  independent record, so there's nothing an archive would protect.
- **Account/Category/Holding** (OQ-34/OQ-43): archive only, one-way.
  Their history (transactions, valuation snapshots) directly depends on
  the record continuing to exist, and there's no "this no longer makes
  sense, discard everything" case worth supporting.
- **Goal**: **both**, and unlike the archive above, **reversible**.
  Archive = "this goal is completed," keeps the record (and its
  historical progress-by-month, FR-8.7) intact, and can be undone
  (FR-8.9). Delete = "this goal no longer makes sense," hard, no
  history kept (FR-8.6). Two different real-world intents map to two
  different actions here, where elsewhere one action sufficed.

### OQ-48: Which side owns Holding-to-Goal allocation — the Holding or the Goal?
**Confirmed: the Holding.** A user edits an Investment Holding to set (or
adjust/remove) what percentage of it funds one or more Goals — not
the reverse. This means allocation management folds into Edit Investment
Holding (CUC-6, UC-2), not into Create/Edit Goal (CUC-10). A
Goal's own page can still display which Holdings fund it, read-only.
See FR-8.2/FR-8.6.

### OQ-49: Are Currency Reference Rates persisted server-side?
**Confirmed: No — frontend-only, on-the-fly estimate, not saved to the
database.** Simplifies the design considerably: `CurrencyReferenceRateAccessor`
is removed entirely (it never existed as a real requirement once this was
decided — flagged for the VBD decomposition's next revision pass). The
backend's role in Goal progress (FR-8.5) shrinks to "return each
Holding's contribution in its own currency"; blending them into one
target-currency figure using a rate the user types in becomes a purely
frontend (EBD) concern. There is no "Manage Currency Reference Rates" use
case anymore — it's absorbed into the Goal progress view itself, not
a separate CRUD flow. See FR-9, FR-8.4/FR-8.5.

### OQ-31: Should end users be able to view their own login history?
**Confirmed: No, removed.** Originally FR-7.3. Reviewing login activity is
a system-admin concern, served directly against the database/logs — not
something end users need or ask for, and not worth a UI/backend use case.
Active session viewing/revocation (FR-1.3) is unaffected — that stays,
since it's genuinely user-facing (protecting your own account, e.g.
revoking a device you don't recognize).

### OQ-27: Can an Admin remove/depose the Owner?
**Confirmed:** No. The Owner can only be removed from a household by their
own action (Leave, Delete Household, or Delete Account) — never by an
Admin. This keeps "who can end the Owner's membership" unambiguous and
consistent with the Owner-succession rule (FR-1.18) always being
Owner-triggered, never forced by another member. See FR-1.11.

### OQ-30: Auth/session mechanism — JWT + OAuth2?
**Confirmed:** JWT-based auth, OAuth2-shaped. **Implication for the
session/device model (FR-1.3, `SessionAccessor`):** a JWT access token is
short-lived and stateless (can't be revoked before expiry without a
blocklist), so what "active sessions/devices" (UC-16) and "revoke a
session" (UC-17) actually operate on is the **refresh token** per
device/login — that's the server-side-tracked, revocable record.
Revoking a session means invalidating its refresh token; the corresponding
access token simply expires shortly after (accepted latency, not treated
as a bug) rather than being revoked instantly. Regardless of this
mechanism, the frontend still always clears its own locally-held
token state on logout (UC-15) — that requirement doesn't change with the
underlying token scheme.

### OQ-28: Can ownership be voluntarily transferred (Owner stays in the household)?
**Confirmed:** Yes — FR-1.20. The Owner can hand off to another member
without leaving. The one hard constraint, restated because it governs the
implementation: **a household never has zero or two Owners at any instant**
— the target's promotion and the transferring user's demotion (default:
to Admin — flag if a different landing role is wanted) must be a single
atomic operation, not two separate writes a reader could observe
mid-transition. This is a genuine invariant for the Resource Accessor
layer, same category as FR-1.18's succession check (see the CUC-1 note in
`01-core-use-cases.md`).

### OQ-29: What fields does registration collect beyond email + password?
**Confirmed, resolved during data modeling:** **first_name, last_name**,
in addition to email + password. FR-1.1 has been updated to reflect this;
the `users` table (`docs/architecture/02-data-model.md`) carries both as
required columns.

### OQ-50: Does a repeat purchase of a fixed-term instrument type accumulate into an existing Holding, or always create a new one?
**Confirmed, resolved during data modeling:** Always creates a new
Holding — never accumulates. Each purchase of a CDB/LCI/LCA/Tesouro
Direto/CD/Treasury bond is its own immutable contract (its own rate,
purchase date, maturity date), unlike stocks/FIIs/funds, which
legitimately average together into one position. FR-5.1's "buying more
of an existing one increases quantity" rule simply doesn't apply to
FR-11.1's instrument list — the ticker/identifier match-and-accumulate
check never fires for these asset types; every buy transaction against
one inserts a brand-new Holding row. This also fixes a latent
correctness problem, not just a modeling preference: FR-11.2 computes
one schedule per *purchase* (from that purchase's own date/terms) —
accumulating multiple purchases with different terms into one Holding
would leave `investment_schedule_entries` with no way to know which
entries belong to which "chunk" of an aggregated quantity. See FR-5.1,
FR-11.1/11.2.

### OQ-51: Do fixed-term instrument Holdings use Valuation Snapshots the same way market-priced Holdings do?
**Confirmed, resolved during data modeling: No.** A fixed-term
instrument's value is fully determined by its principal (cost basis) —
nothing about it changes between the contractual cash events already
captured in `investment_schedule_entries`, so there's nothing to
snapshot. Net worth (FR-5.3/5.4) and Goal progress (FR-8.5/8.7)
read cost basis directly for these Holdings instead of the latest
Valuation Snapshot. Snapshots remain necessary for stock/FII/fund
Holdings specifically because v1 has no live market-data feed
(`MarketAnalysisProviderAccessor` is parked, FR-5.7) — unlike fixed
income, there's no formula to reconstruct a past price from, so if
nobody recorded what it was believed to be worth at the time, that
historical data point is simply gone. See FR-5.2/5.4.

### OQ-52: Is FR-4.4's configurable budget-alert threshold implemented in v1?
**Confirmed, resolved during data modeling: No, removed.** Per-transaction
budget-crossing alerts were judged too noisy in practice. FR-4.4 is
struck through and marked removed; FR-6.5's notification-trigger list no
longer names it. `BudgetAccessor.accrueIfClaimed` no longer reports a
threshold-crossed signal, and `TransactionManager`'s pipeline no longer
fires `NotificationDeliveryUtility.deliver` on it (see the VBD
decomposition doc, §3.1). The notification inbox mechanism itself
(FR-6.10) is unaffected — it's standing infrastructure independent of
which specific triggers are currently active, and Open Banking sync
failure remains a valid (if currently dormant) trigger. See FR-4.4,
FR-6.5.

### OQ-53: Should the onboarding backfill path for pre-existing Holdings be retired now that the transaction-driven path carries the full shape?
**Confirmed, resolved during the mockup-vs-API coverage audit: Yes,
removed.** `POST /accounts/{accountId}/holdings` and its
`HoldingCreateRequest`/`InvestmentScheduleEntryInput` schemas duplicated a
shape `TransactionCreateRequest` now carries directly (`assetType`,
`ticker`, `quantity`, plus `rate` for fixed-term instruments — see
OQ-50). Backfilling a pre-existing investment is now just an
investment-buy Account Transaction dated in the past, same as any other
buy — `InvestmentProductEngine` computes its schedule the same way
regardless of whether the purchase date is today or years ago. FR-5.1 is
trimmed to drop the separate backfill clause; FR-11.5 is struck through
and marked removed; OQ-44 is superseded by this entry.
`AccountManager`'s "Investment Holdings administration" responsibility in
the VBD decomposition narrows to manual edits only (valuation updates,
Goal allocations via `PATCH /holdings/{holdingId}`) — it no longer
owns any creation path. See FR-5.1, FR-11.5, OQ-44, OQ-50.

### OQ-54: Should Goal allocation at Holding-creation time be a separate call, or bundled into the investment-buy transaction?
**Confirmed, resolved during the mockup-vs-API coverage audit follow-up:
Bundled — one call.** `TransactionCreateRequest` gains an optional
`allocations` field; `TransactionManager` calls `GoalAccessor.allocate` (*now `replaceAllocations`, with the buy's split re-weighted — OQ-168*)
directly within the same investment-buy pipeline that creates/updates the
Holding (§3.1), rejecting with 409 the same way `PATCH /holdings/{holdingId}`
already does if the total would exceed 100% (FR-8.3). This doesn't
reverse OQ-48's direction-of-control decision — allocation is still
written from the Holding side, never the Goal — it just adds a
second *moment* (creation, not only a later edit) at which that write can
happen. `PATCH /holdings/{holdingId}` is unchanged and still the only way
to adjust allocations after creation. See FR-8.2, FR-8.3, OQ-48.

### OQ-55: Do we implement recurring/scheduled transactions?
**Confirmed, during the October 2026 design round: No.** FR-3.5 is removed.
Every transaction is recorded individually — manually, or by a system
trigger (Open Banking sync, FR-11.3's scheduled cash events, which are not
user-defined recurrence). Supersedes OQ-9's "generation stays in v1" and
OQ-38. Any recurring-generation trigger in the architecture docs goes.

### OQ-56: Can Valuation Snapshots be corrected after they're entered?
**Confirmed, during the design round: Yes — edit and delete.** FR-5.2 used
to say a valuation update "records a new snapshot, never an overwrite";
in a personal finance app, a typo'd value that can never be fixed is
worse than an editable history. Manually entered snapshots can be edited
(date, value) or deleted from a Holding's "Value history"; the
automatic snapshot a buy/sell/redemption records changes only through
its transaction. Net worth and Goal progress for affected months are
recomputed — no stored aggregate needs patching, since both are derived
from "latest snapshot at or before month end" (FR-5.4/FR-8.7). Needs new
API operations (edit/delete a snapshot).

### OQ-57: How are Categories identified visually?
**Confirmed, during the design round:** each Category gets an **icon** and
a **colour** (from a fixed palette), stored on the Category, preset for the
seeded defaults and chosen by the user for custom ones (FR-10.1). Chosen
over auto-assigning colours from a palette because users recognise their
own colour choices across the ledger, budgets, and category lists.

### OQ-58: Who computes a fixed-term Holding's expected payout and taxes?
**Confirmed: the investment engine (`InvestmentProductEngine`).** The rate
comes from the investment-buy transaction (FR-5.1); **tax rules are
code-configured inside the engine, per country/instrument** — not
user-editable data. The engine exposes expected payout (gross) and
expected taxes per fixed-term Holding (FR-11.2). For index-linked rates it
needs the index's current value — see OQ-59.

### OQ-59: Where do index values (Selic, CDI, IPCA, IGP-M) come from?
**Confirmed: entered manually by the user in v1**, on a new Investments →
Rates screen, as a dated, editable history per index (FR-11.6). The engine
uses the latest value. An automated feed may come later; the engine reads
"latest value of index X" so the source can change without touching it.

### OQ-60: How does a user switch between households (FR-1.8)?
**Confirmed:** from the main navigation menu (the hamburger drawer), where
a household switcher sits under the user's identity together with their
pending invitations. No design had a switcher before the October 2026
round.

### OQ-61: Is the transaction list scoped to the selected month?
**Confirmed: No.** The Transactions page's month selector drives the
balances, budgets, and goals overview, but the transaction list shows
**all** transactions, newest first, loaded incrementally. Filters can use
any date range (not limited to the selected month) and can filter by
investment Holding, which is how a Holding links to its transactions
(FR-3.12).

### OQ-62: Smaller UI-driven requirements confirmed in the design round
**Confirmed:**
- "Sign out all other sessions" in one action (FR-1.3).
- Invitations show who sent them (FR-1.10).
- Theme preference **dark / light / system**, plus language (FR-1.21).
- Net worth shows the change vs the previous month, per currency (FR-5.3).
- Lists of Budgets show over-budget ones first (FR-4.3).
- **Dropped:** a "Remember me on this device" option on sign-in; an "SMS
  and passkeys — coming later" placeholder on MFA setup. The reset-link
  expiry is shown to users only once the backend's real value is set.

### OQ-63: Can the guided first setup be skipped?
**Confirmed: the first account is mandatory**; reviewing Categories and
creating a first Budget stay optional (FR-1.22). The household needs at
least one account before the app is useful.

### OQ-64: What is the minimum password length?
**Confirmed: 12 characters** (NFR-SEC-4). The old mockups disagreed (8 on
registration and reset, 12 on Profile) and no requirement stated it.

### OQ-65: Which UI stack?
**Confirmed: Tailwind CSS + the project's own reusable components**, with
headless accessible primitives for complex widgets, replacing MUI
(NFR-UX-1). Colours are design tokens so dark and light themes are a token
swap (NFR-UX-2). The approved design lives in `docs/design/mockups/`.

### OQ-66: "Objective" or "Goal"?
**Confirmed: "Goal".** Renamed everywhere (UI and docs) because it reads
more naturally in English. Same concept, same rules (FR-8); only the name
changed.

### OQ-67: Is Dashboard customization (widgets) in v1?
**Confirmed, requirements review (Oct 2026): No — deferred to v3.** The
Dashboard is still meant to be user-customizable (the stakeholder
re-confirmed this during the CUC check); v1 ships the fixed Dashboard as
designed (FR-6.0), and customization is planned for v3 (not v2). FR-6.1 and FR-6.7–6.9 stay
valid requirements, tagged deferred.

### OQ-68: Are notifications in v1, given Open Banking is deferred?
**Confirmed: Yes.** Household invitations are a v1 trigger, and more are
expected, so the inbox (FR-6.10) and mechanism (FR-6.5) stay in v1. v1
triggers: invitation received; fixed-term Holding past due with a
position (OQ-72). The app header gets the notification bell.

### OQ-69: Open Banking in v1?
**Confirmed: deferred to v2** (FR-2.5, FR-2.6, FR-3.3 tagged). The
"Import Transactions" action stays visible but disabled.

### OQ-70: Portfolio Builders in v1?
**Confirmed: deferred to v2** (FR-5.5, FR-5.6). The entry buttons on
Investments stay, disabled.

### OQ-71: Reporting in v1?
**Confirmed: deferred to v2** — spending by category, income vs expense,
and transaction CSV export (FR-6.2–6.4). Monthly in/out/total (FR-6.11)
and account balance by month (FR-6.6) are on the Transactions page and
stay in v1.

### OQ-72: How do Holdings get archived?
**Confirmed:** automatically when an investment transaction brings the
quantity to zero (full sell or redemption). A fixed-term Holding past its
due date that still has a position triggers a notification suggesting
the user archive it (FR-5.8, FR-6.5).

### OQ-73: Where do payout figures come from?
**Confirmed: transactions only.** Each payout is a dividend/interest
transaction linked to its Holding, crediting its account. The UI shows
current-month payout per Holding and a payout-over-time chart with a
Holding selector on the Investments overview and the Dashboard (FR-5.9).
No stored yield figure.

### OQ-74: Should the monthly in/out/total summary be a requirement?
**Confirmed: Yes** (FR-6.11), excluding transfers between own accounts
and credit card bill payments.

### OQ-75: Where does a user create an additional household?
**Confirmed:** from the household switcher in the main menu (FR-1.4).

### OQ-76: Which account types exist, and where can investments live?
**Confirmed: four types — checking, savings, credit card only,
investment.** "Cash" and "other" are dropped. Investments can live in
**any account except credit card only** — in Brazil, investments commonly
sit inside a regular bank account, with no separate investment account.
Supersedes OQ-14's "investment-type account only".

### OQ-77: How does the audit log export work in the UI?
**Confirmed:** a small dialog asks for the date range and starts the CSV
download; only Owners/Admins see the option (FR-7.2).

### OQ-78: Goals — "archive/unarchive" or "complete/reopen"?
**Confirmed: complete / reopen** (FR-8.8, FR-8.9), matching the UI. Same
behavior as the former archive/unarchive (OQ-47); only the name changed.

### OQ-79: Which investment types exist, and which does the engine compute?
**Confirmed, requirements review (Oct 2026):**
- **Market-priced** (no engine schedule, manual market value): stock,
  FII, fund, mutual fund, currency, crypto, real estate, other (FR-5.1).
- **Fixed-term** (engine schedule + tax): Brazil — CDB, LC, LF, LCI, LCA,
  CRA, CRI, Debenture (+ "incentivised" flag), Tesouro Direto; US — CD,
  Treasury (FR-11.1). "Treasury" resolves by account currency.
- Brazil tax rules coded in the engine: regressive income tax for CDB,
  LC, LF, Tesouro Direto and non-incentivised debentures; exempt for LCI,
  LCA, CRA, CRI and incentivised debentures (individuals).
- **US expected taxes: "not estimated"** in v1 (personal bracket unknown).

### OQ-80: Is an auto-archived Holding restored if its zeroing transaction changes?
**Confirmed, use case review (Oct 2026): Yes.** When the sell/redemption
that brought a Holding to zero is edited or deleted and the quantity is
no longer zero, the system un-archives it. A user-made archive (from the
matured-holding notification) remains one-way (FR-5.8).

### OQ-81: Does an additional household get the guided setup too?
**Confirmed: Yes.** Every new household — first or additional — runs the
guided setup, with the first account mandatory (FR-1.22).

### OQ-82: How are notifications stored and localized?
**Confirmed, Manager review follow-up (Oct 2026):**
- A notification is stored as **type + parameters**, never as text
  (e.g. `invitation.received {householdId, inviterUserId, role}`). Types
  and their parameter schemas are one shared contract (OpenAPI
  discriminated union → generated frontend types).
- The **frontend renders and localizes** it from a per-locale message
  catalog (ICU MessageFormat) keyed by type, in the user's language
  (FR-1.21). Parameters travel raw (money in minor units + currency, ISO
  dates, enum codes) and are formatted with `Intl` (NFR-I18N-2).
- People and things are referenced by **ID and resolved at display
  time** — a deleted inviter shows as "Someone", so erasure (FR-1.17)
  leaves no stored name behind. Historical labels (e.g. a matured
  holding's name) may be snapshotted in the parameters.
- Guardrails: a test fails if any type lacks a catalog entry in every
  supported locale; unknown types fall back to a generic message and are
  logged; a new type ships in the catalog before the backend emits it.
- The catalog lives in a **shared package** (`packages/i18n`) from day
  one, so a future email/push channel can render server-side from the
  same source.
- *(Superseded by OQ-113: it is now `NotificationEngine` + `EmailAccessor`.)*
  `NotificationDeliveryUtility` stays a Utility (routes type + params to
  channels; in-app only in v1). It becomes a **`NotificationEngine`** if
  any of these appear: per-user channel preferences, digests/batching,
  quiet hours/throttling, or per-user server-side text composition.
  **Channels live inside the Utility** (corrected by OQ-84): sending
  through a channel is static mechanics; only the provider changes, and
  that's configuration of the Utility, not a separate Resource Accessor.

### OQ-83: Are API error messages localized the same way?
**Confirmed: Yes — errors are codes + parameters, localized by the
frontend.** The existing envelope (`03-api-design.md`) is refined, not
replaced: `code` becomes specific and namespaced (e.g.
`goal.allocation_exceeds_100`), gains `params`; field details become
`{field, code, params}`; `message` stays as an **English developer
message for logs/debugging only — never shown to users**; the response
carries the correlation ID (NFR-OBS-1). Error codes live in the same
shared catalog and the same completeness test covers them. Applied in
the API review.

### OQ-84: How is the password-reset email sent?
*(Corrected by OQ-113: email still carries `password.reset` + params + language
and is rendered from the catalog, but by `NotificationEngine`, and sent through
`EmailAccessor` — the provider is that Accessor's configuration. The "Winston
transports" analogy below only held while this was a Utility.)*
**Confirmed, sequence review (Oct 2026): through `NotificationDeliveryUtility`'s
email channel — no separate accessor.** Sending an email is static; what
changes is the provider it goes through, which is the Utility's
configuration (same idea as `LoggingUtility`'s Winston transports). v1 uses
the email channel **only for transactional auth email** (password reset,
FR-1.13 — the user isn't logged in, so in-app can't work); notifications
stay in-app only (OQ-68). The email is requested as type `password.reset`
+ params + the user's language; the Utility fills the template from the
shared `packages/i18n` catalog. Corrects OQ-82's "channels arrive as
Resource Accessors".

### OQ-85: How is a Category's colour stored, and how many are there?
**Confirmed, data model review (Oct 2026): a palette token, 18 colours.**
`categories.color` stores a token name (`mint`, `sky`, …), not a hex: the
same token resolves to a dark-theme and a light-theme value, both checked
at ≥ 4.5:1 contrast on card backgrounds; palette changes need no data
migration; tints derive automatically. The stakeholder rejected the
6-colour set as too small for a growing category list; the palette is 18
colours (listed in `docs/design/mockups/README.md`) and can grow without touching
stored data. A category is told apart by colour + icon + name together.
Free custom colours (a hex picker) are out of scope; if ever wanted, an
optional `custom_hex` column would be added then.

### OQ-86: How are rates stored?
**Confirmed: `bigint` fixed-point, percent × 10,000** (10.50% →
`105000`, 4 decimal places) — the same "no numeric/float anywhere" rule
as money (minor units) and quantity (1e-8 units). Applies to
`index_rate_values.value` and `investment_holdings.rate_value` (which was
`numeric`, against the doc's own rule). Avoids float/precision issues end
to end.

### OQ-87: How is a goal allocation percentage represented?
**Confirmed, API review (Oct 2026): whole-percent integer, 1–100.**
Integers so the ≤ 100% check (FR-8.3) is exact and front/back rounding
agree (contribution = value × pct / 100, half-up to the cent). Basis
points were considered and rejected — splits are things like 60/40 or
50/25/25, and even basis points can't make exact thirds. Rates stay
× 10,000 (OQ-86) since they genuinely need decimals.

### OQ-88: Where does v1 run, and how is email sent?
**Confirmed, project design (Oct 2026): v1 runs purely locally** — no
staging or production hosting, no deployment pipeline. **Email has no
provider yet:** the email channel (`EmailAccessor` since OQ-113) uses a
**console provider** that prints the rendered message (type, recipient,
language, body) to the log. Because the provider is configuration
(OQ-84), hooking up a real one later changes no call site. The
`investmentsDaily` trigger runs in-process (a local scheduler).

### OQ-89: Is a regulatory compliance review in scope?
**Confirmed, project design (Oct 2026): no.** v1 is for the
stakeholder's personal / family use, so there is no LGPD or US-side
compliance review and the OQ-4 legal-review follow-up is closed for v1.
The privacy-by-design choices already made (right to erasure FR-1.17,
PII-free audit log, last-4-only cards) stay as good practice. Revisit
before the app is ever offered to other people.

### OQ-90: Monorepo and lint tooling (task N2)
**Confirmed, implementation (Oct 2026):**
- **pnpm workspaces** (`apps/api`, `apps/web`, `packages/i18n`,
  `packages/api-types`); each workspace declares every dependency it
  imports. Install scripts are blocked except those listed under
  `allowBuilds` in `pnpm-workspace.yaml`.
- **Airbnb via `eslint-config-airbnb-extended`** (NFR-MAINT-3): the
  original `eslint-config-airbnb` has no ESLint 9 flat config or
  TypeScript support. This config needs **ESLint 9**, and
  `typescript-eslint` needs **TypeScript < 6.1**, so both are held there
  until those packages catch up. Airbnb's `prefer-default-export` is
  followed; only `react-in-jsx-scope` is off (automatic JSX runtime).
- Project rules are enforced in `eslint.config.js`: `complexity` 7,
  `max-params` 7, no `class` (NFR-MAINT-1/2).
- **E2E browser:** Playwright's bundled Chromium by default; setting
  `PLAYWRIGHT_CHROMIUM_PATH` (e.g. `/usr/bin/chromium`) uses a local one
  when the browser download is unavailable.
- Composition roots (`apps/api/src/server.ts`, `apps/web/src/main.tsx`)
  hold no functions or logic; they are excluded from unit coverage and
  covered by the E2E smoke test.

### OQ-91: Local and hosted CI (task N3)
**Confirmed, implementation (Oct 2026):** the BDT cadence runs both
locally and on GitHub Actions, using the same root scripts in both places.
- **Local (husky):**
  - `pre-commit` runs `pnpm check`: lint, typecheck, unit + integration
    tests, and the **100% coverage gate** (Vitest thresholds on every
    `src/`, composition roots excluded).
  - ~~`pre-push` runs `pnpm test:smoke`~~ — **removed in N5 (OQ-95):**
    E2E needs Postgres running, and smoke is already a CI merge gate
    (branch protection). Run `pnpm test:smoke` locally on demand.
- **Hosted (`.github/workflows/ci.yml`):** every PR to `main` runs
  `check` then smoke, and both are merge gates. A push to `main` also
  runs Core E2E, post-merge and non-blocking, per the BDT cadence table.
- **E2E tiers are selected by tag:** `@smoke`, `@core`, and untagged
  tests are Full E2E (`pnpm test:e2e`). Full E2E and load testing are
  on demand. There is no load script until a load tool is chosen; k6 is
  still only a candidate.
- **Contract checks:** N7 and N8 add theirs to `pnpm check`, so they run
  in both places without touching the hooks or the workflow.
- **Tooling config files are exempt from the unit-test rule:** root config
  files (`eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`,
  each workspace's `vite`/`vitest` config) are configuration, not
  application code. They must still be documented and linted, but helpers
  inside them (e.g. `scopeTo` in `eslint.config.js`) are not unit-tested,
  and these files sit outside the coverage gate. Decided Oct 2026; any
  logic that grows beyond a one-line helper moves into tested code.

### OQ-92: Local environment (task N4)
**Confirmed, implementation (Oct 2026):**
- **PostgreSQL 18** (`postgres:18-alpine`) via Docker Compose
  (`compose.yaml`), bound to `127.0.0.1` only, with data in a named
  volume.
- **Two database roles:**
  - `financas` is the owner: it runs migrations and owns the schema.
  - `financas_app` is the role the API connects as. It cannot create
    objects; the migrations (N5) grant its table privileges, without
    `UPDATE`/`DELETE` on the audit log (NFR-AUD-1).
  - Both are created by `infra/db/init/`.
- **Two databases:** `financas` for development and `financas_test` for
  E2E runs.
- **Configuration:**
  - A single root `.env` (git-ignored; template `.env.example`), loaded
    by Node's native `--env-file-if-exists`. Real environment variables
    win.
  - The API reads only `PORT`, `DATABASE_URL` (app role) and
    `EMAIL_PROVIDER`. The owner credentials (`DATABASE_MIGRATION_URL`)
    exist only for the migration tooling.
- **Zod** validates the config (`apps/api/src/config/loadConfig.ts`): all
  errors at once, and a failure at startup. It is also the intended
  validation library for N7 (request validation) and U3.
- **Console email:** `EMAIL_PROVIDER=console` is the only value in v1
  (OQ-88). The provider itself is built in `EmailAccessor`
  (U7, OQ-112, OQ-113).

### OQ-93: API contract tooling (task N7)
**Confirmed, implementation (Oct 2026):**
- **Generation:** `@hey-api/openapi-ts` (pinned exactly, since it is
  pre-1.0) generates TypeScript types and **Zod schemas** from
  `openapi.yaml` into `packages/api-types/src/generated/`.
  - `@financas/api-types` exports the types.
  - `@financas/api-types/zod` exports the schemas, so type-only
    consumers don't bundle Zod.
  - The output is committed and never hand-edited.
- **The spec is the single source:** routes validate with
  `validate(target, zSchema)` (`apps/api/src/http/validation.ts`),
  using the generated schemas. Nobody hand-writes a request schema.
  - Query values arrive as text, so a `query` target is first converted
    using the schema's own field types (numbers, booleans, one-item
    arrays). Other strings are left alone.
- **Contract check (`pnpm check:contract`, part of `pnpm check`):**
  - lints the spec as OpenAPI 3.1 with Redocly's `minimal` ruleset
    (telemetry off);
  - regenerates the code, and fails if the committed output is stale.
- **Spec corrections made while adding the check:**
  - Every operation now has an `operationId` (74 added, 8 existed). The
    generated names come from these, e.g. `zCreateGoalBody`.
  - The 27 `nullable: true` properties became 3.1 type unions
    (`type: [X, "null"]`, and `null` added to the one enum). OpenAPI 3.1
    dropped `nullable`, so those fields were not actually nullable in
    the contract.
  - "an Goal" typos in five summaries were fixed.
  - Field meanings and routes are unchanged, so the version stays 1.1.0.
- **Error envelope:** everything leaves through one handler
  (`apps/api/src/http/errorHandler.ts`) as `components/schemas/Error`.
  Tests parse every error body with the generated `zError` schema.
  Generic codes:

  | Code | Status | When |
  |---|---|---|
  | `validation.failed` | 422 | request validation failed; `details[]` holds `{field, code, params}` |
  | `request.invalid` | Hono's own status | e.g. 400 for malformed JSON |
  | `route.not_found` | 404 | unknown route |
  | `internal.unexpected` | 500 | anything else; reveals nothing and is passed to `onUnexpectedError` |

  - The field-level codes (`field.required`, `field.invalid_type`,
    `field.invalid_option`, `field.invalid`, `object.unknown_keys`,
    `string.format`, `number.multiple_of`, and
    `number|string|array|date|value.min|max`) are now typed by the i18n
    catalog (OQ-94).
  - `correlationId` is set on every request by U1's middleware (OQ-99).
  - Until U2 provides logging, `onUnexpectedError` is console output
    from the composition root.

### OQ-94: i18n catalog (task N8)
**Confirmed, implementation (Oct 2026):**
- **Format:** the catalog is TypeScript modules in `packages/i18n`
  (`catalogs/pt-BR.ts`, `catalogs/en-US.ts`), with ICU MessageFormat
  strings.
  - **pt-BR (primary) defines the key set;** every other locale is typed
    as `Catalog`.
  - Sections: `errors`, `fields`, `notifications` and `emails`
    (`<type>.subject` / `<type>.body`). A `ui` section arrives with
    FU5 and the UI kit.
- **Completeness is enforced at three levels:**
  1. A missing or extra key in any locale fails typecheck.
  2. `notifications` must cover the generated `Notification['type']`
     union, so a type added to the spec fails typecheck until both
     catalogs have it.
  3. A unit test parses every message as ICU and checks that each key
     uses **the same argument names in every locale**.
- **Backend codes are typed by the catalog:** `ApiErrorInit.code` is
  `ErrorCode` and `FieldDetail.code` is `FieldCode`, so the API cannot
  emit a code that has no translation (OQ-82's "catalog before the
  backend emits it"). New codes are added to the catalog as each
  Manager is built. Today's catalog covers:
  - the 4 generic codes (OQ-93) and the 16 codes the spec names;
  - the 17 field codes;
  - both notification types;
  - the `password.reset` email.
- **Fallbacks (OQ-82):** `errors.fallback` and `notifications.fallback`
  are shown for codes and types the frontend doesn't know.
- **Message parameters:**
  - People and households arrive already resolved to names
    (`{inviterName}`).
  - Dates arrive already formatted by FormattingUtility (NFR-I18N-2).
  - Counts use ICU `plural` and enum values use ICU `select` (e.g.
    `role`).
- **Spec correction:** the three discriminated unions (`Notification`,
  `LedgerItem`, the report response) had no `mapping`. OpenAPI then
  defines the discriminator value as the schema name, which contradicts
  the real `type`/`ledger`/`reportType` values, and made the generated
  `Notification` type unusable. Each union now has an explicit
  `mapping`.
- **Texts are drafts** written during implementation; reviewing the
  wording is welcome at any time and is a catalog-only change.

### OQ-95: Schema + migrations baseline (task N5)
**Confirmed, implementation (Oct 2026):**
- **Drizzle + node-postgres:**
  - The schema is `apps/api/src/db/schema/`, one file per domain.
  - `drizzle-kit` generates SQL migrations into `apps/api/drizzle/`,
    and they are committed.
  - `pnpm db:generate` creates a migration; `pnpm db:migrate` applies
    them as the owner role (`DATABASE_MIGRATION_URL`).
- **Conventions:**
  - `uuid` keys default to `uuidv7()` (Postgres 18);
  - `timestamptz` everywhere;
  - money, quantity and rates are `bigint`, read as JS `number`;
  - closed value sets are `text` + `CHECK`, while extensible reference
    data stays `text`.
- **`ON DELETE` rules A/B/C** are as in `02-data-model.md`. A unit test
  pins all 43 foreign keys to their rule.
- **Grants (migration `0001_app_role_grants`):**
  - `financas_app` gets CRUD on every table, and default privileges
    cover future tables;
  - `UPDATE`/`DELETE`/`TRUNCATE` on `audit_log_entries` are revoked
    (NFR-AUD-1).
- **Data model corrections:**
  - `budget_periods` gains `household_id` and `currency`;
  - the FR-4.7 claim index is split by scope (shared = household,
    personal = owner);
  - a stale `archived_at` reference for Goals now says `completed_at`;
  - the ERD panel is updated.
- **Schema checks run on PGlite** (embedded Postgres 18, in-process,
  same approach as the `financas` app's integration tests):
  - `apps/api/tests/db/` applies the real migrations to an in-memory
    database and checks, as the app role:
    - the 26 tables and `uuidv7` ids;
    - one Owner per household;
    - the FR-4.7 scopes;
    - an append-only audit log;
    - that the app role cannot change the schema.
  - They run in `pnpm check`, so no Docker is needed to commit or push.
- **E2E keeps the real container:** Playwright's global setup resets
  and migrates `financas_test` before every run, and CI starts Postgres
  with `docker compose`.
- **Node ≥ 24.10** (for `process.loadEnvFile`).

### OQ-96: How are Resource Accessors tested?
**Confirmed (Oct 2026): against embedded Postgres (PGlite), not a mocked
driver.**
- **The approach:**
  - Accessors receive their Drizzle database as a parameter.
  - Tests inject PGlite with the real migrations applied, the same
    approach as the `financas` app's integration tests.
  - Each Accessor gets real behaviour tests: round-trips, database
    errors translated to domain errors, and the application-level
    invariants the data model places inside Accessors (archive cascades,
    backdated-balance walks, `seedDefaults` exactly once, the 100%
    allocation cap, cursor pagination).
- **Why not the strict "mock the driver" reading:**
  - Mocks of Drizzle's chained builder mirror the implementation and
    break on refactors.
  - They cannot catch SQL that is wrong but plausible, so those bugs
    would surface only in the deliberately partial E2E suite.
- **Still with real infrastructure:** concurrency, locking and
  connection pooling (E2E and load, against the container).
- **Unchanged:** Managers still mock the Accessors (BDT integration
  tier).
- **Test isolation, settled at task 13 (OQ-103):** one migrated
  database per test file, and a rolled-back transaction per test, run as
  the app role. An Accessor's own transactions become savepoints.
- Recorded in `04-bdt-test-plan.md`.

### OQ-97: Local operations — backups and log files (task N12)
**Confirmed, implementation (Oct 2026):**
- **Backups:**
  - `pnpm db:backup`, `db:restore` and `db:restore-drill` live in a
    `tools/ops` workspace (`@financas/ops`): pure, tested functions plus a
    thin entry point.
  - They run `pg_dump`/`pg_restore` **inside the container** in custom
    format, which includes grants.
  - **Stored outside the repository** in `~/.local/share/financas/backups`
    (`BACKUP_DIR`), owner-only (`700`/`600`).
  - **Manual only**, no schedule.
  - **The newest 30 are kept** (`BACKUP_KEEP`).
- **Restore safety:**
  - A restore goes to a scratch database (`financas_restore`) unless
    `--into-live` is given.
  - `--into-live` first takes a safety backup of the live data.
- **Drill:** back up, restore into scratch, compare row counts per
  table, drop the scratch copy. The first drill ran on 2026-10-08 and
  passed. The runbook is `docs/operations/backup-restore.md`.
- **Log files (decided now, built in U2):** besides stdout, LoggingUtility
  writes **JSON lines to a daily-rotated file** in
  `~/.local/state/financas/logs` (`LOG_DIR`), keeping 14 days. This is a
  second Winston transport, i.e. configuration (NFR-OBS-5, OQ-10). Logs
  then survive closing the terminal.

### OQ-98: Reference data, amount sign and the demo seed (task N6)
**Confirmed, implementation (Oct 2026):**
- **Reference data lives in `packages/reference`** (`@financas/reference`).
  These are the in-code lists the data model keeps out of the database,
  shared by the API (validation), the web app (pickers) and the seeds:
  - the 16 transaction kinds, each with picker group (Cash / Transfer /
    Credit card / Investment), target ledger, direction and
    `EFFECT_BY_KIND` effect;
  - asset types (8 market-priced, 11 fixed-term, the latter marked BR or
    US);
  - index codes with their unit;
  - schedule-entry kinds;
  - card networks (`visa`, `mastercard`, `amex`, `elo`, `hipercard`,
    `diners`, `discover`, `other` — the spec only named examples);
  - the 18 palette tokens;
  - category icons (Material Symbols names, as in the mockups; K3 grows
    the set);
  - the default categories from mockups 12/41, with icon, colour and
    pt-BR/en-US names.

  Pure validators cover the FR-3.1/OQ-76 kind–target rules. The 12
  closed value sets from N5 stay with the schema; a test keeps the
  effects in agreement.
- **Default categories are seeded in the household creator's language**
  (`defaultCategoriesFor(locale)`); after that they are ordinary,
  renameable data.
- **Amounts are always positive; the kind gives the direction.** This
  applies to `account_transactions`, `card_transactions` and
  `investment_schedule_entries`, enforced by `CHECK (amount > 0)` in
  migration `0002_positive_amounts`. The UI renders −R$85.40 from
  "8540 + an outgoing kind"; a stored sign could disagree with its kind.
- **Demo seed:** `pnpm db:seed:demo` runs as the app role and is
  idempotent (fixed ids). It creates:
  - Ana (Owner, pt-BR) and Ben (Member, en-US);
  - the "Casa Demo" household with the default categories;
  - four accounts (BRL and USD checking, investment, credit-card-only)
    with current-month opening balances;
  - a credit card;
  - index rates.

  The demo users get real credentials once U4 exists; until then they
  can't log in. Each later slice extends the seed through its own
  Accessors, rather than hand-writing rows whose consistency those
  Accessors own.

### OQ-99: How does the correlation ID travel? (task U1)
**Confirmed, implementation (Oct 2026):**
- **Passed explicitly as a parameter**, from the HTTP layer to Managers,
  Engines, Accessors, `logActivity` and service-bus messages, exactly as
  the sequence diagrams show (`logActivity(correlationId, actor, …)`). It
  is never read from ambient state such as AsyncLocalStorage: that would
  be a hidden dependency every test must set up, which BDT treats as a
  smell. `CorrelationId` is a branded type, so only the utility can create
  one.
- **CorrelationIdUtility** (`apps/api/src/utilities/correlationId.ts`)
  provides `newCorrelationId`, `isValidCorrelationId` and
  `resolveCorrelationId`. It's pure, with the UUID generator injectable,
  and unit-tested with nothing mocked (BDT).
- **HTTP:**
  - `correlationIdMiddleware` runs first on every request.
  - A client may send `X-Correlation-Id`. It is kept only if it is a
    well-formed UUID (lower-cased); anything else is replaced, so nothing
    odd reaches the logs.
  - The ID is echoed in the `X-Correlation-Id` response header, and the
    error envelope carries the same value.
- `apps/api/src/utilities/` is where the VBD Utilities live.

### OQ-100: Authentication primitives (task U4)
**Confirmed, implementation (Oct 2026):**
- **Passwords:** Argon2id (`@node-rs/argon2`) with OWASP parameters
  (19 MiB memory, 2 iterations, 1 lane). The parameters are stored in
  each hash, so they can be raised later.
- **MFA:**
  - TOTP per RFC 6238 (`otpauth`): SHA-1, 6 digits, 30-second steps,
    ±1 step of drift.
  - **The secret is encrypted at rest** with AES-256-GCM, keyed by
    `MFA_ENCRYPTION_KEY` (NFR-SEC-3). Rotating that key makes stored
    secrets unreadable.
  - **Recovery codes:** 10 per user, 16 Crockford base32 characters each
    (80 bits, e.g. `7KQM-2XWR-9PTD-4HNC`). They're stored as SHA-256
    hashes and looked up by hash, and typed variations are accepted
    (case, dashes, O→0, I/L→1).
- **Tokens:**
  - The access token is a JWT (HS256, `JWT_SECRET`) valid for **15
    minutes**.
  - The refresh token is an opaque 256-bit random value, valid for **30
    days** and **rotated on every use**: a reused one is rejected and
    ends its session.
  - Password-reset tokens are opaque in the same way.
  - Opaque tokens are stored only as SHA-256 hashes.
- **New endpoint `POST /auth/refresh`** (spec, error code
  `auth.refresh_invalid`), implemented with IdentityManager (task 22).
  Before it, the refresh token had no use.
- **The Utility is pure** (BDT) and touches no storage. Two sequence
  diagrams were corrected:
  - uc-14: the Utility issues the refresh token, and SessionAccessor
    stores its hash;
  - uc-20: the code is hashed by the Utility and consumed atomically by
    UserAccessor.
- **Secrets:**
  - `.env.example` (public repo) carries clearly marked dev-only
    placeholders, which CI uses.
  - `pnpm env:secrets` replaces them in the local `.env` with random
    values and never overwrites a real one.
- **Follow-ups for task 22 (IdentityManager):**
  - Write the refresh use case and its sequence diagram.
  - **The login `401` must not reveal which factor failed.** The spec
    says invalid email, password or MFA code are answered identically,
    but uc-14 returns a distinct `auth.mfa_invalid` once the password is
    right, which would confirm a correct password to an attacker.
    Reconcile there.

### OQ-101: How is configuration organised?
**Confirmed, stakeholder feedback during U4 (Oct 2026): two kinds, two
places, nothing tunable buried in a module.**
- **Environment variables** (`apps/api/src/config/env.ts`, `loadEnv`) hold
  what differs per environment or is secret: `PORT`, `DATABASE_URL`,
  `EMAIL_PROVIDER`, `JWT_SECRET`, `MFA_ENCRYPTION_KEY`. They're read from
  `.env` and validated at startup.
- **Constants** (`apps/api/src/config/constants.ts`) hold fixed
  application settings, the same in every environment and changed only in
  code. They're grouped by area (`authentication`, `http`, …) and
  documented: token lifetimes, issuer and audience, Argon2 and TOTP
  parameters, recovery-code count, the correlation-ID header, and so on.
- **Stays in the module:** facts intrinsic to an algorithm, not tunable
  policy, such as AES-GCM's 12-byte IV, the 32-byte AES-256 key, the
  Crockford alphabet and the UUID pattern.
- Test files may use plain literals.

### OQ-102: Service bus semantics (task U6)
**Confirmed, implementation (Oct 2026):**
- **Typed events:** `apps/api/src/utilities/serviceBus/events.ts` maps
  each topic to its payload. That map is the only coupling between
  Managers; publishing an unknown topic or the wrong payload doesn't
  compile. Topics today:
  - `household.created`;
  - `holding.matured`;
  - `transaction.import.requested`, whose payload is a draft finalised
    with the scheduler in N9.
- **Messages** carry the publishing request's **correlation ID**
  (OQ-99) and a publish time, and are **frozen**, so one subscriber
  can't change what the next one sees.
- **Delivery:**
  - **Fire-and-forget:** `publish` returns before any handler runs.
  - Handlers run in subscription order, against the subscribers present
    at publish time. The same handler registers only once.
  - A failing handler is reported to an injected `onHandlerError`
    (LoggingUtility, U2) and never reaches the publisher or the other
    subscribers.
  - `drain()` waits for everything in flight, including events published
    by handlers. Integration tests and graceful shutdown use it.
- **At-most-once, in memory:** a crash mid-delivery loses the message.
  This is accepted for v1 (VBD §3.0). The visible risk is a household
  left without its default categories if the process dies between
  creating it and seeding them. If that matters later, there are two
  remedies:
  - **A transactional outbox:** the event is written in the same
    database transaction as the business data, and a dispatcher delivers
    it afterwards. That makes delivery at-least-once, so handlers must be
    idempotent. It's not free: Managers must publish inside the write's
    transaction, or the Accessor writes the outbox row.
  - **A cheaper safety net:** a startup check that seeds the defaults for
    households that have none, which needs `seedDefaults` to be safe to
    re-run.

  Worth revisiting once money-moving events such as
  `transaction.import.requested` are live.
- **Not built:** request/reply. §3.0 allows it, but no use case needs it.

### OQ-103: Resource Accessor conventions (task A1, the first Accessor)
**Confirmed, implementation (Oct 2026), applied to every Accessor:**
- **Shape:**
  - `createXAccessor(db)` in `apps/api/src/accessors/`, a factory of
    plain functions (no classes).
  - `db` is any Drizzle database or transaction (`src/db/database.ts`),
    so a caller's transaction flows through.
  - It returns **domain objects, not rows**. Credentials come back only
    from the lookups that need them (e.g. `findByEmail` for login,
    `findPasswordHash`); `findById` has none.
- **Expected outcomes are typed results**, which the compiler makes the
  Manager handle:
  - e.g. `{ ok: false, reason: 'email_taken' }`, `'still_referenced'`, or
    `undefined` for "not found".
  - Postgres codes are read by `pgErrorCode` (`src/db/errors.ts`), which
    follows Drizzle's wrapped `cause` chain.
  - Only unexpected failures throw, and tests prove they aren't
    swallowed.
- **A statement that can fail in an expected way runs in its own
  `db.transaction`**, which becomes a savepoint inside a caller's
  transaction, so the failure can't poison it.
- **Single-use secrets are consumed atomically:** one `UPDATE … WHERE
  unused [AND unexpired] RETURNING`, so two simultaneous requests can't
  both use the same recovery code or reset link.
- **Tests (settles OQ-96's open point):**
  - one migrated PGlite per test file;
  - each test runs **as the application role, inside a transaction that
    is always rolled back** (`withRollback`).
- **Gap fixed in uc-18 (password reset):** nothing marked a reset token
  used, so a link worked until it expired. It now stores only the
  token's hash and consumes it atomically
  (`UserAccessor.consumeResetToken`). The new password's length is
  checked *before* consuming, so a too-short password doesn't burn the
  link (for task 22).
- Still pending from OQ-98: the demo users get real credentials with
  IdentityManager (task 22).

### OQ-104: Audit-log export, CSV and the app timezone (task A15)
**Confirmed, implementation (Oct 2026):**
- **AuditLogAccessor** has `insert` and `listForExport(householdId,
  startDate, endDate)` only. There is no update or delete, matching the
  missing database privileges. Entries come back oldest first, and the
  actor is null for system actions.
- **The CSV is ReportingEngine's job** (stakeholder correction: "audit
  logs are a form of reporting"; the VBD doc already lists "export
  formatting" under ReportingEngine). The flow:
  1. InsightsManager reads the entries via
     `AuditLogAccessor.listForExport`.
  2. It hands them to `ReportingEngine.auditLogCsv(entries)`
     (`src/engines/reporting/`).
  3. That writes the columns `timestamp, actor_id, action, entity_type,
     entity_id`, with `system` for a null actor.

  The engine's RFC 4180 writer (`csv.ts`, with quoting and CRLF) guards
  against **formula injection**: a text cell starting with `=`, `+`, `-`,
  `@`, tab or CR gets a leading `'`, so it opens as text in a spreadsheet
  (OWASP). The v2 transactions export (FR-6.4) will use the same writer.
  The rest of ReportingEngine is still task E2. The export diagram is
  regenerated.
- **App timezone:** `calendar.timeZone = 'America/Sao_Paulo'`
  (`config/constants.ts`). A date like 2026-10-08 means that day in São
  Paulo, both ends inclusive, for this export and every later date range
  or month boundary. Postgres converts with `AT TIME ZONE`, so
  daylight-saving rules are applied; PGlite agrees, including 2018's
  daylight-saving start. Stored instants stay UTC.
- **For U2 (LoggingUtility):** all 42 `recordAudit(actor, entityType,
  entityId)` calls in the sequence diagrams omit the **action** (required
  by FR-7.1) and the **household** (the export's filter).
  `AuditLogAccessor.insert` requires both, so `recordAudit` must pass
  them.

### OQ-105: Notification inbox — reading vs marking seen (task A16)
**Confirmed, implementation (Oct 2026):**
- **`GET /notifications` is read-only.** Previously it also marked
  everything it returned as seen, which caused three problems:
  - the bell's unseen badge had no source: reading the count cleared it;
  - it broke HTTP's safe-read rule, so a browser prefetch or retry would
    silently clear the badge;
  - "mark all seen" after listing also marked a notification that
    arrived in between, which the user never saw (FR-6.10 says "every
    notification **currently shown**").
- **New `POST /notifications/seen {notificationIds}`** (1–200 IDs) marks
  exactly the notifications shown. IDs that aren't the caller's, unknown
  or already seen are ignored silently, and the call is idempotent.
- **NotificationInboxAccessor:**
  - `insert(userId, type, params)`: params are typed per notification
    type, from the API contract;
  - `listByUser`: newest first, and lists types this build doesn't know,
    so the app shows its fallback;
  - `markSeen(userId, ids, now)`;
  - `deleteForUser(userId, id)`: ownership check and hard delete in one
    statement, false for someone else's or a missing notification
    (both → 404).
- **Docs corrected:**
  - uc-05 returned a `message` text field (pre-OQ-82);
  - the `GET /notifications` description still listed the removed and
    deferred triggers instead of v1's (OQ-68);
  - uc-05, uc-06 and the App Shell notification-routing EBD sequence are
    regenerated.

### OQ-106: Sessions — current device, rotation and reuse detection (task A2)
**Confirmed, implementation (Oct 2026):**
- **The access token carries its session (`sid` claim)**, alongside the
  user (`sub`).
  - Before this, nothing told the API which session was "current", yet
    logout, "sign out all others" (FR-1.3) and change password all need
    it.
  - `AuthenticationUtility.signAccessToken({userId, sessionId})`;
    `verifyAccessToken` returns both and rejects a token missing either.
  - Login and MFA recovery now open the session **before** signing the
    token.
  - The spec's `Session` gains **`current`** (computed by the Manager),
    so the list can show "this device". `deviceInfo` may be null.
- **Refresh rotation with reuse detection** (promised in OQ-100).
  `sessions` gains `previous_refresh_token_hash` and a sliding
  `expires_at` in migration `0003`, which ends existing sessions so
  `expires_at` can be required.
  - *Revised by OQ-108:* `SessionAccessor.rotate` is now a guarded write
    that returns `rotated` or `stale`.
  - `findByReplacedToken` reports a replayed token as a fact.
  - IdentityManager decides to end that session.
- **Ending sessions:**
  - `deleteForUser(userId, sessionId)` serves logout and revoking a
    device, with ownership check and delete in one statement (both cases
    → 404);
  - `deleteAllForUser`;
  - `deleteAllExceptCurrent`.
- `listByUser(userId, now)` lists active sessions only, most recently
  used first.
- uc-14, uc-15, uc-16, uc-17 and uc-20 are regenerated.

### OQ-107: Managers decide, Accessors apply — guarded writes (task A3)
**Confirmed, stakeholder review of A3 (Oct 2026); applies to every Accessor:**
- **Business logic belongs to the Manager; the Accessor only applies
  data changes.** For households, the Manager decides:
  - who may remove whom (the Owner leaves only by their own action,
    FR-1.11/OQ-27);
  - that the Owner's role never changes through "change role" (FR-1.12);
  - who may transfer and to whom (FR-1.20);
  - **succession**: IdentityManager asks `findSuccessor` and, if nobody
    remains, calls `delete` to dissolve the household (FR-1.18).

  An earlier version of HouseholdAccessor decided these inside its own
  transactions; it was restructured before merging.
- **Guarded writes keep it safe without moving decisions back.** A
  write that depends on facts the Manager read re-states them in its own
  `WHERE` clause, and returns **`'stale'`** when they no longer hold, so
  nothing is applied over a concurrent change. The Manager then retries
  (re-read and decide again) or answers **409 `household.changed`**.
  - It checks facts, never policy: "`from` is still the Owner", "`to`
    is still a member", "this member is not the Owner".
  - Guards that protect an invariant (never zero or two Owners) stay
    even though the Manager also checks.
  - `swapOwner` demotes and promotes in one transaction, rolling back if
    either guard fails.
- **Why not a Manager-owned transaction:** with guarded writes, Managers
  never touch the database or transactions. In their BDT integration
  tests, "a concurrent change happened" is just a `'stale'` returned by
  the mocked Accessor.
- **HouseholdAccessor operations:** `insert` (household + Owner),
  `findMembership`, `listForUser`, `listMembers` (a read-only join on
  users for names), `findSuccessor` (longest-tenured Admin → Member →
  Viewer), `addMember` (`already_member`), the guarded writes
  `updateRole` / `removeMember` (never the Owner) / `swapOwner`, and
  `delete`.
- **Contract:**
  - new error codes `household.changed` (409) and
    `household.member_not_found` (404), in both catalogs;
  - remove member and change role now list 404 and 409, and transfer
    ownership lists 409;
  - uc-07, uc-08, uc-09, uc-10 and uc-12 are regenerated with the
    decisions in IdentityManager (a leave retries `stale` up to 3 times).

### OQ-108: Review of the earlier Accessors against OQ-107
**Confirmed, Oct 2026:** after OQ-107 ("Managers decide, Accessors
apply"), the four Accessors built before it were reviewed.
- **SessionAccessor.`rotate` contained a policy:** on a replayed
  (already-replaced) refresh token, it *decided* to end the session.
  Treating a replay as theft is a security decision, so it now belongs
  to IdentityManager.
  - `rotate` is a **guarded write**: it applies only while the presented
    token is the session's current, unexpired one, and returns
    `rotated` or `stale`.
  - New **`findByReplacedToken(hash)`** reports the session whose last
    rotation replaced that token.
  - **IdentityManager (task 22), on `stale`:** call
    `findByReplacedToken`; if a session is found, it's a replay, so call
    `deleteForUser` and answer 401 `auth.refresh_invalid`; otherwise
    answer 401 `auth.refresh_invalid`.
- **UserAccessor trimmed emails:** `insert` and `findByEmail` cleaned up
  input. Normalising input is the Manager's job (ValidationUtility); the
  Accessor now stores and matches what it is given. The case-insensitive
  match stays, because it mirrors the unique index on `lower(email)`, a
  fact about the data.
- **Confirmed as conforming:**
  - single-use consumption (recovery codes, reset tokens) guarded on
    "unused" and "not past its stored expiry";
  - outcomes reported by constraints (`email_taken`,
    `still_referenced`, `already_member`);
  - user-scoped guards (`deleteForUser`, `markSeen`);
  - the active-only session list;
  - AuditLogAccessor, which is pure data.
- **Docs repaired:** the OQ-107 rewrite in #17 had accidentally removed
  this file's "Refined (resolved, with a follow-up still open)" section
  heading and its note. Both are restored.

### OQ-109: Invitations — Manager decides, Accessor applies (task A4)
**Confirmed, implementation (Oct 2026):** InvitationAccessor follows
OQ-107 from the start. Three decisions the diagrams put in the Accessor
move to IdentityManager (task 22):
- **FR-1.19 (invitee must be a registered user):** the Manager resolves
  the email with `UserAccessor.findByEmail` and answers 404
  `invitation.invitee_not_registered` if there's none. The Accessor
  inserts by `invitedUserId`. The NOT NULL foreign key stays as the
  structural guarantee, reported as `invitee_missing` if the user was
  deleted in between.
- **Who may accept or decline:** the Manager reads the invitation and
  checks the actor is the invitee (403).
- **Revoke must match the household in the URL.** The diagram revoked by
  invitation ID alone, so an Admin of one household could revoke another
  household's invitation through their own household's route. The
  Manager now answers 404 **`invitation.not_found`**, a new code in both
  catalogs, documented in the spec.
- **The Accessor:**
  - `insert`, `findById`, `findPending`;
  - `listPendingForUser`: household and inviter names via read-only
    joins; a deleted inviter gives null names, so the app shows
    "Someone";
  - `listForHousehold`;
  - the guarded **`resolve(id, accepted | declined | revoked, now)`**,
    which applies only while pending, so two resolutions can't both win.
    `stale` → 409 `invitation.not_pending`.
- **Accept** resolves the invitation, then calls
  `HouseholdAccessor.addMember`, where `already_member` counts as done.
- **Inviting someone who is already a member, or already has a pending
  invitation, is rejected** (stakeholder decision, Oct 2026). Both answer
  409:
  - `invitation.already_member`: "User is already a member" / "Usuário
    já é membro desta casa";
  - `invitation.already_pending`: "User has a pending invitation" /
    "Usuário já tem um convite pendente".

  IdentityManager checks with `HouseholdAccessor.findMembership` and
  `InvitationAccessor.findPending` before inserting.
- uc-03, uc-04, uc-05 and uc-06 are regenerated.

### OQ-110: Logging — one event, several destinations, reliable audit (task U2)
**Confirmed, designed with the stakeholder (Oct 2026; simplified in review
to the financas app's style):**
- **One logger, imported everywhere.** `@financas/logging` exports a
  Winston `logger` that configures itself from the environment when first
  imported, so no entry point configures anything. A module creates its own
  logger with `createLogger({ label, correlationId?, actor? })`, which only
  adds that context (a Winston child), and calls `info`, `warn`, `error`,
  `debug` or `audit` on it. There is no wrapper with its own methods: the
  VBD role **LoggingUtility** is this logger plus the API's audit sink and
  reconciliation (`apps/api/src/utilities/logging`).
- **One event, several transports.** The same event goes everywhere:
  - **the console:** human-readable, in local wall-clock time, e.g.
    `14:03:12 AUDIT [7f3a9c21] user:… BudgetManager: CreateBudget  Budget … (household …)`;
  - **a daily JSON-lines file:** 14 days, under
    `~/.local/state/financas/logs` (`LOG_DIR`), named
    `<LOG_FILE_PREFIX>-YYYY-MM-DD.log`;
  - **for audit events, the audit sink:** the existing `audit_log_entries`
    table, through AuditLogAccessor. The API adds it at startup
    (`logger.add(createAuditSink(...))`); other processes don't store
    audit entries.
- **Levels:** `error`, `warn`, `audit`, `info`, `debug`. `audit` sits above
  `info`, so a quieter console still shows it. Each audit event is stamped
  with its own `auditId` and `auditAt` (the time of the action) as it is
  logged, so it's in the daily file immediately.
- **No `console` anywhere.** Every process logs through the shared
  logger: the API, the demo seed, audit reconciliation and the ops CLI.
  Under Vitest the logger is silent; tests read events with `captureLogs()`.
  The browser logs through `@financas/logging/browser` (OQ-123).
- **Logging is fire-and-forget:** Managers never wait. The correlation ID
  and actor (`user:<id>`, `system`, `unauthenticated`, NFR-OBS-2) are on
  every event. Every event is redacted before any transport sees it
  (passwords, tokens, secrets, auth headers, cookies, MFA/recovery codes).
  Every request is logged (NFR-OBS-1), and unexpected 500s are logged as
  errors with their stack (NFR-OBS-3).
- **Audit reliability is the logging system's job:**
  - The sink stores the locked FR-7.1 fields in the background, retrying
    at 1 s, 5 s and 30 s. If it gives up, it logs an error.
  - **Reconciliation** (`reconcileAudit`) restores any audit line from
    the API's daily files that is missing in the database. It runs at
    **every API start**, and with `pnpm audit:reconcile`. It's idempotent:
    the insert skips known IDs, and restored entries keep their original
    time. The recovery window is the 14-day retention.
  - **The sink has its own level, so audit storage never depends on
    `LOG_LEVEL`.** A test caught that a quieter level would otherwise
    have silently dropped audit entries.
- **Closes OQ-104's open point:** an audit call is
  `log.audit(action, { entityType, entityId, householdId })` on a logger
  whose context carries the actor and correlation ID. The sequence diagrams
  still abbreviate it as `recordAudit(actor, type, id)`.
- **AuditLogAccessor** `insert` and `insertMany` take the caller's ID and
  time, and skip an ID already stored.
- **Configuration (refines OQ-101):** the logging package owns its
  environment variables — `LOG_LEVEL`, `LOG_DIR` and `LOG_FILE_PREFIX`
  (each package script sets its prefix: `api`, `seed`, `audit-reconcile`,
  `ops`) — because it configures itself before any app's `env.ts` runs.
  The API's retry delays and its file prefix (for reconciliation) are in
  its `constants.ts`; retention and date pattern in `@financas/logging`.

### OQ-111: Authorization — system roles, household roles, and where each rule lives (task U5)
**Confirmed with the stakeholder (Oct 2026):**
- **Two levels of roles.** A **system role** (`USER` | `ADMIN`, FR-1.23)
  is platform-wide; a **household role** (Owner, Admin, Member, Viewer)
  holds within one household. Capitals keep the system `ADMIN` from being
  confused with a household `Admin`.
  - Registering through the website always makes a `USER`
    (`users.system_role`, default `USER`). How an `ADMIN` is created is
    decided when the sys-admin pages are designed.
  - `ADMIN` includes `USER`: an admin also uses the app normally.
  - **Every user API requires `USER`**; sys-admin APIs will require
    `ADMIN`. The role travels in the 15-minute access token (`role`
    claim), so no request reads it from the database; a role change takes
    effect at the next refresh, or at once if it also ends the user's
    sessions.
- **A Viewer manages their own personal data.** FR-1.7's "read-only"
  covers shared data only; personal data is invisible to everyone else.
- **A Member edits and deletes anything shared they created** — accounts,
  budgets, goals, transactions — even an account holding others'
  transactions, so a mistake never needs an Owner/Admin to fix.
- **An Admin may manage other Admins.** Only the Owner is protected.
- **Policy vs. business rules.** AuthorizationUtility holds the
  *policy* — which role may take which kind of action — because all four
  Managers apply the same table and a new role must change it in one
  place. Rules about the household's state stay in **IdentityManager**:
  nobody but the Owner ends the Owner's membership (FR-1.11), succession
  (FR-1.18), transfer (FR-1.20), duplicate invitations, and leaving being
  self-service.

**Design (U5):**
- `hasSystemRole(systemRole, required)`: pure; the request middleware
  (built with the first user routes) calls it on every authenticated
  request.
- `decide(role, actorId, request)`: pure, over the in-code `PERMISSIONS`
  table (VBD §2.3). `household.view` (everyone); `household.delete`,
  `household.transferOwnership` (Owner); `members.manage`, `audit.export`
  (Owner, Admin); `data.view` (everyone); `data.create` (Owner, Admin,
  Member); `data.edit`, `data.delete` (Owner, Admin, and a Member on
  shared data they created — `owner_user_id` records the creator of
  shared data). Personal data: its owner, whatever the role.
- `authorize(actorId, householdId, request)` reads only the actor's
  household role (`HouseholdAccessor.findMembership`). **The Manager
  passes the target's facts it has already loaded** (visibility, owner),
  so the Utility never calls AccountAccessor and the like; the VBD
  diagrams' `canWrite(actor, accountId)` is shorthand for this call.
- Outcomes: `allowed` (with the role); `forbidden` → **403**;
  `not_member` and `not_visible` (someone else's personal data) → **404**,
  so neither the household nor the data is revealed.
- Not yet in the API contract: exposing the system role to the web app
  waits for the sys-admin pages.

### OQ-112: Notification delivery, and keeping the reset link out of log files (task U7)
**Confirmed with the stakeholder (Oct 2026):** the console email provider
shows the email **in the terminal only**. A reset email's body holds a
live reset link, so it must never be written to the daily log files.
`@financas/logging` gained a general rule for this: an event logged with
`consoleOnly: true` reaches the console (and tests' `captureLogs`) but the
file transport drops it.

**Design (U7):** superseded by OQ-113 — the console provider now lives in
`EmailAccessor`, and rendering, routing and failure semantics in
`NotificationEngine`. The `consoleOnly` rule above stands.

### OQ-113: Notifications are an Engine, not a Utility (task U7)
**Confirmed with the stakeholder (Oct 2026), after debating the PR for
OQ-112:** `NotificationDeliveryUtility` was misclassified.
- **Why not a Utility:** a Utility must be usable unchanged in another
  system (logging, the service bus, authentication are). This one knows the
  app's notification types, their parameters, which channel each uses, and
  how to word an email — domain knowledge. And anyone may call a Utility,
  including Engines; a notification is a business side effect that only a
  Manager, running a use case, should cause. OQ-82 had even named the
  trigger ("server-side text composition"), and OQ-84's email rendering had
  already crossed it.
- **`NotificationEngine`** (called by `IdentityManager` and
  `AccountManager`): `notify(type, recipient, params)`. **The Engine, not
  the Manager, chooses the channel** from a routing table (v1:
  `invitation.received`, `holding.matured` → in-app; `password.reset` →
  email). The recipient's shape follows from the type's channels —
  `{userId}` for in-app, `{email, language}` for email — and is enforced by
  the types, so a Manager can't omit what a channel needs. Rendering email
  from the shared catalog stays **in the Engine**. It rejects when a
  channel fails; the Manager decides what follows (no `markMaturedNotified`;
  Reset Password still answers 202 after logging).
- **`EmailAccessor`** only sends `{to, subject, body}` through the provider
  `EMAIL_PROVIDER` names (v1 `console`, terminal only — OQ-112). In-app
  goes through the existing `NotificationInboxAccessor`, which now has two
  callers: the Engine writes, `InsightsManager` reads.
- **Not a fifth Manager:** the Manager whose use case caused the
  notification calls the Engine directly; there is no notification
  Manager and no extra service-bus hop. Reading the inbox is a separate
  flow (`InsightsManager`).
- **Future changes land in one place:** emailing invitations too, per-user
  channel preferences, digests or quiet hours are Engine changes; a new
  channel is a new Accessor plus routing entries; a provider swap is inside
  `EmailAccessor`.
- **Diagrams:** `gen_notification_engine_oct2026.py` (layout of every call
  chain, the Invite User, Reset Password and Notify Matured Holding chains,
  the static views) plus the three sequences in their area generators.
  The layered view spans the Engine across Identity and Account (its two
  callers) and explains the three placements in its notes. Counts: 4
  Managers, 3 Engines, 6 Utilities, 17 active Accessors.
- **Drift found while redrawing:** the Invite User call chain said
  "email" and skipped the duplicate checks (fixed); every sequence still
  shows the pre-OQ-110 `logActivity`/`recordAudit` calls (left for a
  separate pass).

### OQ-114: Sign-in — lockout, refresh-token replay, Manager error convention (task M1, PR 1)
**Confirmed with the stakeholder (Oct 2026):**
- **M1 ships as five PRs** (one task, ticked when the last merges):
  1. request authentication + register, login, refresh, logout, sessions;
  2. change/reset password + MFA recovery; 3. profile + list my households
  and invitations; 4. households and members; 5. invitations.
- **Login lockout, now.** 5 failures within 15 minutes lock the **email
  address** for 15 minutes; a success clears it (`config/constants.ts`).
  *(OQ-145: sign-in is now two steps. Both steps count, and only a full
  sign-in clears the count.)*
  - Counted per address in a new `login_attempts` table, not on the user,
    so an address with no account locks like a real one: a 429
    `auth.too_many_attempts` (with `Retry-After`) never confirms that an
    email is registered.
  - **Owned by `UserAccessor`** (credentials and their protections), not a
    new Accessor — the stakeholder preferred it once the existing
    Accessors were laid out. IdentityManager decides the threshold, window
    and lock length; the Accessor counts atomically, locks and clears.
  - *(Changed by OQ-145: only the password step still gives one 401 for
    every failure. A wrong code at the second step is
    `auth.mfa_invalid`.)*
  - Every login failure — unknown email, wrong password, wrong MFA code —
    answers the same 401 `auth.invalid_credentials`, and an unknown email
    still costs one password check, so neither the code nor the timing
    reveals which factor failed. (The old Login sequence showed
    `auth.mfa_invalid` for a wrong code; corrected.)
- **A replayed refresh token ends that session only** — the user's other
  devices stay signed in; an attacker replaying an old token can't sign
  the user out everywhere (matches the contract).
- **Demo users get real dev credentials:** `pnpm db:seed:demo` gives Ana
  and Ben the password and TOTP secret in `config/constants.ts`
  (`demoSeed`), shown once in the seed's terminal output; a rerun
  refreshes them. `pnpm generate:mfacode` prints their current TOTP code,
  so local sign-in needs no authenticator app.

**Design decisions (PR 1):**
- **Request authentication:** `requireSystemRole(verify, 'USER')` on every
  protected route — no or invalid bearer token → 401
  `auth.unauthenticated`; missing system role → 403 `auth.forbidden`
  (OQ-111). The verified claims are the request's actor, and the request
  log now names it.
- **A Manager rejects by throwing the contract's error (code + status).**
  First Manager, so this sets the convention: choosing 401 vs 404 vs 409 is
  part of the use case's security decisions (enumeration avoidance, one
  answer for every login failure). Accessors keep returning typed results
  (OQ-103). Errors may carry headers (`Retry-After`).
- **Registration:** a password under 12 characters is the Manager's
  `password.too_short` (BDT plan), not a generic validation error; a taken
  email is 409 `user.email_taken`. The contract gained
  `auth.unauthenticated`, `auth.too_many_attempts` (+ the 429 response) and
  `user.email_taken`, in both catalogs.
- **Diagrams:** Login redrawn and a new Refresh Tokens sequence
  (`uc-14b`); the Login call chain via `gen_login_lockout_oct2026.py`.
- **Known limit (by design, OQ-30):** an access token stays valid until it
  expires (≤ 15 minutes) even after logout or revocation; only the refresh
  token is server-side.
- **Follow-up:** rows for addresses that never sign in successfully stay
  in `login_attempts`; purge old ones before any hosting.

### OQ-115: Passwords and MFA recovery (task M1, PR 2)
**Confirmed with the stakeholder (Oct 2026):**
- **A reset link works once, for 30 minutes**
  (`authentication.passwordReset.ttlMinutes`). It points at the web app:
  `WEB_APP_URL` (new env variable, default `http://localhost:5173`) +
  `/reset-password?token=…` — the web route comes with the Authenticate
  experience.
- **A wrong current password on Change Password is 422
  `password.current_incorrect`, not 401.** The user is signed in and stays
  so; a 401 would make the web app treat the session as expired. Contract
  and both catalogs updated.
- **A successful reset lifts any login lock on that address** — it proves
  control of the email.

**Design decisions (PR 2):**
- **MFA recovery goes through Login's authentication step:** the same
  lockout, the dummy-hash check for unknown emails and one 401 for every
  failure; the recovery code is checked (and used up) only after the
  password matched, so a wrong password never wastes a code. The old
  sequence answered a distinct `auth.recovery_code_invalid` after a correct
  password — which confirmed the password; corrected. One shared
  `authenticate(email, password, secondFactor)` keeps the two from drifting.
- **Reset request answers 202 before any lookup;** the token and email
  happen afterwards, so neither the answer nor its timing reveals whether
  an account exists. A failure there is logged, never returned.
- **Length first:** both Change Password and the reset confirmation check
  the new password's length before anything else (a too-short password
  never uses up a link, OQ-103).
- Change Password ends every **other** session; a reset ends **all** of
  them (FR-1.13/1.14). Both are audited (`ChangePassword`,
  `ResetPassword`), as is `MfaRecovery` (a Session, like Login).
- Sequences uc-18, uc-19 and uc-20 redrawn accordingly.

### OQ-116: Profile and "my households" — contract gaps closed (task M1, PR 3)
**Found while implementing; resolved toward the existing design:**
- **The contract was the stale side** for the two lists the household
  switcher needs (uc-21):
  - `GET /households` returned plain `Household`s, without the caller's
    **role** that HouseholdAccessor already returns → new `MyHousehold`
    schema (Household + `role`).
  - `GET /users/me/invitations` returned `Invitation`s without the
    **household name or inviter's name** — and an invitee isn't a member, so
    the web app couldn't look them up (the sequence's "the frontend
    resolves `inviterUserId`" could never work). InvitationAccessor (A4)
    already returns them → new `ReceivedInvitation` schema; the inviter's
    names are null for a deleted account ("Someone", OQ-82).
  - The sequence's `memberCount` was never returned by anything; dropped.
- **`UserPreferences.theme` had `default: dark` in the contract**, so the
  generated validator filled it in: a PATCH that changed only the language
  would have reset the theme to dark. Caught by a route test; the default
  moved to the description (new accounts still start dark — the database
  default).
- **Names must not be blank:** register and edit trim first and last name
  and refuse an empty result (422 `validation.failed`, `string.min`); the
  contract says `minLength: 1`. The BDT plan already required names.
  *Since U3 (OQ-165), IdentityManager trims and checks them through
  `ValidationUtility`, not the route; the answer is unchanged.*
- **Edit User** changes only the fields sent; an edit that changes nothing
  is a read. Audited as `EditUser`. Request-shape checks (theme, language
  sets) are the route's contract validation (OQ-93), not a
  `ValidationUtility` call — uc-13 redrawn.
- **The system role is not exposed** by `GET /users/me` yet (OQ-111: waits
  for the sys-admin pages).
- **uc-11 (Create User) redrawn** to the PR 1 implementation: route
  `POST /auth/register` (was drawn as `POST /users`), contract validation at
  the route, a duplicate email decided by the insert's unique index rather
  than a prior lookup that two simultaneous registrations could both pass.

### OQ-117: Households and members (task M1, PR 4)
**Design decisions, all following FR-1.4/1.7/1.11/1.12/1.18/1.20 and OQ-107/OQ-111:**
- **Every household action asks AuthorizationUtility first.** A caller who
  isn't a member gets **404 `household.not_found`** (new code) — the same as
  for a household that doesn't exist, so it's never revealed; a member
  without the role gets 403 `auth.forbidden`.
- **Owner protection lives in IdentityManager (OQ-111):** Remove Member and
  Change Role refuse an Owner target with 403; the guarded writes would also
  refuse it (`stale` → 409) if it changed concurrently.
- **Leave Household** (self-service): a non-Owner is removed; an Owner hands
  the household to the longest-tenured Admin/Member/Viewer (`swapOwner`,
  then removal) or, alone, dissolves it. Any `stale` step re-reads and
  decides again, up to 3 attempts (`households.leaveAttempts`), then 409
  `household.changed` (OQ-107).
- **New guarded `HouseholdAccessor.dissolve(householdId, lastMemberId)`:**
  the old unguarded `delete` would have deleted someone who accepted an
  invitation between "no successor" and the delete. Deliberate dissolution
  by the Owner (uc-02) still uses `delete`.
- **`household.created` carries `{householdId, createdByUserId, language}`:**
  default categories are seeded in the creator's language (an earlier
  decision), and AccountManager must not reach into Identity's data to
  find it.
- **Transfer Ownership to oneself** changes nothing (200). Change Role to
  `Owner` is refused by the contract (422) — that's Transfer Ownership.
- **Contract gaps closed (same as OQ-116):** `HouseholdMembership` gains
  first/last name and email (the members screen needs them; the Accessor
  already returned them); create and get household return `MyHousehold`
  (with the caller's role); the household name must not be blank.
- **Sequences uc-01, 02, 07, 08, 09, 10 redrawn** to the implementation:
  `authorize(...)` with its outcomes, guarded writes and retries, `log.audit`.

### OQ-118: Invitations (task M1, PR 5 — IdentityManager complete)
**Gaps found and closed:**
- **One pending invitation per person per household is now a database
  rule** (partial unique index, migration `0006`): the Manager's duplicate
  check (OQ-109) alone let two simultaneous invites both land.
  `InvitationAccessor.insert` returns `already_pending` → 409.
- **A household's invitation list carries the invitee's name and email**
  (`HouseholdInvitation` schema): invitees aren't members, so the
  Owner/Admin couldn't look them up — the same gap as OQ-116/117.

**Design decisions:**
- **Accepting or declining someone else's invitation is 404
  `invitation.not_found`**, not the contract's 403 — the API's rule of
  answering 404 where a 403 would confirm something exists. Contract
  updated.
- **Accept resolves the invitation first (guarded), then adds the
  membership.** A revoke racing it can't also win, and no membership has to
  be undone. Known limit: if the database fails between the two steps, the
  invitation reads "accepted" without a membership — rare (it needs an
  outage at that instant), and the Owner can invite again.
- **Who may:** invite, list and revoke — Owner/Admin (`members.manage`);
  accept and decline — only the invitee.
- **Audit:** invite, revoke and accept are audited (household management
  and membership); **decline is logged, not audited** — FR-7.1's audit log
  covers household data, and declining changes none (uc-05's original
  decision; the first implementation audited it, corrected before merge).
- **The invitation notification is fire-and-forget** through
  NotificationEngine (in-app, OQ-113); a failure is logged and the
  invitation stands.
- Sequences uc-03 – uc-06 redrawn to the implementation.

**Task 22 (`M1` IdentityManager) is complete**, in five PRs (OQ-114 –
OQ-118). Delete User's cascade is `M1D` (task 136, slice 5).

### OQ-119: Web ValidationUtility (task FU1)
**Design decisions:**
- **Rules answer in the API's field codes.** Each rule returns the
  `{code, params}` of a 422 `details[]` entry (`field.required`,
  `string.format`, `string.min`, `number.min/max`, `date.min/max`,
  `field.invalid_type`), so a client-side error and a server-side one
  render through the same catalog entry — no new catalog keys.
- **Hand-written, never stricter than the API.** The web app doesn't
  bundle the contract's Zod schemas (task N7), so the rules are written
  in `apps/web/src/utilities/validation.ts`: email is trimmed and checked
  with the same pattern `z.email()` uses; the password minimum (12) lives
  in `apps/web/src/config/constants.ts`, mirroring the API's.
- **Rules check typed values; the inputs parse text.** Money is checked
  as an integer of minor units and dates as `YYYY-MM-DD`; turning
  "1.234,56" or a locale date into those is the Money input's (K7) and
  Date input's (K9) job.
- **Format rules let an empty value through**, so optional fields work;
  `required` / `nonBlank` make a field mandatory, combined with
  `firstError`. `validateFields` returns only the failing fields.

### OQ-120: Web PasswordStrengthUtility (task FU2)
**Design decisions:**
- **The estimate is zxcvbn-ts's**, not a length-and-symbols heuristic: a
  heuristic rates `Password1234!` strong, which is the misleading reading
  a meter exists to prevent. It catches common passwords, keyboard runs,
  sequences, dates, l33t and the user's own details, with the common,
  English and pt-BR dictionaries (both languages for every user).
- **Loaded on demand.** The library and its dictionaries (~1 MB) are
  imported by `loadPasswordStrengthEstimator()`, which the password
  screens await, so they never weigh on the rest of the app.
- **The library stays inside the utility.** Callers get our own reading:
  `level` (`too_short` / `weak` / `fair` / `good` / `strong`), the
  meter's four `segments`, and a `hint` code (`add_length`,
  `avoid_common`, `avoid_patterns`, `avoid_dates`, `avoid_lone_words`,
  `avoid_personal`) mapped from its warnings. Its own translations are
  unused; the catalog's new `passwordStrength` section labels levels and
  hints, and the level and hint types are derived from it.
- **Below 12 characters the reading is always `too_short`** (the one hard
  rule, NFR-SEC-4) without running the library. The meter never blocks a
  submit.
- **Personal inputs:** the app's own words (`config/constants.ts`) plus
  the user's name and email; an email also contributes its local part,
  with and without separators, since the library matches whole words.
- **Known behaviour:** two names plus a year (`anasilva1990` without that
  user's email) reads `good`: names are already in the dictionaries, and
  that is zxcvbn's honest guess count.

### OQ-121: Tailwind theme + design tokens (task K1)
**Design decisions:**
- **Tailwind v4, configured in CSS.** `apps/web/src/styles/theme.css` is
  the single source: `:root` holds the dark tokens, `[data-theme='light']`
  the light ones, and `@theme inline` maps each to a utility (`bg-card`,
  `text-ink`, `bg-mint/15`). No `tailwind.config` file.
- **Hex values, not RGB channels.** The mockups' channel form existed so
  Tailwind v3 opacity modifiers worked; v4 does that with `color-mix`, so
  the tokens are plain hex and diff one-to-one against the docs table.
- **Tailwind's default palette is removed.** Only tokens exist as colour
  utilities, so a non-token colour (`bg-white/5`) fails to build. That
  enforces NFR-UX-2 in the build, not in review.
- **Category palette as `cat-*`** (`--c-cat-teal`, `text-cat-teal`): six
  names overlap the theme tokens with different light values. Resolving a
  stored token to a colour at runtime is ThemeUtility's (FU4).
- **Light accents darkened for NFR-UX-2.** The documented light `mint`
  (`#0E9467`), `sun` (`#B07800`) and `peach` (`#D2602B`) were ~3.8:1 on
  white, and `coral` (`#D2383B`) 4.46:1 on `bg`; they now use the category
  palette's light values (`#0B7A55`, `#946200`, `#C2410C`, `#C2302F`).
  `faint` is not a text colour (icons, dividers, disabled only).
- **Enforced by a test** that parses `theme.css`: both themes declare the
  same tokens, the category tokens equal `PALETTE_TOKENS`, every token
  reaches Tailwind, and text tokens, on-fill pairs and the 18 category
  colours reach ≥ 4.5:1 in both themes.
- **Out of scope here:** fonts (K2), choosing dark / light / system (FU4).

### OQ-122: ThemeUtility (task FU4)
**Design decisions:**
- **Applying a theme is one attribute.** `apps/web/src/utilities/theme.ts`
  sets `data-theme` (`dark` / `light`) on `<html>`; the tokens in
  `theme.css` do the rest, so nothing re-renders. `system` follows the
  device's `prefers-color-scheme: light` query live; applying any other
  preference stops listening.
- **The last applied preference is remembered in `localStorage`**
  (`theme.storageKey` in `config/constants.ts`) and restored in `main.tsx`
  before the first render, so the sign-in screen and a reload start in the
  user's theme. The server's `preferences.theme` wins once loaded. A
  missing, unknown or blocked storage value gives the default (dark,
  FR-1.21); a failing write is ignored.
- **One controller per page** (`createThemeController`): a new preference
  replaces the previous one, so the App Shell (S1) and Edit Preferences
  (X3) apply through the same instance `main.tsx` creates.
- **A category colour is a CSS variable reference**, `var(--c-cat-teal)`,
  not a hex: it follows the theme without re-rendering and no hex values
  are copied into TypeScript. For `style` props (fill, stroke,
  background); static markup keeps the `cat-*` utilities. An unknown token
  (a newer palette than this build) falls back to `slate`.

### OQ-123: I18nUtility and the browser logger (task FU5)
**Confirmed with the stakeholder (Oct 2026):**
- **A translator per locale.** `apps/web/src/utilities/i18n.ts` formats
  the shared catalog with `intl-messageformat` (the same ICU dialect the
  catalog test parses). `createTranslator(locale)` gives:
  - `text(section, key, params)` for copy; the compiler checks the section
    and key;
  - `error(code)`, `field(code)` and `notification(type)` for the codes the
    API sends as plain strings.
- **It never throws into the UI.**
  - An unknown code shows its section's generic message:
    `errors.fallback`, `fields['field.invalid']` or
    `notifications.fallback`.
  - A message that fails to format (a missing argument) does the same;
    typed copy shows the key's name instead.
  - Both are logged as warnings with the argument names, never their
    values (OQ-82).
- **Choosing the locale:** the remembered locale (`i18n.storageKey`),
  else the first browser language the catalog supports (`navigator.languages`;
  an exact tag first, then the same language, so `pt-PT` → pt-BR and
  `en-GB` → en-US), else pt-BR. The server's `preferences.language` wins
  once it loads. `createLocaleController` follows ThemeUtility's pattern:
  - one controller per page, created and restored in `main.tsx`;
  - `apply` sets `<html lang>` and remembers the locale;
  - subscribers are told about each change.
- **React binding.** `I18nProvider` re-renders on a locale change.
  `useI18n()` returns the translator, and `useLocaleController()` lets S1
  and X3 apply the user's language. A component outside the provider
  throws, since that is a wiring bug.
- **Shared never-throwing storage.** FU4's `localStorage` wrapper moved to
  `utilities/safeStorage.ts`, and both utilities use it.
- **No `ui` section yet.** It arrives with the first kit component that
  has copy.
- **The browser logger (refines OQ-110).** Winston and its file transport
  are Node-only, so `@financas/logging/browser` gives the web app:
  - the same `createLogger({ label })` call, levels and redaction;
  - no `audit` level, since audit belongs to the API;
  - a threshold of `info` (`loggingSettings.browserLevel`).
  Its console sink is the one place in the web app that touches `console`.
  It is silent under Vitest, and tests read events with `captureLogs()`.

### OQ-124: The API client (task FU7)
**Confirmed with the stakeholder (Oct 2026):**
- **RTK Query, not a generated SDK.** Experiences call the API through one
  `createApi` (`apps/web/src/api/backendApi.ts`). Cache tags make
  cross-view refreshes declarative: Record Transaction → Browse + Month
  Overview, categories → Budget Management. Switch Household resets the
  whole cache. The project already uses RTK, so the only new runtime
  dependency is `react-redux`.
- **Endpoints are hand-written, per Experience.** FU7 ships with no
  endpoints. Each Experience injects its own, typed by
  `@financas/api-types` (one type source, front and back):
  `backendApi.enhanceEndpoints({ addTagTypes }).injectEndpoints(…)` in
  `experiences/<name>/api.ts`. `@rtk-query/codegen-openapi` was rejected
  because it would bring a second generated type set and create every
  endpoint up front.
- **Only Experiences call the backend — enforced.** ESLint
  (`project/ebd-backend-calls`) stops `**/flows/**`, `**/interactions/**`,
  `kit/**` and `utilities/**` from importing `**/api`, `**/api/**` or
  RTK Query. This fixes the frontend folder names those globs rely on.
- **The base query** (`api/baseQuery.ts`) wraps `fetchBaseQuery`:
  - **Correlation ID per call** (`crypto.randomUUID`, `X-Correlation-Id`,
    OQ-99). A replayed call keeps the same ID.
  - **Bearer token** from the token store, read on every send.
  - **Refresh only on 401 `auth.unauthenticated`** (a missing or expired
    access token). A wrong password (`auth.invalid_credentials`), a bad
    MFA code or a rejected refresh never triggers a refresh, so there is
    no loop. After one refresh, the call is replayed once.
  - **Session end.** A refresh the API rejects, or no refresh token at
    all, clears the tokens and dispatches `api/sessionEnded`; the App Shell
    takes the user to Sign In (S1). A refresh that gets no answer keeps the
    tokens. Either way, the call returns its 401.
  - **Errors come back as `ApiError`** `{ status, code, params, details,
    correlationId }`. The envelope's `message` is dropped here, so the UI
    cannot render it (the "lint rule on the API client" of the BDT plan).
    Two cases get a code of the client's own:
    - a call that never reached the API → `network.unavailable`, a new
      catalog key that `ClientErrorCode` keeps out of the API's `ErrorCode`;
    - an answer that isn't the envelope (a proxy's HTML) →
      `internal.unexpected`.
  - **Logging** (codes and IDs only, never bodies or tokens): a call that
    got no answer is a warning; a 5xx or a non-envelope answer is an error.
    Expected 4xx outcomes aren't logged; they're the Experience's to show.
- **Tokens.** The access token lives in memory only (the contract never
  persists it). The refresh token lives in `localStorage`
  (`api.refreshTokenStorageKey`), so a reload or a new tab stays signed in
  for its 30 days. Trade-off: XSS on the origin can read it. An httpOnly
  cookie would have reopened M1 and needed CSRF protection.
- **Rotation-safe refresh.** The backend ends a session when a refresh
  token is used twice (OQ-100). To prevent that:
  - concurrent 401s in a tab share one refresh;
  - every tab takes the same Web Lock (`api.refreshLockName`);
  - the token is read from storage only once the lock is held, so a tab
    never presents a token another tab has already rotated.
- **Wiring is injected.** The base query reads its `ApiEnvironment`
  (base URL, `fetch`, tokens, refresher, correlation IDs) from the store's
  thunk extra argument `{ api }`, built by `browserApiEnvironment(window)`.
  S1 creates the store; `tests/unit/api/backendApi.test.ts` shows the
  wiring.
- **Experience tests (refines the BDT plan).** Experiences run on a real
  store, with the one boundary mocked: `fetch` in the `ApiEnvironment`.
- **Same origin.** The base URL is `/api/v1` on the page's origin; the
  Vite dev server proxies `/api` to the API's port 3000. No CORS and no
  env var.
- **Follow-up (S1/X1) — done in S1 (OQ-156):** signing out in one tab
  clears the shared refresh token, but other tabs noticed only when their
  access token next failed (≤ 15 minutes). The shell now listens to the
  `storage` event, which ends them at once.

## Refined (resolved, with a follow-up still open)

*(OQ-4's legal-review follow-up below is closed for v1 by OQ-89.)*

### OQ-4: Target market, language, and regulatory framework
**Confirmed:** Brazil (BRL) is the **primary** market, but the app must also
support **US-based users (USD)**. Both are in scope from the start, not
BRL-only with US as a maybe.

**Consequences now locked in:**
- At least **pt-BR and en-US** locales are in scope for the frontend
  copy/formatting layer (NFR-I18N-1).
- Open Banking is now confirmed to need **at least two regional providers**
  behind a common interface — e.g. Open Finance Brasil for BRL accounts and
  a US-oriented aggregator/standard (e.g. FDX-based) for USD accounts. This
  reinforces the `[volatile]` marking already on CUC-3/FR-2.5.

**Still open:** the exact regulatory compliance scope — LGPD for Brazil is
clearly in scope; which US-side rules apply (e.g. state-level privacy laws,
anything triggered by linking US bank data) needs legal review before
NFR-COMP-1/NFR-COMP-2 can be finalized. This does not block architecture
work — the design already treats "region/compliance regime" as a variable,
not a hardcoded assumption.

### OQ-125: Typography (task K2)
**Confirmed with the stakeholder (Oct 2026):**
- **Self-hosted fonts.** Manrope (display) and Inter (text) come from
  `@fontsource-variable/*`, bundled by Vite, not from Google Fonts: a
  finance app makes no third-party request (no IP leak, strict CSP, works
  offline). Each font is split by `unicode-range`, so a pt-BR / en-US page
  downloads only the latin files (~25 kB + ~48 kB). `font-mono` (MFA keys,
  backup codes) is the system monospace stack; not worth a third font.
- **Text is set through role utilities, not a `<Text>` component.**
  `apps/web/src/styles/typography.css` (imported by `theme.css`) declares
  one `@utility` per role, bundling family, size, line height and, where
  the role fixes them, weight, tracking and case. A utility works on any
  element (button label, table cell, input), so nothing wraps text.
- **The mockups' 16 ad-hoc sizes collapse into 14 roles:**

  | Role | Font | Size / line (px) | Weight | Use | Mockup sizes |
  |---|---|---|---|---|---|
  | `type-display-xl` | Manrope | 40/44, tight | 800 | auth hero | 40 |
  | `type-display-lg` | Manrope | 34/40, tight | 800 | page title, big total | 34, 36 |
  | `type-display-md` | Manrope | 30/36, tight | 800 | auth screen title | 30 |
  | `type-display-sm` | Manrope | 26/32 | 800 | form / setup amounts | 26, 28 |
  | `type-display-xs` | Manrope | 22/28 | 800 | stat-card amounts | 22 |
  | `type-heading-lg` | Manrope | 24/32 | 700 | section title | 2xl |
  | `type-heading-md` | Manrope | 20/28 | 700 | drawer title | xl |
  | `type-heading-sm` | Manrope | 18/26 | 700 | card title | lg |
  | `type-body-lg` | Inter | 15/22 | — | inputs | 15, 17 |
  | `type-body` | Inter | 14/20 | — | default text | sm |
  | `type-body-sm` | Inter | 13/18 | — | dense rows | 13 |
  | `type-caption` | Inter | 12/16 | — | hints, meta | xs, 12, 12.5, 11.5 |
  | `type-label` | Inter | 11/14, uppercase, 0.05em | 600 | eyebrows, column headers | 11, 10.5 |
  | `type-micro` | Inter | 10/12, uppercase, 0.05em | 700 | badges | 10 |

  Text roles leave weight to the context (`type-body font-semibold`); a
  weight utility also overrides a role's weight. `body` starts in
  `type-body`.
- **Tailwind's default families and size scale are removed**
  (`--font-*: initial`, `--text-*: initial`): only `font-sans`,
  `font-display`, `font-mono` and the roles exist, so `text-sm` generates
  nothing; a size outside the scale needs an explicit `text-[…]`.
- **Tabular figures stay opt-in** (`tabular-nums`), as in the mockups;
  the Amount component (K29) applies them to money.
- **Enforced by a test** that compiles the real stylesheet with Tailwind:
  every role has the approved family, size and line height (none under
  10px), default sizes and families generate nothing, and every font
  source is local.

### OQ-126: Icon set and card-network logos (task K3)
**Confirmed with the stakeholder (Oct 2026):**
- **Self-hosted, generated subset.** The icons are not loaded from Iconify
  at runtime, for the same reason as OQ-125's fonts: no third-party
  request, a strict CSP, and offline use. `tools/icons` (`pnpm
  generate:icons`) copies the chosen icons out of `@iconify-json/*` into
  the committed `apps/web/src/kit/icons/generated/iconData.ts`.
  `pnpm check:icons`, part of `pnpm check`, regenerates the file and
  fails when the committed copy is stale, like `check:contract`.
- **Material Symbols names, used as they are.** They're what the
  mockups and stored category values use, so there's no layer of
  semantic aliases; the registry is the one place to remap if the
  library ever changes. `IconName` is a typed union, so a misspelled
  name fails to compile.
- **Two lists, one registry.** UI icons: `tools/icons/src/selection.ts`
  (the mockups' 78 non-category icons plus `visibility-off-outline` for
  the password field). Category icons: `CATEGORY_ICONS` in
  `@financas/reference`, the list the API validates against, so every
  storable icon can be drawn (a test checks this).
- **The category set grows from 12 to 57**, in picker order and grouped
  by theme: home & bills, food, transport, health, shopping & personal,
  family, leisure, money, other. Adding names needs no schema change.
- **`<Icon name label? className?>`** inlines the glyph as an SVG that
  is 1em square and drawn in `currentColor`, so it follows the text
  around it; utilities override size and colour. Without a `label` it
  is decorative (`aria-hidden`); with one (already translated) it gets
  `role="img"` and `aria-label`.
- **Card-network logos come from Iconify `logos`** ("SVG Logos", CC0),
  the set the mockups already use. The old app's SVGs were not reused:
  they come from the commercial Nucleo pack, they lack Elo and
  Hipercard, and their `amazon` "flag" is a co-brand, not a network.
  `<CardNetworkLogo network label? className?>` keeps each logo's
  colours and proportions: 1em tall, with the width following the
  aspect ratio. `other` shows the `credit-card-outline` glyph.
- **`jcb` and `unionpay` added to `CARD_NETWORKS`** (validated in code,
  no schema change). Maestro and Visa Electron are left out: both are
  debit-only (FR-2.7 is about credit cards), and Mastercard is retiring
  Maestro. A Visa Electron number is detected as `visa`.
- **Detecting the network from the number belongs to K48** (Credit-card
  preview), its only user. The notes for that task are in its row in
  `docs/planning/01-pd-activity-list.md`.
- **ESLint `react/require-default-props` is off** for the web app.
  TypeScript's optional props already say a prop may be absent, and
  React 19 ignores `defaultProps` on function components.

### OQ-127: Segmented control (task K13)
**Confirmed with the stakeholder (Oct 2026):**
- **A value control, not tabs.** `<SegmentedControl>` picks one value
  out of a few: it is a `radiogroup`. The mockups also use the `.seg`
  look, marked `role="tablist"`, for the Account Setup and Investments
  section switchers. Those are navigation, so they get their own nav
  piece when those pages are built and can reuse K13's classes. K13 has
  no tabs mode.
- **Native radios.** Each segment is a visually hidden
  `<input type="radio">` (one `name` per group, from `useId`) inside its
  label. The browser supplies arrow-key movement, focus and radio
  semantics, so there is no keyboard code to maintain. The selected and
  focus looks come from `has-checked` / `has-focus-visible`. Controlled
  only: `value` in, `onChange(value)` out. Texts arrive translated.
- **One look for pills.** The mockups' $ / R$ switch (solid mint
  selected, `raised` track) is unified with `.seg` (`mintdeep` selected,
  bordered `card` track), at a new compact size. Pill sizes are `md` 36px
  (section-level), `sm` 30px (goal status) and `xs` 26px (currency
  switches). The exported mockup pages still show the old switch.
- **Tiles layout.** `layout="tiles"` draws the Record drawer's kind
  groups: equal full-width columns, 64px tall, icon over the label.
- **Theme is not a K13 user.** Profile keeps the mockup's preview cards
  for Dark / Light / System, built with K14 (Option card). The activity
  list's K13 and K14 rows were updated to match.

### OQ-128: Component library (task N14)
**Confirmed with the stakeholder (Oct 2026):**
- **Why:** the stakeholder wants to see each kit component as it is
  built, in isolation and in every state, instead of waiting for the
  first page that uses it.
- **Storybook 10**, over a home-made gallery page: it gives the
  controls panel, docs pages and accessibility checks out of the box,
  and supports Vite 8 and React 19. Ladle was ruled out because it
  bundles Vite 6. Storybook is a dev-only dependency and never ships in
  the app.
- **A new activity, `N14`**, added during slice 1 as task 32, right after
  K13. It depends on K1–K3, ThemeUtility and I18nUtility. Later tasks
  moved down by one (149 in all).
- **Every kit task from task 33 on ships its stories** with the component.
- The setup details (story location, toolbar, addons, backfill) are in
  `N14`'s row in `docs/planning/01-pd-activity-list.md`. The task's
  design step confirms them.

**Settled in the task's design step (Oct 2026):**
- **Smoke tests in jsdom.** `apps/web/tests/unit/stories/stories.smoke.test.tsx`
  renders every story through the real preview (`composeStories`), inside
  `pnpm check`. It catches a story that still typechecks but throws, for
  example a missing provider. `@storybook/addon-vitest` (real Chromium)
  was ruled out as too heavy for now. Axe checks run in the Storybook UI
  only, with `a11y.test: 'error'`.
- **Story-only helpers are tooling.** The swatch grid, the icon gallery,
  the state wrapper for controlled components and `.storybook/`'s
  decorator are documented but not unit-tested, like config files
  (OQ-91). They live outside `src/`, so they are outside the coverage
  gate. The smoke test renders them, and covers each one's single
  behaviour (icon search, the kept selection).
- **ESLint:** `eslint-plugin-storybook`'s flat recommended config. Stories
  and `.storybook/` count as dev-only files, and
  `react/jsx-props-no-spreading` is off there, because CSF passes args
  with `{...args}`.
- **Locale toolbar:** `StoryFrame` gives `I18nProvider` a controller
  fixed to the toolbar's locale, so the app's saved locale is never
  touched. Story args are plain example text, so the controls panel
  can edit them. No catalog keys are added just for stories. Kit
  components get their text from the caller, already translated, so
  the toolbar affects the few that translate their own text, plus
  `lang`.
- **K3 fix found by the stories:** `CardNetworkLogo`'s `other` fallback
  (the card icon) kept `Icon`'s fixed 1em width, so a height utility
  didn't resize it. It now gets `aspect-square w-auto`, like the logos'
  auto width.
- `apps/web/tsconfig.json` lists `.storybook/*.ts(x)` by name, because
  TypeScript's include wildcards skip dot-folders.

**Task 32 (`N14`) is complete.**

### OQ-129: Option card (task K14)
**Confirmed with the stakeholder (Oct 2026):**
- **One component, two layouts.** `<OptionCardGroup>` picks one value
  when each choice needs a description or a picture. `layout="list"`
  (default) stacks full-width rows, each with an icon chip, the title and
  description, and a radio dot. MFA method uses it. `layout="tiles"`
  draws equal columns, two per row at phone width, with the icon on top.
  Account type uses it.
- **Same mechanism as K13 (OQ-127).** It is a `radiogroup` of visually
  hidden native radios, one `name` per group from `useId`. It is
  controlled only, and texts arrive translated. Each radio is named by
  its title (`aria-labelledby`) and described by its description
  (`aria-describedby`).
- **One selected look.** The mockups had three. All option cards now use
  the MFA card's: a `mint/60` border, a light mint tint and a 3px mint
  glow ring. The account-type tile's `mintdeep` fill is dropped.
- **Theme previews belong to the caller.** A tile takes any `preview`
  node, drawn above the title and hidden from assistive tech. When a
  preview is present, the icon moves before the title. Profile draws the
  Dark / Light / System thumbnails when it is built. They show both
  themes' fixed colours, whatever theme is active. The story uses
  sample thumbnails.
- No disabled option: the "coming later" MFA placeholder was dropped
  (OQ-62), so nothing needs one.
- **Shared focus ring, deferred to K16.** K13 and K14 both repeat the
  `has-focus-visible` outline classes. K16 (Checkbox), the third user,
  moves them into a shared kit helper.

**Task 33 (`K14`) is complete.**

### OQ-130: Checkbox (task K16)
**Confirmed with the stakeholder (Oct 2026):**
- **One `<Checkbox>`, controlled only.** It takes `checked`, `onChange`
  (which gets the new boolean) and a `label`. The label is a `ReactNode`,
  already translated, so the terms agreement can hold its links. Clicking
  a link follows it without toggling the box. Uses: the terms on Create
  account, "I've saved these codes" on backup codes, and K12's
  multi-select rows, which put their swatch and amount in the label.
- **Same mechanism as K13/K14 (OQ-127).** A visually hidden native
  checkbox sits inside its label, so the browser handles Space and the
  semantics, and `has-checked` draws the ticked look. The input is named
  by the label only (`aria-labelledby`).
- **Look, from the mockups.** An 18px `rounded-md` box. Unticked, it has a
  1.5px `faint` border (`muted` on hover). Ticked, it is filled `mint`
  with a 14px `check` in `onmint`. There is no indeterminate state: the
  multi-select's presets are buttons, and its group headers show counts.
- **Label in `type-body` ink.** The mockups disagreed (terms muted,
  backup codes ink); ink was chosen for both.
- **The focus ring goes around the box only, not the row.** The input
  sits inside the box, so the box uses the same `has-focus-visible` ring.
- **Shared focus ring (closes OQ-129's deferral).** `kit/focusRing.ts`
  exports `FOCUS_RING`. K13, K14 and K16 use it.
- **Three extra states, built ahead of need:**
  - **Description:** a `type-caption text-muted` line under the label,
    wired through `aria-describedby`.
  - **Error:** `error` (translated text) turns the unticked box coral,
    sets `aria-invalid`, and shows a `type-caption` coral message under
    the row. The message sits outside the label, so it describes the
    input without being part of its name. How an unticked required box
    blocks submit is left to each flow (e.g. FL3's terms).
  - **Disabled:** the row drops to half opacity and can't be toggled.

**Task 34 (`K16`) is complete.**

### OQ-131: Popover (task K22)
**Confirmed with the stakeholder (Oct 2026):**
- **Built on `@floating-ui/react`.** It is the headless library OQ-65
  allows. It flips or shifts the panel at the viewport's edges, sizes the
  panel to the space left, and handles dismiss and focus return. It works
  in jsdom. The native popover API with CSS anchor positioning was turned
  down: it needs Safari 26+ and recent Firefox, and jsdom has neither.
  Radix was turned down: Menu, Select and Tooltip would each need another
  package. The Menu (K23) and Select (K11) will reuse Floating UI's list
  and typeahead hooks.
- **Shared positioning: `kit/popover/overlay.ts`.** `overlayMiddleware()`
  runs offset, flip, shift and size, in that order. The gap is 8px and the
  viewport padding is the 16px page gutter (`config/constants.ts →
  overlay`). `fitToViewport` caps `max-width` and `max-height` at the space
  left, so the 400px inbox fits a phone and scrolls inside. Phones get no
  bottom sheet; that is the Drawer's job (K20). `OVERLAY_SURFACE` holds the
  panel classes: `rounded-2xl`, `bg-raised`, `border-line`,
  `shadow-overlay`, scrolling inside. K11, K18, K19, K23 and K24 build on
  both.
- **`<Popover>` is a non-modal dialog.** `trigger` is a render prop that
  spreads the ref and the ARIA props (`aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`) on its own button; K4 Button doesn't
  exist yet. `label` (translated) names the panel. Its other props are
  `placement` (default `bottom-end`) and `width` in px (the viewport still
  caps it). `children` is a node, or a function that gets `close`, e.g.
  "View holding" closes the inbox after navigating. A click on the trigger
  toggles the panel. Esc, a click outside or tabbing away closes it, and
  focus returns to the trigger. It renders in a portal, so drawers and
  cards with hidden overflow never clip it.
- **Open state is internal.** Opening is UI state, unlike a checkbox's
  value. `onOpenChange` reports each change, e.g. so the inbox can mark
  notifications seen when it opens.
- **New theme token: `shadow-overlay`** (`--s-overlay` per theme). Dark
  uses the mockup's `0 24px 60px -20px` at 85% black. Light uses the same
  geometry, softer and tinted with ink, because the mockups only show a
  dark shadow.
- **No open or close animation**, since the mockups show none.
- **The household switcher is not a popover.** Mockup 21 expands it in
  place inside the nav drawer, so it stays an inline disclosure. K22's
  users are the notification inbox and the K11, K18, K19, K23 and K24
  controls.

**Task 35 (`K22`) is complete.**

### OQ-132: Skeleton, loading rows and empty state (task K28)
**Confirmed with the stakeholder (Oct 2026):**
- **`Skeleton` is one placeholder shape** (`kit/skeleton/Skeleton.tsx`):
  `line` (default, `h-3`), `circle` or `block` (`rounded-2xl`, for cards),
  sized by the caller's `className`. It is `bg-raised` and hidden from
  screen readers. The pulse is `motion-safe:animate-pulse`, so it stops
  for users who prefer reduced motion.
- **`SkeletonRows` is the ledger's loading row** from mockup 30: a 36px
  avatar circle, a title line, a quieter meta line (70% opacity) and an
  amount bar. The two mockup rows' widths alternate, so longer runs don't
  look like a grid. `count` defaults to `config/constants.ts →
  skeleton.rows` (2, as the mockup shows). The rows sit in one
  `role="status"` `aria-busy` region named by `label` (translated), so
  screen readers announce the loading once. Every list uses it for its
  first or next page. Card rails compose their own placeholder from
  `Skeleton` blocks.
- **`EmptyState` is centred** (`kit/emptyState/EmptyState.tsx`). It has an
  icon in a 48px `bg-raised` circle, a `type-heading-sm` title, an
  optional muted `type-body-sm` description and an optional `action`
  slot. No mockup draws one; the stakeholder chose this look over a
  compact inline row. The action is a `ReactNode` because K4 Button
  doesn't exist yet. The same component covers "nothing yet" and "no
  results for these filters".
- **The month header's "loading…" label is not K28.** It belongs to the
  grouped list's sticky header (K41).

**Task 36 (`K28`) is complete.**

### OQ-133: Tag and count badge (task K30)
**Confirmed with the stakeholder (Oct 2026):**
- **`Tag` is the mockups' `.tag`** (`kit/tag/Tag.tsx`). It is a static,
  rounded pill that never wraps. Uses: currencies, account kinds,
  "Personal" / "Shared", "You", "This device", a section header's count,
  "Mixed currencies", "read-only" / "editable" and "v2". `children` is
  already translated, and an optional `icon` leads it as decoration.
- **Five tones:** `neutral` (`bg-raised text-muted`, the default), plus
  `mint`, `sky`, `sun` and `coral`, each tinted at 10% with its own ink.
  Coral is in no mockup yet. It is built ahead of need for the over-budget
  and overdue states. The mockups' one-off 15% mint count and mockup 51's
  500-weight "read-only" / "editable" pills use the same look: 10% tint,
  600 weight.
- **Three sizes:** `md` (22px, 11px / 600, the default), `sm` (20px, for
  dense rows such as the currencies in the record drawer) and `micro`
  (`type-micro`, the "v2" marker).
- **The Owner role pill is not a Tag.** Mockup 60 draws it 32px tall with
  a mint border so it lines up with the Admin / Member / Viewer dropdowns
  in the same column. It takes its look from the same base as K23 Menu's
  trigger, so K30 covers only the small labels.
- **`CountBadge` is the bell's coral circle**
  (`kit/countBadge/CountBadge.tsx`): 16px, `type-micro` in `oncoral`,
  with tabular figures. It renders nothing at zero. Past
  `config/constants.ts → badge.maxCount` (9) it reads "9+", so it stays a
  circle. The number is hidden from screen readers. A visually hidden
  `label` (translated, e.g. "2 unseen notifications") goes in its place,
  so it becomes part of the button's name. It draws only the bubble; the
  caller places it (`absolute` in the button's corner).
- **The dashboard's month-over-month delta pill is K37's.** The Stat tile
  owns it, since it formats the amount through K29.
- **Story smoke test fix.** `stories.smoke.test.tsx` now sets the preview
  annotations before composing the stories. Before, they were set in
  `beforeAll`, after the composition, so the loop rendered every story
  without StoryFrame. A story whose root was one text-only element
  (Tag › Neutral) then looked empty.

**Task 37 (`K30`) is complete.**

### OQ-134: Avatar (task K31)
**Confirmed with the stakeholder (Oct 2026):**
- **`Avatar` is the mockups' initials circle** (`kit/avatar/Avatar.tsx`):
  the members list (60), the nav drawer (21) and the profile header (70).
  It takes `firstName` / `lastName` (the API's user fields) and shows the
  first character of each, uppercased. A character outside the BMP stays
  whole and a blank name is skipped. It is decorative (`aria-hidden`),
  because the person's name is always printed next to it.
- **Colour rule:** the signed-in user is always mint. Everyone else gets
  the tone their user id hashes to (`avatarTone(userId, isSelf)`), so a
  person looks the same on every screen and device, whatever the list
  order. The palette is `config/constants.ts → avatar` (`selfTone` mint,
  `memberTones` sky / sun / lilac). Coral is left out because it means
  errors and over-budget. Each tone is a 15% tint with its own ink.
- **Two sizes:** `md` (40px, 14px text, the default) for rows and the
  drawer, and `lg` (64px, `text-2xl`) for the profile header. Both use
  Manrope at 800 weight. The members list's 700 weight is aligned to the
  drawer and profile. No smaller size is built until a screen needs one.

**Task 38 (`K31`) is complete.**

### OQ-135: Card, section header and kit layouts (task K34)
**Confirmed with the stakeholder (Oct 2026):**
- **`Card` is only the bordered surface** (`kit/card/Card.tsx`):
  `bg-card`, `border-line`. The caller sets the layout inside through
  `className`, because some cards stack and some run in a row (the year
  bar). It renders a `section` by default (`as`: `article`, `div`). Its
  `size` sets padding and radius together, so tighter cards round less:
  `none` (flush and clipped, 20px, for the ledger and tables), `sm` (16px
  padding and radius, for the nested contract / position panels), `md`
  (20px / 20px, the default page panel) and `lg` (28px / 24px, the
  wizard's step card). The mockups' one-off 18px `.acard` / `.ccard`
  padding is aligned to `md`. Rail cards are K36's, not K34's.
- **`SectionHeader`** (`kit/sectionHeader/SectionHeader.tsx`) is a
  `type-heading-sm` title (`h2`, or `h3` through `as`) with these optional
  parts:
  - the **period chip**, the mockups' `.period` (`bg-mintdeep text-mint`,
    12px / 600), whose text the caller formats ("September/2026");
  - a quiet inline `hint` ("newest first");
  - a caption `description` under the title;
  - an `actions` slot on the right (rail arrows, a count `Tag`, "You're
    the Owner", the payout total).
- **`PageHeader`** (`kit/pageHeader/PageHeader.tsx`) holds:
  - an optional `type-label` eyebrow naming the Experience;
  - the page's `h1` (`type-display-lg`) and an optional muted description;
  - a `leading` slot (the profile's 64px avatar);
  - an `actions` slot, aligned to the bottom on the right;
  - a `tabs` slot 20px below. It is a `ReactNode` because those tabs switch
    routes: the Experience decides whether they're links or K13.
- **`WizardLayout`** (`kit/layouts/WizardLayout.tsx`) is mockups 10–14. A
  64px bar shows only the brand mark (no nav during setup). Below it comes
  one of two layouts:
  - with an `aside` (the K49 stepper): a `260px | 1fr` grid, max 1080px,
    stacked below `lg`;
  - without one: a centred column, `narrow` (560px, the default) or
    `wide` (760px, the final summary).
- **`AuthLayout`** (`kit/layouts/AuthLayout.tsx`) owns the whole brand
  panel, which is identical on mockups 01–09:
  - a 520px `bg-deep` panel with mint and sky glows and the mark;
  - the headline, with its accent half in mint;
  - the three feature lines;
  - the © line, with the current year;
  - a decorative product preview: a balance card and a goal card with a
    ring. It is `aria-hidden`, and its sample figures are illustration
    copy in the catalog's new `brand` section (pt-BR and en-US). The ring
    is a plain SVG, and its percent is formatted in the page's locale
    from one constant, so the fill and the label always agree. It doesn't
    wait for K32 or K29.

  The form sits centred, at most 400px wide. Below `lg` the panel is
  hidden and the mark sits above the form.
- **`BrandMark`** (`kit/brand/BrandMark.tsx`) is the mint savings tile
  plus the product name: `md` (a 32px tile, for the wizard bar and, later,
  the App Shell header) and `lg` (40px, for the auth panel). The name is
  `config/constants.ts → brand.name`. It is a proper noun, so it isn't
  translated. It is "Finance APP", as in the repo README and `index.html`.
  The stakeholder chose this over the mockups' "New Finance App", so the
  exported mockup pages are out of date on this point only.

**Task 39 (`K34`) is complete.**

### OQ-136: Button (task K4)
**Confirmed with the stakeholder (Oct 2026):**
- **`Button` is the text button** (`kit/button/Button.tsx`). It is a native
  `<button>` that takes every native prop and `ref`, so the Popover and
  Menu triggers spread their ARIA props on it. `type` defaults to
  `button`, so a form submit is always explicit. `className` is for layout
  only (`w-full`, `flex-1`, `shrink-0`). `leadingIcon` / `trailingIcon`
  take an icon name and are decorative.
- **Seven variants**, all fully rounded:
  - `primary`: `bg-mint text-onmint`, 600 weight;
  - `tonal`: a 10% mint tint, for the soft "add" buttons;
  - `secondary` (the default): a `border-line` outline, ink text;
  - `ghost`: muted text, no border;
  - `danger`: a coral outline at 40%, the mockups' usual destructive button;
  - `danger-ghost`: coral text only, for a row's "Remove" / "Revoke";
  - `danger-solid`: `bg-coral text-oncoral`, for a final destructive confirm.

  Hover uses `ink/5` instead of the mockups' `white/5`, which can't be seen
  in the light theme. Hover applies only while enabled. Focus is the mint
  `focus-visible` outline. Disabled is `opacity-50` with a not-allowed
  cursor, as on the Checkbox.
- **Four sizes:** `sm` 32px, `md` 36px (the default), `lg` 40px and `xl`
  46px (the auth and wizard CTA). The mockups' 44px (`h-11`) buttons are
  aligned to `xl`. Small and medium use `type-body` with 16px icons. Large
  and xl use `type-body-lg` with 18px icons.
- **`elevated`** adds the mint glow under a raised primary: the auth CTA
  and the floating Record button. It uses the new theme token
  **`shadow-glow`** (`--s-glow` per theme). Light uses the light mint at
  45%.
- **`busy`**: the label goes invisible but keeps its space, so the width
  doesn't jump. A `progress-activity` spinner (newly added to the icon
  registry) sits on top and spins only when motion is allowed. The button
  gets `aria-busy` and `aria-disabled` but stays focusable, so focus isn't
  lost mid-submit. Clicks are dropped and `preventDefault` stops the form
  submit they would trigger. No loading text is announced; the button
  keeps its name.
- **`buttonClasses()`** is exported, so an Experience can style a router
  link as a button. Link semantics stay with the Experience.
- **`IconButton`** (`kit/button/IconButton.tsx`) is the round icon-only
  button: close, the rail arrows, the app bar's menu and bell, the auth
  "back". `label` (translated) is required and names it through a
  visually hidden span. A `badge` slot (the bell's `CountBadge`) adds its
  own label to the name. It has two tones, `ghost` (the default) and
  `outline` (`border-line`, muted), and four sizes: `xs` 28px, `sm` 32px
  (the default), `md` 36px and `lg` 40px.
- **Press ripple** (added at the stakeholder's request; `useRipple` in
  `kit/button/ripple.tsx`). Both `Button` and `IconButton` ripple. A circle
  in the button's own text colour grows from the press point until it
  reaches the farthest corner, fading from 24% to nothing over 450ms. The
  theme token is `animate-ripple`, with its keyframes in `theme.css`. A
  keyboard press (Enter / Space, a click with `detail` 0) ripples from the
  centre. The ripples sit in their own clipping layer, so the button keeps
  no `overflow-hidden` that would cut the focus ring or the badge. Each
  ripple removes itself when its animation ends, and quick presses stack.
  There is no ripple while the button is disabled or busy, and none under
  reduced motion. The mockups show no press feedback; the stakeholder
  chose the ripple over a press-scale, and there is no press-scale.
- **Not K4:** inline text links (`text-mint hover:underline`), the nav
  drawer's items (App Shell), the Owner role pill (K23) and the dashed
  "coming soon" placeholders. The Popover, EmptyState, SectionHeader,
  PageHeader and CountBadge stories now use the kit buttons in place of
  their stand-ins.

**Task 40 (`K4`) is complete.**

### OQ-137: Text field and the field frame (task K5)
**Confirmed with the stakeholder (Oct 2026):**
- **`Field` (`kit/field/Field.tsx`) is the frame every form control sits
  in.** It draws the label (`type-caption font-semibold text-muted`) above
  the control, an optional `labelAction` to its right (Sign in's "Forgot
  password?"), and one message under it. The control is passed in as a
  child and spreads `fieldAria(controlId, { hint, error })`, so the
  message describes it and an error marks it `aria-invalid`. K6–K11
  (password, money, number, date, select) reuse the frame instead of
  copying the label, hint and error code.
- **The error replaces the hint.** While a field is invalid, only the
  coral `type-caption font-medium` error shows. The hint comes back once
  the error clears, so the form doesn't grow when it's validated. This
  differs from the Checkbox (OQ-130), which shows both.
- **Hint in `text-muted`, not the mockup's `faint`.** This matches the
  Checkbox description and the strength caption, and gives better
  contrast.
- **`TextField` (`kit/textField/TextField.tsx`)** is a native `<input>`
  in that frame. It takes every native prop and `ref`, like the Button
  (OQ-136). `type` defaults to `text`. It is controlled only: `value`,
  plus `onChange`, which gets the new string, as the Checkbox's gets a
  boolean. An `id` passed in is used for the input; otherwise one is
  generated. `className` sets layout on the whole field.
  `inputClassName` sets text styling on the input (`tabular-nums`, or the
  backup code's `font-mono` centred look).
- **Look, from the mockups' `.field`.** The box is 46px tall,
  `rounded-[14px]`, with a `bg-bg` fill, a `border-line` border and 14px
  side padding. Text is `type-body-lg` ink with `faint` placeholders.
  Focus draws a mint border and a 3px `mint/15` halo. It uses
  `focus-within`, so it shows for any focus (mouse included), as fields
  usually do, and it stays on while a slot's button has focus. Invalid
  turns the border coral, with a `coral/15` halo on focus. Disabled is
  `opacity-50` with a not-allowed cursor. There is one size: the small
  inline inputs (allocation %, the exchange rate) belong to K8 and K47.
  There is no required marker, since the mockups show none.
- **`leading` / `trailing` slots inside the box** were built ahead of
  need, so K6 and K7 stay thin. They hold the money input's R$ / $
  prefix, the password field's show / hide button and a search icon.
  Slots are muted and size their icons at 18px. An empty slot renders
  nothing.
- **No `type="number"`.** It rejects or empties pt-BR decimals ("10,25"),
  reports `""` mid-typing, changes value on scroll, accepts `e`, and drops
  leading zeros. Numeric text uses `inputMode="numeric"` or `"decimal"`
  and our own parsing.
- **No mask in K5.** Masks change on screen only; the caller always gets
  clean values (digits, minor units, a date). Each mask lives in its own
  input:
  - K7: money, as you type, per locale, giving minor units;
  - K8: percentages and rates;
  - K9: the date, `dd/mm/aaaa` or `mm/dd/yyyy`;
  - K17: the 6-digit code, and the backup code `XXXX-XXXX-XXXX-XXXX`
    (16 characters, as the API issues them — corrected by OQ-139);
  - K48: the card number, grouped as its network writes it (amended by
    OQ-187: Amex and Diners 4-6, the rest in fours). It never leaves the
    form; only `network` + `last4` are sent (FR on PAN storage).

  Caret handling, the hard part of any mask, is written once as a shared
  `useMaskedInput(format, parse)` hook. K17's backup code was the first to
  need it, so it was built there (OQ-139).

**Task 41 (`K5`) is complete.**

### OQ-138: Select / combobox (task K11)
**Confirmed with the stakeholder (Oct 2026):**
- **No mockup draws a dropdown select.** The screens named for K11 use
  other controls: the record drawer picks the account and category with
  chips, the budget form's claim-aware picker is a multi-pick checkbox
  list (mockup 42), and the role is chosen with chips (invite) or a menu
  (member row, K23). **K11 is the fallback for long lists.** A screen
  keeps its chips as drawn and switches to K11 only when the list grows
  too long for a row of chips, e.g. many accounts, or categories with
  their subcategories.
- **A select-only combobox, built on Floating UI** (OQ-131). The trigger
  is a `<button role="combobox">` in the shared `Field` frame (OQ-137).
  It opens a floating listbox in a portal. It is controlled only:
  `value` (`null` while nothing is chosen) and `onChange(value)`. The open
  state, the keyboard position and the search are internal UI state,
  like the popover's. A native `<select>` was turned down because it
  can't draw groups with icons, tags, descriptions or disabled reasons
  in the app's theme.
- **Options.** Each option has a `value` and a `label` (translated), plus
  optional slots: `leading` (a category icon or account dot), `trailing`
  (a currency tag) and `description` (a muted second line, like the role
  menu's). `{ group, options }` entries draw a `type-label` heading over
  a `role="group"`.
- **Disabled means "has a reason".** An option is disabled exactly when
  it has a `disabledReason`, so a disabled option always says why. The
  reason shows as faint trailing text ("in Fun Money", as mockup 42 shows
  claimed categories) and describes the option via `aria-describedby`.
  The row fades to 45%. Arrow keys, typeahead and clicks skip it.
- **Keyboard.** The arrow keys walk the options and loop. Enter or Space
  picks. Esc, a click outside or tabbing away closes the list, and focus
  returns to the trigger. Typing letters jumps to an option, and while
  the list is closed it picks that option, as a native select does.
- **Search is opt-in.** `search={{ label, placeholder, noResults }}` adds
  a search box at the top of the panel, focused on open. The search
  ignores case and accents ("saude" finds "Saúde") and matches option
  labels. A group whose heading matches keeps all its options. Typeahead
  is off while searching, and the search clears when the list closes.
  With nothing left, the panel shows `noResults`. The listbox is the
  list inside the panel, not the panel itself, because a listbox may
  hold only options.
- **Look.** The trigger is the text field's box (46px, `rounded-[14px]`,
  `bg-bg`, `border-line`) with an `expand-more` chevron that turns over
  while the list is open. The mint border and halo show while it is
  focused or open, as mockup 50's open multi-select does; coral while
  invalid. It shows the chosen option's leading slot and label, or the
  faint placeholder. The panel is `OVERLAY_SURFACE`, at least as wide as
  the trigger. Its list scrolls inside after 288px (`max-h-72`). The row
  under the keyboard or pointer gets `bg-ink/5`. The chosen row's label
  turns mint and gets a mint check.
- **`overlayMiddleware({ matchReferenceWidth })`** sets the panel's
  `min-width` to the reference's width (`fitToViewportAndReference`).
  The popover keeps the plain `fitToViewport`.
- **Multi-select stays K12.** It builds on K11's option rows and
  checkboxes (K16).

**Task 42 (`K11`) is complete.**

### OQ-139: Code input and backup code input (task K17)
**Confirmed with the stakeholder (Oct 2026):**
- **Backup codes are 16 characters, `XXXX-XXXX-XXXX-XXXX`.** The API
  issues 80 random bits as 16 Crockford base32 characters
  (`recoveryCodes.bytes: 10`). OQ-137's `XXXX-XXXX` and mockup 09's
  `7HJX-21NA` were wrong; the mockup's value is only an example. The API
  is not shortened, because 80 bits is the right strength for a code that
  replaces the second factor.
- **`CodeInput` (`kit/codeInput/CodeInput.tsx`) is one native input under
  six drawn boxes, not six inputs.** The `<input>` (`inputMode="numeric"`,
  `autoComplete="one-time-code"`) is laid invisibly over the boxes, so OS /
  SMS autofill, password managers, paste, backspace and screen readers
  work natively, with no focus to move between inputs. The boxes are
  `aria-hidden`. The caret stays at the end of the digits, because it is
  invisible and a mid-code edit couldn't be seen. There is no `maxLength`:
  it would cut a pasted "482 193" before the space is dropped.
- **Its value is only digits** (`onChange(digits)`). Anything else typed or
  pasted is dropped, and input stops at `mfa.codeLength` (6,
  `config/constants.ts`, the API's `totp.digits`). `onComplete(code)` fires
  when the last digit is typed. The Flow decides whether to submit then;
  the mockups' Verify button stays.
- **Look, from the mockups' `.digit`.** Each box is 52×60 (`max-w-13
  h-15`, shrinking on narrow screens), `rounded-[14px]`, with a `bg-bg`
  fill, a `border-line` border and `type-display-sm` digits. The box the
  next digit goes in (the last once full) gets the mint border and
  `mint/15` halo while the input has focus. Invalid turns every box coral,
  with a coral halo on that box. Disabled is `opacity-50`. It sits in the
  `Field` frame.
- **`Field` gains `labelHidden`.** The label is then kept for screen
  readers only (`sr-only`), without its action. The MFA challenge (mockup
  08) has no visible label because its heading says what to type.
- **`BackupCodeInput` (`kit/codeInput/BackupCodeInput.tsx`)** is the text
  field in mockup 09's look (`font-mono tracking-[.2em] text-center`). It
  shows the code in dashed groups of 4 (`mfa.backupCode`), with a dash
  only once the next group has begun. Typing is as forgiving as the API's
  `normalizeRecoveryCode`: lower case is raised, O / I / L become 0 / 1 /
  1, and anything else is dropped. The caller holds and gets the clean
  code (no dashes, upper case). It turns off autocorrect and spellcheck,
  and asks for capitals.
- **`useMaskedInput` (`kit/maskedInput/useMaskedInput.ts`)** is the shared
  mask hook OQ-137 planned, built now because K17 needs it before K7. A
  `Mask` is `format(clean)` and `parse(text)`, and `parse` must read each
  character on its own. After each edit the caret is put back after the
  same number of clean characters it followed. A backspace that only
  removed a separator removes the clean character before it instead, so
  the key always does something. It counts from the left. K7's money
  mask, whose digits fill from the right, may extend it when it is built
  (it did: `Mask.anchor`, OQ-188).

**Task 43 (`K17`) is complete.**

### OQ-140: Menu and the role pill (task K23)
**Confirmed with the stakeholder (Oct 2026):**
- **Only the role menu is drawn.** Mockup 60 opens it from a member's role
  pill: a 300px panel of `menuitemradio` rows, each with an icon, a label
  and a muted description, and the current role in mint with a check. No
  mockup draws a row's overflow menu; every row action today is an inline
  icon button (Edit / Archive / Remove). The stakeholder chose to build
  both kinds now, since the activity list names "row actions" too.
- **`Menu` (`kit/menu/Menu.tsx`) is built on Floating UI** (OQ-131), like
  the Popover. `trigger` is a render prop that spreads the ref and the
  ARIA props (`aria-haspopup="menu"`, `aria-expanded`, `aria-controls`) on
  its own button: a `MenuPill` for a role, an `IconButton` (`more-horiz`)
  for a row's actions. `label` (translated) names the menu. Floating UI's
  default naming after the trigger is dropped, because the trigger shows
  the current choice ("Member"), not what the menu is. `placement`
  defaults to `bottom-end`, and `width` is in px (the viewport still caps
  it). It renders in a portal on `OVERLAY_SURFACE`. Open state is
  internal, and there is no `onOpenChange`, since no screen needs it.
- **Entries, in display order:**
  - `action`: an `id`, an `onSelect` and an optional `tone: 'danger'`
    (coral label and icon, for Delete);
  - `radio`: a group with `value` (`null` while nothing is chosen),
    `onChange(value)` and its `options`, drawn in a `role="group"`, named
    when it has a `label`. The caller holds the value, as with K11;
  - `separator`: a `border-line` rule.

  Every row may carry an `icon`, a `description` and a `disabledReason`.
  A row is disabled exactly when it has a reason, as in K11: it fades to
  45% with the reason as faint trailing text (`aria-describedby`).
- **Keyboard and pointer.** A click, Enter, Space or the arrow keys open
  the menu. The keyboard starts on the current choice. The arrow keys
  loop and skip disabled rows. Typing letters jumps forward to the next
  matching row. Enter, Space or a click picks a row: the menu closes,
  then the action or `onChange` runs, so a Flow can open a confirm
  straight from it. Esc, a click outside or tabbing away closes it, and
  focus returns to the trigger.
- **Look, from mockup 60's `.menu`.** The panel has `p-1.5`. Rows are
  `rounded-[10px]` with `px-2.5 py-2`, a 18px icon (muted, mint when
  checked, coral when destructive) and a `type-body font-semibold` label
  over a `type-caption` muted description. The row under the keyboard or
  pointer, and the checked one, get `bg-ink/5`.
- **Shared list rules: `kit/floatingList/listItems.ts`.** The select's
  `typeaheadLabelsOf`, `disabledIndicesOf`, `isPickKey` and
  `pickHandlers` moved there, typed on `{ label, disabledReason }`, so K11
  and K23 walk and pick rows by the same rules.
- **`MenuPill` and `StaticPill` (`kit/menu/MenuPill.tsx`).** This is the
  role pill from mockup 60: 32px, fully rounded, `type-body-sm`.
  - `MenuPill` is the menu's trigger. It is a `border-line` button with
    500-weight text and an `expand-more` chevron that turns over while
    open. While open it gets the `mint/60` border and `mint/15` halo. It
    takes every native prop, so callers give it an `aria-label` that says
    whose role it is.
  - `StaticPill` is the Owner's pill (OQ-133): the same shape as a
    `<span>`, in `bg-mintdeep` with a `mint/50` border, 600-weight mint
    text and an optional leading icon (the crown). It lines up with the
    role pills in the same column.

  The pills don't ripple: OQ-136 keeps the role pill out of K4.

**Task 44 (`K23`) is complete.**

### OQ-141: Toast and inline banner (task K25)
**Confirmed with the stakeholder (Oct 2026):**
- **No mockup draws either one**, so both are built from the design
  tokens. The kit only draws them. AlertUtility (FU3) holds the queue, the
  `success / error / …` API and any cap on how many show at once.
- **Four tones (`kit/alert/tones.ts`):** `success` (mint,
  `check-circle-outline`), `info` (sky, `info-outline`), `warning` (sun,
  `warning-outline`) and `error` (coral, `error-outline`).
  `error-outline` was added to the icon selection for this (OQ-126). An
  error has `role="alert"`, so it is announced at once; the other tones
  have `role="status"`.
- **`InlineBanner`** stays in the page where it applies. It takes the look
  of mockup 41's inline confirm box: `rounded-2xl` (OQ-142), `p-3`, a `tone/30`
  border on a `tone/10` background, the 18px glyph in the tone's colour,
  and `type-body-sm` ink text. It has an optional bold `title` and an
  optional `action` slot (a `Button`). `dismiss: { label, onDismiss }`
  adds a close button; without it the banner stays.
- **`Toast`** sits on the floating panels' surface (`bg-raised`,
  `border-line`, `rounded-2xl`, `shadow-overlay`). It shows the tone's
  glyph, the message, an optional single text action
  (`action: { label, onAction }`, a secondary `sm` Button; a click runs it,
  then closes the toast) and a close button named by `dismissLabel`. It
  rises in over 200ms (`animate-toast-in`) and has no motion under
  `prefers-reduced-motion`. It has no exit animation.
- **Auto-dismiss lives in the kit** (`useAutoDismiss`). Success and info
  toasts close after `toast.durationMs` (5s, `config/constants.ts`).
  Warnings and errors (`toast.stickyTones`) stay until closed. A
  `duration` prop overrides the default; `null` keeps the toast. The timer
  pauses while the toast is hovered or focus is inside it, and starts the
  full time over afterwards.
- **`ToastRegion`** is a named `<section>` portalled to `<body>` with
  `pointer-events-none` between toasts. Its toasts are oldest first, so the
  newest sits at the bottom. On a desktop (`sm` and up) it sits at the
  bottom-right, 24px in, 360px wide. On a phone it spans the width with
  the 16px gutter and sits 96px up (`bottom-24`), clear of the floating
  Record button (mockup 34: `bottom-6`, 56px tall).

**Task 45 (`K25`) is complete.**

### OQ-142: Inline confirm (task K26)
**Confirmed with the stakeholder (Oct 2026):**
- **`InlineConfirm` (`kit/confirm/`)** is the "are you sure?" that opens
  inside the card or row it is about: archive, delete, complete / reopen,
  revoke. It follows mockups 41 and 43. The kit only draws it. The caller
  opens it, runs the request and shows any failure in a banner or toast
  (OQ-141).
- **Two tones.** `destructive` (coral, `warning-outline`, a `danger-solid`
  confirm) is for a step that can't be undone. `reversible` (mint,
  `check-circle-outline`, a `primary` confirm) is for one that can. An
  `icon` prop replaces the tone's glyph.
- **Look:** a `rounded-2xl` box with `p-3`, a `tone/30` border on a
  `tone/10` background, and the 18px glyph with a `type-body-sm` message.
  The `message` is a `ReactNode`, so the caller can bold the item's name.
  Under it, right-aligned, sit a `ghost sm` Cancel and the `sm` confirm.
  The host card's `ring-1 ring-tone/40` is the caller's: the kit exports
  `CONFIRM_RINGS` for its `className`.
- **The radius follows the mockup.** OQ-141's `InlineBanner` had
  `rounded-xl`, though it was meant to copy this box, so it is now
  `rounded-2xl` too.
- **Focus:** when the confirm opens, focus moves to Cancel, the safe
  answer. A cancel (the button, or Escape, which doesn't reach the page)
  gives focus back to what held it before the confirm opened, usually the
  trigger. After a confirm the caller decides, because the item is often
  gone. The box is a `group` named by its message.
- **Busy:** while the caller's request runs (`busy`), the confirm shows its
  spinner and ignores clicks, Cancel is disabled and Escape does nothing.

**Task 46 (`K26`) is complete.**

### OQ-143: Type-to-confirm (task K27)
**Confirmed with the stakeholder (Oct 2026):**
- **`TypeToConfirm` (`kit/confirm/`)** is the last step of Delete Account
  and Household Deletion. The user types a phrase before the confirm
  unlocks. No mockup draws it, so it wears the destructive `InlineConfirm`
  box (OQ-142): `rounded-2xl`, `p-3`, a `coral/30` border on `coral/10`,
  the `warning-outline` glyph and a `type-body-sm` message. Below sit a
  `TextField` (K5), then a `ghost sm` Cancel and a `danger-solid sm`
  confirm. Where the box sits (a page section, or later a dialog) is the
  Flow's choice.
- **The phrase is the item's name:** the household's name for Household
  Deletion, the user's email for Delete Account. The kit takes it as
  `phrase`. The caller also builds the field's `label`
  (e.g. `Type "Casa Silva" to confirm`).
- **Matching (`matchesPhrase`):** spaces around the text are ignored;
  otherwise the match is exact and case-sensitive. An empty phrase never
  matches. The check is only in the UI, since neither DELETE endpoint
  takes the phrase.
- **Paste is allowed.** Blocking it hurts dictation and assistive input,
  and it is easy to get around anyway. Autocomplete, autocorrect,
  autocapitalize and spellcheck are off.
- **Holds no state.** The Flow keeps the typed text ("confirmation text",
  BDT plan) and gets changes through `onChange`.
- **Keys and focus:** the box is a `form` named by its message. Enter
  confirms once the phrase matches. When the box opens, focus goes to
  the field. A cancel (the button, or Escape, which doesn't reach the
  page) gives focus back to the earlier holder. `useConfirmFocus` is now
  generic over the element it focuses (`focusRef`). `cancelOnEscape`
  takes any element's key event.
- **Busy:** a spinner shows on confirm, and submits are ignored. The field
  and Cancel are disabled, and Escape does nothing.

**Task 47 (`K27`) is complete.**

### OQ-144: Password field and the strength meter (task K6)
**Confirmed with the stakeholder (Oct 2026):**
- **`PasswordField` (`kit/passwordField/`)** is the text field (K5)
  with the input masked. It takes all of the text field's props except
  `type` and the trailing slot. Sign in, register, reset and change
  password all use it. The only state it holds is whether the password
  shows; the value stays with the caller.
- **An eye button shows and hides the password, on every password
  field.** The mockups draw plain password inputs, so this is a small
  addition to them, kept "just in case". It is an `xs` ghost
  `IconButton` in the trailing slot. The icon shows what a press does:
  `visibility-outline` while the password is hidden, and
  `visibility-off-outline` while it shows. Its name doesn't change (the
  caller's `revealLabel`, e.g. "Show password"); `aria-pressed` reports
  the state. It is disabled with the field. The input never
  spell-checks, autocapitalises or autocorrects, so a password that
  shows isn't marked up or changed.
- **`StrengthMeter`, as the mockups draw it.** Four `h-1.5` bars with a
  `gap-1`, and a `type-caption text-muted` caption under them. The bars
  filled for each level: too short 0, weak 1 in `coral`, fair 2 in
  `sun`, good 3 in `mint`, strong 4 in `mint`. Create account's mockup
  shows three mint bars labelled "Strong"; that is only an example
  state. The bars are hidden from assistive tech. The input's
  `aria-describedby` points at the caption, so screen readers read the
  strength with the field, and no live region announces every
  keystroke.
- **The meter sits under the box, above the hint or error.** The
  password field passes `strength` (a reading and its caption). This
  adds two things to `TextField`: a `footer` slot under the box, and an
  `aria-describedby` passed in that joins the message's (`joinIds`).
  With no `strength` (Sign in, current password) no meter shows; the
  screens also leave it out until the estimator has loaded.
- **The caption comes from `strengthCaption(reading, translator)`** in
  PasswordStrengthUtility, so register, reset and change password word it
  the same way. It gives the level, then the hint, or the 12-character
  minimum when the password is too short or already strong
  ("Fair · avoid dates and years", "Strong · at least 12 characters").
  The catalog's new `passwordStrength.caption` (`{level} · {detail}`)
  joins the two parts. The kit takes only translated text.

**Task 48 (`K6`) is complete.**

### OQ-145: Two-step sign-in, and the Sign In Flow (task FL1)
**Confirmed with the stakeholder (Oct 2026):**
- **Sign-in takes two requests; this reverses OQ-30's "password and MFA
  code together".** With one request, a wrong code couldn't be told
  apart from a wrong password, so the user had to type everything again.
  Now the user retries only the code, as in most apps.
  - `POST /auth/login {email, password}` answers `{challengeToken}`.
  - `POST /auth/mfa/verify {challengeToken, mfaCode}` answers the tokens.
  - `POST /auth/mfa/recover` now takes
    `{challengeToken, recoveryCode}`.
  - All three are public. The sequences (`uc-14`, `uc-20`), the call
    chains and the EBD Sign In sequence are redrawn through their
    generators.
- **OQ-114's guard against enumeration stays where it matters.** The
  password step still gives one 401 `auth.invalid_credentials` for an
  unknown email and for a wrong password. A missing user still costs a
  password check, so the timing reveals nothing either.
  - The second step names a wrong code (`auth.mfa_invalid`), because
    its caller has already proved the password, so naming the code
    reveals nothing new.
  - A challenge that is expired, forged or names a user who is gone
    answers `auth.challenge_expired`. That error code is new, in both
    catalogs.
- **The lockout covers both steps.** A wrong password and a wrong code
  each count as one failure for the address, and 5 failures in 15
  minutes lock it, as before.
  - Step 2 checks the lock before it checks the code.
  - **Only a full sign-in clears the count.** A correct password does
    not, otherwise repeating the password step would reset the counter
    and allow unlimited code guesses.
- **The challenge token is a stateless JWT.**
  - It is valid for 5 minutes (`authentication.challengeToken`).
  - It carries the user (`sub`) and the address (`email`), and has its
    own audience (`financas-mfa-challenge`). So an access token can't
    be used as a challenge, and a challenge can't be used as an access
    token.
  - `AuthenticationUtility` gets `signChallengeToken` and
    `verifyChallengeToken`.
  - There is no table. Reusing a challenge within its 5 minutes still
    needs a correct code, under the same lockout.
  - Step 2 looks the user up by the address and checks that the id
    still matches.
- **The Sign In Flow (`experiences/authenticate/flows/signIn/`)** holds
  the step (credentials, code or backup code), the email to put back,
  the busy flag and the last failure. The rules for moving between
  steps are pure functions in `signInState.ts`.
  - It never sees the challenge token. The Experience keeps it between
    the two requests.
  - Each request is a callback that resolves to an outcome:
    `{ok: true}`, or `{ok: false, error: {code, params}}`.
  - It also emits `onForgotPassword` and `onCreateAccount`; where they
    lead is the Experience's decision.
  - **A wrong code clears only the code**, by remounting its entry. The
    user then types the code again; the password is not re-entered.
  - **After `auth.challenge_expired` or `auth.too_many_attempts` the
    user goes back to the password step with the email kept.** The
    second case is there because a lock lasts longer than a challenge.
  - A wrong password clears the password and keeps the email.
  - After a successful second step the Flow stays busy while the
    Experience takes over.
- **The Flow's three Interactions:** Credential Entry, MFA Code Entry
  and Backup Code Entry.
  - Each holds what the user typed and emits it when it's submitted.
    Credential Entry checks its fields with ValidationUtility first.
  - All three share `stepParts.tsx`: the heading, the error banner, the
    mint text actions and the back arrow.
  - **The code submits by itself on its sixth digit.** Verify is also
    there, and stays disabled until the code is complete. The backup
    code works the same way at 16 characters.
  - **No countdown to the next code.** Mockup 08's "new code in 18s" is
    dropped, because the authenticator app already shows one.
  - **The back arrow** goes from the code step to the password step, and
    from the backup code step to the code step.
  - Texts are in a new `signIn` catalog section, in both locales.
- **Smaller changes:**
  - ValidationUtility's `FieldError.params` is now typed as
    `MessageParams`, so it goes straight to `translator.field`.
  - The web tests share a `renderInLocale` helper
    (`tests/support/`).
  - ESLint's `max-len` now lets through a line that is nothing but a
    module path (an import or a `vi.mock`). Flow and Interaction tests
    sit 6–7 folders deep.

**Task 49 (`FL1`) is complete.**

### OQ-146: The Household Deletion Flow (task FL10)
**Confirmed with the stakeholder (Oct 2026):**
- **Only the Owner sees it.** The Manage Household Experience mounts
  the Flow only when the caller's role is Owner. Everyone else never
  sees the danger zone. The Flow takes no role.
- **The Flow (`experiences/manageHousehold/flows/householdDeletion/`)**
  holds the step (review or confirm), the typed text ("confirmation
  text", BDT plan), the busy flag and the last failure. Its rules are
  pure functions in `householdDeletionState.ts`.
  - It takes `householdName` (the phrase to type) and one request,
    `onDelete`. `onDelete` resolves to the shared outcome:
    `{ok: true}`, or `{ok: false, error: {code, params}}`.
  - After `ok` the Flow stays busy. The household is gone, and the
    Experience has the App Shell switch to another household or start
    Onboard.
  - A failure (403 `auth.forbidden`, 404 `household.not_found`) shows
    as an error banner under the confirm, translated through
    I18nUtility. The typed name is kept for another try.
- **Consequences Review is mockup 60's danger zone:** the coral-ringed
  section with the warning tile, "Delete household", the consequences
  text and the outline "Delete Household" button (`danger`, `lg`).
- **The type-to-confirm (K27, OQ-143) opens inline,** inside the same
  section, in the button's place. There is no dialog in the kit yet,
  and OQ-143 leaves the placement to the Flow.
  - The phrase is the household's name. The label is
    `Type "{householdName}" to confirm`.
  - A cancel (the button, or Escape) goes back to the review and drops
    the typed text and any failure. The kit gives focus back to the
    element that held it before, but that button has unmounted by
    then, so the review re-focuses its own button when it shows again.
- **The outcome type is shared.** Sign In's `SignInOutcome` and
  `SignInFailure` became `RequestOutcome` and `RequestFailure` in
  `utilities/requestOutcome.ts`. Every Flow's request uses the same
  answer.
- **Texts** are in a new `householdDeletion` catalog section, in both
  locales. pt-BR calls the Owner "proprietário". It is the first place
  the role is named in pt-BR.
- The EBD Household Deletion sequence is redrawn through its generator.
  It now shows the Owner-only mount, the cancel and the failure branch.

**Task 50 (`FL10`) is complete.**

### OQ-147: The Account Recovery Flow (task FL2)
**Confirmed with the stakeholder (Oct 2026):**
- **The Flow (`experiences/authenticate/flows/accountRecovery/`)** holds
  the step (request, new password or done), the reset token, whether a
  link was asked for, the busy flag and the last failure. Its rules are
  pure functions in `accountRecoveryState.ts`.
  - It takes an optional `token` and two requests, `onRequestReset(email)`
    and `onConfirmReset(token, newPassword)`, both answering the shared
    `RequestOutcome` (OQ-146), plus the way out, `onBackToSignIn`.
  - The Experience reads the token from `/reset-password?token=…` and
    passes it in. Without one the Flow asks for a link; with one it
    takes the new password. It reads the token once, on mount.
- **Recovery Request is mockup 03.** After the 202 the "check your inbox"
  note shows under the button (a success inline banner). The form stays,
  so the user can ask again. The note never says whether an account has
  that address, matching the API (OQ-115).
- **New Password Entry is mockup 04.** The strength meter (FU2) is
  advisory, loaded on mount. The checks before a submit: at least 12
  characters (NFR-SEC-4), and the confirmation must repeat the password.
  - The repeat check is a new **client-only field code,
    `password.mismatch`**. The catalog types it as `ClientFieldCode`, and
    the API's 422 details use `ApiFieldCode` (every field code but the
    client's), so the API can't send it. This mirrors `ClientErrorCode`.
  - The mockup's "signed out of every other device" says "every device"
    instead: the reset revokes every session, and the user has none.
- **After a successful reset the Flow shows a done step, Reset Complete**
  (no mockup: icon tile, "Password updated", a "Sign in" button that
  emits `onBackToSignIn`). The user isn't signed in: every session was
  revoked.
- **Failures.** `password_reset.token_invalid` (expired, used or unknown
  link) goes back to the request step with the reason in its banner — a
  new link is the only fix. `password.too_short` shows under the new
  password field. Any other failure shows in the banner, and what was
  typed is kept.
- **Shared step parts.** Sign In's heading, banner, text action and back
  arrow moved to `experiences/authenticate/interactions/stepParts.tsx`,
  since both Authenticate Flows use them. Each Flow keeps its own text
  hook (`signInText.ts`, `accountRecoveryText.ts`).
- **Texts** are in a new `accountRecovery` catalog section, in both
  locales.
- The EBD Account Recovery sequence and the Authenticate tier diagram
  are redrawn through their generator.

**Task 51 (`FL2`) is complete.**

### OQ-148: The Registration Flow (task FL3)
**Confirmed with the stakeholder (Oct 2026):**
- **No terms box in v1.** Mockup 02 draws "I agree to the Terms and
  Privacy Policy", but no requirement asks for it, there are no Terms or
  Privacy pages, and `POST /auth/register` doesn't record acceptance. It
  comes back, stored, once those pages exist. The EBD sequence no longer
  lists "terms".
- **The Flow (`experiences/onboard/flows/registration/`)** holds only the
  busy flag and the last failure; its rules are pure functions in
  `registrationState.ts`. It takes one request, `onRegister(registration)`
  answering the shared `RequestOutcome` (OQ-146), and the way out,
  `onSignIn`. On `ok` it stays busy while the Onboard Experience moves on
  to MFA Enrollment, as Sign In does. The TOTP secret and recovery codes
  the API returns stay with the Experience; they never pass through this
  Flow.
- **Registration Form Entry is mockup 02** without the terms box. The
  checks before a submit: first and last name not blank (the API trims
  them), a valid email, at least 12 characters (NFR-SEC-4), and the
  confirmation repeats the password (`password.mismatch`, OQ-147). Names
  and email are sent trimmed. The strength meter (FU2) is advisory and
  rates the password against the name and email typed.
- **Failures.** `user.email_taken` shows under the email,
  `password.too_short` under the password; anything else in the banner.
  What was typed is kept.
- **Shared parts move up.** The step heading, banner, text action and back
  arrow are now used by two Experiences, so `stepParts.tsx` moved from
  `experiences/authenticate/interactions/` to `experiences/interactions/`
  (one Experience never imports from another). The estimator-loading hook
  became `utilities/usePasswordStrengthEstimator.ts`, used by New Password
  Entry and Registration Form Entry.
- **Texts** are in a new `registration` catalog section, in both locales.
- The EBD Onboard Registration sequence is redrawn through its generator.

**Task 52 (`FL3`) is complete.**

### OQ-149: Confirming MFA enrollment, and the MFA Enrollment Flow (task FL4)
**Confirmed with the stakeholder (Oct 2026):**
- **The backend checks the first code.** Mockup 06's "Verify & continue"
  had nothing to call: registration answers the secret once, and
  `/auth/mfa/verify` takes only a sign-in challenge. The M1 call chain had
  left the check to the web Flow, which could not prove anything. Now:
  - `POST /auth/register` also answers an **`enrollmentToken`** — a JWT
    with its own audience (`financas-mfa-enrollment`) that lasts 15
    minutes (`config/constants.ts`), long enough to install an app and
    scan — and the **`otpauthUri`** the QR encodes, so the issuer and TOTP
    settings stay the backend's.
  - **`POST /auth/mfa/enrollment/confirm {enrollmentToken, mfaCode}`**
    checks the code, confirms the enrollment once (guarded write) and
    opens a session (audit `ConfirmMfaEnrollment`). The new user is signed
    in, which Household Setup needs. A wrong code is `auth.mfa_invalid`
    and counts against the sign-in lockout (OQ-114); a bad, expired or
    already-used token is the new **`auth.enrollment_expired`** (401).
    Sequence `uc-11b-confirm-mfa-enrollment.html`.
- **Sign-in waits for the confirmation (FR-1.15), and can resume it.**
  `users.mfa_confirmed_at` is null until the first code; the migration
  marks existing users confirmed at their creation, and the demo seed
  does too. For an unconfirmed account, the right password makes
  `POST /auth/login` answer a **fresh enrollment** — new secret and
  recovery codes replacing the ones no one saw (guarded: confirmed
  meanwhile → the ordinary challenge), audited `RestartMfaEnrollment` —
  instead of a challenge. So someone who closes the tab before scanning
  is never locked out. The answer is tagged:
  `{step: 'mfa', challengeToken}` or
  `{step: 'enroll', enrollmentToken, totpSecret, otpauthUri, recoveryCodes}`.
  Sending a returning user from Sign In to MFA Enrollment is X1/X2's.
- The token helpers became one pair (sign/verify a step token by
  audience), shared by the challenge and the enrollment token.
- **The Flow (`experiences/onboard/flows/mfaEnrollment/`)** gets the
  enrollment from the Onboard Experience as props — `otpauthUri`,
  `totpSecret`, `recoveryCodes`, `accountEmail` — and one request,
  `onConfirm(code)` answering the shared `RequestOutcome`; `onComplete`
  once the codes are acknowledged. Its rules are pure functions in
  `mfaEnrollmentState.ts` (step, method, busy, last failure). No skip and
  no way back out of the Flow. A wrong code shows in the banner and
  clears the boxes, as in Sign In. `auth.enrollment_expired` is the
  Experience's to handle (sign in again, remount with the fresh
  enrollment) — X2.
- **Steps are mockups 05–07.**
  - *MFA Method Selection* — one option card per `mfa.methods`
    (configuration; the app only in v1), then Continue.
  - *MFA Setup Verification* — the QR (`qrcode.react`, black on white in
    both themes, scanners need the contrast) of the API's `otpauthUri`,
    the setup key in groups of 4 with a copy button, "Account: email",
    the 6-digit code (submits on the last digit), back to the method.
  - *Backup Codes Acknowledgement* — every code the API issued (10, not
    the mockup's 8), Download (a `.txt` with a line naming the account),
    Copy all, and Continue enabled only once "I've saved these" is ticked.
- **Two new Utilities:** ClipboardUtility (`utilities/useClipboardCopy.ts`
  — copy with a two-second "Copied", a refusal logged) and
  DownloadUtility (`utilities/downloadTextFile.ts`). Settings in
  `config/constants.ts` (`mfa.methods`, `mfa.setupKeyGroupSize`,
  `mfa.qrSizePx`, `clipboard.copiedFeedbackMs`).
- **Texts** are in a new `mfaEnrollment` catalog section, in both locales.
- The EBD Onboard MFA Enrollment and Registration sequences and the
  Onboard tier diagram are redrawn through their generator.

**Task 53 (`FL4`) is complete.**

### OQ-150: The Household Setup Flow (task FL5)
**Confirmed with the stakeholder (Oct 2026):**
- **Frontend only.** `POST /households` (UC-1) was already in place: the
  name is trimmed and must not be blank (422 otherwise); category seeding
  stays server-side.
- **The Flow (`experiences/onboard/flows/householdSetup/`)** keeps only
  the busy flag and the last failure (`householdSetupState.ts`, pure). The
  name lives in the Interaction, as Registration's fields do (OQ-148), so
  the EBD and BDT docs no longer list it as Flow state. One request,
  `onCreate(name)` answering the shared `RequestOutcome`; success stays
  busy while the Experience moves on. Every failure shows in the banner:
  the only field-level objection, a blank name, is caught client-side.
- **A way out only from the shell.** The Flow takes an optional
  `onCancel`; the shell passes it when the Flow is reached to add another
  household, and "Cancel" shows under Continue. Onboard leaves it out: a
  new user must create a household.
- **Mockup 10, without its "Ideas" chips.** The suggestions ("The Doe
  Family", "Apt 4B", "Casa da Praia") are dropped, and the field starts
  empty — the mockup's filled-in name is a representative state.
- **Texts** are in a new `householdSetup` catalog section, in both locales.
- The EBD Onboard Household Setup sequence is redrawn through its
  generator.

**Task 54 (`FL5`) is complete.**

### OQ-151: The Delete Account Flow, and the kit's danger zone (task FL8)
**Confirmed with the stakeholder (Oct 2026):**
- **Nothing blocks the deletion.** `DELETE /users/me` is unconditional
  (FR-1.17): FR-1.18's succession runs server-side for each household
  the user owns, and a household with no other member is deleted with
  the account. The BDT row's "blocked while owning households without a
  successor" was wrong and is corrected.
- **The ownership check is a note, not a step.** As mockup 70 draws it,
  the danger zone carries the consequences and, only when the user owns
  households, a note that ownership of each passes to another member
  first (or the household is deleted if no one else is in it), with the
  households' names as tags. The Ownership Check Interaction is folded
  into Consequences Review. The names are tags rather than an "A, B and
  C" phrase because the web has no list formatter until FormattingUtility
  (FU6).
- **The Flow (`experiences/manageProfile/flows/deleteAccount/`)** mirrors
  Household Deletion (OQ-146): step (review or confirm), typed text, busy
  flag, last failure, focus return — pure functions in
  `deleteAccountState.ts`. It takes `email` (the phrase, OQ-143),
  `ownedHouseholds` (names; the Experience filters `GET /households` by
  role Owner) and one request, `onDelete`. After `ok` the Flow stays
  busy while the App Shell signs out; a failure shows in a banner under
  the confirm, the typed email kept. The state file is a sibling of
  Household Deletion's, not shared: the two Flows change independently.
- **`DangerZone` is a kit component (K34 family, `kit/card/`)** with its
  story: the coral section with the warning tile, title, description,
  an outline `danger` button, and the caller's confirm in the button's
  place, re-focusing the button after a cancel. Household Deletion's
  Consequences Review now uses it too. Folded into K34, as the layouts
  were, so the kit count stays at 50.
- **Texts** are in a new `deleteAccount` catalog section, in both
  locales.
- The EBD Delete Account sequence and the Manage Profile tier diagram
  are redrawn through their generator.

**Task 55 (`FL8`) is complete.**

### OQ-152: AlertUtility, the toast queue (task FU3)
**Confirmed with the stakeholder (Oct 2026):**
- **Toasts only.** AlertUtility is the page's toast queue. Inline banners
  stay kit pieces (`InlineBanner`, via `StepAlert`) that the Flow owning
  the state draws, and the "are you sure?" steps are the kit's
  `InlineConfirm` / `TypeToConfirm` (OQ-142, OQ-143). The EBD Utilities
  table and the Manage Household notes said otherwise and are corrected.
- **The queue (`utilities/alerts.ts`, `createAlertQueue`)** is plain
  TypeScript: `show({ tone, message, action?, duration? })` returns an id,
  `dismiss(id)` closes a toast that is shown or still waiting, `visible()`
  is the shown list and `subscribe` follows it.
- **At most 3 on screen** (`toast.maxVisible`, `config/constants.ts`),
  oldest first. Extra toasts wait in order and appear as shown ones close,
  so a sticky error is never pushed out unread. A waiting toast's timer
  starts only once it is shown, because the kit runs the timer.
- **Repeats are ignored.** A toast with the same tone and message as one
  already shown or waiting is not added again, and `show` returns the
  existing toast's id. Once that toast closes, the same message can
  show again.
- **Messages arrive translated.** Callers render them with I18nUtility
  (e.g. `translator.error(code)`), as the Flows do for their banners.
- **React binding (`utilities/AlertProvider.tsx`).** `AlertProvider` is
  mounted in `main.tsx` inside the `I18nProvider`. It draws the shown
  toasts in the kit's `ToastRegion`. `useAlerts()` gives
  `success / info / warning / error(message, { action?, duration? })` and
  `dismiss(id)`. Any tier may call it, as with every Utility.
- **Copy (new `alerts` catalog section):** the region is named
  "Alerts" / "Avisos" (not "Notifications", which is the bell's inbox),
  and the close button says "Dismiss" / "Dispensar".

**Task 56 (`FU3`) is complete.**

### OQ-153: List row (task K45)
**Confirmed with the stakeholder (Oct 2026):**
- **`ListRows` + `ListRow`** (`kit/listRow/ListRow.tsx`) are the mockups'
  people / item rows: members and pending invitations (60), sessions and
  invitations to other households (70), the notification inbox (23) and
  coming due (20). `ListRows` renders a `ul` (optional `label`) and each
  `ListRow` an `li`, so screen readers announce the count.
- **Slots, not variants.** `leading` (an `Avatar`, a `ListRowIcon`, or a
  caller's mark such as coming due's date tile), `title` and `meta` (nodes,
  so a "You" `Tag` or "in 3 months" in sun fits), `trailing` (role pill,
  icon buttons, Revoke, an amount) and `footer` (actions under the text,
  as a notification's Accept / Decline; the row then aligns to the top).
  The row itself is never a click target — no mockup has one.
- **Two surfaces on `ListRows`:** `divided` (default; hairlines between
  rows, none under the last) and `raised` (each row its own rounded
  `bg-raised` card, stacked with a gap — the invitation lists).
- **Sizes normalised:** the title is 14px (`type-body`) everywhere — the
  members list's 16px is aligned down. `titleWeight` is `semibold` (a
  name, cut to one line) or `regular` (a sentence with its own bold parts,
  which wraps — notifications). Meta is `type-caption` muted; the
  notifications' 11.5px faint line is aligned to it. `dimmed` fades a row
  to 60% (a seen notification).
- **`ListRowIcon`** (`kit/listRow/ListRowIcon.tsx`) is a glyph in a tinted
  circle, decorative: tones `neutral` (`bg-ink/5`, theme-safe, replacing
  the mockups' `white/5`) / mint / sky / sun / lilac (Avatar's set); sizes
  `md` 40px (default) and `sm` 36px (dense: notifications, pending
  invitations). The profile's 44px household-invite circle becomes 40px.

**Task 57 (`K45`) is complete.**

### OQ-154: The Security Flow (task FL7)
**Confirmed with the stakeholder (Oct 2026):**
- **Both panels at once, no sub-views.** As mockup 70 draws it, the Flow
  (`experiences/manageProfile/flows/security/`) renders Change password
  and Active sessions side by side. The EBD note's "which sub-view
  active" state is dropped. The state (pure functions in
  `securityState.ts`) is the sessions (loading, failed with a retry,
  or loaded: this device first, then the most recently used), the revoke
  that is out (one session or all the others), whether the "sign out all
  others" confirm is open, whether the password change is out, each
  panel's last failure, and a counter that empties the password form
  after a change.
- **The Flow fetches the list as it mounts.** It takes four requests from
  the Manage Profile Experience: `onLoadSessions`, `onRevokeSession(id)`,
  `onRevokeOthers` and `onChangePassword({ currentPassword, newPassword })`.
  The Experience passes a stable `onLoadSessions`. A successful revoke or
  password change removes the sessions it ended from the list, matching
  what the API did (FR-1.14 signs out every other session), so nothing is
  re-fetched.
- **Device names come from the User-Agent, read on the web.** The API's
  `deviceInfo` is the raw header. `utilities/userAgent.ts`
  (`describeUserAgent`) returns the browser and system brands (never
  translated) and the kind of device. The kind picks the row's glyph:
  laptop for macOS, desktop, phone or tablet. The catalog joins the two
  brands ("Chrome on macOS" / "Chrome no macOS"). With one brand the row
  shows that one; with neither, "Unknown device". The reader belongs to
  FormattingUtility's family (no new Utility). The contract is unchanged.
- **Only "Sign out all others" asks first.** It opens the kit's
  destructive `InlineConfirm` under the panel's header, and the header
  button stays in place so a cancel can give it the focus back. Revoking
  one row happens at once, because the device can simply sign in again.
  While any revoke is out, every other revoke waits. The button is
  hidden when this device is the only session.
- **Successes are toasts (AlertUtility):** "Password changed. Your other
  sessions were signed out.", "Session signed out.", "Other sessions
  signed out." Failures stay inline. In the password panel,
  `password.current_incorrect` shows under the current password,
  `password.too_short` under the new one, and anything else in a banner.
  In the sessions panel, a revoke failure shows in a banner and a failed
  load shows a banner with "Try again".
- **Dates go through the catalog** (`{signedIn, date, ::ddMMyyyy}`), in
  each locale's own order, so they don't wait for FormattingUtility (FU6).
- **Texts** are in a new `security` catalog section, in both locales.
- The EBD Security sequence is redrawn through its generator.

**Task 58 (`FL7`) is complete.**

### OQ-155: The Membership Management Flow (task FL9)
**Confirmed with the stakeholder (Oct 2026):**
- **Three panels, as mockup 60 draws them.** The Flow
  (`experiences/manageHousehold/flows/membershipManagement/`) renders the
  Members list, then Invite someone and Pending invitations side by side.
  The page header and the danger zone (FL10) stay with the Experience. The
  state (pure functions in `membershipState.ts`) is the lists (loading,
  failed with a retry, or loaded: the Owner first, then by role, then the
  longest-tenured; pending invitations only, newest first), the request
  that is out (every control waits on it), the open confirm, each panel's
  last failure, and a counter that empties the invite form after a send.
- **Who sees what comes from the loaded list.** The Flow takes the
  signed-in `selfUserId` and reads their role from the members. An
  Owner/Admin gets the role menus, Remove (never on their own row or the
  Owner's), Invite and Pending; a Member or Viewer sees the members only.
  After a transfer the list itself says the caller is now an Admin.
- **The Flow fetches as it mounts.** It takes six requests from the Manage
  Household Experience: `onLoad` (members, plus invitations for an
  Owner/Admin — they 403 otherwise), `onChangeRole`, `onRemoveMember`,
  `onTransferOwnership`, `onInvite` (answers the created invitation) and
  `onRevokeInvitation`. The Experience passes a stable `onLoad`. A success
  changes the lists as the API did — nothing is re-fetched — except
  `409 household.changed`, which shows in the panel and reloads both lists.
- **Transfer Ownership goes to any member**, not only an Admin: FR-1.20
  and the API both allow it, so the EBD note "pick from current Admins" is
  corrected. The swap button on the Owner's row opens a menu of the other
  members; a pick opens a destructive `InlineConfirm` under the Members
  header ("you will become an Admin"). *(Since OQ-160: in the picked
  member's row.)*
- **Only Remove asks first.** Removing a member opens a destructive
  `InlineConfirm` under the header *(since OQ-160: in that member's row)*. Revoking an invitation happens at once
  — it can simply be sent again — so the EBD's single "Remove/Revoke
  (confirmed)" Interaction is split: Remove Member Confirm is its own
  Interaction, revoke lives in Pending Invitations. A role change applies
  at the pick; picking the current role sends nothing.
- **Leave Household stays a standalone Interaction** of the Experience
  (built with X4). The Flow takes a `selfActions` slot that it renders on
  the signed-in user's row, after the Owner's transfer button.
- **Invite:** ValidationUtility checks the email (required, well formed);
  the role is a `SegmentedControl` starting on Member. The invitee codes
  (`invitation.invitee_not_registered`, `already_member`,
  `already_pending`) show under the email; anything else in a banner.
- **The roles are reference data** (EBD Step 5): `household` in
  `config/constants.ts` lists the assignable roles, the invite default,
  the managing roles and the list order. Labels and what each role may do
  are in the catalog.
- **Successes are toasts (AlertUtility)**; failures stay inline in their
  panel. **Dates go through the catalog** — "since 03/2024"
  (`::MMyyyy`) and "sent 12/10/2026" (`::ddMMyyyy`, not the mockup's
  relative "3 days ago") — so they don't wait for FormattingUtility (FU6).
- **Texts** are in a new `membership` catalog section, in both locales.
- The EBD Membership Management sequence is redrawn through its generator.

**Task 59 (`FL9`) is complete.**

### OQ-156: The App Shell (task S1)
**Confirmed with the stakeholder (Oct 2026):**
- **React Router v7, declarative mode** (`react-router`): `<Routes>`, the
  history API and real addresses, so email links (`/reset-password?token=…`,
  OQ-147) and deep links work. The routing table
  (`apps/web/src/shell/routes.ts`) lists every page with who may open it:
  - `signedOut`: Sign In, Registration, Forgot / Reset Password. A
    signed-in user is sent on, to where Sign In was asked for, else the
    Dashboard.
  - `signedIn`: Onboard (`/setup`) and Create household
    (`/households/new`), with no chrome.
  - `household`: every page inside the chrome. A signed-out user goes to
    Sign In, carrying `{ from }` in the navigation state. Only an on-site
    path is followed back (`//host` isn't).

  The addresses are in `config/constants.ts` (`shell.paths`). The main
  nav is built from the same table. An unknown address goes to the
  Dashboard.
- **The shell never calls the backend; the owners hand it their data.**
  `ShellConfig` (`shell/shellConfig.ts`) holds the following, built by the
  composition root (`App.tsx`):
  - each page's element;
  - the chrome's data as hooks from the owning Experiences: identity and the
    pending-invitation count from Manage Profile, the households from
    Manage Household, and the inbox (unseen count, panel, dismiss) from
    Review Insights;
  - the handlers for Sign Out (Authenticate) and Export audit log (Review
    Insights);
  - the notification routing table;
  - the page's theme controller.

  Until each X task plugs in its own, `placeholders.tsx` stands in: every
  page is "Coming soon", the data never loads, Sign out ends the session in
  this browser only, and there is no bell. The file goes away with the last
  Experience.
- **Session state lives in the store's `shell` slice**
  (`shell/shellState.ts`). A page loads signed in when a refresh token is
  kept. Authenticate and Onboard dispatch `sessionStarted` once they hold
  tokens; the signed-out guard then takes the user on. `api/sessionEnded`
  (from the API client, Sign Out, or another tab) signs the user out. A
  store listener then clears this tab's tokens and resets the API cache, so
  the next user sees nothing cached. `S1` creates the store
  (`src/store.ts`), with the thunk extra `{ api, shell }`.
- **Cross-tab sign-out (OQ-124's follow-up):** `watchSignOutElsewhere`
  listens for the `storage` event on the refresh-token key, or a cleared
  storage. Another tab's sign-out ends this tab's session at once.
- **The active household is remembered** (`shell.householdStorageKey`).
  The household gate waits for the households, then picks:
  - the current household if the user still belongs to it, else the
    remembered one, else the first;
  - with no households at all, the user goes to Onboard;
  - a failed load shows a retry.

  The chrome renders only once a household is active.
- **Switch Household is the shell's own thunk, not Manage Household's.**
  The EBD tier diagram routed the switcher to "Manage Household's Switch
  Household", but the switch calls no endpoint. It sets the active id,
  remembers it, and resets the API cache (OQ-124), so every Experience
  fetches again for the new household. Manage Household has nothing to
  add, so the routing entry is dropped from the tier diagram and the BDT
  row moves to the shell. Create household opens Onboard in signed-in
  mode; Pending invitations opens Manage Profile.
- **Notification routing is configuration:** a `NotificationRoutes` table
  maps each type to its owning Experience's handler. The handler reports
  `done` or `failed`; the shell dismisses the notification (the inbox
  owner's `dismiss`) only after `done`. An unknown type is `unrouted`; the
  inbox shows its generic text. The table starts empty; X3 / X7 add their
  entries and I12 checks the seam.
- **The saved theme and language win once the profile loads**
  (OQ-122, OQ-123). The shell applies them through the page's one theme
  and locale controller.
- **Chrome, as mockups 20–24 and 34 draw it:**
  - a sticky 64px header (menu button, brand, bell);
  - an overlay drawer at every width (312px, or the screen less 48px on a
    phone), under the header, over a scrim. Esc, a scrim click or any pick
    closes it, and focus returns to the menu button. It is exposed as the
    page's navigation landmark, not a dialog, and doesn't trap focus;
  - the page column, 1400px at most, with gutters of 16 / 24 / 48px.
- **Two departures from mockup 21:**
  - the switcher's rows show the role only. `MyHousehold` has no member
    count, so "Owner · 4 members" becomes "Owner";
  - Records (Export audit log) is hidden from a Member or Viewer rather
    than captioned "Owner/Admin", which leaves the caption nothing to say.
- **Texts** are in a new `shell` catalog section in both locales; role names
  reuse `membership`.

**Task 60 (`S1`) is complete.**

### OQ-157: The Authenticate Experience (task X1)
**Confirmed with the stakeholder (Oct 2026):**
- **One Experience, two journeys** (`experiences/authenticate/
  AuthenticateExperience.tsx`). Each route gives the Experience an `entry`:
  `signIn` (`/sign-in`) or `recovery` (`/forgot-password` and
  `/reset-password`). It draws the active Flow on the kit's auth layout. It
  is the only tier here that calls the backend: its endpoints are in
  `experiences/authenticate/api.ts`, and all of them are mutations.
  - **The challenge token stays in the Experience** (a ref) between the two
    sign-in requests (OQ-145). It never reaches the Flow.
  - Forgot password, Create account and Back to Sign In navigate with the
    current navigation state. That keeps `{ from }`, so Sign In still
    returns the user where they were going.
  - **The reset link's token is read once and then taken out of the address
    bar** (`replace`), so it doesn't stay in the history. The Flow already
    holds it from mount (OQ-147).
- **A session starts through `startSession(tokens)`**, a new thunk in
  `shell/shellState.ts` that Onboard (X2) will reuse. It stores the tokens,
  then dispatches `sessionStarted`. After that, the signed-out guard takes
  the user on (OQ-156).
- **An unconfirmed enrollment is resumed inside Authenticate.** When the
  password step answers `step: 'enroll'` (OQ-149), the Experience shows
  Onboard's MFA Enrollment Flow in place of Sign In. This follows the way
  Onboard hosts Account Setup's Flows. The enrollment comes from the
  answer, and the account email from what was typed.
  - The confirmed tokens are held, and **the session starts only once the
    backup codes are saved.** Starting it at confirm would let the guard
    take the user away before they have seen the codes.
  - A wrong code is left to the Flow. `auth.enrollment_expired` shows a
    toast (AlertUtility) and returns to Sign In, whose password step issues
    a fresh enrollment.
  - A user with no household then reaches Onboard through the shell's
    household gate. No new route is needed, and nothing depends on X2.
- **Sign Out** (`experiences/authenticate/signOut.ts`) is the thunk behind
  the drawer's button (`ShellActions.signOut`). It sends `POST /auth/logout`,
  then `sessionEnded`. The order matters, because the logout needs the
  access token.
  - **A logout that fails (no answer, server error) still signs the user
    out here.** The user asked to leave. The API client logs the failure,
    and the server session lapses, or the user revokes it from Security.
  - `placeholders.tsx` no longer stands in for Sign Out or the three auth
    pages.
- **`toRequestOutcome` (`api/outcome.ts`)** turns an endpoint's result into
  the shared `RequestOutcome`. A failure keeps only the `code` and `params`.
  An exception thrown while sending (an RTK Query `SerializedError`) becomes
  `internal.unexpected`. Every Experience uses it.
- **Tests (BDT):** the Experience runs on the real store with its Flows
  stubbed, and only `fetch` is faked. The tests cover every documented
  answer: 200 mfa / enroll, 401 `invalid_credentials` / `mfa_invalid` /
  `challenge_expired` / `enrollment_expired`, 429, 202, 400
  `token_invalid`, 422, and no answer. Sign Out is tested both answered and
  unanswered.
- The EBD Sign In sequence (the enroll branch, `startSession`, Sign Out) and
  the Authenticate tier diagram are redrawn through their generator. No new
  texts.

**Task 61 (`X1`) is complete.**

### OQ-158: The Onboard Experience (task X2)
**Confirmed with the stakeholder (Oct 2026):**
- **One Experience, three routes** (`experiences/onboard/
  OnboardExperience.tsx`). Each route gives it an `entry`, and each entry
  opens one stretch of the journey:
  - `registration` (`/register`, signed out): Registration, then MFA
    Enrollment, on the auth layout;
  - `household` (`/setup`, the household gate's target): Household Setup on
    the wizard layout, with no way out;
  - `additionalHousehold` (`/households/new`, the switcher's Create
    household, OQ-81): Household Setup with a Cancel, which opens the
    Dashboard.

  Its endpoints are in `experiences/onboard/api.ts`, and all of them are
  mutations.
- **The server's state is the progression.** Nothing is kept on the client
  to resume a drop-off. An enrollment never confirmed is resumed by Sign In
  (OQ-157). A user with no household is sent to `/setup` by the household
  gate. The EBD's "progression state" is the route.
- **After registering, the household gate takes over.** The secret,
  recovery codes and enrollment token stay in the Experience. The session
  starts only once the backup codes are saved. The signed-out guard then
  goes to the Dashboard, and the gate, finding no household, goes to
  `/setup`. Onboard doesn't navigate there itself, because that would race
  the guard's redirect.
  - Until X4 supplies the households list (`useHouseholds`), the gate
    shows its skeleton. The flow can't be completed in the browser before
    then.
- **A new household becomes the active one.** `switchHousehold(id)`
  remembers it and resets the API cache, so the gate fetches the list
  again. Then the Dashboard opens. Guided Setup is added in between with
  X2G (task 95).
- **The MFA enrollment step is Onboard's, and Authenticate hosts it.**
  `experiences/onboard/MfaEnrollmentStep.tsx` holds the following, moved
  out of Authenticate:
  - the confirm call: `POST /auth/mfa/enrollment/confirm`, moved from
    `authenticate/api.ts` to `onboard/api.ts`;
  - the session held until the codes are saved;
  - the `auth.enrollment_expired` toast, then `onExpired`.

  Onboard leaves through `onExpired` to Sign In, keeping `{ from }`.
  Authenticate goes back to its Sign In view. This is the one place where
  one Experience imports another's piece, in the way Onboard will host
  Account Setup's Flows.
- **Contract fix:** `Household` now lists `id`, `name` and `createdAt` as
  required. The API always sends them, and the generated type had them
  optional.
- **Fix found while testing: the enrollment QR code couldn't be scanned.**
  The theme clears Tailwind's palette (`--color-*: initial`), so the
  wrapper's `bg-white` produced no CSS. The QR then sat on the card with no
  quiet zone, and neither Authy nor a phone camera found it. The QR now
  draws its own white margin: `mfa.qrQuietZoneModules`, 4 modules, the QR
  standard's quiet zone. `mfa.qrSizePx` grows to 150, mockup 06's whole
  tile.
  - **The nav drawer's scrim had the same cause**: its `bg-black/50`
    produced no CSS either. It is now a theme token, `bg-scrim`
    (`--s-scrim`): 55% black in the dark theme, as mockup 21 draws it, and
    ink-tinted at 40% in the light one, as its overlay shadow is.
- **Tests (BDT):** the Experience runs on the real store with its Flows
  stubbed, and only `fetch` is faked. They cover 201, 409
  `user.email_taken`, 422 `password.too_short`, no answer, 401
  `mfa_invalid` / `enrollment_expired`, the household's 201 and 422, and
  Cancel. Authenticate's enrollment tests still cover the step as it hosts
  it.
- The EBD Onboard Registration, MFA Enrollment and Household Setup
  sequences, the Sign In sequence and both tier diagrams are redrawn
  through their generator. No new texts.

**Task 62 (`X2`) is complete.**

### OQ-159: The Manage Profile Experience (task X3)
**Confirmed with the stakeholder (Oct 2026):**
- **One page, as mockup 70 lays it out** (`experiences/manageProfile/
  ManageProfileExperience.tsx`, route `/profile`): the header (avatar, name,
  "email · Role of Household" for the active household), Personal info and
  Preferences, the Security Flow, the invitations, then the Delete Account
  Flow. A skeleton shows while the profile loads, and a failed load offers a
  retry. Its endpoints are in `experiences/manageProfile/api.ts`.
- **Manage Household's households list comes in now, ahead of X4.** The
  household gate needs it before any household page can open, and Manage
  Profile needs it for the role and the households owned.
  `experiences/manageHousehold/api.ts` holds `GET /households` and the
  shell's `useHouseholds`, and Manage Profile reads it from there. This is the
  same kind of cross-Experience import as OQ-158's enrollment step. X4 adds
  the rest to that file.
- **Manage Profile hands the App Shell** `useIdentity` (`GET /users/me`) and
  `usePendingInvitationCount` (`GET /users/me/invitations`) through
  `shellSources.ts`. The profile page reads the same cache, so a saved name
  shows in the drawer at once. With all three sources provided,
  `placeholderSources` is gone. `api/sourceState.ts` turns a query hook's
  flags into a `SourceState`.
- **Edit Personal Info:** first and last name, neither blank, sent trimmed.
  The email is shown locked with its note. Save stays off until a name
  differs from the saved one. A refused save shows in the panel's banner and
  keeps what was typed. A done save toasts "Profile saved." and the panel
  starts again from the saved names.
- **Edit Preferences has no Save.** Each pick is sent at once
  (`PATCH /users/me {preferences: {theme} | {language}}`). The pick is written
  into the cached user before the answer arrives, so the shell's
  `useSavedPreferences` applies it at once, through the same controller as on
  load. If the API refuses it, the change is undone and an error toast says
  so. Names are not written early, so a refused save never resets the form.
  - The theme is the kit's option-card tiles (K14) with thumbnails. Each
    thumbnail draws its theme in that theme's own tokens: `data-theme` now
    scopes either theme on any element (`[data-theme='dark']` joins `:root`
    in `theme.css`).
  - The language is the kit's segmented control (K13) rather than the
    mockup's bordered chips. Language names are in their own language, the
    same in both catalogs, with the mockup's flags. English is listed first.
- **Respond to Invitation is one thunk with two entry points**
  (`respondToInvitation.ts`): the profile's panel, and the bell, through the
  shell's `invitation.received` route (`invitationRoute`, which reads
  `params.invitationId`). It accepts or declines, toasts the outcome ("You
  joined {household}." / "You declined the invitation to {household}.", named
  from the cached list, with a plain fallback), and reports `done` or
  `failed`. A 404 or 409 is toasted from the catalog. Either answer fetches
  the invitations again, and an accept also fetches the households.
  **Accepting doesn't switch households**: the new one appears in the
  switcher. The panel is hidden when no invitation is waiting. The inviter is
  "Someone" once their account is gone (OQ-82). While one answer is out, every
  other answer waits.
  - The composition root takes the page's toasts and translator from its
    providers and hands them to the route (`shellConfigFor`'s third
    argument).
- **Delete Account:** the Flow gets the email and the names of the households
  the user owns. After a done delete, the Experience toasts "Your account was
  deleted." and dispatches `api/sessionEnded`. The shell's guard then opens
  Sign In.
  - **The API's `DELETE /users/me` arrives with task 136 (`M1D`, the
    Delete User cascade).** Until then the API has no route for it and
    answers 404 `route.not_found`, which the Flow shows in its banner as
    "Not found.", the email kept, as OQ-151 places a failure. Task 142
    (`I13`) checks the deletion end to end.
- **Contract fix:** `User`, `Session`, `ReceivedInvitation` and
  `MyHousehold.role` now list the fields the API always sends as required.
  The generated types had them all optional.
- **Tests (BDT):** the Experience runs on the real store, with its Flows and
  standalone Interactions stubbed and only `fetch` faked. The tests' flush
  waits for an animation frame: the store's default auto-batching tells React
  about RTK Query's answers on the next frame. Each Interaction, the shell
  sources, the thunk and the route each have unit tests.
- **Texts** are in a new `profile` catalog section, in both locales.
- Two new EBD sequences, Manage Profile Personal Info & Preferences and
  Respond to Invitation. The notification-routing sequence and the Manage
  Profile and Manage Household tier diagrams are redrawn through their
  generator.

**Task 63 (`X3`) is complete.**

### OQ-160: The Manage Household Experience (task X4)
**Confirmed with the stakeholder (Oct 2026):**
- **One page, as mockup 60 lays it out** (`experiences/manageHousehold/
  ManageHouseholdExperience.tsx`, route `/household`): the header, the
  Membership Management Flow (FL9), Leave Household, then the Household
  Deletion Flow (FL10), which only the Owner sees (OQ-146). A skeleton shows
  until the user and the active household are known; a failed user load
  offers a retry. The page is keyed on the active household, so a switch
  starts it afresh. Its endpoints are in `experiences/manageHousehold/api.ts`.
- **The header** names the household and counts its members ("4 members ·
  shared accounts, budgets, and goals are visible to everyone here."). The
  count comes from the members list, which the Experience caches per
  household (`GET /households/:id/members`); it shows once the members load.
  - The Flow still owns its own lists (OQ-155). A role change, remove or
    transfer also fetches the cached members again, so the header and Leave
    Household stay right. A transfer fetches the households too: the user is
    now an Admin there, so the danger zone goes.
- **The Flow's load** asks for the members and the invitations together. A
  403 on the invitations (a Member or Viewer) means none; any other failure of
  either is handed to the Flow. The invitee's email (`inviteeEmail`) is the
  Flow's `email`. The created invitation is answered as `{id, role,
  createdAt}`.
- **Leave Household is its own card above the danger zone**, not an action
  on the user's row: mockup 60 has no place for it. FL9's `selfActions` slot
  stays, unused. The card says what leaving does for this user, then "Leave
  household" opens a destructive `InlineConfirm` in the button's place.
  Cancel or Escape brings the button back, focused. A failure shows in a
  banner in the card. The confirm's open state is the Interaction's own;
  the request and its failure are the Experience's.
  - **What leaving does** (`interactions/leaveConsequence.ts`): anyone but
    the Owner loses access. For the Owner, the successor is named in
    FR-1.18's order: the longest-tenured Admin, else Member, else Viewer.
    That is the members list's own order. The API decides; this is a preview.
  - **An Owner who is alone may leave.** The card warns that leaving deletes
    the household, as the API does (FR-1.18).
  - Leaving is `DELETE /households/:id/members/:userId` with the user's own
    id (OQ-27). It fetches nothing for the household, which is no longer the
    user's.
- **Once the household is left or deleted** (`householdExit.ts`): a toast
  says so ("You left {household}." / "{household} was deleted."). The
  households are fetched again. The App Shell's `switchHousehold` moves to
  the next one, resetting the API cache, and the user lands on its Dashboard.
  With none left, the user goes to Onboard (`/setup`). When the list can't
  be fetched, the cache is reset anyway, so the shell's gate asks again and
  offers its retry.
- **Two corrections to FL9 (OQ-155), from the stakeholder's review:**
  - **No "You're the Owner" beside the Members heading.** It repeated what
    the user's own row already shows, so it is gone, though mockup 60
    draws it. Member List no longer takes `selfRole`.
  - **A confirm opens in place of the row it is about**, not under the
    header. Removing a member turns that member's row into the destructive
    `InlineConfirm`; a transfer does the same in the picked member's row.
    Nothing above the list moves. Member List takes `confirm` as
    `{userId, element}`. The remove button went with its row, so once the
    row is back after a cancel, its Remove takes the focus again, unless
    something else already holds it.
- **The kit's Tooltip (K24, task 124) comes in now, ahead of order:** the
  members list's icon buttons (Remove, Transfer ownership) had nothing
  saying what they do. `kit/tooltip/Tooltip.tsx`, with its story:
  - **Opt-in**, a `<Tooltip content>` around the trigger. `IconButton` doesn't
    add one by itself.
  - **An inverted chip:** ink background, the page's colour for the text,
    caption size, no arrow, on top (it flips when out of room).
  - It shows after the pointer rests for `tooltip.openDelayMs` (400ms,
    `config/constants.ts`), or at once on keyboard focus. It goes on leave,
    blur, Escape or a press. Touch never shows it.
  - **Two ways to attach it.** A render function gets the props for an
    enabled trigger. `triggerProps` merges another floating trigger's, so a
    Menu's button carries one too. Any other content is wrapped in a
    focusable span, for a disabled control's reason (K24's "disabled
    reasons").
  - The tooltip describes its trigger (`aria-describedby`). With
    `repeatsName` (an icon button whose `label` it repeats), it is hidden
    from assistive tech instead, so the name isn't read twice.
  - Chart-point tooltips belong to the charts (K38), not here.
- **Contract fix:** `HouseholdMembership`, `Invitation` and
  `HouseholdInvitation` now list the fields the API always sends as required.
- **Tests (BDT):** the Experience runs on the real store, with both Flows and
  Leave Household stubbed and only `fetch` faked. The Experience tests'
  stub, fake `fetch` and waits moved to `tests/unit/experiences/
  experienceFakes.tsx`, shared with Manage Profile's. Leave Household, its
  consequence, the exit thunk and the endpoints' translation each have unit
  tests.
- **Texts** are in a new `household` catalog section, in both locales.
- A new EBD sequence, Manage Household — Leave Household. The Membership
  Management and Household Deletion sequences and the Manage Household tier
  diagram are redrawn through their generator.

**Task 64 (`X4`) is complete.**

### OQ-161: The identity seam, end to end (task I7)
**Confirmed with the stakeholder (Oct 2026):**
- **I7 drives the real web app against the real API** — Playwright, the
  test database, nothing mocked (`tests/e2e/identity/`). It covers X1–X4:
  - **Authenticate:** the two-step sign-in with a real authenticator code
    and signing out; a wrong password's localized message; a backup code
    that works once, and only once.
  - **Onboard:** registration → MFA enrollment (the code computed from the
    setup key on screen) → backup codes → first household → the Dashboard.
  - **Manage Profile:** personal info saved; theme and language applied at
    once and restored from the server; a changed password is the one Sign
    In accepts.
  - **Manage Household:** invite → accept (in a second browser session);
    a role change; Transfer Ownership; Leave as Owner with a successor;
    deleting the household.
  - **Not here:** password reset (the console email provider has no test
    sink), Delete Account (`DELETE /users/me` comes with `M1D`; I13 covers
    it), the bell (notifications aren't built).
- **Cadence by BDT tier.** The journeys that are Core E2E journeys (#1
  without its Categories check, #2, #3, #4) are tagged `@core` and run
  after merge; the rest are Full E2E (untagged, nightly).
- **Preconditions are arranged through the API** (`tests/e2e/support/
  identityApi.ts`): other users, households and memberships are created
  with direct requests, so only the behaviour under test goes through the
  browser. Each test registers its own users (unique emails), so tests never
  share state or a login-lockout bucket.
- **Elements are found by what the user reads**, in en-US: the config runs
  the browser in en-US and `tests/e2e/support/text.ts` renders the shared
  catalog's messages. A reworded string can't break a journey; a removed key
  fails typecheck. The authenticator's codes come from `otpauth`
  (`support/totp.ts`). The support helpers are E2E code, like
  `global-setup.ts`: documented, not unit-tested.
- **Fix found by I7 — a new account starts in the language it registered
  in.** Registration sent no language, so every account was pt-BR (the
  column default), and an en-US user's app switched to Portuguese as soon as
  their saved preference loaded, mid-onboarding. `POST /auth/register` now
  takes an optional `language` (pt-BR when absent); Onboard sends the locale
  the page shows; IdentityManager stores it. FR-1.21 says so; the uc-11
  sequence and the Onboard — Registration EBD sequence are redrawn.
- **Running E2E locally** needs the database (`pnpm db:up`) and Playwright's
  Chromium; `PLAYWRIGHT_CHROMIUM_PATH` points at a system one instead.

**Task 66 (`I7`) is complete.**

### OQ-162: Refresh-token reuse grace (code review, phase 2)
**Confirmed with the stakeholder (Oct 2026):**
- **The problem, found by the E2E suite.** The access token lives in memory
  only (OQ-30), so every page load exchanges the refresh token. A page
  reloaded after the API rotated the token, but before the browser stored
  the new one, presents the old token on its next load. That token is
  "replaced", so replay detection (OQ-100/106) ended the session: a quick
  double reload could sign the user out. Reproduced under load in about 1
  reload in 200.
- **The decision: a short reuse grace.** Within
  `authentication.refreshToken.reuseGraceSeconds` (10 s) of a rotation, the
  token that rotation replaced earns a new pair instead of ending the
  session. After the window, the replay rule applies as before.
  - IdentityManager decides; `SessionAccessor.reissueReplaced` applies it
    as a guarded write: only while the presented token is the session's
    replaced one, the rotation happened at or after the window's start, and
    the session is unexpired.
  - The token issued in between, which the reloaded page never stored,
    becomes the remembered replaced one. Whoever still holds it is caught
    as a replay later, so theft detection survives the grace.
  - The last use is not updated, so the window stays anchored to the
    rotation and can't be stretched by reusing the token again and again.
  - No schema change: `last_used_at` already marks the last rotation.
  - A reuse is logged (`info`), a replay still warns.
- **Rejected:** keeping the access token in `sessionStorage` (makes the
  race rarer, doesn't remove it, and widens the token's exposure); leaving
  it as a known issue.
- The uc-14b sequence is redrawn.

### OQ-163: Architecture review fixes (code review, phase 3)
**Confirmed with the stakeholder (Oct 2026):**
- **Delete Account waits for its endpoint.** The Delete Account Flow (task
  55) shipped in slice 1, but `DELETE /users/me` is the Delete User cascade,
  task 136 (`M1D`), in slice 5. The page offered an action that failed.
  - Manage Profile takes a `deleteAccount` setting, defaulting to
    `profile.deleteAccount` in the web's `config/constants.ts` (off). Task
    136 turns it on.
  - **A contract-routes check** (`apps/api/tests/integration/
    contractRoutes.test.ts`) compares `openapi.yaml` with the routes the
    API mounts: every operation is routed or listed as still on the plan
    (by slice, or by task); nothing on that list is routed already; and the
    API mounts nothing the contract lacks. A Flow can no longer reach for
    an endpoint nobody planned to build yet without the gap being written
    down.
- **Shared identity reads have one home.** OQ-158 called Authenticate
  hosting Onboard's enrollment step "the one place" one Experience imports
  another's piece. OQ-159 then had Manage Profile read `useHouseholds` from
  Manage Household's slice, and Manage Household read
  `useGetCurrentUserQuery` from Manage Profile's. The current user and the
  households are read by several Experiences and, as sources, by the App
  Shell, so they now live in `apps/web/src/api/identityApi.ts`:
  `getCurrentUser`, `listHouseholds` and the `useHouseholds` source. The
  Experience slices keep their own endpoints and invalidate the shared
  tags. The enrollment step stays OQ-158's single hosting decision.
- **`SourceState`** (loading / ready / failed with a retry) moves from the
  shell's configuration to `utilities/sourceState.ts`: a display type the
  shell's Interactions take, and that `api/sourceState.ts` builds from a
  query. `api/` and `shell/` no longer import each other's types.
- **The household-role vocabulary lives with the other value lists.**
  `Role` and `AssignableRole` move from `householdAccessor.ts` to
  `db/schema/values.ts`, beside `ROLES` and `SystemRole`; authorization,
  the Manager and the Accessors import them from there. The routes map the
  Manager's results (`Member`, `UserHousehold`, the invitations, `User`),
  re-exported by `managers/identity`, and no longer import an Accessor.
  The audit sink keeps `NewAuditEntry`: producing that record is its job.
- **No Interaction or Experience reaches into a Flow's state for helpers.**
  `fullName` moves to `utilities/personName.ts` (formatting; FormattingUtility,
  FU6, can absorb it). `sortMembers` — the members' order, also FR-1.18's
  succession — moves to `experiences/manageHousehold/memberOrder.ts`,
  generic over anything with a role and a join date: the Flow lists members
  by it and Leave Household names the successor from it. Interactions still
  take their Flow's prop types.
- **Authenticator codes work once (E9, RFC 6238 §5.2).** A code used to be
  accepted again for as long as it was valid (about 90 s with one step of
  drift each way).
  - `AuthenticationUtility.verifyTotp` now answers the code's time step
    (or nothing).
  - `UserAccessor.consumeTotpStep(userId, step)` is a guarded write: it
    records the step only when later than `users.mfa_last_totp_step`, so
    two simultaneous uses can't both pass. Migration `0008` adds the
    column; restarting an enrollment clears it.
  - IdentityManager's MFA step and enrollment confirmation accept a code
    only when its step was used up; a reused code is answered like a wrong
    one (401 `auth.mfa_invalid`, counted against the lockout).
  - E2E: the TOTP helper remembers each secret's last step and uses the
    next step's code (accepted as drift) or waits for the clock; sessions
    for "another device" sign in with a backup code; the test timeout is
    60 s. The login and enrollment-confirm sequences and call chains are
    updated.

**Phase 3 of the code review is complete.**

### OQ-164: A review closes every slice (code review, wrap-up)
**Confirmed with the stakeholder (Oct 2026):**
- **The slice-1 review is closed.** Three phases, each found, decided and
  fixed in its own PRs:
  - tests (mutation testing): #72 (backend), #73 (web and packages);
  - the Playwright suite: #74 (incl. OQ-162);
  - code and architecture: #75 (OQ-163).

  The record is `docs/architecture/12-code-review-2026-10.md`.
- **Every slice now ends with the same review, as a gate.** The plan gets
  `R<n>` items: R1, done, after task 66, and R2–R6 at the end of slices
  2–6. The next slice starts only once its gate is ticked.
- **The method is written down** (`docs/architecture/13-slice-review.md`):
  three phases, one at a time; findings before fixes; one PR per phase,
  each verified the way its findings were found. Each review gets its own
  `<nn>-slice-<n>-review.md`.
- **The tooling stays in the repo:**
  - `pnpm mutation:api` and `pnpm mutation:web` (`scripts/mutation.sh`),
    with `stryker.api.config.json` and `stryker.web.config.json`;
  - the memory watchdog;
  - the command runner (the Vitest runner reports false survivors under
    Vitest 5);
  - the web run's per-file `vitest related` scope.
- **Left open, and planned:** a password-reset E2E journey needs a test
  email sink (the provider is `console` only). It is part of `V3` (Full
  E2E, task 147); which sink is a decision for then.

### OQ-165: Backend ValidationUtility (task U3)
**Confirmed with the stakeholder (Oct 2026):**
- **The contract first, the Utility for the rest.** The route already checks
  every request against the contract's generated schemas (OQ-93). Anything a
  JSON schema can say is said there; `ValidationUtility`
  (`apps/api/src/utilities/validation.ts`) holds only what it can't:
  - `nonBlank`: text that is blank once trimmed;
  - `minLength`: a length the Manager answers with its own code
    (`password.too_short`);
  - `moneyWithin`, `dateWithin`: bounds that come from another field (a
    range's start) or from the request (today, by the Manager's clock).

  Whether a field is required, its type, enum and format stay the
  contract's, so every rule lets a field that wasn't sent through.
- **The Utility reports, the Manager answers.** `checkFields(values, rules)`
  returns `FieldDetail[]` — `{field, code, params}` in the existing field
  codes, no new catalog keys — and the Utility touches no HTTP. The
  Managers' shared `requireValidFields` (`apps/api/src/managers/validation.ts`)
  throws 422 `validation.failed` with them, through the same
  `validationFailed` the route's contract check now uses, so both 422s have
  the same shape.
- **A blank name is answered as `string.min` with `{min: 1}`**, the code the
  contract's own `minLength: 1` produces for `""`, so `""` and `"  "` read
  the same however they arrive.
- **v1 currencies are BRL and USD, in the contract.** A new `Currency`
  schema (`enum: [BRL, USD]`) is referenced by every `currency` and
  `targetCurrency` field, in requests and responses, so the route refuses
  anything else (`field.invalid_option`) and the web app gets the type.
  Adding a currency means adding it there. The database keeps its
  `^[A-Z]{3}$` checks, a fact about the data. The version stays 1.1.0: no
  client sends a currency yet.
- **Slice 1 moved onto it.** The routes' hand-written
  `z.string().trim().min(1)` name schemas broke OQ-93's "nobody
  hand-writes a request schema". They are gone, and IdentityManager trims
  and checks the names itself: Register (uc-11), Edit User (uc-13), Create
  Household (uc-01). The password minimum goes through `minLength`. The
  sequences and call chains are redrawn with the `ValidationUtility` step
  (supersedes OQ-116's "names trimmed at the route").
- **Known behaviour:** the contract check runs first, so a request that
  fails it (say, a malformed email) does not also list a blank name; that
  one is reported once the request is otherwise well formed.

### OQ-166: BudgetAccessor (task A10)
**Confirmed with the stakeholder (Oct 2026):**
- **FR-4.7 is per scope, and the Account decides where a spend goes.** A
  Category/Subcategory is claimed at most once in the household's shared
  scope and at most once in each member's personal scope (the existing
  partial unique indexes). So "Groceries" can sit in one shared Budget and
  in Ana's personal Budget at once. A transaction accrues to the Budget in
  its **Account's** scope: a shared Account's spend counts toward the
  shared Budget, a personal Account's toward its owner's personal Budget.
  Each spend counts toward one Budget only. Making it one claim per
  household was weighed and rejected: a personal Budget nobody else can
  see would block everyone else's claim with a 409 they can't explain.
- **Target writes are atomic.** `insert(budget, targets, month)` and
  `replaceTargets(householdId, budgetId, targets)` each claim the whole
  set in one transaction, and the first refusal rolls everything back:
  `target_claimed` (with the claiming Budget's id) or `target_not_found`
  (not this household's). This supersedes the sequence diagrams'
  per-target `assignTarget`/`releaseTarget` loop, which could leave a
  half-saved Budget behind a 409.
- **FR-4.7 enforcement.** The literal duplicate is the partial unique
  index firing (23505). The rollup half (a Category reserves its
  Subcategories, both ways) is checked in code before the insert, while
  holding the parent Category's row lock (`FOR UPDATE`), so two concurrent
  claims on one Category tree run one after the other. One Budget may hold
  a Category and one of its own Subcategories.
- **Budget Periods (FR-4.9): created at insert, then lazily.** `insert`
  opens the current month's period. Every target change writes the
  current month's period (opening it if needed), and any later period
  already opened follows. So the target in effect for a month is always
  the latest period at or before it. `accrueIfClaimed` opens a missing
  month with that target, which gives a backdated spend the target of its
  own month. A spend dated before the Budget's first period isn't
  tracked. Months come from the Manager in the app time zone (OQ-104),
  so the Accessor does no time-zone maths.
- **`accrueIfClaimed(spend)`** takes `{scope, currency, categoryId,
  subcategoryId, amount, date}`. It matches by exact Subcategory or by
  Category rollup (FR-4.8) in the spend's scope and currency (FR-4.7
  leaves at most one match), adds `amount` (negative to reverse), and
  returns `accrued` or `untracked`. It locks the Budget (`FOR SHARE`) so a
  concurrent delete can't slip in before the period is written.
- **Reads:** `findById`, `list(householdId, viewerUserId, {visibility,
  limit, offset})` (shared Budgets plus the viewer's own personal ones, by
  name, with a total) and `listPeriods(householdId, budgetId, from, to)`.
  `update` changes name and/or target and never touches a past period.
  `delete` is the FR-4.10 hard delete (periods survive, `budget_id` →
  NULL).
- **Not here yet:** Delete User's cascade (personal Budgets deleted, shared
  ones' owner cleared) waits for `M1D` (task 136), like the other
  Accessors.

### OQ-167: ValuationSnapshotAccessor (task A12)
**Confirmed with the stakeholder (Oct 2026):**
- **Keyed by Holding, not household.** A Holding reaches its household
  only through its Account, and the Manager already loads the Holding
  (`InvestmentHoldingAccessor.get`, scoped to the household) to check it
  is market-priced, so that call is the household guard. Manual edits and
  deletes take `(holdingId, snapshotId)`: a snapshot of another Holding is
  `not_found`, never touched. Taking a `householdId` and joining through
  `investment_holdings` → `accounts` on every call was weighed and
  rejected as a second guard reading two other tables.
- **Manual writes:** `insertManual(holdingId, {valuation, asOfDate})`,
  `updateManual(holdingId, snapshotId, changes)` and
  `deleteManual(holdingId, snapshotId)`. The update/delete is guarded by
  `source = 'manual'` in its `WHERE`; a miss is then told apart as
  `automatic` (409 `snapshot.automatic_not_editable`) or `not_found`
  (404 `snapshot.not_found`, a new code that ships with `M2`).
- **Automatic writes:** `insertAutomatic`, `updateAutomatic(transactionId,
  value)` and `deleteAutomatic(transactionId)`. Deleting the transaction
  needs no call (FK cascade); `deleteAutomatic` stays for an edit that
  takes a transaction off its Holding while the transaction survives.
- **Reads:** `list(holdingId, {from?, to?})`, newest first, for the value
  history; `latestAsOf(holdingIds, date)`, one row per Holding, for net
  worth and Goal progress. Same-date snapshots are ordered by
  `created_at`, the later-written winning (then `id`, a UUIDv7). A
  by-month series waits for `ReportingEngine`, when its shape is known.
- **Fixed-term Holdings never get a snapshot (OQ-51)** is a Manager
  decision, so the BDT row moves that check to the Manager seam suites.

### OQ-168: GoalAccessor (task A13)
**Confirmed with the stakeholder (Oct 2026):**
- **A Goal stores only percentages of Holdings, never amounts.** Progress
  is always current value × percentage, computed on read, so the value
  source can change (manual values today; a market-price API later — a
  future idea, its own `MarketPriceAccessor` and its own decision on
  provider and coexistence with manual values) without touching Goals.
- **One allocation write: `replaceAllocations(householdId, holdingId,
  shares)`, replace-all, all or nothing**, for both Managers. It supersedes
  the per-pair `allocate` loop on the bundled buy (OQ-54), which could leave
  half the split written behind a 409 — the same fix OQ-166 made for
  Budget targets. The Holding row is locked `FOR UPDATE`, so two allocation
  writes on one Holding run one after the other.
- **A buy's allocations split the purchase, not the Holding.** Buying into
  an existing market-priced Holding (OQ-50 accumulate) re-weights the whole
  split by value, so every Goal keeps exactly its money: existing value =
  existing quantity × **this buy's unit price** (fresh and exact, not the
  latest snapshot, not cost basis). E.g. a Holding worth 900 funding
  Retirement 60% / Trip 20%, plus a buy of 100 for Car 100% → 1,000:
  Retirement 54%, Trip 18%, Car 10%. Whole percents (OQ-87) are rounded by
  largest remainder; the small drift each buy leaves is accepted (editable
  in Edit Holding). A share that rounds to 0% is dropped. A sell or
  redemption keeps the percentages — every Goal shrinks proportionally.
  This re-weighting is `TransactionManager`'s (built with it), which then
  calls `replaceAllocations`; the purchase's own split still can't pass 100%.
- **Completed Goals (FR-8.9): kept or removed, never grown or added.** In
  Edit Holding a pair on a completed Goal passes only unchanged (same
  percentage) — the form resubmits the full list — or by being left out;
  a new pair or a changed percentage is refused with 409 `goal.completed`
  (a new code that ships with `M2`). A buy's re-weighting of existing pairs
  is exempt (the Goal's money doesn't change); a buy naming a completed Goal
  for new money is refused the same way.
- **Business rules live in the Managers.** Visibility (another member's
  personal Goal is `404 goal.not_found`, never revealed) and the
  completed-Goal rule are checked by the Managers before calling, using
  `findByIds` and `listAllocations({ holdingId })`. A shared Holding may
  fund a personal Goal. The Accessor keeps only household isolation
  (`goal_not_found` for another household's Goal), the FR-8.3 100% cap as
  the data model places it (`allocation_exceeds_100` with `current` and
  `requested` totals) and `holding_not_found`. A Goal listed twice is
  ValidationUtility's to refuse (the unique pair index would throw).
- **Goal writes:** `insert`, `update` (name, target amount, **target
  currency** — allowed, progress is derived on read — and due date),
  `complete` (idempotent, keeps the first time), `reopen`, `delete` (hard;
  allocations cascade, Holdings stay). Reads: `findById`, `findByIds`,
  `list(householdId, viewerUserId, status)` — shared Goals plus the viewer's
  personal ones, soonest due first, unpaginated as `GET /goals` is — and
  `listAllocations({ holdingId } | { goalIds })`.
- **Deleting a user's Goals** (cascade personal, null `owner_user_id` on
  shared) ships with `M1D`.

### OQ-169: AccountAccessor (task A5)
**Confirmed with the stakeholder (Oct 2026):**
- **Transactions older than the Account are allowed.** The day an Account
  is added to the app is not the day the real account opened, so a user
  may record a transaction dated before it.
- **The starting balance is the balance on the day the Account is
  created (an anchor).** That day is stored as
  `accounts.starting_balance_date` (the Manager sets it to the creation
  day). A movement dated **on or after** it moves the balance as usual,
  from its month on. A movement dated **before** it was already in the
  starting balance, so it only rebuilds the history behind it: its month
  opens `amount` lower and every earlier month opens and ends `amount`
  lower; the current balance never changes. E.g. R$1,000 entered on
  17 Oct, then a R$200 expense dated 10 Aug: Aug opens at R$1,200, today
  stays R$1,000. Weighed and rejected: refusing older transactions, and a
  starting balance meaning "before the first recorded transaction" (it
  would move today's balance and force the user to know an old balance).
  The anchor is the **day**, not the month: an expense dated 3 Oct is in a
  balance entered on 17 Oct.
- **Why the anchor (discussed and agreed with the stakeholder).** A
  transaction has three independent effects — the Account balance, the
  Budget, and the Holding (and through it the Goals) — and only the
  balance follows the anchor. Compared against the old app (`financas`:
  one row per month opened from the previous month's closing, no
  propagation to later months, `initialBalance` stored but never used):
  - *Forbidding transactions before the creation day* is simpler but
    breaks onboarding: investments already owned could not be
    registered (OQ-53 makes a past-dated investment buy the only way in,
    and a fixed-term instrument needs its real purchase date for its
    schedule), so Goals could not count money already saved; and the
    first month's Budget would miss the spends before the user joined.
  - *Carrying every movement forward* counts that history twice: a CDB
    bought in 2024, or groceries bought on 3 Oct, would leave today's
    balance even though the starting balance already excludes them.
  - *The anchor* gets all three right: today's balance stays equal to
    the bank's, Holdings and Goals are complete with their real dates,
    and Budgets count the days before joining.
- **Onboarding investments already owned.** Create the investment Account
  with the starting balance = the **uninvested cash** in it today (not the
  investments' value). Record one investment buy per position, dated when
  it was bought (a market-priced position may be one buy at the average
  price); fixed-term instruments take their rate, purchase and maturity
  dates. The Goal split can be given on the same buy (OQ-54). Each buy
  before the starting-balance date fills history only — cash stays — while
  the Holding gets its real dates and schedule and funds its Goals at
  once. Market-priced Holdings then take today's value as a manual
  valuation (OQ-56); fixed-term ones need nothing more (OQ-51).
- **Budgets follow the transaction's date only, never the anchor**
  (OQ-166, unchanged). A Budget starts in the month it is created; a
  spend counts in its own month in the Budget claiming its Category in
  the Account's scope; spends dated before the Budget's first month are
  not tracked. So spends recorded for the days of the joining month
  before the account was created count toward that month's Budget
  without moving the balance. Budget history for months before joining is
  not offered (spending reports still show those months); a "start this
  Budget in an earlier month" option was noted and left out.
- **The UI must explain the starting balance** where an Account is
  created — the onboarding wizard's Add Account step (mockup 11) and the
  Accounts page's Add Account form (mockup 40): it is today's balance (for
  an investment Account, the uninvested cash); anything dated earlier can
  still be recorded, fills in history, Budgets and investments, and never
  changes it. The mockups are revised for this before `FL11`/`X2G`.
- **`applyMovement(accountId, { amount, currency, date })`** — the
  diagrams' `applyMovement(accountId, amount, currency)` gains the date,
  without which no month can be moved. Refused with `currency_mismatch`
  (FR-2.2) or `account_not_found`, writing nothing. Undoing a movement
  (edit, delete) is the same call with the amount negated. The Account row
  is locked `FOR UPDATE`, so two movements on one Account run one after
  the other. Keyed by Account — the Manager has already loaded it within
  the household (OQ-167).
- **An archived Account takes no transactions** — the TransactionManager
  refuses them before calling (Manager decides, Accessor applies).
- **Only an Account's creator may change its visibility** (share it or
  remove the share), and an Account turned personal goes back to its
  creator — `owner_user_id` already holds the creator (identity if
  personal, provenance if shared), so an edit never changes the owner.
  AccountManager checks the creator. A shared Account whose creator left
  (owner nulled, FR-1.17) can no longer be made personal.
- **The month chain has no gaps.** Months with no movement between the
  chain's ends and a new movement's month are filled, opening and ending
  at the carried balance, so `account_month_balances` is a complete
  balance-by-month history (FR-5.4/FR-6.6). Reads: `listBalances(accountId,
  { from?, to? })` by month, and `balancesAsOf(accountIds, month)` — each
  Account's latest month at or before it (the current balance is the one
  as of today's month; ReportingEngine reads month ends).
- **Account writes:** `insert` (the Account plus its first month row at
  the starting balance), `update` (name and visibility — never type,
  currency or owner, OQ-32), `archive` (one way, keeps the first time, OQ-34). Reads:
  `findById`, `list(householdId, viewerUserId, { visibility? })` — shared
  Accounts plus the viewer's personal ones, open first then archived, by
  name; unpaginated (a household has a handful), so `GET /accounts`'s
  limit/offset is applied by the Manager.
- `CalendarMonth`/`monthOf` moved out of BudgetAccessor into
  `accessors/calendarMonth.ts`, shared by both month-row Accessors.
- **Deleting a user's Accounts** (cascade personal, null `owner_user_id`
  on shared — FR-1.17) ships with `M1D`.

### OQ-170: CreditCardAccessor (task A6)
**Confirmed with the stakeholder (Oct 2026):**
- **A billing cycle is named by the month it closes in.** A day up to the
  card's closing day is in the cycle closing that month; a later day is in
  the next month's. A closing day past a short month's end closes on its
  last day (31 → 28/29 Feb). `credit_card_month_balances.year/month` hold
  that cycle, not a calendar month. Weighed and rejected: naming it by the
  due month (how Brazilian banks name a bill) — every label would move
  when the due day is edited; the UI can still say "due on …".
- **Editing the closing day never changes the past.** The closing day in
  force when a movement is written decides its cycle; past cycles stay as
  they are. Undoing an old movement after an edit may land in another
  cycle — the outstanding balance stays right, only how the past splits
  across cycles can drift. Re-bucketing past transactions was rejected:
  it rewrites history and would read CardTransactionAccessor's table.
- **One `applyMovement(cardId, { amount, currency, date })`**, replacing
  `applyChargeOrRefund` / `applyBillPayment`: the two differed only in
  sign, and the sign is the Manager's decision (Manager decides, Accessor
  applies) — a charge +, a refund or a bill payment −. Same shape as
  `AccountAccessor.applyMovement` (OQ-169), runtime cost identical, less
  code. Undo (edit, delete) is the same call negated. Refused with
  `currency_mismatch` (the card takes its Account's currency, FR-2.2) or
  `card_not_found`, writing nothing. The card row is locked `FOR UPDATE`.
- **A bill payment moves both sides** (OQ-15): `AccountAccessor.applyMovement`
  debits the paying Account and `CreditCardAccessor.applyMovement` lowers
  the card. The Record/Edit/Delete Transaction diagrams showed only the
  card side on record and only the Account side on undo; fixed with this
  task.
- **No starting-balance anchor for cards** (FR-2.10: no starting figure):
  every movement carries forward. A charge dated before the chain's first
  cycle (a card added mid-cycle) grows the chain backward, opening at 0.
- **Writes:** `insert(card, today)` — the card plus its first cycle row at
  0, in the cycle `today` falls in; `update(accountId, cardId, changes)`
  and `remove(accountId, cardId)` — keyed by the Account being edited, so a
  card id from another Account changes nothing (FR-2.9, OQ-35). Removing
  is a hard delete taking the card's Card Transactions and balances; bill
  payments keep the paying Account's history, unlinked (`SET NULL`).
  Which Accounts take cards (FR-2.7) and whether a network is known are
  AccountManager's checks. **For `M2`:** Budget spend accrued by a removed
  card's charges stays counted unless AccountManager reverses it.
- **Reads:** `findById(householdId, cardId)` (household guard through the
  Account), `listByAccounts(accountIds)`, `listBalances(cardId, range)`,
  `balancesAsOf(cardIds, month)`. `MonthRange` moved to `calendarMonth.ts`;
  `cycleOf` lives in `accessors/billingCycle.ts`. The demo seed's card row
  now sits in its billing cycle.

### OQ-171: InvestmentHoldingAccessor (task A11)
**Confirmed with the stakeholder (Oct 2026):**
- **The Manager signs both deltas of a trade:** `applyTrade(holdingId,
  { quantityDelta, costBasisDelta })`. A buy adds its quantity and what was
  paid; a sell or redemption removes its quantity and its **average cost**
  (cost basis × sold ÷ held), computed by `TransactionManager`, which keeps
  both deltas with the transaction so an edit or delete undoes them exactly
  (the same call negated). The Accessor refuses a quantity
  (`insufficient_quantity`) or cost basis (`cost_basis_below_zero`) below
  zero under the Holding's row lock, writing nothing. Weighed and rejected:
  the Accessor applying the average-cost rule itself — a business formula
  in an Accessor. `applyTrade` lost its `valuation` and `date`: the
  automatic snapshot is ValuationSnapshotAccessor's (OQ-167) and a Holding
  has no dated history.
- **Archiving stays the Manager's separate call.** `applyTrade` returns the
  new position; `TransactionManager` calls `archive(by=system)` at 0 and
  `unarchiveIfSystemArchived` above it (FR-5.8, OQ-80). `archive` keeps the
  first archive.
- **Re-buying a zeroed market-priced Holding reopens it.** `findByTicker
  (accountId, assetType, ticker)` includes archived Holdings, so the buy
  accumulates into the system-archived one and un-archives it — one Holding
  per ticker per Account, its value history continuing. **Its old Goal
  split is cleared by the buy, not at zero:** at quantity 0 the old shares
  are worth 0, so OQ-168's re-weighting drops every one and the new buy's
  split is the only one left (a new buy has its own purpose). Clearing at
  zero was rejected: undoing the zeroing sell would bring the Holding back
  (OQ-80) without its split. **Before `TransactionManager`'s tests are
  written, every test of this behavior is walked through with the
  stakeholder.**
- **A schedule is replaced whole until it starts:** `applySchedule(holdingId,
  entries)` replaces every entry (so editing a fixed-term buy can recompute
  it) and is refused with `schedule_started` once an entry has posted.
  `markEntryPosted(entryId)` marks an unposted entry, called by
  `TransactionManager` in the database transaction that posts it; `false`
  means a repeated event delivery, which then posts nothing.
  `findDueScheduleEntries(today)` returns each entry's id and Account.
- **A matured Holding's recipients are the Manager's.**
  `findMaturedWithPosition(today)` (redemption date before today, quantity
  > 0, not archived, not yet notified) returns the Account's household,
  owner and visibility; `AccountManager` notifies the owner of a personal
  Account and, for a shared one, the members from
  `HouseholdAccessor.listMembers` — the Accessor never reads memberships.
  `markMaturedNotified` marks once.
- **The rest:** `insert(holding)` opens a Holding with no position (its
  buy's `applyTrade` sets one) and refuses an Account that is
  `credit_card_only` (`account_not_allowed`, OQ-76) or unknown; a fixed-term
  rate and the debenture flag are set only here. Reads: `findById
  (householdId, holdingId)` (household guard through the Account — OQ-167's
  `get`), `listByAccounts(accountIds, { includeArchived })`,
  `listSchedule(holdingIds)`.
- **Gap for `AccountTransactionAccessor`:** `account_transactions` has no
  column for a trade's quantity or cost-basis delta, which Edit/Delete
  Transaction need to undo it. Added with that task.

### OQ-172: IndexRateAccessor (task A14)
**Confirmed with the stakeholder (Oct 2026):**
- **One value per index per day, refused — never overwritten.** Recording
  a second value for an index's day, or editing a value onto a day that
  already has one, returns `duplicate_day` (the unique index firing) →
  409 `index_rate.duplicate_day`. The contract's `PATCH` had no 409; added.
  Weighed and rejected: an upsert — an edit could silently delete another
  row.
- **No future-dated values.** `ValidationUtility`/`AccountManager` refuse
  an `asOf` after today (422 `index_rate.invalid`), so `latest(householdId,
  indexCode)` is simply the highest date, as the data model says, and
  `InvestmentProductEngine.project` needs no "today". Weighed and
  rejected: storing announced future values and reading `latest ≤ date`.
- **Writes are keyed by the route:** `update(householdId, indexCode,
  valueId, changes)` and `remove(householdId, indexCode, valueId)` touch
  only that household's value of that index, else `not_found` (404
  `index_rate.not_found`) — the same guard-in-the-WHERE as
  CreditCardAccessor (OQ-170). The index of a value never changes (the
  body has none). An empty change reads the value back.
  `insert(householdId, {indexCode, value, asOfDate}, actor)` records who
  entered it; clearing `created_by_user_id` on user deletion (FR-1.17)
  ships with `M1D`. The index code's validity is the Manager's check
  (in-code list, no DB CHECK).
- **The Rates tab's list is `AccountManager`'s.** `GET /index-rates` is a
  plain list of entities `AccountManager` owns, so by the read-ownership
  rule (VBD §3) it serves it via `list(householdId)` — by index, newest
  first — grouping into `IndexRateSeries` with each index's unit from
  `INDEX_CODES`. The View Investments sequence had placed the route under
  `InsightsManager`; fixed with this task.

### OQ-173: CategoryAccessor (task A9)
**Confirmed with the stakeholder (Oct 2026):**
- **A Category edit is one atomic call.** `update(householdId, categoryId,
  {name?, icon?, color?, subcategories?: [{id?, name}]})` runs in one
  transaction: a listed Subcategory with an `id` is renamed, one without is
  created, unlisted ones are untouched (archiving has its own route). An
  `id` that isn't under this Category refuses the whole edit
  (`subcategory_not_found`); another household's Category is `not_found`.
  An empty change reads the Category back. Weighed and rejected: the UC-02
  diagram's per-entry `upsertSubcategory` loop — a failure midway left the
  edit half-applied. UC-02 updated. The 404/422 mapping of these refusals
  lands with `AccountManager` (M2); the contract's `editCategory` and
  archive routes have no 404 yet.
- **The Accessor also refuses an unknown icon or colour.** `insert` and
  `update` return `invalid_icon`/`invalid_color` for a value outside
  `CATEGORY_ICONS`/`PALETTE_TOKENS` (`@financas/reference`), as a second
  line behind `ValidationUtility`'s 422. No DB CHECK — the icon set and
  palette are in-code lists that grow.
- **Default seeding is guarded to once per household.** `seedDefaults
  (householdId, language)` takes the household's row lock and inserts
  nothing when the household already has a Category (or no longer exists),
  returning `false`. The bus is at-most-once today (OQ-102), so this only
  bites under a future at-least-once transport — cheap insurance.
- **Names are not unique** — neither Categories in a household nor
  Subcategories in a Category; the data model has no index.
- **Archive keeps the first time.** `archive(householdId, categoryId)`
  stamps the Category (`coalesce`) and its live Subcategories with the same
  `now()`; already-archived ones keep theirs. `archiveSubcategory
  (householdId, categoryId, subcategoryId)` touches only that row, scoped by
  household and Category from the route. Both return `false` when not found.
- **Reads:** `findById` returns every Subcategory, archived included;
  `list(householdId, {includeArchived})` leaves archived Categories and
  Subcategories out unless asked. Both sort open first, then by name.
- **Raised, not resolved here:** FR-3's "a chosen Subcategory must belong
  to the chosen Category" has no owner — `TransactionManager`'s Accessor
  list doesn't include `CategoryAccessor`. To settle with the Record
  Transaction work.

### OQ-174: AccountManager (task M2)
**Confirmed with the stakeholder (Oct 2026):**
- **Household data routes are nested under `/households/{householdId}`.**
  The contract never said which household `POST /accounts`, `GET
  /categories`, `/budgets`, `/goals` or `/index-rates` act in, yet every
  Accessor needs one. Every household-data path (accounts, credit cards,
  categories, budgets, holdings, index rates, goals, transactions,
  dashboard, reports) moved under `/households/{householdId}/…`, like
  invitations and the audit export already were; `GET /accounts`'s
  `householdId` query parameter is gone. Weighed and rejected: an
  `X-Household-Id` header (hidden context, declared on every operation)
  and a query/body field (inconsistent between verbs). The version stays
  1.1.0: no client calls these routes yet. Every sequence and EBD diagram
  showing these routes was redrawn. The `/households/*` guard mounted
  with the household routes admits only signed-in USERs on all of them,
  so the token is checked once.
- **Built only what slice 2 needs, each read where it belongs.** A plain
  list of a Manager's own entities is that Manager's (read-ownership
  rule, VBD §3): AccountManager serves Goal definitions (`GET …/goals`,
  `GET …/goals/{goalId}`) now, for Goal Management and Guided Setup;
  progress, a reshaped read, stays `InsightsManager`'s (`M4`), on its own
  route, when it is built. The contract's Goal reads change with the
  Goals part of this task.
- **Removing a Credit Card keeps the Budget spend its charges accrued.**
  The money was spent; Budget Periods are history and survive even a
  Budget delete (FR-4.10). Reversing it would need `CardTransactionAccessor`,
  which isn't AccountManager's. Weighed and rejected: refusing to remove
  a card with charges, and reversing the spend on removal.
- **Built in five parts, one PR each** (as `M1` was): ① Categories and
  the `household.created` → `seedDefaults` subscription; ② Accounts and
  Credit Cards with their balance histories; ③ Budgets; ④ Goals; ⑤
  investment administration — Edit Holding, archive Holding, manual
  market values, schedule entries, index rates and the `holding.matured`
  subscription.
- **Categories are shared data nobody owns.** They record no creator, so
  the permission table reads them as shared data with no owner: any
  member but a Viewer may create one; viewing is everyone's; editing
  (Subcategories included) and archiving are Owner/Admin — a Member
  cannot edit a Category they created. Recording a creator (a migration)
  was left for when a Member needs it.
- **The icon set is a contract enum** (`CategoryIcon`), like the colour
  (`CategoryColor`) — what a JSON schema can say is said there (OQ-165),
  so the route refuses an unknown icon (`field.invalid_option`) and the
  web app gets the type. A test keeps both enums equal to
  `CATEGORY_ICONS` / `PALETTE_TOKENS` in `@financas/reference`. The
  Accessor's `invalid_icon`/`invalid_color` (OQ-173) is answered the same
  way, on the field. A Subcategory in an edit now requires its `name`.
- **Category answers:** another household's (or a missing) Category is 404
  `category.not_found`; a Subcategory id not under the Category — in an
  edit body or on the archive route — is 404 `subcategory.not_found`
  (new codes, both locales). Blank names, the Category's and each
  Subcategory's, are 422 with `subcategories[i].name` paths
  (`ValidationUtility.checkItems`). An empty edit reads the Category back
  and is not audited. Every write is audited (`CreateCategory`,
  `EditCategory`, `ArchiveCategory`, `ArchiveSubcategory`).
- **Seeding runs as the system** on the event's correlation ID and logs
  whether the defaults were inserted; a failure reaches the bus's error
  sink (`onHandlerError`), never the household's creator.
- **Shared Manager plumbing moved out of IdentityManager:** the household
  access check (`managers/access.ts`: `requireAccess`, with an optional
  entity 404 for someone else's personal data) and the request context
  types (`managers/requestContext.ts`), so no Manager imports another.

### OQ-175: AccountManager part 2 — Accounts and Credit Cards (task M2)
**Confirmed with the stakeholder (Oct 2026):**
- **An Account read carries its balance and cards.** `Account` gains
  `currentBalance` (the stored month row as of today's month) and
  `cards`, each with `outstandingBalance` (its latest cycle at or
  before the one today falls in, by its closing day — OQ-170). One
  request fills the Accounts page and the record drawer's card list.
  These are stored rows read back, not a computation, so it stays a
  plain read of AccountManager's own entities (VBD §3 read-ownership
  rule). `GET …/accounts/{accountId}/credit-cards` is gone. Weighed and
  rejected: separate calls per Account (N+1 requests per page).
- **Writes across Accessors share one transaction:
  `UnitOfWorkUtility`.** Creating an Account with cards, and an edit
  with card changes, write through AccountAccessor and
  CreditCardAccessor together or not at all. The composition root
  builds the Accessors over one transaction and hands them to the
  Manager's work (`deps.inTransaction(work)`); a throw rolls everything
  back. The writes inside run one at a time (a nested write is a
  savepoint on the shared connection). Every check runs before the
  transaction opens, so a refused request writes nothing; a card or
  Account gone meanwhile is 404 and rolls the edit back.
  `TransactionManager`'s record cascade will use the same Utility.
  Weighed and rejected: validating first and accepting a half-written
  request on a database fault.
- **An archived Account can't be edited** — name, visibility and cards
  alike: 409 `account.archived`. Archiving is one-way (FR-2.4);
  archiving again is a 204 that writes and audits nothing.
- **Card changes are `cards: {add, edit, remove}`** on the Account edit
  (OQ-35), replacing the `CreditCardInput` list with its `_remove`
  flag: a new card needs every field (`CreditCardNew`), an edit names
  its `id` and any fields (`CreditCardEdit`), a removal is an id. The
  network is a contract enum (`CardNetwork`) kept equal to
  `CARD_NETWORKS` in `@financas/reference` by a test (as OQ-174 did for
  icons); `last4` is four digits, days 1–31, expiry month 1–12, year
  2000–2100. Adding a card to an investment Account is 422
  `account.cards_not_allowed` (FR-2.7); an edited or removed id not on
  the Account is 404 `credit_card.not_found`.
- **Who may do what:** a personal Account is its owner's alone (any
  role — a Viewer may create and manage one); a shared one follows the
  table (create: Owner/Admin/Member; edit/archive: Owner/Admin, or the
  Member who created it — OQ-111). Only the creator may change the
  visibility (FR-2.3) — anyone else gets 403, unless they send the
  visibility it already has. Someone else's personal Account, and a
  card on one, are 404 `account.not_found` / `credit_card.not_found`.
- **Balance histories take months:** `from` / `to` as `YYYY-MM`, both
  optional, on `GET …/accounts/{id}/balances` and `GET
  …/credit-cards/{id}/balances` (a card's rows are billing cycles,
  named by closing month). `listAccounts` is not paginated, like
  `listCategories`.
- **Audit:** `CreateAccount`, `EditAccount` (only when the name or
  visibility changed), `ArchiveAccount`, and one entry per card change
  — `AttachCreditCard`, `EditCreditCard`, `RemoveCreditCard` (entity
  `CreditCard`). "Today" is the app time zone's date from the
  Manager's clock (OQ-104).

### OQ-176: AccountManager part 3 — Budgets (task M2)
**Confirmed with the stakeholder (Oct 2026):**
- **A new target must be an open Category or Subcategory.** BudgetAccessor
  didn't check `archivedAt`, so a Budget could claim a Category nobody can
  record against any more. The Manager reads the household's open
  Categories (`CategoryAccessor.list`) and refuses any other new target:
  422 `field.invalid_option` on `targets[i].categoryId` /
  `targets[i].subcategoryId`, the same answer as a target that isn't this
  household's. A claim the Budget already holds stays when an edit sends
  it again, even after its Category was archived. Weighed and rejected:
  allowing it (the claim would block nothing useful and track nothing).
- **`GET …/budgets` isn't paginated**, like `listCategories` and
  `listAccounts` (OQ-175): the claim-aware Category picker needs every
  claim in the caller's scopes. It returns definitions only; spend against
  target is the Budget status read (FR-4.3), `InsightsManager`'s, like
  Goal progress (OQ-174). `BudgetAccessor.list` lost its page.
- **Periods take months:** `from` / `to` as `YYYY-MM`, both optional, on
  `GET …/budgets/{id}/periods`, like the balance histories (OQ-175);
  `listPeriods` takes a `MonthRange` with open ends.
- **The monthly target is more than zero** (`PositiveMoney`, `minimum: 1`),
  on create and edit; an edit's `targets` needs at least one (FR-4.1).
- **A target names exactly one of `categoryId` / `subcategoryId`.** The
  contract says it in prose only: the generated Zod validator ignores
  `additionalProperties: false`, so a `oneOf` would accept both and
  silently drop one. AccountManager checks it — 422 `field.invalid` on
  `targets[i]`, reported with a blank name in one answer. A target sent
  twice is claimed once.
- **An edit is one transaction.** `update` (name, target) and
  `replaceTargets` run together through `UnitOfWorkUtility` (OQ-175), so a
  refused target keeps none of the edit; the sequence diagram had them as
  two writes. Every check runs before; a Budget deleted meanwhile is 404
  and rolls back. An empty edit reads the Budget back, unaudited.
- **Who may do what follows the Accounts' rule:** a personal Budget is its
  owner's alone; a shared one follows the permission table (create:
  Owner/Admin/Member; edit/delete: Owner/Admin, or the Member who created
  it — OQ-111). Someone else's personal Budget — and a deleted one — is
  404 `budget.not_found` (new code, both locales). Deleting is authorized
  like any write (the old diagram had no `AuthorizationUtility` edge).
- **Refusals:** a target claimed in the scope is 409
  `budget.target_already_claimed` with `params` naming the target and the
  claiming `budgetId` — always a Budget the caller can see, as it sits in
  the same scope; a target gone between the check and the write is the
  422 above. **Audit:** `CreateBudget`, `EditBudget`, `DeleteBudget`.
- **Shared plumbing:** the "access request for personal-or-shared data"
  helper moved from the Account use cases to `managers/access.ts`
  (`accessToOwned`), now used by Accounts and Budgets.

### OQ-177: AccountManager part 4 — Goals (task M2)
**Confirmed with the stakeholder (Oct 2026):**
- **`GET …/goals` returns definitions; progress has its own route.** As
  OQ-174 set out, the plain list is AccountManager's own read (`{data:
  Goal[]}`, one status, soonest due first, unpaginated like
  `listBudgets`). The list with per-currency contributions and
  `fundedBy` — `GoalWithProgress` — moved to `GET
  /households/{householdId}/goal-progress?status=` (`listGoalProgress`),
  a reshaped read, `InsightsManager`'s, built with `M4`; `GET
  …/goals/{goalId}/progress` (by month) stays there too. Goal Management
  reads both and joins them by Goal id. A separate path, not
  `…/goals/progress`, so it can't be mistaken for a `goalId`. Weighed and
  rejected: leaving progress out of the contract until `M4`.
- **`GET …/goals/{goalId}/allocations` is dropped.** It duplicated
  `fundedBy` on the progress read, which also carries the Holding names
  only `InsightsManager` reads. The `GoalAllocation` schema went with it.
- **A completed Goal can be edited** (name, target, target currency, due
  date). FR-8.9 closes only new funding to it — `goal.completed`, which
  ships with Edit Holding (part 5). Completion is reversible, unlike an
  archived Account (OQ-175). Weighed and rejected: 409 `goal.completed`
  on the edit.
- **Who may do what follows the Budgets' rule (OQ-176):** a personal Goal
  is its owner's alone (a Viewer may create and manage one); a shared one
  follows the permission table (create: Owner/Admin/Member; edit,
  complete, reopen, delete: Owner/Admin, or the Member who created it —
  OQ-111). Complete and reopen are `data.edit`. Someone else's personal
  Goal — and a deleted one — is 404 `goal.not_found` (new code, both
  locales).
- **Rules:** the target is more than zero (`PositiveMoney`) on create and
  edit; a blank name is 422; a due date in the past is allowed (overdue
  is a display state); the visibility never changes. Completing a
  completed Goal, or reopening an active one, is a 204 that writes and
  audits nothing; an empty edit reads the Goal back, unaudited. A Goal
  gone before its write is 404.
- **Audit:** `CreateGoal`, `EditGoal`, `CompleteGoal`, `ReopenGoal` (the
  old diagram's `UncompleteGoal`), `DeleteGoal`. Each write goes through
  GoalAccessor alone, so no `UnitOfWorkUtility`; `GoalAccessor` joins
  `AccountStores` for part 5's Edit Holding, which writes allocations
  with the Holding.

### OQ-178: AccountManager part 5 — investment administration (task M2)
**Confirmed with the stakeholder (Oct 2026):**
- **A Holding takes its Account's access.** A Holding has no owner or
  visibility of its own, so every use case on one reads the Holding, then
  its Account, and decides on the Account's (OQ-111): personal, the
  owner's alone; shared, the permission table plus the Member who created
  the Account. Allocation and market-value writes are `data.edit`,
  archiving is `data.delete` (like archiving an Account), reads are
  `data.view`. A missing Holding, or one in someone else's personal
  Account, is 404 `holding.not_found` (new code). An archived Holding takes
  no allocation or market-value change: 409 `holding.archived` (new code),
  like `account.archived` (OQ-175).
- **Hidden shares are carried over.** A shared Holding may fund another
  member's personal Goal (OQ-168), which the editor can't see and so can't
  name in a replace-all edit. The edit replaces only the split over the
  Goals the caller can see; the hidden shares are kept as they are and
  still count toward the 100% — the 409 `goal.allocation_exceeds_100`
  totals include them without naming them. Weighed and rejected: dropping
  them (the other member silently loses their allocation) and refusing the
  edit while any exist.
- **The split has its own read.** `InvestmentHolding` carries no
  allocations, and `AccountManager` never calls `InvestmentProductEngine`,
  so it can't answer an `InvestmentHolding` (with `expectedPayout`). New
  `GET …/holdings/{holdingId}/allocations` (`listHoldingAllocations`)
  answers `{data: [{goalId, percentage}]}` — the visible shares, oldest
  first — and `PATCH …/holdings/{holdingId}` answers the same shape, the
  split as written (schemas `HoldingAllocation`, `HoldingAllocations`).
  Weighed and rejected: `allocations` on the `InvestmentHolding` read
  (`InsightsManager`) with a 204 PATCH. `GET …/accounts/{id}/holdings` and
  `GET …/holdings/{id}` stay `InsightsManager`'s (M4).
- **Edit Holding's rules:** a Goal named twice is 422 `array.duplicate` on
  `allocations[i].goalId` (a new field code, `ValidationUtility.distinctItems`
  — OQ-168 left it to ValidationUtility); a named Goal the caller can't see,
  or another household's, is 404 `goal.not_found`; a completed Goal's share
  grown or added is 409 `goal.completed` (new code, both locales — FR-8.9,
  OQ-168). `GoalAccessor`'s own refusals map to 404 `holding.not_found` /
  `goal.not_found` and 409 `goal.allocation_exceeds_100`. The catalogue's
  100% message described the old additive check; it now reads "these
  allocations add up to {requested}%".
- **Only a matured Holding is archived by hand** (FR-5.8): fixed-term, still
  holding a position, past its due date — the redemption entry's date, the
  rule `findMaturedWithPosition` uses. Any other is 409
  `holding.not_matured` (new code); a zeroed Holding archives itself in
  Record Transaction. An archived Holding is a 204 that writes and audits
  nothing. Weighed and rejected: archiving any open Holding.
- **Index rates are shared data whose recorder is their creator:** any
  member but a Viewer records a value; Owner/Admin, or the Member who
  recorded it, corrects or deletes it. `IndexRateAccessor.findById` is new
  (the check needs the recorder before the write). Weighed and rejected:
  the Categories' rule (OQ-174), where a Member can't change what they
  entered. `IndexRateValue` gains `createdByUserId`.
- **Dates after today are refused on the field.** A market value's or an
  index value's `asOf` after today is 422 `validation.failed` with
  `date.max` on `asOf` (`ValidationUtility.dateWithin`, OQ-165) — not the
  `index_rate.invalid` OQ-172 and the old diagrams named. A market value
  is zero or more (`NonNegativeMoney`, a new contract schema); an index
  value may be negative (IPCA deflation).
- **Market values:** a fixed-term Holding is 409
  `holding.not_market_priced` (OQ-51); another Holding's snapshot is 404
  `snapshot.not_found` (new code) and an automatic one 409
  `snapshot.automatic_not_editable` (OQ-56). An empty edit reads the
  snapshot back, answered as a write would, unaudited.
- **`GET …/index-rates` answers `{data: IndexRateSeries[]}`** (was a bare
  array): every index in `INDEX_CODES` order, one with no value with an
  empty list, each value newest first. The unit enum became
  `annual_percent` / `trailing_12m_percent`, the in-code names; `IndexCode`
  and `IndexRateUnit` are named schemas kept equal to `INDEX_CODES` by a
  test (as OQ-174/175 did). The path parameter component is now `Index`.
- **`holding.matured` carries the Holding, not a recipient list.** The bus
  payload (a draft until now) is `findMaturedWithPosition`'s row; the
  recipients are AccountManager's (OQ-171): a personal Account's owner
  (none if gone — the Holding is then marked), every member of a shared
  one. Every delivery is awaited (all settled); the Holding is marked
  notified only when all succeeded, else a warning is logged and
  tomorrow's run tries again (re-telling those already told — accepted).
  The publisher is `N9`.
- **The notice's params are `{holdingId, assetType, ticker, dueDate}`,**
  not `holdingName`: a Holding has no name, and a label is the reader's
  language's to build (OQ-82). The catalogues render "Your CDB matured on
  … Archive it?" from `assetType`.
- **Reads served here:** a Holding's value history (`StartDate`/`EndDate`,
  newest first), its schedule (posted or not, now with `createdAt`) and
  its visible split; the Rates tab. **Audit:** `EditHoldingAllocations`,
  `ArchiveHolding` (entity `InvestmentHolding`), `RecordMarketValue`,
  `EditMarketValue`, `DeleteMarketValue` (`ValuationSnapshot`),
  `RecordIndexRate`, `EditIndexRate`, `DeleteIndexRate` (`IndexRate`).
  Each write is one Accessor call, so no `UnitOfWorkUtility`; the new
  Accessors join `AccountDeps`, not `AccountStores`.

### OQ-179: FormattingUtility (task FU6)
**Confirmed with the stakeholder (Oct 2026):**
- **Money is written in its own currency's conventions**, whatever the
  interface language (NFR-I18N-2): BRL as pt-BR (`R$ 1.234,56`), USD as
  en-US (`$1,234.56`), even for an en-US user. The mockups' `R$85,000.00`
  is representative only. The currency → locale map is
  `formatting.currencyLocale` in `config/constants.ts`.
- **Money always shows its cents** — no whole-units option; the mockups'
  `R$150,000` goal targets read `R$ 150.000,00`.
- **Signs:** a negative number takes the true minus sign `−` (U+2212), as
  the design draws it; `{ sign: 'always' }` adds `+` to a positive amount
  (income), never to zero.
- **Rates (percent × 10,000, OQ-86) always show two decimals**, rounded:
  `10.50%` / `10,50%`. Whole percents (OQ-87) show none. Both, dates and
  lists follow the interface language.
- **Dates** (`YYYY-MM-DD`) are read as a day, not an instant, so no time
  zone moves them. The named styles are in `formatting.dateStyles`:
  `numeric` (default), `dayMonth`, `monthYear`, `weekdayDayMonth`. A
  value that isn't a date is shown as it came.
- **Lists** join with the locale's conjunction (`A, B e C`) via
  `Intl.ListFormat` — available now for screens that waited on it
  (OQ-151).
- **Shape:** pure functions in `utilities/formatting.ts` (`formatMoney`,
  `formatRate`, `formatPercent`, `formatDate`, `formatList`) with `Intl`
  formatters cached per locale and options; `createFormatter(locale)`
  binds them, and `useFormatter()` gives the current locale's set.
- **`fullName` and `describeUserAgent` stay where they are**
  (`personName.ts`, `userAgent.ts`); they already count as
  FormattingUtility's family (OQ-154, OQ-163). Moving them would only
  churn imports.

**Task 77 (`FU6`) is complete.**

### OQ-180: Switch (task K15)
**Confirmed with the stakeholder (Oct 2026):**
- **Visibility is not a switch.** The activity list named Account
  visibility as a Switch user, but the approved Accounts mockup (40)
  draws it as a two-choice pick (Personal / Shared with household). The
  mockup wins. The Switch's first user is the debenture's
  "incentivised" flag on Record Transaction (FR-11.1).
- **One `<Switch>`, controlled only.** It takes `checked`, `onChange`
  (which gets the new boolean), a translated `label`, an optional
  `description` and `disabled`. No error state: an on/off setting has no
  invalid value.
- **Same mechanism as K16 (OQ-130).** A visually hidden native checkbox
  with `role="switch"` sits inside its label, so the browser handles
  Space, focus and the on/off state. `has-checked` draws the "on" look.
  The input is named by the label only (`aria-labelledby`).
- **Label left, switch right.** The row spans its container and pins the
  switch to the end, the settings-row convention. The description sits
  under the label in `type-caption text-muted`.
- **Look, from the mockups' `.switch` CSS.** A 40×24 pill in `line` with
  an 18px `muted` thumb, 3px in. On, the track turns `mint` and the thumb
  slides 16px to the end and turns `onmint`. The shared `FOCUS_RING` goes
  around the track. Disabled drops the row to half opacity.

**Task 78 (`K15`) is complete.**

### OQ-181: Progress bar (task K33)
**Confirmed with the stakeholder (Oct 2026):**
- **Two shapes, one `<ProgressBar>`, told apart by `size`.** The `pill`
  (default) is the mockups' `.bar`: 28px, `track` behind, the amount
  written inside (goal cards on page 43, the Investments Goals panel on
  page 50). The `thin` bar is the 8px `raised` track with no text (the
  buy drawer's allocation total on page 32, a holding's term elapsed on
  page 51).
- **K33 owns stacking.** The thin bar takes `segments` (`value` +
  `tone`), drawn left to right; a single bar is one segment. The
  Allocation editor (K47) passes one segment per Goal and draws nothing
  of its own.
- **Held to 100%.** The pill's fill is held to 0–100 (an overfunded Goal
  shows full; the caller's text still says the real figure). Segments are
  held cumulatively: the one that passes 100% is cut, later ones get no
  width.
- **Display only, caller formats.** It takes plain percentages and an
  already-formatted `label` (FormattingUtility); it formats nothing.
- **Tones.** Pill: `sky` (default) or `mint` for a completed Goal.
  Segments add `skysoft` (`sky/60`), the mockup's alternating shade.
- **Text readable on both sides of the fill.** As in the mockup, the
  label is drawn twice: `ink` over the track and the tone's dark ink
  (`onsky` / `onmint`) clipped to the fill with `clip-path`. Both copies
  are `aria-hidden`.
- **Accessibility.** `role="progressbar"`, 0–100, `aria-valuenow` is the
  (rounded) held value — the segments' total for the thin bar. The pill's
  label is its `aria-valuetext`; the thin bar takes an optional
  `ariaValueText`. The caller names it (`ariaLabel`).
- **Motion.** The fill's width animates over 200ms.
- **The text is centred in the pill** (stakeholder review, Oct 2026),
  not left-aligned as in the mockup; both copies centre, so they stay
  lined up.

**Task 79 (`K33`) is complete.**

### OQ-182: Expandable row / accordion (task K42)
**Confirmed with the stakeholder (Oct 2026):**
- **One `<Expandable>`, two surfaces** (`kit/expandable/Expandable.tsx`).
  `row` (default) is the ledger transaction (mockups 30, 34) and the
  holding (51), and later K43's table rows: open, it is `bg-raised` with
  a `border-y border-mint/30`. `card` is the bordered section that folds
  away — the archived categories on page 41: `rounded-card border
  border-line`, a muted `px-5 py-3.5` header, a `border-t` over the panel.
- **The category cards themselves don't expand.** Page 41 shows their
  subcategories as chips, always visible; the activity list's "category
  cards" use of K42 is the Archived section.
- **The summary is one button.** The caller lays it out (flex for the
  ledger, a grid for holdings); K42 adds the `expand-more` chevron at the
  end — `faint`, turned over and mint while open, 200ms. Since it sits
  inside the button, the summary holds no controls: actions (Edit/Delete,
  inputs, Save) live in the panel, as in the mockups.
- **The panel exists only while open,** so a collapsed holding builds no
  value-history chart. It is a `region` named by its trigger
  (`aria-expanded`, `aria-controls`). The caller pads it (68px ledger
  indent, 95px holdings). No open/close animation, as the mockups show none.
- **Open state: the row's own or the caller's.** Uncontrolled by default
  (`defaultExpanded`, `onExpandedChange` reports each toggle); passing
  `expanded` hands it to the caller — e.g. a ledger that keeps one row open
  while holdings stay independent (page 51 shows two open).
- **Dividers belong to the list** (K41 / K43), not to K42.
- **The kit sets the panel apart from the summary** (stakeholder review,
  Oct 2026), not as in the mockups, where a row's panel starts right
  under its summary. A `row` panel gets `pt-2`, so its content sits 20px
  under the summary (the row's side padding); the caller pads the rest.
  A `card` panel keeps only its `border-t`.

**Task 80 (`K42`) is complete.**

### OQ-183: Stepper (task K49)
**Confirmed with the stakeholder (Oct 2026):**
- **One `<Stepper>`** (`kit/stepper/Stepper.tsx`), the guided setup's
  aside on mockups 11–13. It takes the `steps` (`label`, optional
  `hint`) and the `current` index; the steps before it are done.
- **States, from the mockups.** Done: a mint 32px dot with an `onmint`
  check, the label `muted`. Current: a `mintdeep` dot with a mint number
  and a 2px mint ring, the label `ink`. Next: a `line`-bordered dot with
  a `faint` number, the label `faint`. Hints are always `faint`. The
  connector under each step but the last is mint after a done step,
  `line` otherwise.
- **The caller formats the caption** ("Getting started · step 1 of 3")
  and passes it as `caption`, like K33's `label`; K49 translates nothing.
  The dashed "can be changed later" tip is the caller's, beside it in
  `WizardLayout`'s `aside`.
- **Below `lg`, a row of dots.** Where the wizard stacks the stepper
  above the step's card, it shrinks to the caption over the dots joined
  by short connectors; the labels and hints stay for screen readers
  only. From `lg` it is the mockups' vertical list.
- **Display only.** The steps are not links: Back belongs to Wizard
  Navigation, and the server's state is the progression (OQ-158).
- **Accessibility.** An `<ol>` named by `ariaLabel`, the current step
  `aria-current="step"`; a done step adds a visually hidden
  `completedLabel` ("completed"). Dots and connectors are `aria-hidden`.

**Task 81 (`K49`) is complete.**

### OQ-184: Category chip (task K50)
**Confirmed with the stakeholder (Oct 2026):**
- **Two forms** (`kit/categoryChip/CategoryChip.tsx`), both a category's
  icon in its palette colour on a soft tint of it (OQ-85). The
  **`CategoryDisc`** stands beside the name: `xs` 24px (a budget's
  claim-aware picker, mockup 42), `sm` 32px (setup's review, 12), `md`
  36px — the default — (ledger and dashboard rows, 30 / 20) and `lg`
  40px (the category cards, 41); icons 14 / 16 / 18 / 20px. The
  **`CategoryChip`** is the budget card's pill (42): a 30px `raised`
  pill holding a 20px disc (12px icon) and the name at 13px.
- **Colour inline, from ThemeUtility.** The disc's `style` takes
  `categoryColor()` for the icon and the new `categoryTint()` — a
  `color-mix()` of the same variable at `theme.categoryTintPercent`
  (15, the mockups' `/15`) — for the background. No per-token class
  map: a new palette colour needs a CSS variable and a reference entry,
  never a kit change; an unknown token falls back to `slate`.
- **Typed by the reference.** `icon: CategoryIcon`, `color:
  PaletteToken` from `@financas/reference`; the caller passes the name,
  already translated.
- **Display only.** The disc is `aria-hidden` (the name always stands
  beside it or in the pill); pickers (K18, K19, the claim-aware picker)
  wrap it.

**Task 82 (`K50`) is complete.**

### OQ-185: Icon picker (task K18)
**Confirmed with the stakeholder (Oct 2026):**
- **Mockup 41's row, then a popover** (`kit/iconPicker/IconPicker.tsx`):
  36px rounded squares (`rounded-xl`, `border-line`, `text-muted`; the
  selected one `border-mint/60` on `bg-mintdeep`, `text-mint`). The row
  shows six icons, then "More icons" (`more-horiz`), which opens a K22
  popover holding every `CATEGORY_ICONS` entry as a flat grid in picker
  order: eight a row (`iconPicker.panelWidth` 354px, capped by the
  viewport), scrolling inside, with no search and no group headings.
- **Fixed quick picks.** `iconPicker.quickIcons` in `config/constants.ts`
  holds the mockup's six (pets, school, flight, redeem, fitness,
  child-care). The selected icon always shows in the row: when it isn't
  a quick pick it leads the row and the last quick pick drops out, so the
  row keeps its length.
- **Semantics.** The row is a radio group of visually hidden native radios,
  like the segmented control (OQ-127), so the arrow keys come from the
  browser. The panel's icons are `aria-pressed` buttons instead: picking
  one also closes the panel, and an arrow key on a radio would close it
  too. The selected look is the kit's mint, never the category's colour.
- **Names from the catalog.** The new `categoryIcons` section in
  `packages/i18n` names each of the 57 icons in pt-BR and en-US, keyed by
  the icon. A test keeps its keys equal to `CATEGORY_ICONS`, in order.
  Like every kit component, the picker takes the names already translated:
  `iconLabel(icon)`, plus `label` and `moreLabel`.
- **Controlled.** `value: CategoryIcon` and `onChange`; it holds no state.

**Task 83 (`K18`) is complete.**

### OQ-186: Colour swatch picker (task K19)
**Confirmed with the stakeholder (Oct 2026):**
- **Every colour inline** (`kit/colorSwatchPicker/ColorSwatchPicker.tsx`):
  mockup 41's row shows six swatches, but the picker shows all 18
  `PALETTE_TOKENS` at once, wrapping in the card (`gap-2.5`). There is no
  popover: 18 small swatches fit, and each is one click away. So K22 is
  not a base of K19.
- **Palette order**, the spectrum from `mint` to `slate`; the mockup's six
  are not moved to the front.
- **Mockup look.** 26px discs filled inline with `categoryColor()`, so, as
  with the category chip (OQ-184), a new palette colour needs no kit
  change. The selected swatch takes the mockup's double ring: a 2px gap in
  `card` (the category form's surface), then 2px of its own colour
  (`ring-current`). The keyboard ring sits outside it, 4px out.
- **Semantics.** A radio group of visually hidden native radios, like the
  icon picker's row (OQ-185), so the arrow keys come from the browser.
- **Names from the catalog.** The new `paletteColors` section in
  `packages/i18n` names each of the 18 colours in pt-BR and en-US, keyed by
  the token. A test keeps its keys equal to `PALETTE_TOKENS`, in order. The
  picker takes the names already translated: `colorLabel(color)`, plus
  `label`.
- **Controlled.** `value: PaletteToken` and `onChange`; it holds no state.

**Task 84 (`K19`) is complete.**

### OQ-187: Credit-card preview (task K48)
**Confirmed with the stakeholder (Oct 2026):**
- **Detection as data** (`packages/reference/src/cards.ts`):
  `CARD_NETWORK_RULES` lists each network's BIN ranges, a range being two
  prefixes with the same count of digits. `detectCardNetwork(digits)`
  returns the first network with a range the number falls in, or `other`.
  A range matches once the number has as many digits as its prefixes, so a
  partial number is read as it is typed: `4` is Visa, and `401178` makes it
  Elo. Elo and Hipercard come first, since they overlap Visa, Discover and
  Diners. A test checks every network but `other` has a rule; the icon
  registry's test already checks every one has a logo.
- **BIN lists re-checked** against Braintree's `credit-card-type` (the most
  maintained public table; there is no official one). Elo gains
  650057–650081 and 651680–651704. Braintree keeps only 606282 as
  Hipercard and lists 637095, 637568, 637599, 637609, 637612, 63737423
  and 63743358 as **Hiper**, a separate Itaú brand. **Hiper counts as
  Hipercard** (no new network), and the old 19-digit Hipercard BINs
  384100, 384140 and 384160 stay.
- **Network-aware grouping** (amends OQ-137): `CARD_NUMBER_FORMATS` gives
  each network its gaps and allowed lengths — Amex 4-6-5 (15 digits),
  Diners 4-6-4 (14), the rest in fours, with a fifth group for 19 digits.
  The input stops at the detected network's longest length.
- **Luhn check:** `isValidCardNumber(digits)` (digits only, a length the
  network allows, the checksum holds) catches typos before only `last4` is
  kept. The add-card form shows the field error; its message joins the
  catalog with that form.
- **Three kit pieces** (`apps/web/src/kit/creditCard/`):
  - `CardNumberInput`: the text field with the mask (shared
    `useMaskedInput`), `inputMode="numeric"`, `autoComplete="cc-number"`,
    monospaced. Controlled: the digits in, the digits out.
  - `CardPreview`: mockup 11's live card. It shows the chip, the logo, the
    digits typed and dots for the rest (dimmed), the billing line and the
    expiry. When no number is typed (editing a saved card), it shows dots
    and `last4`. The card is a picture (`aria-hidden`); the caption
    ("Mastercard detected from the number") is `aria-live="polite"`. The
    number scales with the card's width (container units), so a 19-digit
    number fits on one line.
  - `CardRow`: the saved-card strip of mockups 11 and 40 — the logo,
    "•••• 1111" over the meta line, and an optional trailing action. Mockup
    40's inline meta takes mockup 11's stacked layout: one look.
  - All three hold no state; the caller detects the network, formats the
    expiry and translates every text.
- **One dark gradient per network** (`creditCard.gradients` in
  `config/constants.ts`), the mockup preview's gold-brown for Mastercard.
  The card and the row are drawn with `data-theme="dark"`, so they stay
  dark in the light theme, like a real card.
- **Logos sit on a light badge** (the dark theme's `ink`). This is a
  departure from the mockups: logos keep their own colours, and Visa's
  navy and Elo's black disappear on a dark card.
- **Catalog:** `cardNetworks` names each network (a test keeps its keys
  equal to `CARD_NETWORKS`); `creditCard` holds the field label, the
  billing line, the expiry, the "detected" caption and "Remove card".

**Task 85 (`K48`) is complete.**

### OQ-188: Money input (task K7)
**Confirmed with the stakeholder (Oct 2026):**
- **Digits fill from the right, cents first**, as in Brazilian bank apps:
  typing 1, 2, 3 shows `0,01`, `0,12`, `1,23`; R$ 100 is typed `10000`.
  There is no decimal key, so nothing depends on whether the currency
  writes `,` or `.` — the free-decimal alternative was turned down because
  an en-US user typing a BRL amount would need to type `,`. A pasted
  `1.234,56` keeps its digits (R$ 1.234,56); a pasted `50` reads as 0,50.
- **The text follows the currency's own conventions**, like every amount
  on screen (FU6): a BRL amount reads `1.234,56` for an en-US user too.
  `moneyConventions(currency)` in the FormattingUtility gives the symbol,
  the separators and the minor digits, read from `Intl`.
- **Two looks, one component** (`kit/moneyInput/MoneyInput.tsx`):
  - `variant="field"` (default): the kit's text field with the symbol in
    its leading slot — a market value (mockup 52).
  - `variant="hero"`: the mockups' amount panel, its label inside and the
    number in `type-display-lg`, the symbol in `type-heading-lg` — the
    record drawer, the starting balance, budget and goal targets. The
    mockups draw it at 24–40px; the kit has **one hero size**, as K5 has
    one field size. The hint or error sits inside the panel, under the
    number; an error turns the border coral.
  - `direction` signs and tones the prefix for an amount its transaction
    kind signs: `out` −R$ in coral, `in` +R$ in mint; without it the
    symbol is muted.
- **Controlled in minor units**: `value` is an integer (`Money`) or `null`
  while empty, and `onChange` gets the same. Deleting down past `0,01`
  empties the input (`null`) and the placeholder shows the zero (`0,00`);
  a caller passing `0` still sees `0,00`. Only a changed amount is
  reported. A field the API defaults (the opening balance, "0 when left
  out") sends `null` as 0; a required one fails on `null`.
- **Negatives only on request** (`allowNegative`, e.g. an overdrawn
  starting balance — `openingBalance` is plain `Money`). Every minus typed
  flips the sign, so `-` anywhere toggles it; zero is never negative. The
  amount is written with the true minus sign (`−12,34`) after the symbol.
- **At most 13 digits**, cents included (`moneyInput.maxDigits` in
  `config/constants.ts`: 99,999,999,999.99, well within a safe integer);
  a digit past it is refused.
- **The shared mask hook gains `Mask.anchor`** (amends OQ-139): `end`
  counts the caret's clean characters from the right, so it stays beside
  the same digits when padding zeros appear or go (`1,23` → delete the
  `1` → `0,|23`). The money mask's `parse` keeps those zeros; the input
  drops them when it reads the amount.
- **No catalog keys**: the symbol and the placeholder come from `Intl`;
  labels and hints are the caller's.

**Task 86 (`K7`) is complete.**

### OQ-189: Number, rate and percent input (task K8)
**Confirmed with the stakeholder (Oct 2026):**
- **The decimal point is typed** (`110`, `10,25`, `0,5`), unlike money's
  fill-from-the-right (OQ-188), which would make 110% of CDI `1100000`.
  **Either `,` or `.` places it**, since a phone's keypad may offer only
  one; only the first counts. **There is no thousands grouping in the
  field**, so neither key is ambiguous. The text shows the interface
  language's decimal sign (`decimalSeparator(locale)` in the
  FormattingUtility), as rates and percents read everywhere (FU6). A
  pasted `1.234,56` reads as 1.23456, which is accepted.
- **One component, three kinds** (`kit/numberInput/NumberInput.tsx`,
  `kind`), each controlled in the API's fixed-point integer (or `null`
  while empty):
  - `quantity`: units × 10⁸, up to 8 decimals (`Quantity`), no suffix;
  - `rate`: percent × 10,000, up to 4 decimals (OQ-86), a `%` suffix;
  - `percent`: the whole percent (OQ-87), no point, a `%` suffix.

  The label says the rest ("% a.a.", "% of CDI"). The scales are the
  contract's (`KIND_SCALE` in `decimal.ts`). The whole-digit caps are
  `numberInput.maxWholeDigits` in `config/constants.ts`: quantity 7, rate
  4, percent 3. A digit past a cap or a decimal past the scale is refused.
  Ranges (1–100, required) stay with the ValidationUtility and the Flows.
- **What was typed is kept while it still reads as the caller's number**,
  so `10,` keeps its comma until the next digit. A number changed from
  outside replaces it. A number from the caller is shown without trailing
  zeros (`10,5`, not `10,5000`). Only a changed number is reported.
- **Negatives only on request** (`allowNegative`), as in K7: every minus
  typed flips the sign, a lone `−` is kept while the digits come, and zero
  is never negative. The Rates tab turns it on, since IPCA and IGP-M can
  read below zero in deflation (IGP-M's 12 months did in 2023). Quantities
  and percents never take it.
- **Two sizes:** `field` (the kit's text field, `%` in its trailing slot)
  and `compact`, the Goal allocation row's small right-aligned box
  (mockups 32, 51: `h-9 w-14`, `type-body-sm`, `%` beside it), its label
  for screen readers only (the Goal's name) and the hint or error under it.
- **A Quantity's real ceiling is the safe integer**, not the contract:
  × 10⁸ in a JSON number keeps exact digits only below about 90 million
  units. So the input stops at 9,999,999.99999999. A holding of more units
  (e.g. some cryptocurrencies) would need the wire format to change. That
  is recorded here, not solved in v1.
- **Contract fix:** `TransactionCreateRequest.rate.value` was `type:
  number`, against OQ-86 and the Holding's own `rate.value`. It is now an
  integer, percent × 10,000 (110% of CDI = `1100000`).
- **No catalog keys**: the `%` is a symbol; labels and hints are the
  caller's.

**Task 87 (`K8`) is complete.**

### OQ-190: Date input (task K9)
**Confirmed with the stakeholder (Oct 2026):**
- **A masked text field, as the mockups draw it** (Record and Due date,
  mockups 31, 32, 43; As of and the history editor, 52, 53): the kit's
  text field with no calendar and no compact size. The calendar belongs to
  the date range picker (K10, on the popover). A native `type="date"` was
  turned down: it writes the browser's format, not the app's, and can't
  take the theme.
- **The pieces follow the interface language**: `dd/mm/aaaa` in pt-BR,
  `mm/dd/yyyy` in en-US, read from `Intl` by `dateConventions(locale)` in
  the FormattingUtility, as every date on screen reads (FU6). Digits only,
  up to 8; the separators appear on their own, and the year always takes
  four digits. **A `/`, `.` or `-` typed after a single digit pads it**
  (`1/9/2026` → `01/09/2026`), since that is how dates are often typed.
  The caret is the shared `useMaskedInput` hook's (OQ-139).
- **Controlled in the contract's `YYYY-MM-DD`** (`value`, `''` while
  empty). **While incomplete, the caller gets the pieces typed so far in
  that order** (`14/0` → `-0-14`), so the ValidationUtility's `isoDate`
  rule reports "Enter a valid date" rather than "required". All 8 digits
  give `YYYY-MM-DD` even for a day that doesn't exist (31/02); that and
  the bounds are `isoDate`'s (OQ-119), not the input's. What was typed is
  kept while it still reads as the caller's value; a date changed from
  outside replaces it. Only a changed value is reported.
- **The format is the placeholder**, from new catalog keys
  (`dateInput.day/month/year`: `dd`/`mm`/`aaaa`, `dd`/`mm`/`yyyy`) in the
  locale's order. A caller's `placeholder` wins.

**Task 88 (`K9`) is complete.**

### OQ-191: Drawer / sheet (task K20)
**Confirmed with the stakeholder (Oct 2026):**
- **Moved up, before FL11.** Mockup 40 opens Add / Edit Account in a
  drawer, and the activity list names the drawer for Add Budget / Goal
  too, but the network had no K20 under FL11, FL13 or FL14, so task 107
  came after them. It now runs before task 89 (keeping its number) and
  the three Flows depend on it.
- **A modal dialog on Floating UI** (OQ-131), unlike the shell's nav
  drawer, which is a non-modal navigation landmark: `role="dialog"`,
  `aria-modal`, named by its title; focus stays inside and the page behind
  doesn't scroll. It renders in a portal over the scrim (`bg-scrim`).
- **The caller holds `open`** — a Flow opens it from several places
  (Add, each card's Edit). Esc, a press on the scrim and the ✕ call
  `onClose`; a caller with a save out simply ignores it. Props: `title`
  (names the dialog), `caption` (the small line above, "Edit account"),
  the scrolling body and a pinned `footer` for the actions. The ✕'s label
  is the new catalog key `drawer.close`.
- **Focus** goes to the body's first field on opening (the ✕ when there
  is none) and back to whatever had it before on closing.
- **Look, from mockups 31–33, 40 and 52:** from `md` up, 520px on the
  right under the 64px header, `bg-card` with a line on its left; the
  heading row and footer are divided off by lines. Below `md`, a
  full-screen sheet over the header (mockups README).
- **It slides**: the panel in from the right (up from the bottom as a
  sheet) and the scrim fades, over `drawer.transitionMs` (200ms, in
  `config/constants.ts`), as the README's motion line asks; there is no
  motion under `prefers-reduced-motion`. The nav drawer and the popover
  stay without animation.

**Amended in FL11 (Oct 2026):**
- **One stacking order for the kit (`LAYERS`, `kit/popover/overlay.ts`).** Bottom to top: the shell's chrome (z-20/30), the drawer's scrim and panel (z-40/50), the panels (select, menu, popover — the date input's calendar and the icon picker's "more" too), tooltips, toasts. The panels had been at z-40, under the drawer, so a Select inside a drawer opened behind it with no visible options.
- **Two widths from `md`: `default` 520px and `wide` 640px.** The account drawers are wide: beside the 200px card preview, a 520px drawer left the card number about 160px — too narrow for a 16-digit number. Below `md` every drawer is still the full-screen sheet.

**Task 107 (`K20`) is complete.**

### OQ-192: Account & Card Management (task FL11)
**Design decisions:**
- **The Accounts tab is the live flow; the other tabs are placeholders.** The page at `/account-setup` carries mockup 40's four tabs, and only Accounts works — Categories, Budgets and Goals show an empty state until their flows land in FL12–FL14. The page is keyed on the household, so a switch starts it afresh.
- **The opening balance field is OQ-169's anchor.** Add Account takes "today's balance" as optional; the Manager stores it with `startingBalanceDate` set to the creation day, and the account runs from there. The field's hint says exactly that — leave it out when you start from zero.
- **Cards go on every type that takes them (FR-2.7, OQ-11).** Checking, savings and `credit_card_only` accounts all offer the cards section, created and edited atomically with the account; investment accounts don't. Cards typed before switching to investment are neither checked nor sent. A `credit_card_only` account's balance shows as the sum of its cards' outstanding balances (OQ-175); a checking or savings account shows its own balance with its cards listed under it.
- **The number never leaves the form, and an attached card's identity is fixed.** Only network and last four digits are stored (NFR-SEC-7). A new card enters through its number, beside the K48 live preview; an attached card shows as its K48 saved-card strip, and only its billing days and expiration edit — a different number is a different card, so it is removed and the new one added. The edit sends only those four fields.
- **Every member may add an account; a Viewer's is personal.** Personal data is its owner's whatever their role (the permission table), so a Viewer gets Add Account with the visibility locked at Personal — the server forbids them shared data.
- **Type and currency lock at creation** (the contract makes them immutable); the edit drawer shows them as locked fields with their note. Visibility moves only in its creator's hands; everyone else sees it read-only.
- **Archiving sits behind an inline confirm** — the kit's danger zone with a destructive confirm, as mockup 40 draws it — and an archived account leaves the list for its own section.
- **A failure shows once, where the form is.** A create, edit or archive that fails shows in the open drawer's banner with what was typed kept; it isn't also toasted. Successes toast. Only the control whose request is out spins (Save for an edit, the confirm for an archive). One request at a time: while one is out, every other control waits (Archive and its confirm included) and the drawer doesn't close (Cancel, Esc and the backdrop wait too), so each answer lands on its own request and a failure always has its banner.
- **The Flow keeps its own list.** It loads once as it mounts and applies each success from the answer (append, replace, stamp `archivedAt`). Nothing else reads the accounts list, so the writes invalidate no cache tag; a reader added later brings its own refresh.
- **A card's billing days and expiry are picked from dropdowns, not typed** (a deliberate divergence from mockup 11, which draws three text fields with expiry as one `MM/YYYY`). Closing and due day offer 1–28 (OQ-170), the expiry a month and a year from a window, so nothing invalid can be entered and no format has to be explained.
- **A refused card says what is wrong, field by field.** A missing number, a length its network never has (read from the first digits: an Amex has 15, a Diners 14), a checksum that fails (a typo) and each unpicked day, month or year get their own message under their own field — one catch-all under the number read as "type more digits". The name's error and the cards' show together, the first problem takes the focus (`useFocusFirstInvalid`), and changing a field clears only its own message.
- **An expired card is accepted.** The expiration is recorded as the card prints it and isn't checked against today, in the form or the API: an expired card is legitimately recorded (an old card whose past transactions are being entered).

**Task 89 (`FL11`) is complete.**

### OQ-193: Category Management (task FL12)
**Design decisions:**
- **The Categories tab is the live flow; Budgets and Goals stay placeholders.** The page at `/account-setup` now renders mockup 41's grid of category cards — each with its disc, name, its subcategory chips and an inline add-sub field — plus a dashed create card. Budgets and Goals keep their empty states until FL13–FL14.
- **Editing turns the card into its form in place.** Mockup 41 draws only the create state; editing reuses the same `CategoryFormCard` pre-filled where the card stood, with Save/Cancel instead of Create/Cancel. An empty create form starts from the `category-outline` icon and the `mint` colour, as mockup 41's create card is drawn. A drawer was turned down: the grid is small and the card already holds every field, so lifting it into a sheet would move the eye for no gain.
- **Adding a subcategory is the category's own atomic edit.** The inline add-sub sends `PATCH …/categories/:id` with `{subcategories:[{name}]}` — OQ-173's rule that unlisted subcategories are untouched makes one endpoint enough; no separate create route was added.
- **Archiving cascades, behind a confirm that says so.** Archiving a category archives all its live subcategories server-side (FR-10.4); the card's inline confirm names the count before it goes out. A single subcategory archives on its own from its chip.
- **Members create, only Owner and Admin manage** (FR-1.7, the permission table). Categories are shared data nobody owns, so the table applies as is: Owner, Admin and Member may create (`data.create`); only Owner and Admin edit, add subcategories or archive (`data.edit` / `data.delete` — the Member creator exception needs an owner, and a category has none). So a Member's new category takes its subcategories from an Owner or Admin. Viewers see the grid read-only.
- **The category list is the Experience's** (EBD: shared read-only data across Account Setup's Flows — Category Management writes it, Budget Management reads it). The Experience subscribes to `GET …/categories?includeArchived=true` and hands the list down; after each successful write it fetches the list again and only then answers the Flow, so the spinner stops on a list that already holds the change. The category writes don't invalidate the cache as well (that would fetch twice), and the Flow never patches the list itself — no local `archivedAt`, no cascade guessed in the browser. If that fetch fails, the write still answers ok (it went through; a failure would invite a duplicate), and the list stays on screen with a banner above it saying it may be out of date, with a retry. The grid isn't swapped for the failure state, so an open form keeps what was typed; that full-panel failure is for a first load only. While a request is out, the inline subcategory field waits too, so nothing typed meanwhile is cleared when the add lands.
- **A failure shows once, where it belongs.** A create or edit failure shows in its form card's banner, with what was typed kept; a card action's failure (add or archive a subcategory, archive a category) is toasted, its confirm staying open. Every control waits while a request is out, and the inline subcategory field keeps what was typed until the new subcategory is listed.
- **Names are short: at most 20 characters** for a category or a subcategory. The contract's create and update requests carry `maxLength: 20` (a longer one is a 422 `string.max`), and the form and the inline field stop typing there (`config/constants.ts` → `categories.nameMaxLength`). Names stored before the rule keep their length until edited.
- **The card's header follows mockup 41: Edit and Archive are icon buttons**, named after the category for screen readers only, and the name wraps instead of pushing them out of the card.
- **A subcategory is added from the dashed "+ Subcategory" pill**, as mockup 41 draws it: the pill opens a ringed field with its ✓ (Enter adds, Escape closes and drops what was typed). The field stays open after an add, for the next one. The chips and the pill share one wrapping row, as the mockup lays them out. An always-visible bare field read as decoration — users reached for the + first.
- **The contract's Category and Subcategory schemas gained their `required` lists.** Every field was optional in the generated types although the server always emits them all (`toCategoryJson`); the required arrays now match what the API returns, so the web side stops treating live data as half-present.

**Task 90 (`FL12`) is complete.**

### OQ-5: Notification delivery channels
**Confirmed:** In-app notification is the **v1 minimum** — every
notification-worthy event must at least surface in-app.

**Also confirmed as a named volatility:** the stakeholder explicitly called
out that the notification *channel* is expected to change/expand over time
(email, push, SMS, etc.). This is now captured as a volatility on CUC-8
(see 01-core-use-cases.md) rather than left implicit — the delivery
mechanism must sit behind an abstraction so adding a channel later never
requires touching the logic that decides *whether* to notify.

### OQ-10: Log aggregation / monitoring destination
**Confirmed:** Winston's own **Transport** abstraction is the pluggability
mechanism — no separate abstraction needs to be designed for this. v1 uses
a single stdout/console transport; additional transports (a hosted
log/observability service, a self-hosted stack) can be added later purely
as configuration, since Winston already supports multiple simultaneous
transports natively. See NFR-OBS-5.

### OQ-19: Partial bill payments and revolving-credit interest
**Confirmed:** explicitly out of scope for v1, not automated. If a Credit
Card Bill Payment (FR-3.7) doesn't cover the full outstanding balance, it
simply reduces the balance by the amount paid — the user manually deals
with the remainder however they see fit; the system does not carry it
forward as a distinct "revolving balance" or compute interest on it.

**Why this is lower-stakes than it first looked:** the system doesn't
track a credit limit at all (no "available credit" concept), so there's no
limit-usage calculation that a carried-over balance would need to feed —
partial payment handling only really matters once interest calculation is
in scope, which it isn't yet.

**Future phase (not committed to now):** carrying an unpaid balance
forward across cycles, with a user-defined (manually entered, not
automated/fetched) interest rate applied to it — consistent with the
system's broader "manual over automated" stance (see the Currency
Reference Rate treatment, FR-9).
**Affects:** FR-2.10, FR-3.7.

## Open (genuinely unresolved — not blocking, tracked so it isn't lost)

*(None currently — OQ-29, the last item here, was resolved during data
modeling; see below.)*

