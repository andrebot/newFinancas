#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/budget-spending/*.html — CUC-5, 3 of 3
use cases — and rewrites the matching call chains in
docs/design/diagrams/call-chains/budget-spending/ (as built in M2 part 3,
OQ-176). Idempotent."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import check_mermaid_source, page as _page
from gen_call_chains_oct2026_lib import CC, E, write as write_chain

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/budget-spending"


def page(filename, title, subtitle, mermaid, notes):
    problems = check_mermaid_source(mermaid, filename)
    assert not problems, problems
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

# The access check every Budget use case on an existing Budget takes (OQ-176):
# read the Budget, then authorize on its own visibility and owner.
LOAD_BUDGET = """    AM->>BA: findById(householdId, budgetId)
    BA-->>AM: budget (or none)
    AM->>AU: authorize(actor, householdId, {ACTION, budget.visibility, budget.ownerUserId})
    alt not a member
        AM-->>API: 404 household.not_found
    else missing, or someone else&#39;s personal Budget
        AM-->>API: 404 budget.not_found
    else role may not ACTION_NAME (a Member may on a shared one they created)
        AM-->>API: 403 auth.forbidden
    else allowed"""


def load_budget(action, action_name):
    return LOAD_BUDGET.replace("ACTION_NAME", action_name).replace("ACTION", action)

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-create-budget.html",
    title="Create Budget",
    subtitle='<span class="route">POST /households/:householdId/budgets</span> &mdash; FR-4.1/4.7. A Category or Subcategory can be claimed by at most one Budget per scope &mdash; a real partial-unique-index constraint, not application logic. The Budget, its claims and this month&#39;s period are written together or not at all (OQ-166).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant VU as ValidationUtility
    participant CA as CategoryAccessor
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/budgets {name, targetAmount, currency, visibility, targets: [{categoryId} | {subcategoryId}]}
    Note over API: contract check first: targetAmount &ge; 1, currency,<br/>targets non-empty, ids are UUIDs &rarr; 422 validation.failed
    API->>AM: createBudget(context, householdId, input)
    AM->>AU: authorize(actor, householdId, {data.create, visibility, ownerUserId: actor})
    alt not a member
        AM-->>API: 404 household.not_found
    else shared Budget by a role that may not create (Viewer)
        AM-->>API: 403 auth.forbidden
    else allowed (a personal Budget is anyone&#39;s own)
        AM->>VU: checkFields({name: nonBlank})
        alt blank name, or a target naming both ids or neither
            AM-->>API: 422 validation.failed {name, targets[i]}
        else well formed
            AM->>CA: list(householdId)
            Note over AM,CA: open Categories and Subcategories only
            alt a target archived or not this household&#39;s
                AM-->>API: 422 validation.failed {targets[i].categoryId | subcategoryId: field.invalid_option}
            else all claimable
                AM->>BA: insert(budget, targets once each, this month)
                Note over BA: one transaction: the Budget, every claim and this<br/>month&#39;s period &mdash; a refusal keeps nothing (OQ-166)
                alt a target is claimed in this scope (FR-4.7)
                    BA-->>AM: target_claimed {target, claimedByBudgetId}
                    AM-->>API: 409 budget.target_already_claimed {target, budgetId}
                else a target gone since the check
                    BA-->>AM: target_not_found {target}
                    AM-->>API: 422 validation.failed {targets[i]...}
                else all claimed
                    BA-->>AM: budget
                    AM-->>LOG: audit CreateBudget
                    AM-->>API: budget
                    API-->>User: 201 Created {budget}
                end
            end
        end
    end
""",
    notes="""
    <ul>
      <li>The literal-duplicate rejection (FR-4.7) is a real DB constraint one layer down &mdash; partial unique indexes on <code>budget_targets</code>, per scope (shared: per household; personal: per household + owner, OQ-95), scoped columns denormalized specifically to make this a plain index rather than a cross-table application check.</li>
      <li>The rollup half (a claimed Category reserves its Subcategories, both ways) is checked by the Accessor before each insert, under the parent Category&#39;s row lock (OQ-166).</li>
      <li>Each scope claims a Category once: the same Category can sit in one shared Budget and in each member&#39;s personal Budget; a spend counts toward the Budget of its Account&#39;s scope (OQ-166). So the claiming Budget named by a 409 is always one the caller can see.</li>
      <li>The generated validator can&#39;t say &ldquo;exactly one of <code>categoryId</code> / <code>subcategoryId</code>&rdquo;, so the Manager checks it; a target sent twice is claimed once (OQ-176).</li>
      <li>&ldquo;This month&rdquo; is the app time zone&#39;s (OQ-104), from the Manager&#39;s clock.</li>
      <li>See FR-4.1, FR-4.2, FR-4.7, OQ-166, OQ-176.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-budget.html",
    title="Edit Budget",
    subtitle='<span class="route">PATCH /households/:householdId/budgets/:budgetId</span> &mdash; FR-4.9. Changing the target amount only affects the current and future Budget Periods; every past period keeps the target actually in effect at the time. The name, target and targets are written in one transaction (OQ-176).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant VU as ValidationUtility
    participant CA as CategoryAccessor
    participant UW as UnitOfWorkUtility
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /households/:householdId/budgets/:budgetId {name?, targetAmount?, targets?: [...]}
    Note over API: no field for currency or visibility exists,<br/>targetAmount &ge; 1, targets non-empty &rarr; else 422
    API->>AM: editBudget(context, householdId, budgetId, edit)
""" + load_budget("data.edit", "edit") + """
        AM->>VU: checkFields({name: nonBlank})
        alt blank name, or a target naming both ids or neither
            AM-->>API: 422 validation.failed {name, targets[i]}
        else targets sent
            AM->>CA: list(householdId)
            Note over AM,CA: a target the Budget already holds stays,<br/>even once archived, a new one must be open
        end
        alt a new target archived or not this household&#39;s
            AM-->>API: 422 validation.failed {targets[i]...: field.invalid_option}
        else nothing sent
            AM-->>API: budget (read back, unaudited)
        else all checked
            AM->>UW: inTransaction(work)
            opt name or targetAmount sent
                AM->>BA: update(householdId, budgetId, {name, targetAmount}, this month)
                Note over BA: a new target writes this month&#39;s period (opened<br/>if needed) and any later one &mdash; never a past one (FR-4.9)
            end
            opt targets sent
                AM->>BA: replaceTargets(householdId, budgetId, targets once each)
                Note over BA: dropped claims released, new ones claimed (OQ-166)
            end
            alt the Budget deleted meanwhile
                AM-->>API: 404 budget.not_found (rolled back)
            else a new target claimed elsewhere in the scope (FR-4.7)
                AM-->>API: 409 budget.target_already_claimed {target, budgetId} (rolled back)
            else a target gone since the check
                AM-->>API: 422 validation.failed (rolled back)
            else written
                UW-->>AM: committed
                AM-->>LOG: audit EditBudget
                AM->>BA: findById(householdId, budgetId)
                AM-->>API: budget
                API-->>User: 200 OK {budget}
            end
        end
    end
""",
    notes="""
    <ul>
      <li>Historical actual-vs-target reporting never gets silently rewritten by a later edit &mdash; the immutable snapshot lives one layer down, not enforced here.</li>
      <li><strong>Corrected (OQ-176):</strong> <code>update</code> and <code>replaceTargets</code> used to be drawn as two separate writes, so a 409 on the targets left the new name and amount saved. They now share one transaction through <code>UnitOfWorkUtility</code>: a refusal keeps none of the edit.</li>
      <li>See FR-4.7, FR-4.9, OQ-166, OQ-176.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-delete-budget.html",
    title="Delete Budget",
    subtitle='<span class="route">DELETE /households/:householdId/budgets/:budgetId</span> &mdash; FR-4.10/OQ-40. Hard delete of the live definition only &mdash; unlike every other archive/delete decision in this project, past Budget Periods are unaffected and survive on their own.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId/budgets/:budgetId
    API->>AM: deleteBudget(context, householdId, budgetId)
""" + load_budget("data.delete", "delete") + """
        AM->>BA: delete(householdId, budgetId)
        Note over BA: hard delete &mdash; budget_targets rows cascade away<br/>(they're the live definition's own claims), but<br/>budget_periods.budget_id is a nullable FK with<br/>ON DELETE SET NULL, so past periods survive intact (OQ-40)
        alt deleted meanwhile
            BA-->>AM: false
            AM-->>API: 404 budget.not_found
        else deleted, targets released
            BA-->>AM: true
            AM-->>LOG: audit DeleteBudget
            AM-->>API: deleted
            API-->>User: 204 No Content
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Corrected (OQ-176):</strong> deleting is a <code>data.delete</code> on the Budget, authorized like any write &mdash; a shared Budget needs Owner/Admin or the Member who created it; a personal one is its owner&#39;s alone. The earlier diagram had no <code>AuthorizationUtility</code> edge.</li>
      <li>Deleting also frees every Category/Subcategory this Budget had claimed, making them available to a new Budget in the same scope immediately. Deleting it again is 404: nothing is left.</li>
      <li>See FR-4.10, OQ-40, OQ-176.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")

# ------------------------------------------------------------ call chains
BS = CC / "budget-spending"
UOW = "<code>UnitOfWorkUtility.inTransaction</code> wraps the BudgetAccessor writes in one transaction (OQ-176) &mdash; not drawn on the shared layout."

write_chain(
    BS / "uc-01-create-budget.html",
    "Call Chain — Create Budget",
    "Use case 1 of 3 in the Budget &amp; Spending set (CUC-5, FR-4.1/4.7). Create pattern. As built in M2 part 3 (OQ-176).",
    E((1, "mgr-account", "util-authz"), (2, "mgr-account", "util-validation"),
      (3, "mgr-account", "acc-category"), (4, "mgr-account", "acc-budget"),
      (5, "mgr-account", "util-logging", "a")),
    [
        "<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility.authorize(data.create)</code> (sync) → ② <code>ValidationUtility.checkFields(...)</code> (sync) → ③ <code>CategoryAccessor.list(...)</code> (sync — which targets are open) → ④ <code>BudgetAccessor.insert(...)</code> (sync, validated write — the Budget, its claims and this month&#39;s period in one transaction; rejects a target claimed in the scope, FR-4.7) → ⑤ <code>LoggingUtility</code> (async).",
        "<strong>Corrected (OQ-176):</strong> the authorization call is needed — a shared Budget needs a role that may create (a Viewer may not); and a new target must be an open Category or Subcategory, read through <code>CategoryAccessor</code> (a Manager reading two Accessors, no Accessor-to-Accessor call).",
        "<strong>No smell:</strong> the overlap-uniqueness invariant is still enforced inside the single Accessor write, not as a separate pre-check.",
    ],
)
write_chain(
    BS / "uc-02-edit-budget.html",
    "Call Chain — Edit Budget",
    "Use case 2 of 3 in the Budget &amp; Spending set (CUC-5, FR-4.7/4.9). Edit pattern. As built in M2 part 3 (OQ-176).",
    E((1, "mgr-account", "acc-budget"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "util-validation"), (4, "mgr-account", "acc-category"),
      (5, "mgr-account", "util-logging", "a")),
    [
        "<strong>Chain:</strong> <code>AccountManager</code> ① <code>BudgetAccessor.findById(...)</code> (sync — the Budget&#39;s visibility and owner feed the check; later <code>update</code>, <code>replaceTargets</code> and the read back) → ② <code>AuthorizationUtility.authorize(data.edit)</code> (sync) → ③ <code>ValidationUtility.checkFields(...)</code> (sync) → ④ <code>CategoryAccessor.list(...)</code> (sync, only when targets are sent) → ⑤ <code>LoggingUtility</code> (async).",
        "<strong>No smell:</strong> the same components as Create (UC-1) — Edit and Create differ in Accessor method, not in which components are involved.",
        UOW,
    ],
)
write_chain(
    BS / "uc-03-delete-budget.html",
    "Call Chain — Delete Budget",
    "Use case 3 of 3 in the Budget &amp; Spending set (CUC-5, FR-4.10). Hard delete (OQ-40). As built in M2 part 3 (OQ-176).",
    E((1, "mgr-account", "acc-budget"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "util-logging", "a")),
    [
        "<strong>Chain:</strong> <code>AccountManager</code> ① <code>BudgetAccessor.findById / delete(...)</code> (sync, hard delete — releases claimed Category/Subcategory targets in the same write) → ② <code>AuthorizationUtility.authorize(data.delete)</code> (sync, between the read and the write) → ③ <code>LoggingUtility</code> (async).",
        "<strong>Corrected (OQ-176):</strong> deleting is a data.delete on the Budget, so it is authorized like any write.",
        "<strong>No smell:</strong> still the shallowest chain in this set — Budget Periods are independent of the live record, per OQ-40.",
    ],
)
print(f"Rewrote 3 call chains in {BS}")
