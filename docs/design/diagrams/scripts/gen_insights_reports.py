#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/insights-reports/*.html — CUC-8,
6 use cases: 3 active in v1, Edit Dashboard Layout deferred to v3, View Report / Export CSV deferred to v2 (Oct 2026 review)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/insights-reports"


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
    subtitle='<span class="route">GET /dashboard</span> &mdash; FR-6.0 (v1 fixed panels, OQ-67). Updated in the Oct 2026 sequence review: no stored layout &mdash; widgets are v3.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant RE as ReportingEngine

    User->>API: GET /dashboard
    API->>IM: getDashboard(actor)
    IM->>AZ: visibleScope(actor)
    AZ-->>IM: scope (personal + shared, FR-2.3/4.2/8.1)
    IM->>RE: dashboard(scope, today)
    Note over RE: net worth per currency + change vs previous month,<br/>coming-due fixed income, payout series (default holdings),<br/>balances, budgets (over-budget first), goals &mdash; the same<br/>shapes the month-overview / investments-overview reports and<br/>View Goals produce, composed once
    RE-->>IM: panels
    IM-->>API: dashboard {panels}
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>v1 = fixed panels (FR-6.0, OQ-67):</strong> no <code>DashboardAccessor</code> read (parked until v3). Changing which holdings the payout chart shows refetches <code>GET /reports/payouts</code> only.</li>
      <li>See FR-6.0, FR-5.3, FR-5.9, FR-4.3, FR-8.5, OQ-67.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-dashboard-layout.html",
    title="Edit Dashboard Layout",
    subtitle='<strong>Deferred to v3 (OQ-67).</strong> <span class="route">PATCH /dashboard/widgets</span> &mdash; FR-6.1/FR-6.8. Add, remove, reorder; the same Widget type can appear more than once with different settings.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant DA as DashboardAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /dashboard/widgets {widgets: [{widgetId?, widgetType, position, settings}, ...]}
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
    subtitle='<strong>Ad-hoc report types deferred to v2 (OQ-71)</strong> &mdash; the <code>/reports/:reportType</code> resource itself is v1, serving the fixed types <code>month-overview</code>, <code>investments-overview</code>, <code>payouts</code>. <span class="route">GET /reports/:reportType</span> &mdash; FR-6.2/6.3/6.6. One generic use case standing in for spend-by-category, income-vs-expense, and account-balance-by-month &mdash; the same computation shape, different parameters.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant RE as ReportingEngine
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor

    User->>API: GET /reports/:reportType?dateRange=...&accountId=...
    API->>IM: getReport(actor, reportType, params)
    alt reportType unknown or dateRange malformed
        IM-->>API: BadRequest
        API-->>User: 400 report.unknown_type_or_range
    else valid
        IM->>RE: generate(reportType, params, actor)
        RE->>ATA: query(actor, dateRange, filters)
        ATA-->>RE: rows
        RE->>CTA: query(actor, dateRange, filters)
        CTA-->>RE: rows
        Note over RE: income-vs-expense excludes transfers via the persisted<br/>effect column (FR-3.6) &mdash; not recomputed from kind each time
        RE-->>IM: report data
        IM-->>API: report
        API-->>User: 200 OK {report data}
    end
""",
    notes="""
    <ul>
      <li>FR-6.6 states this explicitly for account-balance-by-month, and it holds for the other two: "this requires no new stored data... a reporting view over existing history, not a new data-model concept."</li>
      <li>See FR-6.2, FR-6.3, FR-6.6, FR-3.6.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-04
UCS.append(dict(
    filename="uc-04-export-csv.html",
    title="Export Transactions to CSV",
    subtitle='<strong>Deferred to v2 (OQ-71).</strong> <span class="route">GET /reports/transactions/export?format=csv</span> &mdash; FR-6.4. A formatted PDF is a nice-to-have, not a v1 commitment; CSV is the only guaranteed export format.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant RE as ReportingEngine
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor

    User->>API: GET /reports/transactions/export?format=csv&dateRange=...
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
    subtitle='<span class="route">GET /notifications</span> &mdash; FR-6.10/OQ-45. Opening the inbox marks every notification currently shown as seen &mdash; a bulk update, not a per-item action.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant NA as NotificationInboxAccessor

    User->>API: GET /notifications
    API->>IM: listNotifications(actor)
    IM->>NA: listByUser(actor)
    NA-->>IM: [{notificationId, type, message, seenAt}, ...]
    IM->>NA: markAllSeen(actor)
    Note over NA: bulk update &mdash; every notification currently shown<br/>gets seenAt = now (FR-6.10)
    NA-->>IM: marked
    IM-->>API: notifications[]
    API-->>User: 200 OK [{notificationId, type, message, seenAt}, ...]
""",
    notes="""
    <ul>
      <li><strong>Oct 2026 review:</strong> each item is <code>{type, params, seen, createdAt}</code> &mdash; never text (OQ-82). The frontend renders it from the shared i18n catalog and resolves IDs (e.g. a deleted inviter shows as &ldquo;Someone&rdquo;). v1 types: <code>invitation.received</code>, <code>holding.matured</code>; actions call their own use cases (accept/decline invitation, archive holding).</li>
      <li><strong>Standing infrastructure, no active producer yet</strong> &mdash; both of FR-6.5's stated v1 triggers (budget threshold, Open Banking sync failure) are currently inactive (one removed, one deferred), so in practice this inbox is empty today. The mechanism is fully wired and ready regardless (see <code>02-data-model.md</code>'s Insights domain).</li>
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
    participant LOG as LoggingUtility

    User->>API: DELETE /notifications/:notificationId
    API->>IM: deleteNotification(actor, notificationId)
    IM->>NA: findById(notificationId)
    alt notification does not belong to actor, or doesn't exist
        NA-->>IM: not found
        IM-->>API: NotFound
        API-->>User: 404 notification.not_found
    else belongs to actor
        NA-->>IM: found
        IM->>NA: delete(notificationId)
        NA-->>IM: deleted
        IM-->>LOG: logActivity(correlationId, actor, "DeleteNotification")
        IM-->>API: deleted
        API-->>User: 204 No Content
    end
""",
    notes="""
    <ul>
      <li>404 rather than 403 for a notification belonging to someone else &mdash; same enumeration-avoidance instinct as Revoke Session in Identity & Household.</li>
      <li>See FR-6.10, OQ-45.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
