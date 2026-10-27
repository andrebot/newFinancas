#!/usr/bin/env python3
"""(Renamed from gen_investment_objectives.py — Oct 2026 review: Objective -> Goal, archive/unarchive -> complete/reopen, OQ-66/OQ-78; UC-06 View Goals added.)
Generates docs/design/diagrams/sequences/goals/*.html — CUC-10, 6 of 6 use
cases — and rewrites the matching call chains in
docs/design/diagrams/call-chains/goals/ (UC-01..05 as built in M2 part 4,
OQ-177). Idempotent."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import check_mermaid_source, page as _page
from gen_call_chains_oct2026_lib import CC, E, write as write_chain

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sequences", "goals")


def page(filename, title, subtitle, mermaid, notes):
    problems = check_mermaid_source(mermaid, filename)
    assert not problems, problems
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

# The access check every Goal use case on an existing Goal takes (OQ-177):
# read the Goal, then authorize on its own visibility and owner.
LOAD_GOAL = """    AM->>GA: findById(householdId, goalId)
    GA-->>AM: goal (or none)
    AM->>AU: authorize(actor, householdId, {ACTION, goal.visibility, goal.ownerUserId})
    alt not a member
        AM-->>API: 404 household.not_found
    else missing, or someone else&#39;s personal Goal
        AM-->>API: 404 goal.not_found
    else role may not ACTION_NAME (a Member may on a shared one they created)
        AM-->>API: 403 auth.forbidden
    else allowed"""


def load_goal(action, action_name):
    return LOAD_GOAL.replace("ACTION_NAME", action_name).replace("ACTION", action)


def lifecycle(verb, method, already, write_note, audit):
    """The Complete / Reopen sequence: the same check and shape, opposite writes."""
    return """
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant GA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/goals/:goalId/""" + verb + """
    API->>AM: """ + verb + """Goal(context, householdId, goalId)
""" + load_goal("data.edit", "edit") + """
        alt """ + already + """
            AM-->>API: nothing to write, unaudited (OQ-177)
            API-->>User: 204 No Content
        else
            AM->>GA: """ + method + """(householdId, goalId)
            Note over GA: """ + write_note + """
            alt deleted meanwhile
                GA-->>AM: false
                AM-->>API: 404 goal.not_found
            else written
                GA-->>AM: true
                AM-->>LOG: audit """ + audit + """
                API-->>User: 204 No Content
            end
        end
    end
"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-create-goal.html",
    title="Create Goal",
    subtitle='<span class="route">POST /households/:householdId/goals</span> &mdash; FR-8.1. A Goal starts open and unfunded; its creator owns it.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant VU as ValidationUtility
    participant GA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/goals {name, targetAmount, targetCurrency, dueDate, visibility}
    Note over API: contract check first: targetAmount &ge; 1, currency,<br/>dueDate a date, visibility &rarr; 422 validation.failed
    API->>AM: createGoal(context, householdId, input)
    AM->>AU: authorize(actor, householdId, {data.create, visibility, ownerUserId: actor})
    alt not a member
        AM-->>API: 404 household.not_found
    else shared Goal by a role that may not create (Viewer)
        AM-->>API: 403 auth.forbidden
    else allowed (a personal Goal is anyone&#39;s own)
        AM->>VU: checkFields({name: nonBlank})
        alt blank name
            AM-->>API: 422 validation.failed {name}
        else valid
            AM->>GA: insert(goal, ownerUserId = actor, name trimmed)
            GA-->>AM: goal
            AM-->>LOG: audit CreateGoal
            AM-->>API: goal
            API-->>User: 201 Created {goal}
        end
    end
""",
    notes="""
    <ul>
      <li>No allocations here &mdash; a Goal starts unfunded; allocating a Holding to it happens later, from the Holding&#39;s own edit flow (OQ-48).</li>
      <li><strong>Corrected (OQ-177):</strong> creating is authorized like a Budget &mdash; a shared Goal needs Owner, Admin or Member; a personal one is anyone&#39;s own, a Viewer&#39;s too (OQ-111). The earlier diagram had no <code>AuthorizationUtility</code> edge.</li>
      <li>The target is more than zero (<code>PositiveMoney</code>); a due date in the past is allowed &mdash; an overdue Goal is a display state.</li>
      <li>See FR-8.1, OQ-48, OQ-177.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-goal.html",
    title="Edit Goal",
    subtitle='<span class="route">PATCH /households/:householdId/goals/:goalId</span> &mdash; FR-8.1. Name, target, target currency and due date only &mdash; never the visibility, never the allocations (OQ-48).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant VU as ValidationUtility
    participant GA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /households/:householdId/goals/:goalId {name?, targetAmount?, targetCurrency?, dueDate?}
    Note over API: contract check first: targetAmount &ge; 1, currency, dueDate a date
    API->>AM: editGoal(context, householdId, goalId, edit)
""" + load_goal("data.edit", "edit") + """
        AM->>VU: checkFields({name: nonBlank})
        alt blank name
            AM-->>API: 422 validation.failed {name}
        else nothing to change
            AM-->>API: the Goal as read, unaudited
            API-->>User: 200 OK {goal}
        else changes
            AM->>GA: update(householdId, goalId, changes)
            alt deleted meanwhile
                GA-->>AM: none
                AM-->>API: 404 goal.not_found
            else updated
                GA-->>AM: goal
                AM-->>LOG: audit EditGoal
                AM-->>API: goal
                API-->>User: 200 OK {goal}
            end
        end
    end
""",
    notes="""
    <ul>
      <li>This endpoint has no <code>allocations</code> field at all &mdash; contrast with Edit Investment Holding (<code>docs/design/diagrams/sequences/track-investments/uc-02-edit-holding.html</code>), which is where allocation changes actually happen.</li>
      <li><strong>A completed Goal can be edited too (OQ-177):</strong> FR-8.9 closes only new funding to it (<code>goal.completed</code>, on Edit Holding). Changing the target currency is allowed: progress is derived on read, nothing stored follows it (OQ-168).</li>
      <li>See FR-8.1, OQ-48, OQ-177.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-complete-goal.html",
    title="Complete Goal",
    subtitle='<span class="route">POST /households/:householdId/goals/:goalId/complete</span> &mdash; FR-8.8. &ldquo;This goal is completed&rdquo; &mdash; keeps the record intact so historical progress-by-month stays viewable, and is reversible (see Reopen).',
    mermaid=lifecycle(
        "complete", "complete", "already completed",
        "sets completed_at &mdash; unlike every other archive in this<br/>project, this one CAN be undone (FR-8.9)",
        "CompleteGoal"),
    notes="""
    <ul>
      <li>Distinct from Delete (UC-05): complete means &ldquo;done,&rdquo; delete means &ldquo;no longer makes sense&rdquo; &mdash; OQ-47&#39;s &ldquo;third lifecycle pattern,&rdquo; the only entity in this project with both a hard delete and a reversible completion.</li>
      <li><strong>Corrected (OQ-177):</strong> completing is a <code>data.edit</code> on the Goal; completing a completed Goal is a 204 that writes and audits nothing.</li>
      <li>See FR-8.8, OQ-47, OQ-177.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-04
UCS.append(dict(
    filename="uc-04-reopen-goal.html",
    title="Reopen Goal",
    subtitle='<span class="route">POST /households/:householdId/goals/:goalId/reopen</span> &mdash; FR-8.9. The only &ldquo;reopen&rdquo; endpoint in the entire API &mdash; every other archived entity in this project stays archived, one-way.',
    mermaid=lifecycle(
        "reopen", "reopen", "already active",
        "nulls completed_at back out &mdash; restores active status,<br/>able to receive new allocations again (FR-8.9)",
        "ReopenGoal"),
    notes="""
    <ul>
      <li>Same column, same shape as Complete (UC-03) &mdash; the only difference is which direction the write goes. No other resource in this project exposes the reverse direction at all.</li>
      <li><strong>Corrected (OQ-177):</strong> the audit action is <code>ReopenGoal</code> (was <code>UncompleteGoal</code>) and the use case <code>reopenGoal</code>; reopening an active Goal is a 204 that writes and audits nothing.</li>
      <li>See FR-8.9, OQ-177.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-05
UCS.append(dict(
    filename="uc-05-delete-goal.html",
    title="Delete Goal",
    subtitle='<span class="route">DELETE /households/:householdId/goals/:goalId</span> &mdash; FR-8.6. Hard delete, no history kept &mdash; &ldquo;this goal no longer makes sense.&rdquo; The underlying Investment Holdings are never deleted.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant GA as GoalAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId/goals/:goalId
    API->>AM: deleteGoal(context, householdId, goalId)
""" + load_goal("data.delete", "delete") + """
        AM->>GA: delete(householdId, goalId)
        Note over GA: hard delete, no history &mdash; goal_allocations rows<br/>cascade away, but the Investment Holdings they referenced<br/>are completely untouched (FR-8.6)
        alt deleted meanwhile
            GA-->>AM: false
            AM-->>API: 404 goal.not_found
        else deleted
            GA-->>AM: true
            AM-->>LOG: audit DeleteGoal
            API-->>User: 204 No Content
        end
    end
""",
    notes="""
    <ul>
      <li>Contrast with Complete (UC-03): this is deliberately unrecoverable, for the case where the Goal itself was a mistake, not merely completed. Deleting it again is 404: nothing is left.</li>
      <li><strong>Corrected (OQ-177):</strong> deleting is a <code>data.delete</code> on the Goal, authorized like any write. The earlier diagram had no <code>AuthorizationUtility</code> edge.</li>
      <li>See FR-8.6, OQ-47, OQ-177.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-06 (Oct 2026)
UCS.append(dict(
    filename="uc-06-view-goals.html",
    title="View Goals",
    subtitle='<span class="route">GET /households/:householdId/goal-progress?status=active|completed</span> &mdash; FR-8.5/8.7/FR-9. Progress per currency, computed on read &mdash; the frontend blends currencies with the user&#39;s on-the-fly rate (nothing stored).',
    mermaid="""
sequenceDiagram
    actor User
    participant API as Hono route
    participant IM as InsightsManager
    participant AZ as AuthorizationUtility
    participant RE as ReportingEngine
    participant GA as GoalAccessor
    participant AA as AccountAccessor
    participant IHA as InvestmentHoldingAccessor
    participant VSA as ValuationSnapshotAccessor
    participant ATA as AccountTransactionAccessor

    User->>API: GET /households/:householdId/goal-progress?status=active
    API->>IM: viewGoals(actor, status)
    IM->>AZ: visibleScope(actor)
    IM->>GA: list(householdId, viewerUserId, status)
    IM->>RE: goalProgress({householdId, viewerUserId}, goals, today)
    RE->>AA: list(householdId, viewerUserId) &mdash; the Accounts the viewer sees
    RE->>GA: listAllocations({goalIds}, date) &mdash; the split in effect then (OQ-206)
    RE->>IHA: findByIds(householdId, allocated holdingIds) &mdash; with their currency
    RE->>VSA: latestAsOf(market-priced holdingIds, date)
    RE->>ATA: costBasisAsOf(fixed-term holdingIds, date) &mdash; OQ-206
    Note over RE: contribution = value &times; allocated %, kept in the<br/>Holding&#39;s own currency (OQ-49) &mdash; never converted here &mdash;<br/>a Holding in an Account the viewer can&#39;t see counts, unnamed (OQ-206)
    RE-->>IM: [{goal, fundedBy[{holdingId, name, percentage, contribution}]}]
    IM-->>API: goals
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>FX stays in the browser (FR-9, OQ-49):</strong> &ldquo;1 USD = x BRL&rdquo; is typed on the goal card and only blends the returned per-currency contributions for display.</li>
      <li>Reshaped read &rarr; <code>InsightsManager</code> + <code>ReportingEngine</code> (read-ownership rule), built with M4. <strong>OQ-177:</strong> moved to its own route &mdash; <code>GET /households/:householdId/goals</code> is <code>AccountManager</code>&#39;s plain list of definitions (OQ-174); <code>GET &hellip;/goals/:goalId/allocations</code> was dropped, as <code>fundedBy</code> here covers it. <code>GET /households/:householdId/goals/:goalId/progress</code> stays for the by-month history (FR-8.7).</li>
      <li><strong>OQ-206:</strong> a fixed-term Holding&#39;s value on a date is its trades&#39; cost basis by then (the by-month history uses the month&#39;s end); funding in an Account the viewer can&#39;t see counts, with <code>holdingId</code> and <code>name</code> null, so every member sees a shared Goal&#39;s same total.</li>
      <li>See FR-8.5, FR-8.7, FR-9, OQ-49, OQ-177, OQ-206.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")

# ------------------------------------------------------------ call chains
GO = CC / "goals"
G = "the Goals set (CUC-10"
AS_BUILT = "As built in M2 part 4 (OQ-177)."
CORRECTED_AUTHZ = "<strong>Corrected (OQ-177):</strong> the authorization call is needed &mdash; a Goal is personal or shared like a Budget, so every use case checks the caller&#39;s role against the Goal&#39;s visibility and owner (OQ-111)."
ON_GOAL = "<strong>Chain:</strong> <code>AccountManager</code> ① <code>GoalAccessor.findById(...)</code> (sync &mdash; the Goal&#39;s visibility and owner feed the check; later the write) → ② <code>AuthorizationUtility.authorize(ACTION)</code> (sync) → "


def on_goal(action):
    return ON_GOAL.replace("ACTION", action)

write_chain(
    GO / "uc-01-create-goal.html",
    "Call Chain — Create Goal",
    f"Use case 1 of 6 in {G}, FR-8.1). Create pattern. {AS_BUILT}",
    E((1, "mgr-account", "util-authz"), (2, "mgr-account", "util-validation"),
      (3, "mgr-account", "acc-goal"), (4, "mgr-account", "util-logging", "a")),
    [
        "<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility.authorize(data.create)</code> (sync) → ② <code>ValidationUtility.checkFields(...)</code> (sync) → ③ <code>GoalAccessor.insert(...)</code> (sync) → ④ <code>LoggingUtility</code> (async).",
        CORRECTED_AUTHZ,
        "<strong>No smell:</strong> a Goal starts unfunded &mdash; no allocation write here (OQ-48).",
    ],
)
write_chain(
    GO / "uc-02-edit-goal.html",
    "Call Chain — Edit Goal",
    f"Use case 2 of 6 in {G}, FR-8.1). Edit pattern. {AS_BUILT}",
    E((1, "mgr-account", "acc-goal"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "util-validation"), (4, "mgr-account", "util-logging", "a")),
    [
        on_goal("data.edit") + "③ <code>ValidationUtility.checkFields(...)</code> (sync) → <code>GoalAccessor.update(...)</code> → ④ <code>LoggingUtility</code> (async).",
        CORRECTED_AUTHZ,
        "<strong>No smell:</strong> the same components as Create (UC-1) &mdash; Edit and Create differ in Accessor method, not in which components are involved.",
    ],
)
write_chain(
    GO / "uc-03-complete-goal.html",
    "Call Chain — Complete Goal",
    f"Use case 3 of 6 in {G}, FR-8.8). Reversible completion. {AS_BUILT}",
    E((1, "mgr-account", "acc-goal"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "util-logging", "a")),
    [
        on_goal("data.edit") + "<code>GoalAccessor.complete(...)</code>, skipped when already completed → ③ <code>LoggingUtility</code> (async).",
        "<strong>No smell:</strong> one Accessor, one Utility check &mdash; the shallowest shape.",
    ],
)
write_chain(
    GO / "uc-04-reopen-goal.html",
    "Call Chain — Reopen Goal",
    f"Use case 4 of 6 in {G}, FR-8.9). The only reopen in the API. {AS_BUILT}",
    E((1, "mgr-account", "acc-goal"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "util-logging", "a")),
    [
        on_goal("data.edit") + "<code>GoalAccessor.reopen(...)</code>, skipped when already active → ③ <code>LoggingUtility</code> (async).",
        "<strong>No smell:</strong> the mirror of Complete (UC-3) &mdash; same components, opposite write.",
    ],
)
write_chain(
    GO / "uc-05-delete-goal.html",
    "Call Chain — Delete Goal",
    f"Use case 5 of 6 in {G}, FR-8.6). Hard delete (OQ-47). {AS_BUILT}",
    E((1, "mgr-account", "acc-goal"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "util-logging", "a")),
    [
        on_goal("data.delete") + "<code>GoalAccessor.delete(...)</code> (sync, hard delete &mdash; allocations cascade, Holdings stay) → ③ <code>LoggingUtility</code> (async).",
        CORRECTED_AUTHZ,
        "<strong>No smell:</strong> the allocations go by FK cascade inside the one write; no call reaches <code>InvestmentHoldingAccessor</code>.",
    ],
)
write_chain(
    GO / "uc-06-view-goals.html",
    "Call Chain — View Goals",
    f"Use case 6 of 6 in {G}, FR-8.5/8.7). View. Progress on <code>GET /households/:householdId/goal-progress</code> (OQ-177); built with M4.",
    E((1, "mgr-insights", "util-authz"), (2, "mgr-insights", "acc-goal"), (3, "mgr-insights", "eng-reporting"),
      (4, "eng-reporting", "acc-account"), (4, "eng-reporting", "acc-goal"), (4, "eng-reporting", "acc-holding"),
      (4, "eng-reporting", "acc-snapshot"), (4, "eng-reporting", "acc-accounttxn")),
    [
        "<strong>Chain:</strong> <code>InsightsManager</code> ① <code>AuthorizationUtility</code> (visibility) → ② <code>GoalAccessor.list</code> (the Goals the viewer sees) → ③ <code>ReportingEngine.goalProgress</code> → ④ reads <code>AccountAccessor</code> (the viewer&#39;s Accounts — funding elsewhere counts unnamed, OQ-206), <code>GoalAccessor</code> (allocations), <code>InvestmentHoldingAccessor.findByIds</code> (the Holdings with their currency), <code>ValuationSnapshotAccessor</code> (market-priced values), <code>AccountTransactionAccessor.costBasisAsOf</code> (fixed-term values by then, OQ-206).",
        "<strong>OQ-177:</strong> the plain list of definitions, <code>GET &hellip;/goals</code>, is <code>AccountManager</code>&#39;s own read (OQ-174) &mdash; Goal Management reads both.",
        "<strong>No smell:</strong> a reshaped read stays on the read side; the Engine reads three Accessors, none calls another.",
    ],
)
print(f"Rewrote 6 call chains in {GO}")
