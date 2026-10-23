#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/track-investments/*.html — CUC-6,
11 active use cases (Oct 2026 sequence review: UC-05..UC-12 added, UC-02..04 updated). UC-01 (Add Pre-Existing Investment Holding,
the onboarding-backfill path) was retired per OQ-53 — every Holding is
now created transaction-driven; see gen_record_transactions.py's own
UC-01 instead. Numbering starts at UC-02 deliberately, not renumbered,
to avoid churning cross-references elsewhere. Also rewrites the matching
call chains in docs/design/diagrams/call-chains/track-investments/ for the
use cases built in M2 part 5 (UC-02, 03, 05..11 — OQ-178). Idempotent."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import check_mermaid_source, page as _page
from gen_call_chains_oct2026_lib import CC, E, write as write_chain

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sequences", "track-investments")


def page(filename, title, subtitle, mermaid, notes):
    problems = check_mermaid_source(mermaid, filename)
    assert not problems, problems
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE_AM = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

UCS = []

P_IM = """    actor User
    participant API as Hono route
    participant IM as InsightsManager"""

# The access check every use case on a Holding takes (OQ-178): a Holding has no
# owner of its own, so the Manager reads it, then its Account, and authorizes
# on the Account's visibility and owner.
LOAD_HOLDING = """    AM->>IHA: findById(householdId, holdingId)
    IHA-->>AM: holding (or none)
    AM->>AA: findById(householdId, holding.accountId)
    AA-->>AM: its Account
    AM->>AU: authorize(actor, householdId, {ACTION, account.visibility, account.ownerUserId})
    alt not a member
        AM-->>API: 404 household.not_found
    else missing, or in someone else&#39;s personal Account
        AM-->>API: 404 holding.not_found
    else role may not ACTION_NAME (a Member may on a shared Account they created)
        AM-->>API: 403 auth.forbidden
    else allowed"""


def load_holding(action, action_name):
    return LOAD_HOLDING.replace("ACTION_NAME", action_name).replace("ACTION", action)


HOLDING_PARTICIPANTS = """    participant AU as AuthorizationUtility
    participant IHA as InvestmentHoldingAccessor
    participant AA as AccountAccessor"""


def mv(n, verb, call, route, body, status, notes):
    """Market-value (manual Valuation Snapshot) Record/Edit/Delete, as built (OQ-178)."""
    date_check = "" if verb == "Delete" else """
            AM->>VU: checkFields({asOf: dateWithin(max: today)})
            alt asOf after today
                AM-->>API: 422 validation.failed {asOf: date.max}
            else"""
    date_end = "" if verb == "Delete" else """
            end"""
    if verb == "Record":
        write = """
                AM->>VSA: insertManual(holdingId, {valuation, asOfDate})
                VSA-->>AM: snapshot
                AM-->>LOG: audit RecordMarketValue
                API-->>User: 201 Created {snapshot}"""
    else:
        empty = "" if verb == "Delete" else """
                alt nothing to change
                    AM->>VSA: list(holdingId)
                    Note over AM: read back, answered as a write would (not this Holding&#39;s &rarr; 404, automatic &rarr; 409), unaudited
                else"""
        empty_end = "" if verb == "Delete" else """
                end"""
        write = empty + f"""
                AM->>VSA: {call}
                alt not this Holding&#39;s snapshot
                    VSA-->>AM: not_found
                    AM-->>API: 404 snapshot.not_found
                else automatic (source = transaction)
                    VSA-->>AM: automatic
                    AM-->>API: 409 snapshot.automatic_not_editable
                else written
                    VSA-->>AM: done
                    AM-->>LOG: audit {verb}MarketValue
                    API-->>User: {status}
                end""" + empty_end
    UCS.append(dict(
        filename=f"uc-0{n}-{verb.lower()}-market-value.html",
        title=f"{verb} Market Value",
        subtitle=f'<span class="route">{route}</span> &mdash; FR-5.2/OQ-56. Manual Valuation Snapshot of a market-priced Holding (stock, FII, fund, other).',
        mermaid=f"""
sequenceDiagram
""" + P_CORE_AM + "\n" + HOLDING_PARTICIPANTS + f"""
    participant VU as ValidationUtility
    participant VSA as ValuationSnapshotAccessor
    participant LOG as LoggingUtility

    User->>API: {route} {body}
    API->>AM: {verb.lower()}MarketValue(context, householdId, holdingId{'' if verb == 'Record' else ', snapshotId'}{'' if verb == 'Delete' else ', input'})
""" + load_holding("data.edit", "maintain") + """
        alt Holding archived
            AM-->>API: 409 holding.archived
        else fixed-term (OQ-51)
            AM-->>API: 409 holding.not_market_priced
        else market-priced""" + date_check + write + date_end + """
        end
    end
""",
        notes=f"<ul><li>{notes}</li><li><strong>As built (OQ-178):</strong> access is the Holding&#39;s Account&#39;s (<code>data.edit</code> for all three writes); an archived Holding takes no new value; a date after today is refused on the field (<code>date.max</code>), as everywhere else (OQ-165).</li><li>Net worth and goal progress read &ldquo;latest snapshot at or before month end&rdquo; on demand &mdash; nothing to recompute here.</li><li>See FR-5.2, OQ-51, OQ-56, OQ-83, OQ-178.</li></ul>",
    ))


def ir(n, verb, route, body, call, status, refusals):
    """Index rate (FR-11.6) Record/Edit/Delete as built (OQ-172, OQ-178); `refusals`
    are the Accessor's (result, response) outcomes before the success branch."""
    outcomes = "".join(
        f"""            {'alt' if i == 0 else 'else'} {result}
                IRA-->>AM: {result}
                AM-->>API: {response}
""" for i, (result, response) in enumerate(refusals))
    if verb == "Record":
        access = """    AM->>AU: authorize(actor, householdId, {data.create, shared, ownerUserId: actor})
    alt not a member
        AM-->>API: 404 household.not_found
    else a Viewer
        AM-->>API: 403 auth.forbidden
    else allowed"""
    else:
        action = "data.edit" if verb == "Edit" else "data.delete"
        access = f"""    AM->>IRA: findById(householdId, index, valueId)
    IRA-->>AM: value (or none)
    AM->>AU: authorize(actor, householdId, {{{action}, shared, ownerUserId: value.createdByUserId}})
    alt not a member
        AM-->>API: 404 household.not_found
    else missing, or another index&#39;s
        AM-->>API: 404 index_rate.not_found
    else not Owner/Admin, nor the Member who recorded it
        AM-->>API: 403 auth.forbidden
    else allowed"""
    date_check = "" if verb == "Delete" else """
        AM->>VU: checkFields({asOf: dateWithin(max: today)})
        alt asOf after today
            AM-->>API: 422 validation.failed {asOf: date.max}
        else"""
    date_end = "" if verb == "Delete" else """
        end"""
    empty = """
        alt nothing to change
            AM-->>API: the value as loaded, unaudited
        else""" if verb == "Edit" else ""
    empty_end = """
        end""" if verb == "Edit" else ""
    UCS.append(dict(
        filename=f"uc-{n:02d}-{verb.lower()}-index-rate.html",
        title=f"{verb} Index Rate",
        subtitle=f'<span class="route">{route}</span> &mdash; FR-11.6/OQ-59. Manual, dated history per index (Selic, CDI, IPCA, IGP-M).',
        mermaid=f"""
sequenceDiagram
""" + P_CORE_AM + f"""
    participant AU as AuthorizationUtility
    participant VU as ValidationUtility
    participant IRA as IndexRateAccessor
    participant LOG as LoggingUtility

    User->>API: {route} {body}
    Note over API: contract check first: index is selic / cdi / ipca / igpm, value an integer, asOf a date
    API->>AM: {verb.lower()}IndexRate(context, householdId, index{'' if verb == 'Record' else ', valueId'}{'' if verb == 'Delete' else ', input'})
""" + access + date_check + empty + f"""
            AM->>IRA: {call}
""" + outcomes + f"""            else done
                IRA-->>AM: done
                AM-->>LOG: audit {verb}IndexRate
                API-->>User: {status}
            end""" + empty_end + date_end + """
    end
""",
        notes="<ul><li>Household-scoped reference data, written by <code>AccountManager</code>. <code>InvestmentProductEngine.project</code> reads the latest value on demand, so no projection is stored or recomputed here.</li><li><strong>As built (OQ-178):</strong> shared data whose recorder counts as its creator &mdash; any member but a Viewer records; Owner/Admin, or the Member who recorded it, corrects or deletes. A date after today is <code>date.max</code> on <code>asOf</code> (it was drawn as <code>index_rate.invalid</code>).</li><li>See FR-11.6, OQ-59, OQ-172, OQ-178.</li></ul>",
    ))


# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-holding.html",
    title="Edit Holding Goal Allocations",
    subtitle='<span class="route">GET /households/:householdId/holdings/:holdingId/allocations</span>, <span class="route">PATCH /households/:householdId/holdings/:holdingId</span> &mdash; FR-8.2/8.3/OQ-48. Allocations only &mdash; position is transaction-only, market value has its own use cases.',
    mermaid="""
sequenceDiagram
""" + P_CORE_AM + "\n" + HOLDING_PARTICIPANTS + """
    participant VU as ValidationUtility
    participant GA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: GET /households/:householdId/holdings/:holdingId/allocations
    API->>AM: listHoldingAllocations(context, householdId, holdingId)
    Note over AM: same access check (data.view), then GA.listAllocations + findByIds,<br/>the shares of Goals the caller can&#39;t see left out
    AM-->>API: the visible split
    API-->>User: 200 OK {data: [{goalId, percentage}]}

    User->>API: PATCH /households/:householdId/holdings/:holdingId {allocations: [{goalId, percentage}, ...]}
    Note over API: contract check first: each percentage 1..100 &rarr; 422
    API->>AM: editHolding(context, householdId, holdingId, allocations)
""" + load_holding("data.edit", "edit") + """
        alt Holding archived
            AM-->>API: 409 holding.archived
        else open
            AM->>GA: listAllocations({holdingId})
            GA-->>AM: the split now
            AM->>GA: findByIds(householdId, goals now + goals named)
            GA-->>AM: the Goals &mdash; those the caller can see are the visible ones
            AM->>VU: distinctItems(allocations, goalId)
            alt a Goal named twice
                AM-->>API: 422 validation.failed {allocations[i].goalId: array.duplicate}
            else a named Goal isn&#39;t visible (someone else&#39;s personal one, another household&#39;s)
                AM-->>API: 404 goal.not_found
            else a completed Goal&#39;s share grown or added (FR-8.9)
                AM-->>API: 409 goal.completed
            else
                AM->>GA: replaceAllocations(householdId, holdingId, hidden shares + the new split)
                alt total would exceed 100%
                    GA-->>AM: allocation_exceeds_100 {current, requested}
                    AM-->>API: 409 goal.allocation_exceeds_100 {current, requested}
                else Holding or Goal gone meanwhile
                    GA-->>AM: holding_not_found / goal_not_found
                    AM-->>API: 404 holding.not_found / goal.not_found
                else replaced
                    GA-->>AM: ok
                    AM-->>LOG: audit EditHoldingAllocations
                    API-->>User: 200 OK {data: the split as written}
                end
            end
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Direction of control (OQ-48):</strong> allocations are written from the Holding, never from the Goal.</li>
      <li><strong>Replace-all over what the caller can see (OQ-178):</strong> a shared Holding may fund someone else&#39;s personal Goal; the editor never sees that share, so the Manager carries it over unchanged and it still counts toward the 100% &mdash; the 409&#39;s totals include it without naming it.</li>
      <li>The &le; 100% check is a single comparison in <code>GoalAccessor</code>, made under the Holding&#39;s row lock.</li>
      <li><strong>Business rules are the Manager&#39;s (OQ-168):</strong> a Goal the actor can&#39;t see is &ldquo;not found&rdquo;, never revealed; a completed Goal&#39;s share may stay unchanged or be removed, never grow or be added.</li>
      <li><strong>Access (OQ-178):</strong> a Holding takes its Account&#39;s visibility and owner; an archived Holding is closed to edits.</li>
      <li>See FR-8.2, FR-8.3, OQ-48, OQ-168, OQ-178.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-archive-holding.html",
    title="Archive Matured Holding",
    subtitle='<span class="route">POST /households/:householdId/holdings/:holdingId/archive</span> &mdash; FR-5.8/OQ-43/OQ-72. Reached from the &ldquo;past due &mdash; archive?&rdquo; notification. One-way.',
    mermaid="""
sequenceDiagram
""" + P_CORE_AM + "\n" + HOLDING_PARTICIPANTS + """
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/holdings/:holdingId/archive
    API->>AM: archiveHolding(context, householdId, holdingId)
""" + load_holding("data.delete", "archive") + """
        alt already archived
            AM-->>API: nothing to write, unaudited
            API-->>User: 204 No Content
        else open
            AM->>IHA: listSchedule([holdingId])
            IHA-->>AM: the schedule
            alt not fixed-term, no position, or not past its redemption date
                AM-->>API: 409 holding.not_matured
            else matured
                AM->>IHA: archive(holdingId, by = user)
                Note over IHA: one-way &mdash; a user-made archive is never undone<br/>automatically (contrast OQ-80)
                alt archived meanwhile
                    IHA-->>AM: false
                    API-->>User: 204 No Content (unaudited)
                else archived now
                    IHA-->>AM: true
                    AM-->>LOG: audit ArchiveHolding
                    API-->>User: 204 No Content
                end
            end
        end
    end
    Note over User,API: frontend then calls DELETE /notifications/:notificationId<br/>(Insights UC-6) to clear the notice
""",
    notes="""
    <ul>
      <li><strong>Only a matured Holding (OQ-178):</strong> fixed-term, still holding a position, past its due date &mdash; the redemption entry&#39;s date, the same rule <code>findMaturedWithPosition</code> uses. Every other archive happens automatically in Record Transaction when a trade zeroes the Holding.</li>
      <li>Archiving is <code>data.delete</code> on the Holding&#39;s Account, like archiving an Account.</li>
      <li>See FR-5.8, OQ-43, OQ-72, OQ-80, OQ-178.</li>
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
    IHA-->>CRON: [{entryId, holdingId, accountId, kind, amount, date}, ...]
    loop for each due entry
        CRON->>SB: publish("transaction.import.requested", {entryId, ...})
        SB-->>TM: subscribe("transaction.import.requested")
        TM->>IHA: markEntryPosted(entryId)
        alt already posted (a repeated delivery)
            IHA-->>TM: false
            Note over TM: nothing more &mdash; the entry posted once (OQ-171)
        else marked now
            IHA-->>TM: true
            Note over TM: same recordTransaction(...) pipeline as POST /households/:householdId/transactions,<br/>in the same database transaction &mdash; kind = interest / redemption / tax,<br/>linked to the Holding, a redemption that zeroes it auto-archives it (OQ-72)
            TM->>ATA: insert(accountTransaction, effect, holdingId)
            ATA-->>TM: transactionId
        end
        TM-->>LOG: logActivity(correlationId, systemActor, "PostScheduledCashEvent")
        TM-->>LOG: recordAudit(systemActor, "Transaction", transactionId)
    end
""",
    notes="""
    <ul>
      <li><strong>Posted once (OQ-171):</strong> <code>markEntryPosted</code> runs in the same database transaction as the posted Transaction and only marks an unposted entry, so a repeated event delivery posts nothing twice.</li>
      <li><strong>Payout source (FR-5.9):</strong> the interest transactions posted here, linked to their Holding, are what the payout chart reads.</li>
      <li><strong>OQ-201:</strong> index-linked amounts are the projections made at buy time &mdash; the user edits a posted one to what the bank paid, or deletes it (it isn&#39;t posted again). At maturity interest (gross), tax and redemption (principal) post as three entries on the same date, each moving the account&#39;s cash.</li>
      <li>The same <code>investmentsDaily</code> run also publishes <code>holding.matured</code> (UC-11) &mdash; one cron, two events (Manager review M6).</li>
      <li>See FR-11.2, FR-11.3, FR-5.9, OQ-72.</li>
    </ul>
""",
))

mv(5, "Record", "insertManual(holdingId, {valuation, asOfDate})", "POST /households/:householdId/holdings/:holdingId/valuation-snapshots", "{value, asOf}", "201 Created {snapshot}", "Fixed-term Holdings have no snapshots (value = cost basis until redemption, OQ-51). The value is zero or more (<code>NonNegativeMoney</code>).")
mv(6, "Edit", "updateManual(holdingId, snapshotId, {valuation?, asOfDate?})", "PATCH /households/:householdId/holdings/:holdingId/valuation-snapshots/:snapshotId", "{value?, asOf?}", "200 OK {snapshot}", "Corrects a typo in a past value (OQ-56).")
mv(7, "Delete", "deleteManual(holdingId, snapshotId)", "DELETE /households/:householdId/holdings/:holdingId/valuation-snapshots/:snapshotId", "", "204 No Content", "If it was the latest, the previous snapshot becomes the current value.")
DUPLICATE_DAY = ("duplicate_day", "409 index_rate.duplicate_day")
RATE_NOT_FOUND = ("not_found (deleted meanwhile)", "404 index_rate.not_found")
ir(8, "Record", "POST /households/:householdId/index-rates/:index/values", "{value, asOf}", "insert(householdId, {indexCode, value, asOfDate}, actor)", "201 Created {value}", [DUPLICATE_DAY])
ir(9, "Edit", "PATCH /households/:householdId/index-rates/:index/values/:valueId", "{value?, asOf?}", "update(householdId, index, valueId, changes)", "200 OK {value}", [RATE_NOT_FOUND, DUPLICATE_DAY])
ir(10, "Delete", "DELETE /households/:householdId/index-rates/:index/values/:valueId", "", "remove(householdId, index, valueId)", "204 No Content", [RATE_NOT_FOUND])

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
    participant HA as HouseholdAccessor
    participant NE as NotificationEngine
    participant NIA as NotificationInboxAccessor
    participant LOG as LoggingUtility

    CRON->>IHA: findMaturedWithPosition(today)
    Note over IHA: fixed-term, redemption date < today, quantity > 0,<br/>not archived, not yet notified
    IHA-->>CRON: [{holdingId, accountId, householdId, ownerUserId, visibility, assetType, ticker, dueDate}, ...]
    loop for each matured Holding
        CRON->>SB: publish("holding.matured", the row)
        SB-->>AM: subscribe("holding.matured") &mdash; notifyMaturedHolding, as the system
        alt shared Account
            AM->>HA: listMembers(householdId)
            HA-->>AM: the members &mdash; each is a recipient (OQ-171)
        else personal Account
            Note over AM: the recipient is ownerUserId (none if the owner is gone)
        end
        par for each recipient
            AM->>NE: notify("holding.matured", {userId}, {holdingId, assetType, ticker, dueDate})
            Note over NE: routing table: holding.matured &rarr; in-app
            NE->>NIA: insert(userId, "holding.matured", params)
            NIA-->>NE: stored
            NE-->>AM: delivered (or rejected)
        end
        alt every delivery succeeded
            AM->>IHA: markMaturedNotified(holdingId)
            AM-->>LOG: info "Matured holding notified" {holdingId, recipients}
        else a delivery failed
            AM-->>LOG: warn "not marked" {holdingId, recipients, failed}
            Note over AM: not marked &mdash; tomorrow&#39;s run tries again
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Type + params, never text (OQ-82):</strong> the frontend renders &ldquo;Your CDB matured on 2026-10-01. Archive it?&rdquo; in the reader&#39;s language from <code>assetType</code>. <strong>OQ-178:</strong> the params carry <code>assetType</code> and <code>ticker</code> instead of a <code>holdingName</code> &mdash; a Holding has no name, and a label is the reader&#39;s language&#39;s to build.</li>
      <li><strong>Recipients are the Manager&#39;s (OQ-171):</strong> the event carries the Holding&#39;s Account owner and visibility; a shared Account&#39;s recipients are its household&#39;s members, read through <code>HouseholdAccessor</code> &mdash; the Accessor never reads memberships.</li>
      <li><strong>Synchronous on purpose:</strong> unlike invitations, the Manager waits for every delivery (all settled), because marking the Holding notified depends on them all. A partial failure re-notifies tomorrow, including those already told &mdash; accepted.</li>
      <li>The publisher (<code>investmentsDaily</code>) is task N9; this subscription is built with M2 part 5.</li>
      <li>Normally a redemption (UC-4) zeroes and auto-archives the Holding first; this catches the rest.</li>
      <li>See FR-5.8, FR-6.5, OQ-68, OQ-72, OQ-82, OQ-171, OQ-178; Manager review M6.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-12
UCS.append(dict(
    filename="uc-12-view-investments.html",
    title="View Investments",
    subtitle='<span class="route">GET /households/:householdId/reports/investments-overview</span>, <span class="route">GET /households/:householdId/reports/payouts?holdingIds=</span>, <span class="route">GET /households/:householdId/accounts/:accountId/holdings</span> &mdash; FR-5.3/5.4, FR-5.9, FR-11.2, FR-11.6. Fixed v1 report types under <code>/reports</code> (sequence review Q1).',
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

    User->>API: GET /households/:householdId/reports/investments-overview
    API->>IM: report(actor, "investments-overview")
    IM->>AZ: visibleScope(actor)
    IM->>RE: investmentsOverview(scope)
    RE->>IHA: holdings (cost basis for fixed-term)
    RE->>VSA: latestAsOf(market-priced holdingIds, today)
    RE->>ATA: this month's dividend / interest transactions linked to Holdings
    RE-->>IM: {netWorthByCurrency + change vs previous month, payoutThisMonth, allocations, comingDue}
    IM-->>API: report
    API-->>User: 200 OK

    User->>API: GET /households/:householdId/reports/payouts?holdingIds=a,b,c&months=12
    API->>IM: report(actor, "payouts", {holdingIds, months})
    IM->>RE: payoutSeries(scope, holdingIds, months)
    RE->>ATA: monthly sums of linked dividend / interest transactions
    RE-->>IM: series per holding (top 5 + others grouped by the frontend)
    IM-->>API: report
    API-->>User: 200 OK

    User->>API: GET /households/:householdId/accounts/:accountId/holdings
    API->>IM: holdingsByAccount(actor, accountId)
    IM->>RE: positions(accountId)
    RE-->>IM: holdings with positions and values
    loop for each fixed-term Holding
        IM->>IPE: project(holding)
        IPE->>IRA: latest(householdId, index) &mdash; index-linked rates only
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
      <li>The Rates tab reads <code>GET /households/:householdId/index-rates</code> (every index with its history) &mdash; a plain read of <code>AccountManager</code>'s own entities, so it is <code>AccountManager</code>'s (<code>IndexRateAccessor.list</code>, read-ownership rule, OQ-172), not this Manager's; so are a Holding's value history (<code>GET &hellip;/holdings/:holdingId/valuation-snapshots</code>), its schedule (<code>&hellip;/schedule-entries</code>) and its visible Goal split (<code>&hellip;/allocations</code>) &mdash; built in M2 part 5 (OQ-178).</li>
      <li><strong>Still this Manager&#39;s (M4):</strong> <code>GET &hellip;/accounts/:accountId/holdings</code> and <code>GET &hellip;/holdings/:holdingId</code> &mdash; a Holding read carries <code>expectedPayout</code> / <code>expectedTaxes</code>, and only <code>InsightsManager</code> calls <code>InvestmentProductEngine</code> (OQ-178).</li>
      <li>See FR-5.3, FR-5.4, FR-5.9, FR-11.2, FR-11.6, OQ-58, OQ-73, OQ-79.</li>
    </ul>
""",
))


for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")

# ------------------------------------------------------------ call chains
TI = CC / "track-investments"
T = "the Track Investments &amp; Net Worth set (CUC-6"
AS_BUILT = "As built in M2 part 5 (OQ-178)."
ON_HOLDING = "<code>AccountManager</code> ① <code>InvestmentHoldingAccessor.findById</code> + <code>AccountAccessor.findById</code> (sync &mdash; the Holding&#39;s Account&#39;s visibility and owner feed the check) → ② <code>AuthorizationUtility.authorize(ACTION)</code> (sync) → "
HOLDING_ACCESS = "<strong>Corrected (OQ-178):</strong> a Holding has no owner of its own, so access is decided on its Account &mdash; the <code>AccountAccessor</code> read is the check&#39;s input, not a second Accessor in a chain (both are called by the Manager)."


def on_holding(action):
    return "<strong>Chain:</strong> " + ON_HOLDING.replace("ACTION", action)


write_chain(
    TI / "uc-02-edit-holding.html",
    "Call Chain — Edit Holding Goal Allocations",
    f"Use case 2 of 12 in {T}, FR-8.2/8.3). Edit. {AS_BUILT}",
    E((1, "mgr-account", "acc-holding"), (1, "mgr-account", "acc-account"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "acc-goal"), (4, "mgr-account", "util-validation"), (5, "mgr-account", "acc-goal"),
      (6, "mgr-account", "util-logging", "a")),
    [
        on_holding("data.edit") + "③ <code>GoalAccessor.listAllocations</code> + <code>findByIds</code> (the visible Goals, the hidden shares) → ④ <code>ValidationUtility.distinctItems</code> → ⑤ <code>GoalAccessor.replaceAllocations(householdId, holdingId, hidden + new)</code> (rejects &gt; 100%, FR-8.3) → ⑥ <code>LoggingUtility</code> (async).",
        HOLDING_ACCESS,
        "<strong>No smell:</strong> the completed-Goal and visibility rules are the Manager&#39;s decisions (OQ-168); the Accessor keeps only household isolation and the cap. The split read (<code>GET &hellip;/allocations</code>) is ①–③ alone.",
    ],
)
write_chain(
    TI / "uc-03-archive-holding.html",
    "Call Chain — Archive Matured Holding",
    f"Use case 3 of 12 in {T}, FR-5.8). Lifecycle Transition (one-way, user-made). {AS_BUILT}",
    E((1, "mgr-account", "acc-holding"), (1, "mgr-account", "acc-account"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "acc-holding"), (4, "mgr-account", "util-logging", "a")),
    [
        on_holding("data.delete") + "③ <code>InvestmentHoldingAccessor.listSchedule</code> (has it matured?) then <code>archive(holdingId, by=user)</code> → ④ <code>LoggingUtility</code> (async).",
        HOLDING_ACCESS,
        "The notification that started this is then deleted by the frontend via Delete Notification (Insights UC-6) — keeps <code>AccountManager</code> off the inbox.",
    ],
)
for n, verb, method, note in [
    (5, "record", "insertManual", "Net worth and goal progress pick it up on read — nothing to recompute here."),
    (6, "edit", "updateManual (an empty edit: <code>list</code>, read back)", "Rejects automatic (transaction-driven) snapshots — those change only with their transaction (OQ-56)."),
    (7, "delete", "deleteManual", "Same restriction as Edit; the previous snapshot becomes current if this was the latest."),
]:
    kind = {"record": "Create", "edit": "Edit", "delete": "Lifecycle Transition"}[verb]
    edges = [(1, "mgr-account", "acc-holding"), (1, "mgr-account", "acc-account"), (2, "mgr-account", "util-authz")]
    if verb != "delete":
        edges.append((3, "mgr-account", "util-validation"))
    edges += [(4, "mgr-account", "acc-snapshot"), (5, "mgr-account", "util-logging", "a")]
    validation = "③ <code>ValidationUtility.dateWithin(max: today)</code> → " if verb != "delete" else ""
    write_chain(
        TI / f"uc-0{n}-{verb}-market-value.html",
        f"Call Chain — {verb.capitalize()} Market Value",
        f"Use case {n} of 12 in {T}, FR-5.2). {kind}. {AS_BUILT}",
        E(*edges),
        [
            on_holding("data.edit") + f"(open and market-priced, else 409) → {validation}④ <code>ValuationSnapshotAccessor.{method}</code> → ⑤ <code>LoggingUtility</code> (async).",
            HOLDING_ACCESS,
            note,
        ],
    )
for n, verb, method, access in [
    (8, "record", "insert(householdId, {indexCode, value, asOfDate}, actor)", "① <code>AuthorizationUtility.authorize(data.create)</code> (sync) → "),
    (9, "edit", "update(householdId, index, valueId, changes)", "① <code>IndexRateAccessor.findById</code> (its recorder) → <code>AuthorizationUtility.authorize(data.edit)</code> (sync) → "),
    (10, "delete", "remove(householdId, index, valueId)", "① <code>IndexRateAccessor.findById</code> (its recorder) → <code>AuthorizationUtility.authorize(data.delete)</code> (sync) → "),
]:
    kind = {"record": "Create", "edit": "Edit", "delete": "Lifecycle Transition"}[verb]
    edges = ([] if verb == "record" else [(1, "mgr-account", "acc-indexrate")]) + [(1, "mgr-account", "util-authz")]
    if verb != "delete":
        edges.append((2, "mgr-account", "util-validation"))
    edges += [(3, "mgr-account", "acc-indexrate"), (4, "mgr-account", "util-logging", "a")]
    validation = "② <code>ValidationUtility.dateWithin(max: today)</code> → " if verb != "delete" else ""
    write_chain(
        TI / f"uc-{n:02d}-{verb}-index-rate.html",
        f"Call Chain — {verb.capitalize()} Index Rate",
        f"Use case {n} of 12 in {T}, FR-11.6). {kind}. {AS_BUILT}",
        E(*edges),
        [
            f"<strong>Chain:</strong> <code>AccountManager</code> {access}{validation}③ <code>IndexRateAccessor.{method}</code> → ④ <code>LoggingUtility</code> (async).",
            "<strong>OQ-178:</strong> shared data whose recorder counts as its creator &mdash; a Member may correct or delete their own value, so an edit or delete reads it first.",
            "Projections read the latest value on demand, so nothing downstream is recalculated here.",
        ],
    )
write_chain(
    TI / "uc-11-notify-matured-holding.html",
    "Call Chain — Notify Matured Holding",
    f"Use case 11 of 12 in {T}, FR-5.8, FR-6.5). System-Trigger + subscriber. {AS_BUILT}",
    E((1, "acc-holding", "util-servicebus", "a"), (2, "util-servicebus", "mgr-account", "a"), (3, "mgr-account", "acc-household"),
      (4, "mgr-account", "eng-notify"), (5, "eng-notify", "acc-inbox"), (6, "mgr-account", "acc-holding"), (7, "mgr-account", "util-logging", "a")),
    [
        "<strong>Chain:</strong> <code>investmentsDaily</code> → ① <code>InvestmentHoldingAccessor.findMaturedWithPosition(today)</code> → <code>ServiceBusUtility.publish(\"holding.matured\")</code> (async) → ② <code>AccountManager.notifyMaturedHolding</code> subscribes → ③ a shared Account&#39;s recipients: <code>HouseholdAccessor.listMembers</code> (a personal one&#39;s is its owner, OQ-171) → ④ <code>NotificationEngine.notify(\"holding.matured\", {userId}, {holdingId, assetType, ticker, dueDate})</code> per recipient, all settled (sync — the Manager needs every outcome) → ⑤ in-app: <code>NotificationInboxAccessor.insert</code> → ⑥ <code>InvestmentHoldingAccessor.markMaturedNotified</code> only after every recipient was notified → ⑦ <code>LoggingUtility</code> (async).",
        "Same trigger shape as the scheduled cash events (§3.2a). <code>NotificationInboxAccessor</code> has two callers: the Engine writes, <code>InsightsManager</code> reads (View/Delete Notification) — a shared Accessor, not an Accessor→Accessor call.",
    ],
)
print(f"Rewrote 9 call chains in {TI}")
