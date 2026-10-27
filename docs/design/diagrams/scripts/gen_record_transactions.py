#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/record-transactions/*.html — CUC-4,
5 of 5 use cases (Open Banking auto-import deferred to v2, OQ-69).
Updated in the Oct 2026 sequence review (docs/architecture/08-sequence-review-2026-10.md)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sequences", "record-transactions")


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
    subtitle='<span class="route">POST /households/:householdId/transactions</span> &mdash; FR-3.1/OQ-39. One unified entry point for both Account and Card Transactions &mdash; target narrows which kinds are valid, itself data-driven. The investment-buy-against-a-fixed-term-instrument sub-case is one of the two widest-fan-out flows in the whole system.',
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

    User->>API: POST /households/:householdId/transactions {accountId | creditCardId, kind, date, amount, currency, categoryId?, description, holdingId? | assetType + ticker?, quantity?, rate?, dueDate?, interestPayment?, incentivised?, allocations?}
    API->>TM: record(actor, input)
    Note over TM: loads the target (Account or card + its Account) and, if given, the Category &mdash;<br/>an archived Account or a newly used archived Category is refused (OQ-169, OQ-201)
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
            TM->>CCA: applyMovement(cardId, {signedAmount, currency, date})
            Note over CCA: positive for a charge, negative for a refund (the Manager signs it),<br/>lands in the billing cycle the date falls in (OQ-170)
            CCA-->>TM: outstanding balance updated
            TM->>BA: accrueIfClaimed({accountScope, currency, categoryId, subcategoryId, &plusmn;amount, date})
            BA-->>TM: spend updated (no-op if unclaimed, a refund subtracts &mdash; OQ-201)
            TM->>CTA: insert({creditCardId, kind, date, amount, currency, categoryId, subcategoryId, description, createdByUserId})
            alt the card or the recorder was deleted meanwhile (a Category can't be &mdash; FR-10.3)
                CTA-->>TM: {ok: false, reason: reference_not_found}
                Note over TM: refuse &mdash; the unit of work rolls the card movement and accrual back (OQ-203)
                TM-->>API: Conflict
                API-->>User: 409 transaction.changed (retry gets the precise 404)
            else recorded
                CTA-->>TM: {ok: true, transaction}
                TM-->>LOG: logActivity(correlationId, actor, "RecordTransaction")
                TM-->>LOG: recordAudit(actor, "Transaction", transactionId)
                TM-->>API: transaction
                API-->>User: 201 Created {transaction}
            end
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
        else cash kind on a credit-card-only account
            TM-->>API: ValidationError (OQ-201 &mdash; it takes only bill payments to its cards)
            API-->>User: 422 transaction.kind_not_allowed_for_target
        else fixed-term buy: dueDate not after date, or a spread on a rate not CDI/Selic
            TM-->>API: ValidationError (OQ-205 &mdash; the Engine is never called)
            API-->>User: 422 validation.failed {dueDate | rate.spread}
        else effect = movement or transfer
            TM->>AA: applyMovement(accountId, {amount, currency, date})
            AA-->>TM: new balance
        else effect = bill_payment
            TM->>AA: applyMovement(accountId, {-amount, currency, date})
            AA-->>TM: account debited (OQ-15)
            TM->>CCA: applyMovement(cardId, {-amount, currency, date})
            CCA-->>TM: outstanding balance reduced
        else effect = investment_trade
            Note over TM: quantityDelta and costBasisDelta computed here (FR-3.8):<br/>a buy adds what was paid, a sell or redemption removes its average cost (OQ-171),<br/>a sell or redemption names its Holding by holdingId (OQ-201)
            TM->>AA: applyMovement(accountId, {&minus;amount for a buy, +amount for a sell or redemption, currency, date})
            AA-->>TM: cash moved (OQ-201 &mdash; history only when dated before the starting balance, OQ-169)
            opt kind = investment buy
                alt assetType is one of FR-11.1's fixed-term instruments
                    TM->>IHA: insert(holding) &mdash; a new Holding, always (OQ-50)
                    IHA-->>TM: new Holding
                else market-priced
                    TM->>IHA: findByTicker(accountId, assetType, ticker)
                    IHA-->>TM: the Holding, archived ones included (OQ-171)
                    opt none
                        TM->>IHA: insert(holding) (auto-create, FR-5.1/OQ-41)
                        IHA-->>TM: new Holding
                    end
                end
            end
            TM->>IHA: applyTrade(holdingId, {quantityDelta, costBasisDelta})
            IHA-->>TM: {quantity, costBasis}
            Note over IHA: refused below zero: insufficient_quantity / cost_basis_below_zero
            opt market-priced assetType (OQ-51)
                TM->>VSA: insertAutomatic(holdingId, transactionId, valuation, date)
                Note over VSA: source = transaction &mdash; changes only with its transaction (OQ-56)
            end
            alt quantity = 0 (full sell or redemption)
                TM->>IHA: archive(holdingId, by = system)
                Note over IHA: auto-archive (FR-5.8, OQ-72) &mdash; undone if this<br/>transaction is later edited or deleted (OQ-80)
            else a buy into a system-archived Holding
                TM->>IHA: unarchiveIfSystemArchived(holdingId)
                Note over IHA: the re-buy reopens the position (OQ-171)
            end
            opt assetType is a defined FR-11.1 instrument type
                Note over TM,IPE: dueDate, rate and the debenture incentivised flag are<br/>user-supplied &mdash; not derivable from assetType alone (OQ-50, OQ-79)
                TM->>IPE: schedule(householdId, {assetType, incentivised, date, amount, dueDate, rate, interestPayment})
                Note over IPE: reads the latest index value itself for an index-linked rate &mdash; amounts are projections,<br/>BR business days (252), US actual/365, at maturity interest + tax + redemption (OQ-201)
                alt the index has no value yet (OQ-205)
                    IPE-->>TM: {ok: false, reason: index_missing, indexCode}
                    TM-->>API: refused &mdash; nothing kept
                    API-->>User: 422 index_rate.missing {indexCode}
                else
                    IPE-->>TM: entries &mdash; tax rules coded per type, US = none estimated
                    TM->>IHA: applySchedule(holdingId, schedule)
                    IHA-->>TM: schedule stored (replace-all, refused once an entry posted, OQ-171)
                end
            end
            opt allocations provided (OQ-54, OQ-168)
                TM->>GA: findByIds(householdId, goalIds)
                GA-->>TM: the named Goals
                TM->>GA: listAllocations({holdingId})
                GA-->>TM: the Holding's current split
                alt a named Goal isn't visible to the actor
                    TM-->>API: NotFound
                    API-->>User: 404 goal.not_found
                else a named Goal is completed (FR-8.9)
                    TM-->>API: Conflict
                    API-->>User: 409 goal.completed
                else the purchase's own split passes 100% (FR-8.3)
                    TM-->>API: Conflict
                    API-->>User: 409 goal.allocation_exceeds_100 {current, requested}
                else
                    Note over TM: the split applies to the purchase: re-weight the existing split by value<br/>(existing quantity &times; this buy's unit price) plus the purchase's shares &mdash;<br/>largest remainder, a share rounding to 0% dropped, completed Goals re-weighted too
                    TM->>GA: replaceAllocations(householdId, holdingId, shares)
                    GA-->>TM: replaced
                end
            end
        end
        TM->>BA: accrueIfClaimed({accountScope, currency, categoryId, subcategoryId, &plusmn;amount, date})
        BA-->>TM: spend updated (any kind may carry a category, money in subtracts &mdash; OQ-201)
        TM->>ATA: insert({…transaction, effect, trade: {quantityDelta, costBasisDelta}, createdByUserId})
        alt an Account, Holding, card or user it names was deleted meanwhile
            ATA-->>TM: {ok: false, reason: reference_not_found}
            Note over TM: refuse &mdash; the unit of work rolls every write above back (OQ-107)
            TM-->>API: Conflict
            API-->>User: 409 transaction.changed (retry gets the precise 404)
        else recorded
            ATA-->>TM: {ok: true, transaction}
            TM-->>LOG: logActivity(correlationId, actor, "RecordTransaction")
            TM-->>LOG: recordAudit(actor, "Transaction", transactionId)
            TM-->>API: transaction
            API-->>User: 201 Created {transaction}
        end
    end
""",
    notes="""
    <ul>
      <li>This is the same pipeline as the VBD backend doc&#39;s &sect;5 sequence diagram (Record an Account Transaction), reused here rather than redrawn from scratch &mdash; the Card Transaction branch and the HTTP/route layer are the only genuinely new detail added.</li>
      <li><strong>Two separate ledgers, one bridge:</strong> Card Transactions and Account Transactions are two distinct tables with no FK between them (OQ-16) &mdash; the only bridge is a Credit Card Bill Payment, an Account Transaction carrying a <code>credit_card_id</code>.</li>
      <li>No <code>NotificationDeliveryUtility</code> call anywhere in this flow &mdash; FR-4.4's threshold alert was removed (OQ-52, Round 8).</li>
      <li><strong>Oct 2026 review:</strong> automatic Valuation Snapshot is explicit (<code>source = transaction</code>, OQ-56); a full sell/redemption auto-archives the Holding (OQ-72); investment kinds rejected on credit-card-only accounts (OQ-76); the Engine call carries the debenture flag and returns coded taxes (OQ-79); error responses use OQ-83 codes. No recurring option (OQ-55).</li>
      <li><strong>Re-buying a zeroed Holding (OQ-171):</strong> a market-priced buy reopens the system-archived Holding of its ticker. Its old Goal split is worth 0 at quantity 0, so the buy's re-weighting (OQ-168) drops every old share &mdash; the new buy's split is the only one left; undoing the zeroing sell instead restores the old split intact.</li>
      <li><strong>Goal allocation can be bundled here (OQ-54, added after the API coverage audit):</strong> one call in, no separate <code>PATCH /households/:householdId/holdings/{holdingId}</code> follow-up required &mdash; same 100%-cap rejection as that endpoint's own allocation edit (FR-8.3), just reachable from this pipeline too. Direction of control is unchanged (OQ-48): still written from the Holding's side, never the Goal's.</li>
      <li><strong>The buy's split is the purchase's (OQ-168):</strong> buying into a Holding that already funds Goals re-weights its whole split by value at this buy's unit price, so every Goal keeps exactly its money (900 at Retirement 60% / Trip 20%, plus 100 for Car 100% &rarr; 54% / 18% / 10%). One replace-all write, so a refusal never leaves half a split behind.</li>
      <li><strong>Slice 3 readiness (OQ-201):</strong> every trade moves the account&#39;s cash (a buy debits it, a sell or redemption credits it); sell, redemption, dividend, interest and tax name their Holding by <code>holdingId</code>; a credit-card-only account takes only bill payments to its cards; any kind may carry a category and money in reduces the claiming Budget&#39;s spend; the trade&#39;s deltas and the recorder are stored with the transaction. Transfers are two unlinked entries &mdash; each is an ordinary <code>transfer</code>-effect movement.</li>
      <li>All writes share one database transaction (<code>UnitOfWorkUtility</code>) &mdash; any refusal rolls every one back.</li>
      <li>See FR-3.1, FR-3.6&ndash;3.9, FR-5.2, FR-5.8, FR-8.2, FR-8.3, FR-11.1&ndash;11.3, OQ-16, OQ-39, OQ-48, OQ-50, OQ-51, OQ-54, OQ-56, OQ-72, OQ-76, OQ-79, OQ-83, OQ-201.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-transaction.html",
    title="Edit Transaction",
    subtitle='<span class="route">PATCH /households/:householdId/transactions/:transactionId</span> &mdash; FR-3.2. Works for either an Account or Card Transaction, the same unified entry point (OQ-39). Real complexity: every downstream effect must be reversed, then reapplied with the new values.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant AA as AccountAccessor
    participant IHA as InvestmentHoldingAccessor
    participant IPE as InvestmentProductEngine
    participant CCA as CreditCardAccessor
    participant VSA as ValuationSnapshotAccessor
    participant BA as BudgetAccessor
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /households/:householdId/transactions/:transactionId {date?, amount?, categoryId?, subcategoryId?, description?, quantity?, rate?, dueDate?, interestPayment?, incentivised?}
    API->>TM: edit(actor, transactionId, input)
    TM->>ATA: findById(householdId, transactionId) (else the card ledger)
    ATA-->>TM: the stored transaction &mdash; kind, target, trade deltas, recorder
    TM->>AZ: canWrite(actor, transactionId)?
    alt not authorized
        AZ-->>TM: denied
        TM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else a fixed-term buy whose schedule has posted, and amount, date or terms change
        TM-->>API: Conflict
        API-->>User: 409 transaction.schedule_started (OQ-201 &mdash; description and category still edit)
    else authorized
        AZ-->>TM: allowed
        Note over TM: values change, never identity: kind, account, card and Holding stay (OQ-201).<br/>Reverse the OLD effect first, using the transaction's current stored values
        alt was a balance movement or bill payment
            TM->>AA: applyMovement(accountId, {-oldAmount, currency, oldDate})
            opt was a bill payment
                TM->>CCA: applyMovement(cardId, {+oldAmount, currency, oldDate})
            end
        else was an investment trade
            TM->>AA: applyMovement(accountId, {&plusmn;oldAmount reversed, currency, oldDate})
            TM->>IHA: applyTrade(holdingId, {-oldQuantityDelta, -oldCostBasisDelta})
        else was a card charge/refund
            TM->>CCA: applyMovement(cardId, {-oldSignedAmount, currency, oldDate})
        end
        TM->>BA: accrueIfClaimed({accountScope, currency, oldCategoryId, oldSubcategoryId, &mp;oldAmount, oldDate})
        Note over TM: then reapply the NEW values &mdash; same dispatch as<br/>Record Transaction, on the new amount/date/category
        alt new effect is a balance movement or bill payment
            TM->>AA: applyMovement(accountId, {newAmount, currency, newDate})
            opt is a bill payment
                TM->>CCA: applyMovement(cardId, {-newAmount, currency, newDate})
            end
        else new effect is an investment trade
            TM->>AA: applyMovement(accountId, {&mp;newAmount, currency, newDate})
            TM->>IHA: applyTrade(holdingId, {newQuantityDelta, newCostBasisDelta})
            IHA-->>TM: {quantity, costBasis}
            opt market-priced
                TM->>VSA: updateAutomatic(transactionId, newValuation, newDate)
            end
            opt a fixed-term buy whose terms, amount or date changed (schedule not started)
                Note over TM: dueDate after date, a spread only on CDI/Selic &mdash; else 422 validation.failed (OQ-205)
                TM->>IHA: updateTerms(holdingId, {rate, dueDate, interestPayment, incentivised})
                TM->>IPE: schedule(householdId, {new terms})
                alt the index has no value yet (OQ-205)
                    IPE-->>TM: {ok: false, reason: index_missing, indexCode}
                    TM-->>API: refused &mdash; nothing kept
                    API-->>User: 422 index_rate.missing {indexCode}
                else
                    IPE-->>TM: entries
                    TM->>IHA: applySchedule(holdingId, entries) &mdash; replace-all (OQ-171)
                end
            end
            alt quantity = 0
                TM->>IHA: archive(holdingId, by = system)
            else quantity > 0
                TM->>IHA: unarchiveIfSystemArchived(holdingId)
                Note over IHA: undoes only a system-made archive (OQ-80)
            end
        else new effect is a card charge/refund
            TM->>CCA: applyMovement(cardId, {newSignedAmount, currency, newDate})
        end
        TM->>BA: accrueIfClaimed({accountScope, currency, newCategoryId, newSubcategoryId, &plusmn;newAmount, newDate})
        TM->>ATA: update(transactionId, expected, {values, trade: {newQuantityDelta, newCostBasisDelta}})
        Note over ATA: guarded by the values read (OQ-107)
        alt they changed meanwhile
            ATA-->>TM: stale
            Note over TM: refuse &mdash; the unit of work rolls the reverse and reapply back
            TM-->>API: Conflict
            API-->>User: 409 transaction.changed (reload and retry)
        else updated
            ATA-->>TM: {status: updated, transaction}
            TM-->>LOG: logActivity(correlationId, actor, "EditTransaction")
            TM-->>LOG: recordAudit(actor, "Transaction", transactionId)
            TM-->>API: transaction
            API-->>User: 200 OK
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Reverse-then-reapply, all inside one transaction</strong> &mdash; the same complexity flagged in <code>02-data-model.md</code>&#39;s Transactions domain, now traced call-by-call. If the edit only changes the <code>date</code> to a different month, the reverse/reapply pair is what actually drives the backdated-balance cascade documented in the Accounts domain (shift every subsequent month&#39;s opening/ending balance by one delta).</li>
      <li><code>CardTransactionAccessor.update</code> path (not shown, same shape) applies when the target was a Card Transaction instead of an Account Transaction.</li>
      <li><strong>Oct 2026 review:</strong> the automatic snapshot follows the edit; the Holding is re-archived or un-archived to match the new quantity (OQ-72, OQ-80).</li>
      <li><strong>OQ-201:</strong> the trade&#39;s cash leg is undone and redone with it; a buy or sell may change its quantity, a fixed-term buy its rate, due date, interest payment and debenture flag &mdash; and its schedule is recomputed while no entry has posted. Once one has, its amount, date and terms are locked (409). The Budget accrual is undone and redone with its sign (money in subtracts). Transactions the schedule posted edit like any other.</li>
      <li>See FR-3.2, FR-5.8, OQ-201.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-delete-transaction.html",
    title="Delete Transaction",
    subtitle='<span class="route">DELETE /households/:householdId/transactions/:transactionId</span> &mdash; FR-3.2. Same reverse-effect complexity as Edit, without a reapply step.',
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
    participant GA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId/transactions/:transactionId
    API->>TM: delete(actor, transactionId)
    TM->>ATA: findById(householdId, transactionId) (else the card ledger)
    ATA-->>TM: the stored transaction
    TM->>AZ: canWrite(actor, transactionId)?
    alt not authorized
        AZ-->>TM: denied
        TM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else a fixed-term buy whose schedule has posted
        TM-->>API: Conflict
        API-->>User: 409 transaction.schedule_started (OQ-201)
    else the buy that created its Holding, and other transactions reference it
        TM->>ATA: countForHolding(holdingId, buyId)
        ATA-->>TM: n &gt; 0
        TM-->>API: Conflict
        API-->>User: 409 transaction.holding_in_use {count} (OQ-201)
    else authorized
        AZ-->>TM: allowed
        alt was a balance movement or bill payment
            TM->>AA: applyMovement(accountId, {-amount, currency, date})
            opt was a bill payment
                TM->>CCA: applyMovement(cardId, {+amount, currency, date})
            end
        else was an investment trade
            TM->>AA: applyMovement(accountId, {&plusmn;amount reversed, currency, date})
            alt the buy that created its Holding, nothing else references it
                TM->>GA: replaceAllocations(householdId, holdingId, [])
                TM->>IHA: delete(holdingId)
                Note over IHA: the Holding goes with its buy &mdash; snapshots and schedule cascade (OQ-201)
            else
                TM->>IHA: applyTrade(holdingId, {-quantityDelta, -costBasisDelta})
                TM->>VSA: deleteAutomatic(transactionId)
                TM->>IHA: unarchiveIfSystemArchived(holdingId)
                Note over IHA: if this was the sell/redemption that zeroed the<br/>Holding, it comes back (OQ-80)
            end
        else was a card charge/refund
            TM->>CCA: applyMovement(cardId, {-signedAmount, currency, date})
        end
        TM->>BA: accrueIfClaimed({accountScope, currency, categoryId, subcategoryId, &mp;amount, date})
        TM->>ATA: delete(transactionId, expected)
        alt the values read changed meanwhile
            ATA-->>TM: stale
            Note over TM: refuse &mdash; the unit of work rolls every reversal back (OQ-107)
            TM-->>API: Conflict
            API-->>User: 409 transaction.changed (reload and retry)
        else deleted
            ATA-->>TM: deleted
            TM-->>LOG: logActivity(correlationId, actor, "DeleteTransaction")
            TM-->>LOG: recordAudit(actor, "Transaction", transactionId)
            TM-->>API: deleted
            API-->>User: 204 No Content
        end
    end
""",
    notes="""
    <ul>
      <li>A deleted, backdated transaction runs the balance cascade in reverse across every subsequent month, same mechanic as Edit (UC-02) minus the reapply half.</li>
      <li><strong>OQ-201:</strong> a trade&#39;s cash leg is reversed too. Deleting the buy that created a Holding deletes the Holding (its Goal split, snapshots and schedule with it) when no other transaction references it, and is refused otherwise; a fixed-term buy whose schedule has posted can&#39;t be deleted. A deleted transaction the schedule posted isn&#39;t posted again &mdash; its entry stays marked.</li>
      <li>See FR-3.2, OQ-201.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-04 (Oct 2026)
UCS.append(dict(
    filename="uc-04-browse-transactions.html",
    title="Browse &amp; Filter Transactions",
    subtitle='<span class="route">GET /households/:householdId/transactions?kinds=&amp;accountIds=&amp;creditCardIds=&amp;categoryIds=&amp;holdingId=&amp;from=&amp;to=&amp;cursor=</span> &mdash; FR-3.12/OQ-61. Both ledgers merged, newest first, cursor-paginated. Owned by <code>TransactionManager</code> (plain read of its own ledger &mdash; read-ownership rule).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor

    User->>API: GET /households/:householdId/transactions?{filters}&cursor
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
    Note over TM: merge newest-first, cut to limit, the next cursor
    par account ledger
        TM->>ATA: dayTotals(filter, page's days) + monthCounts(filter, page's months)
        ATA-->>TM: sums by day, currency and kind &mdash; counts by month
    and card ledger
        TM->>CTA: dayTotals(filter, page's days) + monthCounts(filter, page's months)
        CTA-->>TM: sums by day, currency and kind &mdash; counts by month
    end
    Note over TM: sign each kind's sum and add up per day and currency &mdash; over the<br/>whole filtered set, not only the page (OQ-201)
    TM-->>API: {items, dayTotals, monthCounts, nextCursor}
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>Not scoped to the period bar (OQ-61):</strong> any date range, including none.</li>
      <li>Filtering by <code>holdingId</code> returns the investment transactions linked to it &mdash; the holding row's "See in Transactions" link.</li>
      <li><strong>Filters (OQ-201):</strong> combined with AND; accounts and cards are one picker (a row matches when its account or card is selected, a card's rows also when its Account is &mdash; OQ-204; none = all); a Category includes its Subcategories.</li>
      <li>No logging/audit &mdash; a plain read (FR-7.1 audits mutations only).</li>
      <li>See FR-3.12, OQ-61; read-ownership rule, VBD &sect;3.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-05 (Oct 2026)
UCS.append(dict(
    filename="uc-05-view-month-overview.html",
    title="View Month Overview",
    subtitle='<span class="route">GET /households/:householdId/reports/month-overview?year=&amp;month=</span> &mdash; FR-6.11, FR-6.6, FR-4.3, FR-8.5/OQ-74. A fixed v1 report type of <code>GET /households/:householdId/reports/{reportType}</code> (stakeholder: reports will expand later).',
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
    participant CCA as CreditCardAccessor
    participant BA as BudgetAccessor
    participant GA as GoalAccessor
    participant IHA as InvestmentHoldingAccessor
    participant VSA as ValuationSnapshotAccessor

    User->>API: GET /households/:householdId/reports/month-overview?year=2026&month=9
    API->>IM: report(actor, "month-overview", {year, month})
    IM->>AZ: visibleScope(actor)
    AZ-->>IM: scope
    IM->>RE: monthOverview({householdId, viewerUserId}, {year, month})
    RE->>AA: list(householdId, viewerUserId) &mdash; the Accounts the viewer sees
    RE->>CCA: listByAccounts(accountIds)
    RE->>ATA: monthlySums(accountIds, Jan 1, Dec 31) &mdash; by month, currency, kind and stored effect
    RE->>CTA: monthlySums(creditCardIds, from, to) &mdash; charge / refund by month, currency and kind
    Note over RE: in / out / net per currency &mdash; excluding own-account<br/>transfers and bill payments (effect column, FR-3.6/3.11)
    RE->>AA: balancesAsOf(accountIds, month) &mdash; month-end balances (FR-6.6)
    RE->>CCA: balancesAsOf(cardIds, month) &mdash; month-end outstanding (OQ-201)
    RE->>BA: list(householdId, viewerUserId) + listPeriods(budgetId, {to: month}) &mdash; target in effect, spend (over-budget first)
    RE->>GA: list(householdId, viewerUserId, active) + listAllocations({goalIds})
    RE->>IHA: findByIds(householdId, allocated holdingIds) &mdash; with their currency
    RE->>VSA: latestAsOf(market-priced holdingIds, monthEnd)
    RE->>ATA: costBasisAsOf(fixed-term holdingIds, monthEnd) &mdash; OQ-206
    Note over RE: funding in an Account the viewer can't see counts, unnamed (OQ-206)
    RE-->>IM: {summaryByCurrency, yearStrip, balances, budgets, goals}
    IM-->>API: report
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>Route under <code>/reports</code></strong> by stakeholder decision (sequence review Q1): month overview is a report, and reports expand in v2 (ad-hoc types, CSV export).</li>
      <li>One currency is shown at a time in the UI ($/R$ switch) &mdash; the response carries every currency, never summed (FR-2.2).</li>
      <li><strong>OQ-201:</strong> In/Out count card charges and refunds and investment buys and sells, leave out transfers and bill payments; a card shows its outstanding balance at the month&#39;s end; each Budget item carries its id, name, currency and visibility, and one with no period opened that month shows the target in effect and zero spend; Goals come per currency &mdash; the frontend shows the Goal&#39;s own currency and a note when others fund it. Archived Accounts are left out.</li>
      <li><strong>OQ-206:</strong> the strip is January&ndash;December of the selected year; a fixed-term Holding&#39;s value at the month&#39;s end is its trades&#39; cost basis by then; a Goal&#39;s funding in an Account the viewer can&#39;t see counts with no id or name.</li>
      <li>See FR-6.11, FR-6.6, FR-4.3, FR-8.5, OQ-74, OQ-206.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
