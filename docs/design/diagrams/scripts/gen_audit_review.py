#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/audit-review/*.html — CUC-9, 1 of 1
use case."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/audit-review"


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-export-audit-log.html",
    title="Export Audit Log",
    subtitle='<span class="route">GET /households/:householdId/audit-log/export</span> &mdash; FR-7.2/OQ-46. Owner/Admin only. This is the Audit Log&#39;s ONLY access method in v1 &mdash; there is no in-app browsable table anywhere in this API.',
    mermaid="""
sequenceDiagram
    actor User
    participant API as Hono route
    participant IM as InsightsManager
    participant AZ as AuthorizationUtility
    participant AA as AuditLogAccessor

    User->>API: GET /households/:householdId/audit-log/export?startDate=...&endDate=...
    API->>IM: exportAuditLog(actor, householdId, dateRange)
    IM->>AZ: canManageMembers(actor, householdId)?
    alt not Owner/Admin
        AZ-->>IM: denied
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>IM: allowed
        IM->>AA: exportCsv(householdId, dateRange)
        Note over AA: audit_log_entries has zero foreign keys, by design (OQ-25/<br/>NFR-AUD-1) &mdash; actor_id/household_id/entity_id are plain<br/>stored values, permanently orphan-tolerant, never joined
        AA-->>IM: csv content
        IM-->>API: csv content
        API-->>User: 200 OK (Content-Type: text/csv, Content-Disposition: attachment)
    end
""",
    notes="""
    <ul>
      <li><strong>No <code>logActivity</code>/<code>recordAudit</code> here</strong> &mdash; matches <code>InsightsManager</code>'s established pattern of reads never triggering the audit write path (FR-7.1 scopes it to financial/household-data mutations).</li>
      <li><code>AuditLogAccessor</code> itself never grants <code>UPDATE</code>/<code>DELETE</code> to the application role at the database level &mdash; append-only is enforced by privilege, not by this call path's own discipline.</li>
      <li>See FR-7.1, FR-7.2, OQ-25, OQ-46, NFR-AUD-1.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
