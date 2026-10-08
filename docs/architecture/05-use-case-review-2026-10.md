# Use case review — October 2026

Second review in the sequence (requirements ✅ → **use cases** → call
chains → sequences → data model → API). Checks the 48 use-case diagrams
(`docs/design/diagrams/use-cases/`) against the reviewed requirements (OQ-55 – OQ-79)
and the change log (`00-design-round-change-log.md`, D1–D22).

Result: **47 diagrams → 59** — 56 active in v1 (3 deferred to v2), 12
added, 15 changed. **Applied** (Oct 2026). Confirmed by the stakeholder (Oct 2026); this list is the change record
for the diagram updates.

## 1. Defer (keep the diagrams, mark them v2 / v3)

| Use case | Why |
|---|---|
| Insights UC-2 Edit Dashboard Layout | FR-6.1/6.7–6.9 deferred to **v3** (OQ-67) |
| Insights UC-3 View Report | FR-6.2/6.3 deferred (OQ-71) |
| Insights UC-4 Export CSV | FR-6.4 deferred (OQ-71) |

(The Open Banking trio — Connect / Disconnect / Sync — was already
deferred and never diagrammed.)

## 2. Rename

| Use case(s) | Change |
|---|---|
| `investment-objectives/` (5) | Folder → `goals/`; Create / Edit / Delete Goal; **Archive → Complete Goal**, **Unarchive → Reopen Goal** (D1, D21). |

## 3. Change existing use cases

| Use case | Change | Source |
|---|---|---|
| Record Transactions UC-1 Record | Remove the recurring branch. Investment buy: full asset-type list, debenture flag, goal allocations. **Sell/redemption that brings quantity to 0 auto-archives the Holding.** Investment kinds allowed on any account except credit card only. | D2, D15, D19, D22 |
| Record Transactions UC-2 Edit / UC-3 Delete | Editing/deleting the transaction that zeroed a Holding must **restore** it (see open question Q1). Automatic valuation snapshot follows its transaction. | D3, D15 |
| Track Investments UC-2 Edit Holding | Narrow to **edit goal allocations only** (position is read-only; market value moves to its own use cases below). | D3 |
| Track Investments UC-3 Archive Holding | Entry is now the **matured-holding notification** (manual archive of a past-due fixed-term Holding with a position); zero-quantity archive happens inside Record Transaction. | D15, OQ-72 |
| Track Investments UC-4 Generate Scheduled Cash Event | Remove recurring reference; tax via the engine's coded rules per type; redemption to 0 → auto-archive. | D2, D5, D15, D22 |
| Accounts UC-1 Create Account | Types = checking, savings, credit card only, investment. | D19 |
| Categories UC-1 Create / UC-2 Edit | Add icon + colour. | D4 |
| Identity UC-1 Create Household | Second entry point: "Create household" in the switcher (Q2: does guided setup run again?). | D18 |
| Identity UC-3 Invite User | Also **creates a notification** for the invitee (system effect). | D14 |
| Identity UC-4 Accept / UC-5 Decline | Can also be done from the notification inbox. | D14 |
| Identity UC-11 Create User | Password ≥ 12 chars. | D11 |
| Identity UC-13 Edit User | Include preferences (theme dark/light/system, language). | D9 |
| Identity UC-17 Revoke Session | Variant: **revoke all other sessions** in one action. | D9 |
| Identity UC-18 Reset / UC-19 Change Password | Password ≥ 12 chars. | D11 |
| Insights UC-1 View Dashboard | v1 fixed panels incl. net-worth change vs previous month and payout chart. | D13, D16 |
| Insights UC-5 View Notifications | Items are actionable (accept/decline invitation, archive matured holding). | D14 |

## 4. Add (12)

| New use case | Pattern | Source |
|---|---|---|
| Identity — **List My Households** (feeds the switcher) | View | FR-1.8, D7 |
| Transactions — **Browse & Filter Transactions** (all, lazy, filter by kind/account/card/category/holding/date range) | View | FR-3.12, D8 |
| Transactions — **View Month Overview** (in/out/total per currency, 12-month strip, balances, budgets, goals for the period) | View | FR-6.11, FR-6.6, D17 |
| Investments — **Record Market Value** (manual valuation snapshot) | Create | FR-5.2, D3 |
| Investments — **Edit Market Value** | Edit | FR-5.2, D3 |
| Investments — **Delete Market Value** | Lifecycle | FR-5.2, D3 |
| Investments — **Record Index Rate** | Create | FR-11.6, D6 |
| Investments — **Edit Index Rate** | Edit | FR-11.6, D6 |
| Investments — **Delete Index Rate** | Lifecycle | FR-11.6, D6 |
| Investments — **View Investments** (net worth series + delta, payout series with holding selection, allocations, holdings by account with expected payout/taxes) | View | FR-5.3, FR-5.9, FR-11.2, D5, D16 |
| Investments — **Notify Matured Holding** (daily system trigger) | System-Trigger | FR-5.8, FR-6.5, D14 |
| Goals — **View Goals** (progress per currency for the frontend rate calculator) | View | FR-8.5, FR-9 |

## 5. Not use cases (frontend only — confirm)

- **Switching the active household** — client-side context change after
  List My Households; every request then carries the chosen household.
- **Guided first setup** — an EBD Flow composing Create Account, Review
  Categories, Create Budget; "first account mandatory" is enforced by the
  frontend flow, not a backend rule.
- **Goal exchange-rate input** — client-side calculator (FR-9, no storage).
- **Audit-export dialog** — UI around the existing Export Audit Log use case.

## Open questions for the stakeholder

- **Q1.** A Holding auto-archived by a full sell/redemption: if that
  transaction is later **edited or deleted** so quantity is no longer 0,
  should the system **un-archive** it automatically? Archive is otherwise
  one-way (FR-5.8). **Decided: yes (OQ-80).**
- **Q2.** Creating an **additional** household from the switcher: run the
  guided setup again (mandatory first account) or open the new household
  empty? **Decided: yes (OQ-81).**
