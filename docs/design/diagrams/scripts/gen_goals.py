#!/usr/bin/env python3
"""(Renamed from gen_investment_objectives.py — Oct 2026 review: Objective -> Goal, archive/unarchive -> complete/reopen, OQ-66/OQ-78; UC-06 View Goals added.)
Generates docs/design/diagrams/sequences/goals/*.html — CUC-10,
5 of 5 use cases."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/goals"


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-create-goal.html",
    title="Create Goal",
    subtitle='<span class="route">POST /goals</span> &mdash; FR-8.1.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant OA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: POST /goals {name, targetAmount, targetCurrency, dueDate, visibility}
    API->>AM: createGoal(actor, input)
    AM->>VU: check(input)
    alt validation fails
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>OA: insert(goal, ownerId=actor)
        OA-->>AM: goalId
        AM-->>LOG: logActivity(correlationId, actor, "CreateGoal")
        AM-->>LOG: recordAudit(actor, "Goal", goalId)
        AM-->>API: goalId
        API-->>User: 201 Created {goalId}
    end
""",
    notes="""
    <ul>
      <li>No allocations here &mdash; a Goal starts unfunded; allocating a Holding to it happens later, from the Holding's own edit flow (OQ-48).</li>
      <li>See FR-8.1.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-goal.html",
    title="Edit Goal",
    subtitle='<span class="route">PATCH /goals/:goalId</span> &mdash; FR-8.1. Name/target/due-date only &mdash; allocations are never editable from here (OQ-48).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant OA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /goals/:goalId {name, targetAmount, targetCurrency, dueDate}
    API->>AM: editGoal(actor, goalId, input)
    AM->>VU: check(input)
    alt validation fails
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>OA: update(goalId, input)
        OA-->>AM: updated
        AM-->>LOG: logActivity(correlationId, actor, "EditGoal")
        AM-->>LOG: recordAudit(actor, "Goal", goalId)
        AM-->>API: updated
        API-->>User: 200 OK
    end
""",
    notes="""
    <ul>
      <li>This endpoint has no <code>allocations</code> field at all &mdash; contrast with Edit Investment Holding (<code>docs/design/diagrams/sequences/track-investments/uc-02-edit-holding.html</code>), which is where allocation changes actually happen.</li>
      <li>See FR-8.1, OQ-48.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-complete-goal.html",
    title="Complete Goal",
    subtitle='<span class="route">POST /goals/:goalId/complete</span> &mdash; FR-8.8. "This goal is completed" &mdash; keeps the record intact so historical progress-by-month stays viewable, and is reversible (see Unarchive).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant OA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: POST /goals/:goalId/complete
    API->>AM: completeGoal(actor, goalId)
    AM->>OA: complete(goalId)
    Note over OA: sets completed_at &mdash; unlike every other archive in this<br/>project, this one CAN be undone (FR-8.9)
    OA-->>AM: completed
    AM-->>LOG: logActivity(correlationId, actor, "CompleteGoal")
    AM-->>LOG: recordAudit(actor, "Goal", goalId)
    AM-->>API: completed
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li>Distinct from Delete (UC-05): archive means "done," delete means "no longer makes sense" &mdash; OQ-47's "third lifecycle pattern," the only entity in this project with both a hard delete and a reversible archive.</li>
      <li>See FR-8.8, OQ-47.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-04
UCS.append(dict(
    filename="uc-04-reopen-goal.html",
    title="Reopen Goal",
    subtitle='<span class="route">POST /goals/:goalId/reopen</span> &mdash; FR-8.9. The only "unarchive" endpoint in the entire API &mdash; every other archived entity in this project stays archived, one-way.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant OA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: POST /goals/:goalId/reopen
    API->>AM: uncompleteGoal(actor, goalId)
    AM->>OA: reopen(goalId)
    Note over OA: nulls completed_at back out &mdash; restores active status,<br/>able to receive new allocations again (FR-8.9)
    OA-->>AM: reopened
    AM-->>LOG: logActivity(correlationId, actor, "UncompleteGoal")
    AM-->>LOG: recordAudit(actor, "Goal", goalId)
    AM-->>API: reopened
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li>Same column, same shape as Archive (UC-03) &mdash; the only difference is which direction the write goes. No other resource in this project exposes the reverse direction at all.</li>
      <li>See FR-8.9.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-05
UCS.append(dict(
    filename="uc-05-delete-goal.html",
    title="Delete Goal",
    subtitle='<span class="route">DELETE /goals/:goalId</span> &mdash; FR-8.6. Hard delete, no history kept &mdash; "this goal no longer makes sense." The underlying Investment Holdings are never deleted.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant OA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /goals/:goalId
    API->>AM: deleteGoal(actor, goalId)
    AM->>OA: delete(goalId)
    Note over OA: hard delete, no history &mdash; goal_allocations rows<br/>cascade away, but the Investment Holdings they referenced<br/>are completely untouched (FR-8.6)
    OA-->>AM: deleted
    AM-->>LOG: logActivity(correlationId, actor, "DeleteGoal")
    AM-->>LOG: recordAudit(actor, "Goal", goalId)
    AM-->>API: deleted
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li>Contrast with Archive (UC-03): this is deliberately unrecoverable, for the case where the Goal itself was a mistake, not merely completed.</li>
      <li>See FR-8.6, OQ-47.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-06 (Oct 2026)
UCS.append(dict(
    filename="uc-06-view-goals.html",
    title="View Goals",
    subtitle='<span class="route">GET /goals?status=active|completed</span> &mdash; FR-8.5/8.7/FR-9. Progress per currency, computed on read &mdash; the frontend blends currencies with the user&#39;s on-the-fly rate (nothing stored).',
    mermaid="""
sequenceDiagram
    actor User
    participant API as Hono route
    participant IM as InsightsManager
    participant AZ as AuthorizationUtility
    participant RE as ReportingEngine
    participant GA as GoalAccessor
    participant IHA as InvestmentHoldingAccessor
    participant VSA as ValuationSnapshotAccessor

    User->>API: GET /goals?status=active
    API->>IM: viewGoals(actor, status)
    IM->>AZ: visibleScope(actor)
    IM->>RE: goalProgress(scope, status)
    RE->>GA: goals + allocations
    RE->>IHA: allocated Holdings (cost basis for fixed-term)
    RE->>VSA: latest snapshots for market-priced Holdings
    Note over RE: contribution = value &times; allocated %, kept in the<br/>Holding&#39;s own currency (OQ-49) &mdash; never converted here
    RE-->>IM: [{goal, contributionsByCurrency[], fundedBy[]}]
    IM-->>API: goals
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>FX stays in the browser (FR-9, OQ-49):</strong> &ldquo;1 USD = x BRL&rdquo; is typed on the goal card and only blends the returned per-currency contributions for display.</li>
      <li>Reshaped read &rarr; <code>InsightsManager</code> + <code>ReportingEngine</code> (read-ownership rule). <code>GET /goals/:goalId/progress</code> stays for the by-month history (FR-8.7).</li>
      <li>See FR-8.5, FR-8.7, FR-9, OQ-49.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
