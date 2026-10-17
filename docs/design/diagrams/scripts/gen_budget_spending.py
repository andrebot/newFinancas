#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/budget-spending/*.html — CUC-5, 3 of 3
use cases."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/budget-spending"


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-create-budget.html",
    title="Create Budget",
    subtitle='<span class="route">POST /households/:householdId/budgets</span> &mdash; FR-4.1/4.7. A Category or Subcategory can be claimed by at most one Budget per scope &mdash; a real partial-unique-index constraint, not application logic.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/budgets {name, targetAmount, currency, visibility, targets: [...]}
    API->>AM: createBudget(actor, input)
    AM->>VU: check(name, targetAmount, currency)
    alt validation fails
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>BA: insert(budget, targets, currentMonth)
        Note over BA: one transaction: the Budget, every target claim and<br/>the current month's period &mdash; a refusal keeps nothing (OQ-166)
        alt a target is claimed in this scope (FR-4.7)
            BA-->>AM: target_claimed {target, claimedByBudgetId}
            AM-->>API: Conflict
            API-->>User: 409 budget.target_already_claimed {categoryId, budgetId}
        else a target is not this household's
            BA-->>AM: target_not_found {target}
            AM-->>API: ValidationError
            API-->>User: 422 validation.failed {details}
        else all targets claimed
            BA-->>AM: budget
            AM-->>LOG: logActivity(correlationId, actor, "CreateBudget")
            AM-->>LOG: recordAudit(actor, "Budget", budgetId)
            AM-->>API: budget
            API-->>User: 201 Created {budget}
        end
    end
""",
    notes="""
    <ul>
      <li>The literal-duplicate rejection (FR-4.7) is a real DB constraint one layer down &mdash; partial unique indexes on <code>budget_targets</code>, per scope (shared: per household; personal: per household + owner, OQ-95), scoped columns denormalized specifically to make this a plain index rather than a cross-table application check.</li>
      <li>The rollup half (a claimed Category reserves its Subcategories, both ways) is checked by the Accessor before each insert, under the parent Category's row lock (OQ-166).</li>
      <li>Each scope claims a Category once: the same Category can sit in one shared Budget and in each member's personal Budget; a spend counts toward the Budget of its Account's scope (OQ-166).</li>
      <li>See FR-4.1, FR-4.2, FR-4.7, OQ-166.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-budget.html",
    title="Edit Budget",
    subtitle='<span class="route">PATCH /households/:householdId/budgets/:budgetId</span> &mdash; FR-4.9. Changing the target amount only affects the current and future Budget Periods; every past period keeps the target actually in effect at the time.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /households/:householdId/budgets/:budgetId {name, targetAmount, targets: [...]}
    API->>AM: editBudget(actor, budgetId, input)
    AM->>VU: check(input)
    alt validation fails
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>BA: update(householdId, budgetId, {name, targetAmount}, currentMonth)
        Note over BA: a new target writes the current month's period (opened<br/>if needed) and any later one &mdash; never a past period's<br/>target_amount (FR-4.9)
        BA-->>AM: updated
        opt targets sent
            AM->>BA: replaceTargets(householdId, budgetId, targets)
            Note over BA: one transaction: dropped claims released, new ones<br/>claimed &mdash; a refusal keeps the old set (OQ-166)
            alt a new target is claimed elsewhere in the scope (FR-4.7)
                BA-->>AM: target_claimed {target, claimedByBudgetId}
                AM-->>API: Conflict
                API-->>User: 409 budget.target_already_claimed {categoryId, budgetId}
            else a target is not this household's
                BA-->>AM: target_not_found {target}
                AM-->>API: ValidationError
                API-->>User: 422 validation.failed {details}
            else applied
                BA-->>AM: ok
            end
        end
        AM-->>LOG: logActivity(correlationId, actor, "EditBudget")
        AM-->>LOG: recordAudit(actor, "Budget", budgetId)
        AM-->>API: updated
        API-->>User: 200 OK
    end
""",
    notes="""
    <ul>
      <li>Historical actual-vs-target reporting never gets silently rewritten by a later edit &mdash; the immutable snapshot lives one layer down, not enforced here.</li>
      <li>See FR-4.9.</li>
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
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId/budgets/:budgetId
    API->>AM: deleteBudget(actor, budgetId)
    AM->>BA: delete(householdId, budgetId)
    Note over BA: hard delete &mdash; budget_targets rows cascade away<br/>(they're the live definition's own claims), but<br/>budget_periods.budget_id is a nullable FK with<br/>ON DELETE SET NULL, so past periods survive intact (OQ-40)
    BA-->>AM: deleted, targets released
    AM-->>LOG: logActivity(correlationId, actor, "DeleteBudget")
    AM-->>LOG: recordAudit(actor, "Budget", budgetId)
    AM-->>API: deleted
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li>No alt/rejection branch shown &mdash; deleting a Budget is unconditional, matching the confirmed call chain (no <code>AuthorizationUtility</code> edge for this flow).</li>
      <li>Deleting also frees every Category/Subcategory this Budget had claimed, making them available to a new Budget in the same scope immediately.</li>
      <li>See FR-4.10, OQ-40.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
