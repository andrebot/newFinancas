#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/record-transactions/*.html — CUC-4,
5 of 5 use cases (Open Banking auto-import deferred to v2, OQ-69).
Updated in the Oct 2026 sequence review (docs/architecture/08-sequence-review-2026-10.md)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/record-transactions"


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE = """    actor User
    participant API as Hono route
    participant TM as TransactionManager"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-record-transaction.html",
    title="Record Transaction",
    subtitle='<span class="route">POST /transactions</span> &mdash; FR-3.1/OQ-39. One unified entry point for both Account and Card Transactions &mdash; target narrows which kinds are valid, itself data-driven. The investment-buy-against-a-fixed-term-instrument sub-case is one of the two widest-fan-out flows in the whole system.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant AA as AccountAccessor
    participant CCA as CreditCardAccessor
    participant IHA as InvestmentHoldingAccessor
    participant IPE as InvestmentProductEngine
    participant VSA as ValuationSnapshotAccessor
    participant GA as GoalAccessor
    participant BA as BudgetAccessor
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor
    participant LOG as LoggingUtility

    User->>API: POST /transactions {target, kind, date, amount, currency, categoryId, description, assetType?, ticker?, quantity?, rate?, dueDate?, incentivised?, allocations?}
    API->>TM: record(actor, input)
    TM->>AZ: canWrite(actor, targetId)?
    alt not authorized
        AZ-->>TM: denied
        TM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized, target is a Credit Card
        AZ-->>TM: allowed
        alt kind not in {charge, refund}
            TM-->>API: ValidationError (FR-3.1 &mdash; a Credit Card target only offers charge/refund)
            API-->>User: 422 transaction.kind_not_allowed_for_target
        else charge or refund
            TM->>CCA: applyChargeOrRefund(cardId, amount, kind)
            CCA-->>TM: outstanding balance updated
            TM->>BA: accrueIfClaimed(categoryId, subcategoryId, amount, date)
            BA-->>TM: spend updated (no-op if unclaimed)
            TM->>CTA: insert(cardTransaction)
            CTA-->>TM: transactionId
        end
    else authorized, target is an Account
        AZ-->>TM: allowed
        Note over TM: effect = EFFECT_BY_KIND[kind] &mdash; inline reference-data lookup
        alt currency does not match the target account's currency
            TM-->>API: ValidationError (FR-2.2 &mdash; no cross-currency movements)
            API-->>User: 422 transaction.currency_mismatch
        else investment kind on a credit-card-only account
            TM-->>API: ValidationError (OQ-76 &mdash; investments live in checking, savings or investment accounts)
            API-->>User: 422 transaction.investment_not_allowed_on_account
        else effect = movement or transfer
            TM->>AA: applyMovement(accountId, amount, currency)
            AA-->>TM: new balance
        else effect = bill_payment
            TM->>CCA: applyBillPayment(cardId, amount)
            CCA-->>TM: outstanding balance reduced
        else effect = investment_trade
            Note over TM: quantityDelta computed here (buy/sell/redemption rule, FR-3.8)
            opt kind = investment buy
                alt assetType is one of FR-11.1's fixed-term instruments
                    TM->>IHA: create a new Holding, always (OQ-50)
                    IHA-->>TM: new holdingId
                else no existing Holding for this ticker+account
                    TM->>IHA: create Holding (auto-create, FR-5.1/OQ-41)
                    IHA-->>TM: new holdingId
                end
            end
            TM->>IHA: applyTrade(holdingId, quantityDelta, date)
            IHA-->>TM: {newQuantity}
            opt market-priced assetType (OQ-51)
                TM->>VSA: insertAutomatic(holdingId, transactionId, valuation, date)
                Note over VSA: source = transaction &mdash; changes only with its transaction (OQ-56)
            end
            opt newQuantity = 0 (full sell or redemption)
                TM->>IHA: archive(holdingId, by = system)
                Note over IHA: auto-archive (FR-5.8, OQ-72) &mdash; undone if this<br/>transaction is later edited or deleted (OQ-80)
            end
            opt assetType is a defined FR-11.1 instrument type
                Note over TM,IPE: dueDate, rate and the debenture incentivised flag are<br/>user-supplied &mdash; not derivable from assetType alone (OQ-50, OQ-79)
                TM->>IPE: schedule(assetType, incentivised, dueDate, rate, purchaseDate, amount)
                IPE-->>TM: {cashEvents[], taxes} &mdash; tax rules coded per type, US = none estimated
                TM->>IHA: applySchedule(holdingId, schedule)
                IHA-->>TM: schedule stored
            end
            opt allocations provided (OQ-54)
                loop for each {goalId, percentage}
                    TM->>GA: allocate(holdingId, goalId, percentage)
                    alt this Holding's total allocated percentage would exceed 100%
                        GA-->>TM: rejected (FR-8.3)
                        TM-->>API: Conflict
                        API-->>User: 409 goal.allocation_exceeds_100 {current, requested}
                    else within budget
                        GA-->>TM: applied
                    end
                end
            end
        end
        TM->>BA: accrueIfClaimed(categoryId, subcategoryId, amount, date)
        BA-->>TM: spend updated
        TM->>ATA: insert(accountTransaction, effect)
        ATA-->>TM: transactionId
    end
    TM-->>LOG: logActivity(correlationId, actor, "RecordTransaction")
    TM-->>LOG: recordAudit(actor, "Transaction", transactionId)
    TM-->>API: transactionId
    API-->>User: 201 Created {transactionId}
""",
    notes="""
    <ul>
      <li>This is the same pipeline as the VBD backend doc&#39;s &sect;5 sequence diagram (Record an Account Transaction), reused here rather than redrawn from scratch &mdash; the Card Transaction branch and the HTTP/route layer are the only genuinely new detail added.</li>
      <li><strong>Two separate ledgers, one bridge:</strong> Card Transactions and Account Transactions are two distinct tables with no FK between them (OQ-16) &mdash; the only bridge is a Credit Card Bill Payment, an Account Transaction carrying a <code>credit_card_id</code>.</li>
      <li>No <code>NotificationDeliveryUtility</code> call anywhere in this flow &mdash; FR-4.4's threshold alert was removed (OQ-52, Round 8).</li>
      <li><strong>Oct 2026 review:</strong> automatic Valuation Snapshot is explicit (<code>source = transaction</code>, OQ-56); a full sell/redemption auto-archives the Holding (OQ-72); investment kinds rejected on credit-card-only accounts (OQ-76); the Engine call carries the debenture flag and returns coded taxes (OQ-79); error responses use OQ-83 codes. No recurring option (OQ-55).</li>
      <li><strong>Goal allocation can be bundled here (OQ-54, added after the API coverage audit):</strong> one call in, no separate <code>PATCH /holdings/{holdingId}</code> follow-up required &mdash; same 100%-cap rejection as that endpoint's own allocation edit (FR-8.3), just reachable from this pipeline too. Direction of control is unchanged (OQ-48): still written from the Holding's side, never the Goal's.</li>
      <li>See FR-3.1, FR-3.6&ndash;3.9, FR-5.2, FR-5.8, FR-8.2, FR-8.3, FR-11.1&ndash;11.3, OQ-16, OQ-39, OQ-48, OQ-50, OQ-51, OQ-54, OQ-56, OQ-72, OQ-76, OQ-79, OQ-83.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-transaction.html",
    title="Edit Transaction",
    subtitle='<span class="route">PATCH /transactions/:transactionId</span> &mdash; FR-3.2. Works for either an Account or Card Transaction, the same unified entry point (OQ-39). Real complexity: every downstream effect must be reversed, then reapplied with the new values.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant AA as AccountAccessor
    participant IHA as InvestmentHoldingAccessor
    participant CCA as CreditCardAccessor
    participant VSA as ValuationSnapshotAccessor
    participant BA as BudgetAccessor
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /transactions/:transactionId {amount, date, categoryId, description}
    API->>TM: edit(actor, transactionId, input)
    TM->>AZ: canWrite(actor, transactionId)?
    alt not authorized
        AZ-->>TM: denied
        TM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>TM: allowed
        Note over TM: reverse the OLD effect first, using the transaction's<br/>current stored values
        alt was a balance movement or bill payment
            TM->>AA: applyMovement(accountId, -oldAmount, currency)
        else was an investment trade
            TM->>IHA: applyTrade(holdingId, -oldQuantityDelta, oldValuation, oldDate)
        else was a card charge/refund
            TM->>CCA: applyChargeOrRefund(cardId, -oldAmount, oldKind)
        end
        TM->>BA: accrueIfClaimed(oldCategoryId, oldSubcategoryId, -oldAmount, oldDate)
        Note over TM: then reapply the NEW values &mdash; same dispatch as<br/>Record Transaction, on the new amount/date/category
        alt new effect is a balance movement or bill payment
            TM->>AA: applyMovement(accountId, newAmount, currency)
        else new effect is an investment trade
            TM->>IHA: applyTrade(holdingId, newQuantityDelta, newDate)
            IHA-->>TM: {newQuantity}
            TM->>VSA: updateAutomatic(transactionId, newValuation, newDate)
            alt newQuantity = 0
                TM->>IHA: archive(holdingId, by = system)
            else newQuantity > 0
                TM->>IHA: unarchiveIfSystemArchived(holdingId)
                Note over IHA: undoes only a system-made archive (OQ-80)
            end
        else new effect is a card charge/refund
            TM->>CCA: applyChargeOrRefund(cardId, newAmount, newKind)
        end
        TM->>BA: accrueIfClaimed(newCategoryId, newSubcategoryId, newAmount, newDate)
        TM->>ATA: update(transactionId, input)
        ATA-->>TM: updated
        TM-->>LOG: logActivity(correlationId, actor, "EditTransaction")
        TM-->>LOG: recordAudit(actor, "Transaction", transactionId)
        TM-->>API: updated
        API-->>User: 200 OK
    end
""",
    notes="""
    <ul>
      <li><strong>Reverse-then-reapply, all inside one transaction</strong> &mdash; the same complexity flagged in <code>02-data-model.md</code>&#39;s Transactions domain, now traced call-by-call. If the edit only changes the <code>date</code> to a different month, the reverse/reapply pair is what actually drives the backdated-balance cascade documented in the Accounts domain (shift every subsequent month&#39;s opening/ending balance by one delta).</li>
      <li><code>CardTransactionAccessor.update</code> path (not shown, same shape) applies when the target was a Card Transaction instead of an Account Transaction.</li>
      <li><strong>Oct 2026 review:</strong> the automatic snapshot follows the edit; the Holding is re-archived or un-archived to match the new quantity (OQ-72, OQ-80).</li>
      <li>See FR-3.2, FR-5.8.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-delete-transaction.html",
    title="Delete Transaction",
    subtitle='<span class="route">DELETE /transactions/:transactionId</span> &mdash; FR-3.2. Same reverse-effect complexity as Edit, without a reapply step.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant AA as AccountAccessor
    participant IHA as InvestmentHoldingAccessor
    participant CCA as CreditCardAccessor
    participant VSA as ValuationSnapshotAccessor
    participant BA as BudgetAccessor
    participant ATA as AccountTransactionAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /transactions/:transactionId
    API->>TM: delete(actor, transactionId)
    TM->>AZ: canWrite(actor, transactionId)?
    alt not authorized
        AZ-->>TM: denied
        TM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>TM: allowed
        alt was a balance movement or bill payment
            TM->>AA: applyMovement(accountId, -amount, currency)
        else was an investment trade
            TM->>IHA: applyTrade(holdingId, -quantityDelta, date)
            TM->>VSA: deleteAutomatic(transactionId)
            TM->>IHA: unarchiveIfSystemArchived(holdingId)
            Note over IHA: if this was the sell/redemption that zeroed the<br/>Holding, it comes back (OQ-80)
        else was a card charge/refund
            TM->>CCA: applyChargeOrRefund(cardId, -amount, kind)
        end
        TM->>BA: accrueIfClaimed(categoryId, subcategoryId, -amount, date)
        TM->>ATA: delete(transactionId)
        ATA-->>TM: deleted
        TM-->>LOG: logActivity(correlationId, actor, "DeleteTransaction")
        TM-->>LOG: recordAudit(actor, "Transaction", transactionId)
        TM-->>API: deleted
        API-->>User: 204 No Content
    end
""",
    notes="""
    <ul>
      <li>A deleted, backdated transaction runs the balance cascade in reverse across every subsequent month, same mechanic as Edit (UC-02) minus the reapply half.</li>
      <li>See FR-3.2.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-04 (Oct 2026)
UCS.append(dict(
    filename="uc-04-browse-transactions.html",
    title="Browse &amp; Filter Transactions",
    subtitle='<span class="route">GET /transactions?kinds=&amp;accountIds=&amp;creditCardIds=&amp;categoryIds=&amp;holdingId=&amp;from=&amp;to=&amp;cursor=</span> &mdash; FR-3.12/OQ-61. Both ledgers merged, newest first, cursor-paginated. Owned by <code>TransactionManager</code> (plain read of its own ledger &mdash; read-ownership rule).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor

    User->>API: GET /transactions?{filters}&cursor
    API->>TM: browse(actor, filters, cursor)
    TM->>AZ: visibleScope(actor)
    AZ-->>TM: {accountIds, creditCardIds} the actor may see (personal / shared)
    par account ledger
        TM->>ATA: list(filters within scope, cursor, limit)
        ATA-->>TM: page
    and card ledger
        TM->>CTA: list(filters within scope, cursor, limit)
        CTA-->>TM: page
    end
    Note over TM: merge newest-first, cut to limit, compute day totals<br/>per currency and the next cursor
    TM-->>API: {items, dayTotals, nextCursor}
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>Not scoped to the period bar (OQ-61):</strong> any date range, including none.</li>
      <li>Filtering by <code>holdingId</code> returns the investment transactions linked to it &mdash; the holding row's "See in Transactions" link.</li>
      <li>No logging/audit &mdash; a plain read (FR-7.1 audits mutations only).</li>
      <li>See FR-3.12, OQ-61; read-ownership rule, VBD &sect;3.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-05 (Oct 2026)
UCS.append(dict(
    filename="uc-05-view-month-overview.html",
    title="View Month Overview",
    subtitle='<span class="route">GET /reports/month-overview?year=&amp;month=</span> &mdash; FR-6.11, FR-6.6, FR-4.3, FR-8.5/OQ-74. A fixed v1 report type of <code>GET /reports/{reportType}</code> (stakeholder: reports will expand later).',
    mermaid="""
sequenceDiagram
    actor User
    participant API as Hono route
    participant IM as InsightsManager
    participant AZ as AuthorizationUtility
    participant RE as ReportingEngine
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor
    participant AA as AccountAccessor
    participant BA as BudgetAccessor
    participant GA as GoalAccessor
    participant VSA as ValuationSnapshotAccessor

    User->>API: GET /reports/month-overview?year=2026&month=9
    API->>IM: report(actor, "month-overview", {year, month})
    IM->>AZ: visibleScope(actor)
    AZ-->>IM: scope
    IM->>RE: monthOverview(scope, year, month)
    RE->>ATA: sums by currency and effect, per month of the year
    RE->>CTA: charge/refund sums by currency, per month
    Note over RE: in / out / net per currency &mdash; excluding own-account<br/>transfers and bill payments (effect column, FR-3.6/3.11)
    RE->>AA: balances at month end (derived from dated ledger, FR-6.6)
    RE->>BA: budget periods for the month (over-budget first)
    RE->>GA: goals + allocations
    RE->>VSA: latest snapshot at or before month end, per allocated Holding
    RE-->>IM: {summaryByCurrency, yearStrip, balances, budgets, goals}
    IM-->>API: report
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>Route under <code>/reports</code></strong> by stakeholder decision (sequence review Q1): month overview is a report, and reports expand in v2 (ad-hoc types, CSV export).</li>
      <li>One currency is shown at a time in the UI ($/R$ switch) &mdash; the response carries every currency, never summed (FR-2.2).</li>
      <li>See FR-6.11, FR-6.6, FR-4.3, FR-8.5, OQ-74.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
