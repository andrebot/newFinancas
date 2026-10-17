#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/categories/*.html — FR-10, 3 of 3 use
cases."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/categories"


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-create-category.html",
    title="Create Category",
    subtitle='<span class="route">POST /categories</span> &mdash; FR-10.1. A custom Category supplementing the predefined default set every household is seeded with (VBD doc &sect;3.1b).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant CA as CategoryAccessor
    participant LOG as LoggingUtility

    User->>API: POST /categories {name, icon, color}
    API->>AM: createCategory(actor, householdId, {name, icon, color})
    AM->>VU: check(name, icon, color)
    alt name missing, icon or colour unknown
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>CA: insert(householdId, {name, icon, color})
        Note over CA: refuses an icon/colour outside the in-code sets as a<br/>second line (invalid_icon / invalid_color, OQ-173)
        CA-->>AM: Category (no Subcategories yet)
        AM-->>LOG: logActivity(correlationId, actor, "CreateCategory")
        AM-->>LOG: recordAudit(actor, "Category", categoryId)
        AM-->>API: categoryId
        API-->>User: 201 Created {categoryId}
    end
""",
    notes="""
    <ul>
      <li>No <code>visibility</code> field &mdash; Category is pure household-shared taxonomy, no personal/shared split exists for it (see <code>02-data-model.md</code>).</li>
      <li><strong>Oct 2026 review:</strong> icon + colour (fixed palette) on every category (FR-10.1, OQ-57).</li>
      <li><strong>OQ-173:</strong> the Accessor re-checks icon and colour against <code>@financas/reference</code> and returns <code>invalid_icon</code>/<code>invalid_color</code>; the Manager&#39;s 422 normally fires first. Names need not be unique.</li>
      <li>See FR-10.1.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-category.html",
    title="Edit Category (incl. Subcategories)",
    subtitle='<span class="route">PATCH /categories/:categoryId</span> &mdash; FR-10.2. Creating a new Subcategory under this Category is folded into the same request, not a separate endpoint.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant CA as CategoryAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /categories/:categoryId {name?, icon?, color?, subcategories: [{id?, name}, ...]}
    API->>AM: editCategory(actor, categoryId, input)
    AM->>VU: check(input)
    alt validation fails
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>CA: update(householdId, categoryId, {name?, icon?, color?, subcategories?})
        Note over CA: one transaction (OQ-173): renames each listed Subcategory<br/>with an id, creates those without, unlisted ones untouched.<br/>A Subcategory has no parent-subcategory field &mdash; the<br/>two-level limit (FR-10.2) is structural, not a runtime check
        alt not this household's Category / an id under another Category
            CA-->>AM: not_found / subcategory_not_found (nothing written)
        else applied
            CA-->>AM: Category with its Subcategories
        end
        AM-->>LOG: logActivity(correlationId, actor, "EditCategory")
        AM-->>LOG: recordAudit(actor, "Category", categoryId)
        AM-->>API: updated
        API-->>User: 200 OK
    end
""",
    notes="""
    <ul>
      <li><strong>One atomic call (OQ-173)</strong> &mdash; the earlier per-entry <code>upsertSubcategory</code> loop could leave an edit half-applied; the whole PATCH is now a single <code>update</code>. The 404/422 mapping of <code>not_found</code>/<code>subcategory_not_found</code> lands with <code>AccountManager</code> (M2).</li>
      <li><strong>No "exceeds two levels" alt-flow shown</strong> &mdash; there is no request shape that could even express a third level (no <code>subcategories</code> field exists on a Subcategory), so there is nothing to reject at runtime.</li>
      <li>See FR-10.2.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-archive-category.html",
    title="Archive Category or Subcategory",
    subtitle='<span class="route">POST /categories/:categoryId/archive</span> or <span class="route">POST /categories/:categoryId/subcategories/:subcategoryId/archive</span> &mdash; FR-10.3/10.4. Archiving a Category cascades to all its Subcategories; archiving a Subcategory affects nothing else.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant CA as CategoryAccessor
    participant LOG as LoggingUtility

    alt target is a Category
        User->>API: POST /categories/:categoryId/archive
        API->>AM: archiveCategory(actor, categoryId)
        AM->>CA: archive(householdId, categoryId)
        Note over CA: stamps this Category's archived_at, then its live<br/>Subcategories' with the same time &mdash; one transaction<br/>(FR-10.4's cascade) &mdash; already-archived ones keep theirs
        CA-->>AM: archived (Category + all Subcategories)
    else target is a Subcategory
        User->>API: POST /categories/:categoryId/subcategories/:subcategoryId/archive
        API->>AM: archiveSubcategory(actor, categoryId, subcategoryId)
        AM->>CA: archiveSubcategory(householdId, categoryId, subcategoryId)
        Note over CA: single-row update &mdash; parent Category and sibling<br/>Subcategories are untouched (FR-10.4)
        CA-->>AM: archived (this Subcategory only)
    end
    AM-->>LOG: logActivity(correlationId, actor, "ArchiveCategory")
    AM-->>LOG: recordAudit(actor, "Category", categoryId)
    AM-->>API: archived
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li>No hard delete exists for either resource &mdash; FR-10.3 only ever defines archive, the same one-way shape as Accounts/Holdings, not Budget&#39;s hard-delete shape.</li>
      <li>See FR-10.3, FR-10.4.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
