# Call chain review — October 2026

Third review in the sequence (requirements ✅ → use cases ✅ → **call
chains** → sequences → data model → API). The call chains
(`docs/design/diagrams/call-chains/`) plot each use case's calls on the VBD layered
architecture, so this review is where the new use cases get **owners and
components**. **VBD Round 9 — confirmed by the stakeholder and applied to the call
chains** (`docs/design/diagrams/scripts/gen_call_chains_oct2026.py`; 59 chains, all
edge endpoints validated). The VBD doc and the layered/component diagrams
are updated after the Managers review, which may refine this.

## A. Component changes (VBD Round 9)

| # | Change | Why |
|---|---|---|
| C1 | **Remove `RecurringTransactionScheduleAccessor`** and the §3.2b recurring trigger. 18 → 17 active accessors. | Recurring dropped (OQ-55). |
| C2 | **Rename `ObjectiveAccessor` → `GoalAccessor`**; its reversible transition is complete/reopen. | OQ-66, OQ-78. |
| C3 | **Add `IndexRateAccessor`** — household index-rate history (Selic, CDI, IPCA, IGP-M). Written by `AccountManager` (reference data that governs projections — the "set something up ahead of cash-flow events" trigger pattern); read by `InvestmentProductEngine`. 17 → 18 active. | FR-11.6, OQ-59. |
| C4 | **`ValuationSnapshotAccessor`**: manual snapshots become insert / update / delete (`AccountManager`); automatic snapshots stay owned by `TransactionManager`, changed only with their transaction. Drop "never overwrite". | FR-5.2, OQ-56. |
| C5 | **`InvestmentProductEngine` gains `project(holding)`** → expected payout + expected taxes, using coded tax rules per instrument (full FR-11.1 list, debenture `incentivised`, US taxes "not estimated") and the latest index rate via `IndexRateAccessor`. New caller: `InsightsManager` (View Investments). | FR-11.2, OQ-58, OQ-79. |
| C6 | **`ReportingEngine` gains three output shapes:** payout series (dividend/interest Account Transactions linked to Holdings, FR-5.9); month overview (in/out/net per currency + 12-month strip, excluding own transfers and bill payments, FR-6.11); net worth change vs previous month (FR-5.3). | FR-5.3, 5.9, 6.11. |
| C7 | **`InvestmentHoldingAccessor`** gains `archive(holdingId, by: system|user)`, `unarchiveIfSystemArchived(holdingId)`, `findMaturedWithPosition(today)`, `markMaturedNotified(holdingId)`. | FR-5.8, OQ-72, OQ-80. |
| C8 | **`SessionAccessor.deleteAllExceptCurrent(userId, currentSessionId)`**; **`HouseholdAccessor.listForUser`**; **`InvitationAccessor.listPendingForUser`** (with inviter). | FR-1.3, 1.8, 1.10. |
| C9 | **`DashboardAccessor` → parked (v3).** v1 Dashboard has no stored layout. | OQ-67. |
| C10 | **`TransactionManager` stops calling `NotificationDeliveryUtility`** — the current Record Transaction chain still shows that edge (threshold alerts, removed by OQ-52). | Stale diagram. |

Managers stay at **4**, Engines at **2**, Utilities at **7**. Every
existing call chain gets the updated accessor layout (C1–C3, C9).

## B. Chains for new use cases

| Use case | Owner | Chain |
|---|---|---|
| List My Households | `IdentityManager` (identity views stay there, like View Sessions) | ① `HouseholdAccessor.listForUser` → ② `InvitationAccessor.listPendingForUser` |
| Browse & Filter Transactions | **`TransactionManager`** (stakeholder decision, Q1) | ① `AuthorizationUtility` (visibility) → ② `AccountTransactionAccessor.list` + `CardTransactionAccessor.list` (merged, newest first) |
| View Month Overview | `InsightsManager` | ① `AuthorizationUtility` → ② `ReportingEngine.monthOverview` → ③ `AccountTransactionAccessor`, `CardTransactionAccessor`, `AccountAccessor`, `CreditCardAccessor`, `BudgetAccessor`, `GoalAccessor`, `ValuationSnapshotAccessor` |
| Record Market Value | `AccountManager` | ① `AuthorizationUtility` → ② `ValidationUtility` → ③ `InvestmentHoldingAccessor` (verify market-priced) → ④ `ValuationSnapshotAccessor.insertManual` → ⑤ `LoggingUtility` (async) |
| Edit Market Value | `AccountManager` | same shape, ④ `updateManual` (rejects automatic snapshots) |
| Delete Market Value | `AccountManager` | same shape, ④ `deleteManual` |
| Record / Edit / Delete Index Rate | `AccountManager` | ① `AuthorizationUtility` → ② `ValidationUtility` → ③ `IndexRateAccessor` → ④ `LoggingUtility` (async) |
| Notify Matured Holding | cron trigger + `AccountManager` | ① trigger → `InvestmentHoldingAccessor.findMaturedWithPosition` → ② `ServiceBusUtility.publish("holding.matured")` → ③ `AccountManager` subscribes → ④ `NotificationDeliveryUtility.deliver` (in-app) → ⑤ `InvestmentHoldingAccessor.markMaturedNotified` — same trigger shape as §3.2a |
| View Investments | `InsightsManager` | ① `AuthorizationUtility` → ② `ReportingEngine` (net worth + change, payout this month + series, allocations, coming due) → ③ `InvestmentProductEngine.project` per fixed-term holding → ④ `IndexRateAccessor` (latest) |
| View Goals | `InsightsManager` | ① `AuthorizationUtility` → ② `ReportingEngine.goalProgress` → ③ `GoalAccessor`, `ValuationSnapshotAccessor`, `InvestmentHoldingAccessor` |

## C. Changed chains

| Use case | Change |
|---|---|
| Record Transaction | Drop `NotificationDeliveryUtility` (C10). Add `ValuationSnapshotAccessor` (automatic snapshot), `GoalAccessor.allocate` (bundled allocations, OQ-54), `InvestmentHoldingAccessor.archive(system)` at quantity 0. |
| Edit / Delete Transaction | Add automatic-snapshot update/delete and `InvestmentHoldingAccessor.unarchiveIfSystemArchived` (OQ-80). |
| Edit Holding (goal allocations) | Drop the snapshot write; only `GoalAccessor.allocate` remains (C4). |
| Archive Matured Holding | `InvestmentHoldingAccessor.archive(user)`. The notification is then deleted by the frontend through Delete Notification (Insights UC-6) — keeps `AccountManager` off the inbox; the use-case diagram is corrected to match. |
| Generate Scheduled Cash Event | Unchanged shape; a redemption to zero now auto-archives inside the re-entered pipeline. |
| Revoke Session | Variant edge `SessionAccessor.deleteAllExceptCurrent`. |
| View Dashboard | Drop `DashboardAccessor` (parked, C9); `ReportingEngine` reads gain payout + month data. |
| Invite User | Unchanged (`NotificationDeliveryUtility` already in-app). |
| Goals UC-1…5 | Rename to `GoalAccessor`; folder `investment-objectives/` → `goals/`, complete/reopen. |

## D. Smell check (the purpose of call chains)

- **`InsightsManager` fan-out grows** (Month Overview, View Investments,
  View Goals) — but every new edge is a *read* through
  `ReportingEngine`; no writes, no cross-Manager calls. Acceptable: View
  is its trigger pattern.
- **New cross-Engine need avoided:** `InsightsManager` calls both Engines
  side by side; `ReportingEngine` never calls `InvestmentProductEngine`
  (Engine→Engine is forbidden).
- **`AccountManager` gains a subscriber role** (`holding.matured`), same as
  its existing `household.created` subscription — still no Manager↔Manager
  direct call.

## Decision

- **Q1 → `TransactionManager`** owns Browse & Filter Transactions: it's a
  simple filter over the ledger it owns, no transformation worth an
  Engine. (Recommendation was `InsightsManager`; stakeholder chose
  otherwise — `TransactionManager` therefore also has a read path now.)
