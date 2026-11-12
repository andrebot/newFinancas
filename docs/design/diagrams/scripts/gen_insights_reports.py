#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/insights-reports/*.html — CUC-8,
6 use cases: 3 active in v1, Edit Dashboard Layout deferred to v3, View Report / Export CSV deferred to v2 (Oct 2026 review)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sequences", "insights-reports")


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE = """    actor User
    participant API as Hono route
    participant IM as InsightsManager"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-view-dashboard.html",
    title="View Dashboard",
    subtitle='<span class="route">GET /households/:householdId/dashboard</span> &mdash; FR-6.0 (v1 fixed panels, OQ-67). Updated in the Oct 2026 sequence review: no stored layout &mdash; widgets are v3. As built in task 139 (OQ-242, OQ-243): the panels for the server&#39;s month, no payouts.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant RE as ReportingEngine

    User->>API: GET /households/:householdId/dashboard
    API->>IM: getDashboard(context, householdId)
    IM->>AZ: authorize(actor, householdId, memberOnly)
    alt not a member
        AZ-->>IM: not_member
        IM-->>API: household.not_found
        API-->>User: 404 household.not_found
    else any member &mdash; data.view is everyone&#39;s on shared data (OQ-111)
        AZ-->>IM: allowed
        Note over IM: today in the app&#39;s time zone (OQ-104)
        IM->>RE: dashboard(viewer, today, 6)
        Note over RE: net worth per currency over the last 6 months and Coming Due<br/>(the investments overview&#39;s, without its payouts and slices),<br/>month-end balances, budgets (over-budget first) and goals<br/>(the Month Overview&#39;s) &mdash; narrowed to the viewer (OQ-206)
        RE-->>IM: {month, netWorth, comingDue, balances, budgets, goals}
        IM-->>API: the panels
        API-->>User: 200 OK DashboardReport
    end
""",
    notes="""
    <ul>
      <li><strong>v1 = fixed panels (FR-6.0, OQ-67):</strong> no <code>DashboardAccessor</code> read (parked until v3).</li>
      <li><strong>The server&#39;s month (OQ-242):</strong> the report carries <code>month</code> (<code>YYYY-MM</code>), and the app titles the page and the rails with it, never the browser&#39;s clock.</li>
      <li><strong>No payouts (OQ-243):</strong> the payout chart shows the Holdings the user picked, remembered in the browser, which the server doesn&#39;t know &mdash; so it always reads <code>GET /households/:householdId/reports/payouts</code> with that choice, sharing Investments&#39; cache. Changing the choice refetches only that.</li>
      <li>See FR-6.0, FR-5.3, FR-5.9, FR-4.3, FR-8.5, OQ-67, OQ-242, OQ-243.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-dashboard-layout.html",
    title="Edit Dashboard Layout",
    subtitle='<strong>Deferred to v3 (OQ-67).</strong> <span class="route">PATCH /households/:householdId/dashboard/widgets</span> &mdash; FR-6.1/FR-6.8. Add, remove, reorder; the same Widget type can appear more than once with different settings.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant DA as DashboardAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /households/:householdId/dashboard/widgets {widgets: [{widgetId?, widgetType, position, settings}, ...]}
    API->>IM: editLayout(actor, input)
    IM->>VU: check(input)
    alt validation fails (unknown widgetType)
        VU-->>IM: rejected
        IM-->>API: ValidationError
        API-->>User: 422 dashboard.widget_type_unknown
    else valid
        VU-->>IM: ok
        IM->>DA: upsertWidgets(actor, widgets)
        Note over DA: no uniqueness constraint on (user_id, widget_type) &mdash;<br/>two net-worth-trend widgets, one per currency, is<br/>explicitly allowed (FR-6.8)
        DA-->>IM: saved
        IM-->>LOG: logActivity(correlationId, actor, "EditDashboardLayout")
        IM-->>API: saved
        API-->>User: 200 OK
    end
""",
    notes="""
    <ul>
      <li>No <code>recordAudit</code> &mdash; a dashboard layout isn&#39;t financial/household data (FR-7.1's scope); it's purely personal-per-user presentation.</li>
      <li>See FR-6.1, FR-6.8, FR-6.9.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-view-report.html",
    title="View Report",
    subtitle='<strong>Ad-hoc report types deferred to v2 (OQ-71)</strong> &mdash; the <code>/reports/:reportType</code> resource itself is v1, serving the fixed types <code>month-overview</code>, <code>investments-overview</code>, <code>payouts</code>. <span class="route">GET /households/:householdId/reports/:reportType?year=&amp;month=</span> &mdash; FR-6.2/6.3/6.6, FR-6.11. As built in M4 (OQ-208) and task 133 (OQ-236): all three are served; <code>payouts</code> also takes <code>holdingIds</code> (comma-joined) and <code>months</code> (1..24, default 12).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant RE as ReportingEngine

    User->>API: GET /households/:householdId/reports/:reportType?year=&month=
    Note over API: contract check first: reportType one of the three v1 types,<br/>year 1900..9999, month 1..12, months 1..24 &rarr; 422 validation.failed
    API->>IM: report(context, householdId, reportType, {year?, month?, holdingIds?, months})
    IM->>AZ: authorize(actor, householdId, memberOnly)
    alt not a member
        IM-->>API: 404 household.not_found
    else investments-overview or payouts (task 133, OQ-236)
        Note over IM,RE: today in the app&#39;s time zone &mdash; see Track Investments UC-12, View Investments
        IM->>RE: investmentsOverview(viewer, today, 6) / payouts(viewer, {holdingIds, months, today})
        RE-->>IM: the overview / the series, as this member sees them
        IM-->>API: tagged reportType: investments-overview / payouts
    else month-overview &mdash; any role: data.view is everyone&#39;s on shared data (OQ-111)
        Note over IM: the month asked for &mdash; each part defaults to today&#39;s (OQ-104)
        IM->>RE: monthOverview({householdId, viewerUserId}, {year, month})
        Note over RE: narrows everything from the viewer it is handed (OQ-206):<br/>per-currency in / out / net + the year strip,<br/>month-end balances, budgets and their status, goals with progress &mdash;<br/>funding the viewer can&#39;t see counts unnamed
        RE-->>IM: the overview as this member sees it
        IM-->>API: the overview, tagged reportType: month-overview
    end
    API-->>User: 200 OK {reportType, summary, yearStrip, balances, budgets, goals}
""",
    notes="""
    <ul>
      <li><strong>As built in M4 (OQ-208):</strong> the route is the contract&#39;s parameterized operation from day one and hands every v1 type to <code>InsightsManager.report</code>; the Manager decides which types exist &mdash; after the membership check, so a non-member learns nothing &mdash; and answers each from ReportingEngine. It only decides which month (or, for payouts, which window ending today) was asked for (each part defaults to today&#39;s, OQ-104) and hands the viewer to ReportingEngine &mdash; all narrowing is the Engine&#39;s (OQ-206). Every member role may read it: <code>data.view</code> is everyone&#39;s on shared data (OQ-111), so a Viewer sees the same report, narrowed to what they can see.</li>
      <li><strong>Task 133 (OQ-236):</strong> <code>investments-overview</code> and <code>payouts</code> landed beside their first caller &mdash; the same generic use case, different parameters (spend-by-category, income-vs-expense, account-balance-by-month stay deferred to v2, OQ-71). <code>report.unknown_type_or_range</code> stays reserved for the contract.</li>
      <li>FR-6.6 states this explicitly for account-balance-by-month, and it holds for the other two: "this requires no new stored data... a reporting view over existing history, not a new data-model concept."</li>
      <li>See FR-6.2, FR-6.3, FR-6.6, FR-6.11, OQ-71, OQ-104, OQ-206, OQ-208, OQ-236.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-04
UCS.append(dict(
    filename="uc-04-export-csv.html",
    title="Export Transactions to CSV",
    subtitle='<strong>Deferred to v2 (OQ-71).</strong> <span class="route">GET /households/:householdId/reports/transactions/export?format=csv</span> &mdash; FR-6.4. A formatted PDF is a nice-to-have, not a v1 commitment; CSV is the only guaranteed export format.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant RE as ReportingEngine
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor

    User->>API: GET /households/:householdId/reports/transactions/export?format=csv&dateRange=...
    API->>IM: exportTransactions(actor, dateRange)
    IM->>RE: exportCsv(actor, dateRange)
    RE->>ATA: query(actor, dateRange)
    ATA-->>RE: rows
    RE->>CTA: query(actor, dateRange)
    CTA-->>RE: rows
    RE-->>IM: csv content
    IM-->>API: csv content
    API-->>User: 200 OK (Content-Type: text/csv, Content-Disposition: attachment)
""",
    notes="""
    <ul>
      <li>Same shape as Export Audit Log (<code>docs/design/diagrams/sequences/audit-review/uc-01-export-audit-log.html</code>) &mdash; a plain CSV download, not a browsable report.</li>
      <li>See FR-6.4.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-05
UCS.append(dict(
    filename="uc-05-view-notifications.html",
    title="View Notification Inbox",
    subtitle='<span class="route">GET /notifications</span> + <span class="route">POST /notifications/seen</span> &mdash; FR-6.10/OQ-45/OQ-105. Listing changes nothing (the bell can poll it for the unseen count); opening the inbox then marks exactly the notifications shown as seen.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant NA as NotificationInboxAccessor

    User->>API: GET /notifications
    API->>IM: listNotifications(context)
    IM->>NA: listByUser(actor)
    Note over NA: read-only &mdash; newest first (OQ-105)
    NA-->>IM: [{id, type, params, seenAt, createdAt}, ...]
    IM-->>API: notifications[]
    API-->>User: 200 OK {data: [{id, type, params, seenAt, createdAt}, ...]}
    Note over User,API: the user opens the inbox
    User->>API: POST /notifications/seen {notificationIds}
    Note over API: contract check first: 1..200 UUIDs &rarr; 422 validation.failed
    API->>IM: markNotificationsSeen(context, notificationIds)
    IM->>NA: markSeen(actor, notificationIds, now)
    Note over NA: only these IDs, only the actor's, only unseen &mdash;<br/>one that arrived after the list stays unseen (FR-6.10)
    NA-->>IM: count marked
    IM-->>API: done
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li><strong>Oct 2026 review:</strong> each item is <code>{type, params, seen, createdAt}</code> &mdash; never text (OQ-82). The frontend renders it from the shared i18n catalog and resolves IDs (e.g. a deleted inviter shows as &ldquo;Someone&rdquo;). v1 types: <code>invitation.received</code>, <code>holding.matured</code>; actions call their own use cases (accept/decline invitation, archive holding).</li>
      <li><strong>v1 producers (OQ-68):</strong> Invite User (<code>invitation.received</code>) and the daily job (<code>holding.matured</code>).</li>
      <li><strong>As built in task 139 (OQ-243):</strong> the user&#39;s own inbox, in no household &mdash; no role check; the routes sit behind their own signed-in guard. The bell polls the list every 60s while the tab is in front, and on focus; the panel marks what it opened with (in batches of 200), and those stay &ldquo;new&rdquo; while it is open.</li>
      <li><strong>Why two calls (OQ-105):</strong> a GET that marked everything seen could not feed the bell's unseen badge without clearing it, broke HTTP's safe-read rule (a prefetch or retry would clear it), and would also mark a notification arriving between the list and the mark.</li>
      <li>See FR-6.10, OQ-45.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-06
UCS.append(dict(
    filename="uc-06-delete-notification.html",
    title="Delete Notification",
    subtitle='<span class="route">DELETE /notifications/:notificationId</span> &mdash; FR-6.10/OQ-45. Hard delete, no archive &mdash; unlike most delete/archive decisions in this project, there is no history-dependency reason to keep it around.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant NA as NotificationInboxAccessor

    User->>API: DELETE /notifications/:notificationId
    API->>IM: deleteNotification(context, notificationId)
    IM->>NA: deleteForUser(actor, notificationId)
    Note over NA: ownership check and delete in one statement (OQ-105)
    alt not the actor's, or doesn't exist
        NA-->>IM: not deleted
        IM-->>API: NotFound
        API-->>User: 404 notification.not_found
    else the actor's
        NA-->>IM: deleted
        IM-->>API: deleted
        API-->>User: 204 No Content
    end
""",
    notes="""
    <ul>
      <li><strong>As built in task 139 (OQ-243):</strong> no activity log call &mdash; the request log already records the call (OQ-110), and InsightsManager has no logger. The bell&#39;s actions delete a notice the same way once the Experience that owns it reports success (the App Shell&#39;s routing).</li>
      <li>404 rather than 403 for a notification belonging to someone else &mdash; same enumeration-avoidance instinct as Revoke Session in Identity & Household.</li>
      <li>See FR-6.10, OQ-45.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
