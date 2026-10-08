#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/track-investments/*.html — CUC-6,
11 active use cases (Oct 2026 sequence review: UC-05..UC-12 added, UC-02..04 updated). UC-01 (Add Pre-Existing Investment Holding,
the onboarding-backfill path) was retired per OQ-53 — every Holding is
now created transaction-driven; see gen_record_transactions.py's own
UC-01 instead. Numbering starts at UC-02 deliberately, not renumbered,
to avoid churning cross-references elsewhere."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/track-investments"


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE_AM = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

UCS = []

P_IM = """    actor User
    participant API as Hono route
    participant IM as InsightsManager"""


def mv(n, verb, method, route, body, status, notes):
    """Market-value (manual Valuation Snapshot) Create/Edit/Delete."""
    rejects = "" if verb == "Record" else """
        else snapshot is automatic (source = transaction)
            VSA-->>AM: rejected
            AM-->>API: Conflict
            API-->>User: 409 snapshot.automatic_not_editable"""
    UCS.append(dict(
        filename=f"uc-0{n}-{verb.lower()}-market-value.html",
        title=f"{verb} Market Value",
        subtitle=f'<span class="route">{route}</span> &mdash; FR-5.2/OQ-56. Manual Valuation Snapshot of a market-priced Holding (stock, FII, fund, other).',
        mermaid=f"""
sequenceDiagram
""" + P_CORE_AM + f"""
    participant AZ as AuthorizationUtility
    participant VU as ValidationUtility
    participant IHA as InvestmentHoldingAccessor
    participant VSA as ValuationSnapshotAccessor
    participant LOG as LoggingUtility

    User->>API: {route} {body}
    API->>AM: {verb.lower()}MarketValue(actor, holdingId, input)
    AM->>AZ: canWrite(actor, holdingId)?
    alt not authorized
        AZ-->>AM: denied
        AM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>AM: allowed
        AM->>VU: check(input)
        AM->>IHA: get(holdingId)
        alt Holding is a fixed-term instrument (OQ-51)
            IHA-->>AM: assetType = CDB / Tesouro / ...
            AM-->>API: Conflict
            API-->>User: 409 holding.not_market_priced
        else market-priced
            IHA-->>AM: ok
            AM->>VSA: {method}{rejects}
        end
        AM-->>LOG: logActivity(correlationId, actor, "{verb}MarketValue")
        AM-->>LOG: recordAudit(actor, "ValuationSnapshot", snapshotId)
        AM-->>API: done
        API-->>User: {status}
    end
""",
        notes=f"<ul><li>{notes}</li><li>Net worth and goal progress read &ldquo;latest snapshot at or before month end&rdquo; on demand &mdash; nothing to recompute here.</li><li>See FR-5.2, OQ-51, OQ-56, OQ-83.</li></ul>",
    ))


def ir(n, verb, route, body, call, status):
    """Index rate (FR-11.6) Create/Edit/Delete."""
    UCS.append(dict(
        filename=f"uc-{n:02d}-{verb.lower()}-index-rate.html",
        title=f"{verb} Index Rate",
        subtitle=f'<span class="route">{route}</span> &mdash; FR-11.6/OQ-59. Manual, dated history per index (Selic, CDI, IPCA, IGP-M).',
        mermaid=f"""
sequenceDiagram
""" + P_CORE_AM + f"""
    participant AZ as AuthorizationUtility
    participant VU as ValidationUtility
    participant IRA as IndexRateAccessor
    participant LOG as LoggingUtility

    User->>API: {route} {body}
    API->>AM: {verb.lower()}IndexRate(actor, index, input)
    AM->>AZ: canWrite(actor, householdId)?
    alt not authorized
        AZ-->>AM: denied
        AM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>AM: allowed
        AM->>VU: check(input)
        alt unknown index or value out of range
            VU-->>AM: rejected
            AM-->>API: ValidationError
            API-->>User: 422 index_rate.invalid
        else valid
            AM->>IRA: {call}
            IRA-->>AM: done
            AM-->>LOG: logActivity(correlationId, actor, "{verb}IndexRate")
            AM-->>LOG: recordAudit(actor, "IndexRate", valueId)
            AM-->>API: done
            API-->>User: {status}
        end
    end
""",
        notes="<ul><li>Household-scoped reference data, written by <code>AccountManager</code>. <code>InvestmentProductEngine.project</code> reads the latest value on demand, so no projection is stored or recomputed here.</li><li>See FR-11.6, OQ-59.</li></ul>",
    ))


# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-holding.html",
    title="Edit Holding Goal Allocations",
    subtitle='<span class="route">PATCH /holdings/:holdingId</span> &mdash; FR-8.2/8.3/OQ-48. Narrowed in the Oct 2026 review: allocations only &mdash; position is transaction-only, market value has its own use cases.',
    mermaid="""
sequenceDiagram
""" + P_CORE_AM + """
    participant AZ as AuthorizationUtility
    participant GA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /holdings/:holdingId {allocations: [{goalId, percentage}, ...]}
    API->>AM: editHoldingAllocations(actor, holdingId, allocations)
    AM->>AZ: canWrite(actor, holdingId)?
    alt not authorized
        AZ-->>AM: denied
        AM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>AM: allowed
        AM->>GA: replaceAllocations(holdingId, allocations)
        alt total would exceed 100%
            GA-->>AM: rejected (FR-8.3)
            AM-->>API: Conflict
            API-->>User: 409 goal.allocation_exceeds_100 {current, requested}
        else within budget
            GA-->>AM: replaced
            AM-->>LOG: logActivity(correlationId, actor, "EditHoldingAllocations")
            AM-->>LOG: recordAudit(actor, "InvestmentHolding", holdingId)
            AM-->>API: updated
            API-->>User: 200 OK
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Direction of control (OQ-48):</strong> allocations are written from the Holding, never from the Goal.</li>
      <li>Replace-all semantics: the request carries the full allocation list, so the &le; 100% check is a single comparison in <code>GoalAccessor</code>.</li>
      <li>See FR-8.2, FR-8.3, OQ-48, OQ-56.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-archive-holding.html",
    title="Archive Matured Holding",
    subtitle='<span class="route">POST /holdings/:holdingId/archive</span> &mdash; FR-5.8/OQ-43/OQ-72. Reached from the &ldquo;past due &mdash; archive?&rdquo; notification. One-way.',
    mermaid="""
sequenceDiagram
""" + P_CORE_AM + """
    participant AZ as AuthorizationUtility
    participant IHA as InvestmentHoldingAccessor
    participant LOG as LoggingUtility

    User->>API: POST /holdings/:holdingId/archive
    API->>AM: archiveHolding(actor, holdingId)
    AM->>AZ: canWrite(actor, holdingId)?
    alt not authorized
        AZ-->>AM: denied
        AM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>AM: allowed
        AM->>IHA: archive(holdingId, by = user)
        Note over IHA: one-way &mdash; a user-made archive is never undone<br/>automatically (contrast OQ-80)
        IHA-->>AM: archived
        AM-->>LOG: logActivity(correlationId, actor, "ArchiveHolding")
        AM-->>LOG: recordAudit(actor, "InvestmentHolding", holdingId)
        AM-->>API: archived
        API-->>User: 204 No Content
    end
    Note over User,API: frontend then calls DELETE /notifications/:notificationId<br/>(Insights UC-6) to clear the notice
""",
    notes="""
    <ul>
      <li><strong>Oct 2026 review:</strong> manual archive is now only for a fixed-term Holding past due with a position; every other archive happens automatically in Record Transaction. Authorization added (it was missing).</li>
      <li>See FR-5.8, OQ-43, OQ-72, OQ-80.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-04
UCS.append(dict(
    filename="uc-04-generate-scheduled-cash-event.html",
    title="Generate Scheduled Investment Cash Event",
    subtitle='System-triggered by <code>investmentsDaily</code>, no HTTP route &mdash; FR-11.3. Re-enters the exact Record Transaction pipeline (VBD &sect;3.2a).',
    mermaid="""
sequenceDiagram
    participant CRON as investmentsDaily
    participant IHA as InvestmentHoldingAccessor
    participant SB as ServiceBusUtility
    participant TM as TransactionManager
    participant ATA as AccountTransactionAccessor
    participant LOG as LoggingUtility

    CRON->>IHA: findDueScheduleEntries(today)
    Note over IHA: reads the schedule (and coded taxes) InvestmentProductEngine<br/>computed at buy time &mdash; the Engine is NOT called again
    IHA-->>CRON: [{holdingId, accountId, kind, amount, date}, ...]
    loop for each due entry
        CRON->>SB: publish("transaction.import.requested", {...})
        SB-->>TM: subscribe("transaction.import.requested")
        Note over TM: same recordTransaction(...) pipeline as POST /transactions &mdash;<br/>kind = interest / redemption / tax, linked to the Holding,<br/>a redemption that zeroes it auto-archives it (OQ-72)
        TM->>ATA: insert(accountTransaction, effect, holdingId)
        ATA-->>TM: transactionId
        TM-->>LOG: logActivity(correlationId, systemActor, "PostScheduledCashEvent")
        TM-->>LOG: recordAudit(systemActor, "Transaction", transactionId)
    end
""",
    notes="""
    <ul>
      <li><strong>Payout source (FR-5.9):</strong> the interest transactions posted here, linked to their Holding, are what the payout chart reads.</li>
      <li>The same <code>investmentsDaily</code> run also publishes <code>holding.matured</code> (UC-11) &mdash; one cron, two events (Manager review M6).</li>
      <li>See FR-11.2, FR-11.3, FR-5.9, OQ-72.</li>
    </ul>
""",
))

mv(5, "Record", 'insertManual(holdingId, value, asOf)', "POST /holdings/:holdingId/valuation-snapshots", "{value, asOf}", "201 Created {snapshotId}", "Fixed-term Holdings have no snapshots (value = cost basis until redemption, OQ-51).")
mv(6, "Edit", 'updateManual(snapshotId, value, asOf)', "PATCH /holdings/:holdingId/valuation-snapshots/:snapshotId", "{value?, asOf?}", "200 OK", "Corrects a typo in a past value (OQ-56).")
mv(7, "Delete", 'deleteManual(snapshotId)', "DELETE /holdings/:holdingId/valuation-snapshots/:snapshotId", "", "204 No Content", "If it was the latest, the previous snapshot becomes the current value.")
ir(8, "Record", "POST /index-rates/:index/values", "{value, asOf}", "insert(householdId, index, value, asOf)", "201 Created {valueId}")
ir(9, "Edit", "PATCH /index-rates/:index/values/:valueId", "{value?, asOf?}", "update(valueId, value, asOf)", "200 OK")
ir(10, "Delete", "DELETE /index-rates/:index/values/:valueId", "", "delete(valueId)", "204 No Content")

# ---------------------------------------------------------------- UC-11
UCS.append(dict(
    filename="uc-11-notify-matured-holding.html",
    title="Notify Matured Holding",
    subtitle='System-triggered by <code>investmentsDaily</code>, no HTTP route &mdash; FR-5.8, FR-6.5/OQ-68/OQ-72.',
    mermaid="""
sequenceDiagram
    participant CRON as investmentsDaily
    participant IHA as InvestmentHoldingAccessor
    participant SB as ServiceBusUtility
    participant AM as AccountManager
    participant ND as NotificationDeliveryUtility
    participant NIA as NotificationInboxAccessor
    participant LOG as LoggingUtility

    CRON->>IHA: findMaturedWithPosition(today)
    Note over IHA: fixed-term, dueDate < today, quantity > 0,<br/>not yet notified
    IHA-->>CRON: [{holdingId, ownerUserIds}, ...]
    loop for each matured Holding
        CRON->>SB: publish("holding.matured", {holdingId, ownerUserIds})
        SB-->>AM: subscribe("holding.matured")
        loop for each owner
            AM->>ND: deliver(userId, type = "holding.matured", params = {holdingId, holdingName, dueDate})
            ND->>NIA: insert(userId, type, params, unseen)
        end
        AM->>IHA: markMaturedNotified(holdingId)
        AM-->>LOG: logActivity(correlationId, systemActor, "NotifyMaturedHolding")
    end
""",
    notes="""
    <ul>
      <li><strong>Type + params, never text (OQ-82):</strong> the frontend renders &ldquo;CDB Banco Inter 2026 reached its due date&hellip; archive it?&rdquo; in the user's language. <code>holdingName</code> is a deliberate snapshot (historical label).</li>
      <li>Normally a redemption (UC-4) zeroes and auto-archives the Holding first; this catches the rest.</li>
      <li>See FR-5.8, FR-6.5, OQ-68, OQ-72, OQ-82; Manager review M6.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-12
UCS.append(dict(
    filename="uc-12-view-investments.html",
    title="View Investments",
    subtitle='<span class="route">GET /reports/investments-overview</span>, <span class="route">GET /reports/payouts?holdingIds=</span>, <span class="route">GET /accounts/:accountId/holdings</span>, <span class="route">GET /index-rates</span> &mdash; FR-5.3/5.4, FR-5.9, FR-11.2, FR-11.6. Fixed v1 report types under <code>/reports</code> (sequence review Q1).',
    mermaid="""
sequenceDiagram
""" + P_IM + """
    participant AZ as AuthorizationUtility
    participant RE as ReportingEngine
    participant IPE as InvestmentProductEngine
    participant IHA as InvestmentHoldingAccessor
    participant VSA as ValuationSnapshotAccessor
    participant ATA as AccountTransactionAccessor
    participant IRA as IndexRateAccessor

    User->>API: GET /reports/investments-overview
    API->>IM: report(actor, "investments-overview")
    IM->>AZ: visibleScope(actor)
    IM->>RE: investmentsOverview(scope)
    RE->>IHA: holdings (cost basis for fixed-term)
    RE->>VSA: latest snapshots (market-priced)
    RE->>ATA: this month's dividend / interest transactions linked to Holdings
    RE-->>IM: {netWorthByCurrency + change vs previous month, payoutThisMonth, allocations, comingDue}
    IM-->>API: report
    API-->>User: 200 OK

    User->>API: GET /reports/payouts?holdingIds=a,b,c&months=12
    API->>IM: report(actor, "payouts", {holdingIds, months})
    IM->>RE: payoutSeries(scope, holdingIds, months)
    RE->>ATA: monthly sums of linked dividend / interest transactions
    RE-->>IM: series per holding (top 5 + others grouped by the frontend)
    IM-->>API: report
    API-->>User: 200 OK

    User->>API: GET /accounts/:accountId/holdings
    API->>IM: holdingsByAccount(actor, accountId)
    IM->>RE: positions(accountId)
    RE-->>IM: holdings with positions and values
    loop for each fixed-term Holding
        IM->>IPE: project(holding)
        IPE->>IRA: latest(index) &mdash; index-linked rates only
        IRA-->>IPE: value, asOf
        Note over IPE: coded tax rules per type (OQ-79)<br/>US: expectedTaxes = not estimated
        IPE-->>IM: {expectedPayout, expectedTaxes}
    end
    IM-->>API: holdings
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>Two Engines side by side, never calling each other</strong> &mdash; <code>InsightsManager</code> composes them (VBD &sect;3).</li>
      <li>Payout comes only from linked transactions (FR-5.9); projections are computed on read (FR-11.2) &mdash; nothing new is stored.</li>
      <li>The Rates tab reads <code>GET /index-rates</code> (every index with its history) &mdash; a plain read; value history reads <code>GET /holdings/:holdingId/valuation-snapshots</code> (exists).</li>
      <li>See FR-5.3, FR-5.4, FR-5.9, FR-11.2, FR-11.6, OQ-58, OQ-73, OQ-79.</li>
    </ul>
""",
))


for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
