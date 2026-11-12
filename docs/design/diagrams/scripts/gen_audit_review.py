#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/audit-review/*.html — CUC-9, 1 of 1
use case."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sequences", "audit-review")


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-export-audit-log.html",
    title="Export Audit Log",
    subtitle='<span class="route">GET /households/:householdId/audit-log/export?startDate=&amp;endDate=</span> &mdash; FR-7.2/OQ-46. Owner/Admin only. This is the Audit Log&#39;s ONLY access method in v1 &mdash; there is no in-app browsable table anywhere in this API. As built in task 139 (OQ-243): both days required, the end not before the start.',
    mermaid="""
sequenceDiagram
    actor User
    participant API as Hono route
    participant IM as InsightsManager
    participant AZ as AuthorizationUtility
    participant AA as AuditLogAccessor
    participant RE as ReportingEngine

    User->>API: GET /households/:householdId/audit-log/export?startDate=...&endDate=...
    Note over API: contract check first: both days, ISO dates &rarr; 422 validation.failed (field.required)
    API->>IM: exportAuditLog(context, householdId, {startDate, endDate})
    IM->>AZ: authorize(actor, householdId, audit.export)
    alt not a member
        AZ-->>IM: not_member
        IM-->>API: household.not_found
        API-->>User: 404 household.not_found
    else Member or Viewer
        AZ-->>IM: forbidden
        IM-->>API: auth.forbidden
        API-->>User: 403 auth.forbidden
    else Owner/Admin, endDate before startDate
        AZ-->>IM: allowed
        IM-->>API: validation.failed (endDate, date.before_start)
        API-->>User: 422 validation.failed
    else Owner/Admin
        AZ-->>IM: allowed
        IM->>AA: listForExport(householdId, startDate, endDate)
        Note over AA: inclusive app-timezone days (OQ-104) &mdash; zero foreign keys by<br/>design (OQ-25/NFR-AUD-1) &mdash; IDs are plain stored values,<br/>permanently orphan-tolerant, never joined
        AA-->>IM: entries (oldest first)
        IM->>RE: auditLogCsv(entries)
        Note over RE: export formatting is the Engine's job (VBD) &mdash;<br/>RFC 4180, formula-injection safe (OQ-104)
        RE-->>IM: csv content
        IM-->>API: {csv, filename: audit-log-startDate-endDate.csv}
        API-->>User: 200 OK (Content-Type: text/csv, Content-Disposition: attachment, its filename)
    end
""",
    notes="""
    <ul>
      <li><strong>No <code>logActivity</code>/<code>recordAudit</code> here</strong> &mdash; matches <code>InsightsManager</code>'s established pattern of reads never triggering the audit write path (FR-7.1 scopes it to financial/household-data mutations).</li>
      <li><code>AuditLogAccessor</code> itself never grants <code>UPDATE</code>/<code>DELETE</code> to the application role at the database level &mdash; append-only is enforced by privilege, not by this call path's own discipline.</li>
      <li><strong>The app (task 139, OQ-243):</strong> the drawer&#39;s &ldquo;Export audit log&rdquo; (Owners and Admins only) opens Review Insights&#39; dialog &mdash; Last 30 days, Last 90 days, This year or Custom &mdash; which checks the same two rules before asking, then saves the CSV under the name the API gave it.</li>
      <li>See FR-7.1, FR-7.2, OQ-25, OQ-46, OQ-104, OQ-243, NFR-AUD-1.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
