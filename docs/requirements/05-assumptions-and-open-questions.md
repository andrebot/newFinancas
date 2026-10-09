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
`allocations` field; `TransactionManager` calls `GoalAccessor.allocate`
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
- `NotificationDeliveryUtility` stays a Utility (routes type + params to
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
provider yet:** `NotificationDeliveryUtility`'s email channel uses a
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
  (OQ-88). The provider itself is built in `NotificationDeliveryUtility`
  (U7).

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
**Confirmed, designed with the stakeholder (Oct 2026):**
- **One Winston logger, one event, several transports.** The same event
  goes everywhere:
  - **the console:** human-readable, in local wall-clock time, e.g.
    `14:03:12 AUDIT [7f3a9c21] user:… CreateBudget  Budget … (household …)`;
  - **a daily JSON-lines file:** 14 days, under
    `~/.local/state/financas/logs` (`LOG_DIR`), named
    `<process>-YYYY-MM-DD.log`;
  - **for audit events, the audit sink:** the existing `audit_log_entries`
    table, through AuditLogAccessor.
- **`packages/logging`** (`@financas/logging`) holds the shared parts:
  logger factory, console line, redaction, actor labels. The API and the
  ops CLI both use it. The API's **LoggingUtility**
  (`apps/api/src/utilities/logging`) adds `logActivity`, `logError`,
  `logRequest` and `recordAudit`, plus the audit sink and reconciliation.
- **No `console` anywhere.** Every process logs through the shared
  logger: the API, the demo seed, audit reconciliation and the ops CLI.
- **Every method is fire-and-forget:** Managers never wait. The
  correlation ID and actor (`user:<id>`, `system`, `unauthenticated`,
  NFR-OBS-2) are on every event. `details` are redacted (passwords,
  tokens, secrets, auth headers, cookies, MFA/recovery codes). Every
  request is logged (NFR-OBS-1), and unexpected 500s go to `logError`
  with their stack (NFR-OBS-3).
- **Audit reliability is the logging system's job:**
  - `recordAudit` gives each entry its own ID and the time of the
    action, and logs it, so it's in the daily file immediately.
  - The sink stores the locked FR-7.1 fields in the background, retrying
    at 1 s, 5 s and 30 s. If it gives up, it logs `audit.store_failed`.
  - **Reconciliation** (`reconcileAudit`) restores any audit line from
    the daily files that is missing in the database. It runs at **every
    API start**, and with `pnpm audit:reconcile`. It's idempotent: the
    insert skips known IDs, and restored entries keep their original
    time. The recovery window is the 14-day retention.
  - **The sink has its own level, so audit storage never depends on
    `LOG_LEVEL`.** A test caught that a quieter level would otherwise
    have silently dropped audit entries.
- **Closes OQ-104's open point:** `recordAudit` takes `actor`,
  `householdId`, `action`, `entityType`, `entityId` and the correlation
  ID. The sequence diagrams still abbreviate it as `recordAudit(actor,
  type, id)`; the real call always carries the action and household.
- **AuditLogAccessor** `insert` and `insertMany` take the caller's ID and
  time, and skip an ID already stored.
- Configuration: `LOG_LEVEL` and `LOG_DIR` in `env.ts`; retry delays and
  the file prefix in `constants.ts`; retention and date pattern in
  `@financas/logging`.

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

