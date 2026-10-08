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
    subtitle='<span class="route">POST /budgets</span> &mdash; FR-4.1/4.7. A Category or Subcategory can be claimed by at most one Budget per scope &mdash; a real partial-unique-index constraint, not application logic.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: POST /budgets {name, targetAmount, currency, visibility, targets: [...]}
    API->>AM: createBudget(actor, input)
    AM->>VU: check(name, targetAmount, currency)
    alt validation fails
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>BA: insert(budget)
        BA-->>AM: budgetId
        loop for each target in the request
            AM->>BA: assignTarget(budgetId, categoryId or subcategoryId)
            alt target already claimed in this scope
                BA-->>AM: rejected (FR-4.7, partial unique index)
                AM-->>API: Conflict
                API-->>User: 409 budget.target_already_claimed {categoryId, budgetId}
            else target available
                BA-->>AM: claimed
            end
        end
        AM-->>LOG: logActivity(correlationId, actor, "CreateBudget")
        AM-->>LOG: recordAudit(actor, "Budget", budgetId)
        AM-->>API: budgetId
        API-->>User: 201 Created {budgetId}
    end
""",
    notes="""
    <ul>
      <li>The overlap rejection (FR-4.7) is a real DB constraint one layer down &mdash; a partial unique index on <code>budget_targets (household_id, visibility, owner_user_id, category_id)</code>, scoped columns denormalized specifically to make this a plain index rather than a cross-table application check.</li>
      <li>See FR-4.1, FR-4.2, FR-4.7.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-budget.html",
    title="Edit Budget",
    subtitle='<span class="route">PATCH /budgets/:budgetId</span> &mdash; FR-4.9. Changing the target amount only affects the current and future Budget Periods; every past period keeps the target actually in effect at the time.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /budgets/:budgetId {name, targetAmount, targets: [...]}
    API->>AM: editBudget(actor, budgetId, input)
    AM->>VU: check(input)
    alt validation fails
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>BA: update(budgetId, {name, targetAmount})
        Note over BA: only the current/future budget_periods rows are ever<br/>touched &mdash; nothing in this write path revisits a past<br/>period's target_amount (FR-4.9)
        BA-->>AM: updated
        loop for each target change
            AM->>BA: assignTarget/releaseTarget(budgetId, target)
            alt newly assigned target already claimed elsewhere
                BA-->>AM: rejected (FR-4.7)
                AM-->>API: Conflict
                API-->>User: 409 budget.target_already_claimed {categoryId, budgetId}
            else applied
                BA-->>AM: applied
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
    subtitle='<span class="route">DELETE /budgets/:budgetId</span> &mdash; FR-4.10/OQ-40. Hard delete of the live definition only &mdash; unlike every other archive/delete decision in this project, past Budget Periods are unaffected and survive on their own.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant BA as BudgetAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /budgets/:budgetId
    API->>AM: deleteBudget(actor, budgetId)
    AM->>BA: delete(budgetId)
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
