# Manager review — October 2026

Requested after the call chain review (VBD Round 9). Purpose: check that
each of the 4 Managers still has **one trigger pattern and one volatility**
after everything the design round added, before the VBD doc and the
architecture diagrams are rewritten.

## 1. The four Managers after Round 9

| Manager | Trigger pattern | Writes (owns) | Reads (views it owns) | Bus |
|---|---|---|---|---|
| `IdentityManager` | Someone establishes or exercises who they are | Users (+ preferences), sessions (revoke one / all others), households, memberships, roles, ownership, invitations (+ in-app notification to the invitee) | View Sessions, **List My Households** | publishes `household.created` |
| `AccountManager` | Someone sets something up ahead of cash-flow events | Accounts (4 types), credit cards, categories (icon/colour), budgets, goals (create/edit/complete/reopen/delete), holding goal allocations, **archive matured holding**, **market values** (manual snapshots), **index rates** | — | subscribes `household.created`, **`holding.matured`** (+ delivers that notification) |
| `TransactionManager` | A cash-flow event happened | Account + card transactions (record/edit/delete) with every side effect: balances, holdings (create, trade, **auto-archive/unarchive**), schedule via `InvestmentProductEngine`, automatic snapshots, bundled goal allocations, budget accrual | **Browse & Filter Transactions** | subscribes `transaction.import.requested` (cash events; Open Banking later) |
| `InsightsManager` | Someone wants to see the state of things, shaped | Notifications (mark seen, delete) | Dashboard (fixed), **Month Overview**, **View Investments**, **View Goals**, audit-log export — all through `ReportingEngine` (+ `InvestmentProductEngine.project` for projections) | — |

Engines: `ReportingEngine` (only `InsightsManager` calls it),
`InvestmentProductEngine` (`TransactionManager` to schedule,
`InsightsManager` to project). Managers stay at **4**.

## 2. Findings

**M1 — A read-ownership rule is now visible; make it explicit.**
Browse & Filter went to `TransactionManager` (stakeholder decision), and
the existing chains already follow the same split everywhere:
*a plain list/filter of a Manager's own entities is served by that
Manager; anything aggregated or reshaped goes through `InsightsManager` +
`ReportingEngine`.* View Sessions and List My Households (Identity),
Browse Transactions (Transaction), notifications (Insights owns the
inbox) are plain lists; Dashboard, Month Overview, Investments, Goals are
reshaped. *Recommend:* write this rule into the VBD doc's §3 as the test
for every future View use case.

**M2 — Stale VBD table: `SessionAccessor` listed under `InsightsManager`.**
The View Sessions chain uses `IdentityManager`, and M1 says it should.
*Recommend:* remove it from `InsightsManager`'s row.

**M3 — `AccountManager` is now the largest Manager.** Accounts, cards,
categories, budgets, goals, holding allocations, matured-holding archive,
market values, index rates, and two subscriptions. Size alone isn't a
reason to split (VBD decomposes by volatility, and Round 2 merged a
separate Planning Manager into it because both share one trigger
pattern). Every item still fits "set up / maintain something ahead of
cash-flow events". *Recommend:* keep one `AccountManager`; revisit only
if a volatility shows up that these items don't share.

**M4 — Market values: `AccountManager` or `TransactionManager`?** A
manual market value isn't really "setup" — it's an observation that a
holding's value changed. But it moves no money, touches no ledger, and
the CUC-6 volatility it carries ("valuation source": manual now, a price
feed later) is different from `TransactionManager`'s (transaction kinds
and their side effects). When a price feed arrives it will be a trigger
writing snapshots directly, like the cash-event trigger.
*Recommend:* keep in `AccountManager` (as proposed); note the future
price-feed trigger will target `ValuationSnapshotAccessor` without going
through `TransactionManager`.

**M5 — `TransactionManager`'s trigger pattern needs one more word.**
"A cash-flow event happened" no longer covers Browse. *Recommend:*
"A cash-flow event happened — and the ledger those events form" (it owns
the ledger, writes and plain reads).

**M6 — Two daily triggers read the same accessor.** Scheduled cash
events and matured-holding notices both start from
`InvestmentHoldingAccessor` once a day. *Recommend:* one daily
`investmentsDaily` scheduler entry that publishes both events
(`transaction.import.requested`, `holding.matured`) — one cron, two
subscribers, no change to ownership.

**M7 — `GoalAccessor.allocate` has two writers** (`AccountManager` on edit
holding, `TransactionManager` on a bundled buy). Allowed — the invariant
(≤ 100%) lives in the Accessor, so both paths get it for free. Noted, no
change.

**M8 — Notification creation is spread across Managers** (invitation →
`IdentityManager`, matured holding → `AccountManager`). This is the VBD
design: the Manager whose workflow decides a notification is warranted
calls `NotificationDeliveryUtility`; the channel volatility stays in the
Utility. No change.

## 3. Decisions (stakeholder, Oct 2026)

- **Q1 — yes.** M1's read-ownership rule goes into the VBD doc.
- **Q2 — keep one `AccountManager`, and document when to spin it out**
  into its own subsystem (fractal Managers make that possible): a part
  that changes for a different reason, needs independent deploy/scale, or
  gets its own owner. Natural seams: containers (accounts, cards),
  planning (categories, budgets, goals), investment admin (allocations,
  market values, index rates, matured holdings).
- **Q3 — market values stay in `AccountManager`.**
- **Q4 — merge** the two daily jobs into one `investmentsDaily` scheduler
  entry.

## 4. Questions as asked

- **Q1** Adopt M1's read-ownership rule? *(recommend yes)*
- **Q2** M3: keep one `AccountManager`? *(recommend yes)*
- **Q3** M4: market values stay in `AccountManager`? *(recommend yes)*
- **Q4** M6: merge the two daily triggers into one scheduler entry?
  *(recommend yes)*

After answers: rewrite the VBD doc as Round 9 (inventory, rules incl. M1,
§3.2b removal, per-Manager table), then update the component and layered
architecture diagrams (`02-vbd-component-diagram.html`,
`03-backend-layered-architecture.html`).
