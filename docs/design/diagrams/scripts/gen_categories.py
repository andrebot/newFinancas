#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/categories/*.html — FR-10, 3 of 3 use
cases."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sequences", "categories")


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
    subtitle='<span class="route">POST /households/:householdId/categories</span> &mdash; FR-10.1. A custom Category supplementing the predefined default set every household is seeded with (VBD doc &sect;3.1b).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant VU as ValidationUtility
    participant CA as CategoryAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/categories {name, icon, color}
    Note over API: contract check: icon and colour are enums<br/>(CategoryIcon, CategoryColor &mdash; OQ-174) &rarr; 422 before the Manager
    API->>AM: createCategory(actor, householdId, {name, icon, color})
    AM->>AZ: authorize(actor.userId, householdId, data.create on shared data, owner none)
    alt not a member
        AZ-->>AM: not_member
        AM-->>API: NotFound
        API-->>User: 404 household.not_found
    else a Viewer
        AZ-->>AM: forbidden
        AM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>AM: allowed
        AM->>VU: checkFields({name}, {name: nonBlank})
        alt name blank once trimmed
            VU-->>AM: [name: string.min]
            AM-->>API: ValidationError
            API-->>User: 422 validation.failed {details}
        else valid
            VU-->>AM: []
            AM->>CA: insert(householdId, {name trimmed, icon, color})
            Note over CA: refuses an icon/colour outside the in-code sets as a<br/>second line (invalid_icon / invalid_color, OQ-173)
            alt refused
                CA-->>AM: invalid_icon / invalid_color
                AM-->>API: ValidationError
                API-->>User: 422 validation.failed {icon / color: field.invalid_option}
            else inserted
                CA-->>AM: Category (no Subcategories yet)
                AM-->>LOG: log.audit("CreateCategory", Category categoryId)
                AM-->>API: Category
                API-->>User: 201 Created Category
            end
        end
    end
""",
    notes="""
    <ul>
      <li>No <code>visibility</code> field &mdash; Category is pure household-shared taxonomy with no recorded creator, so the permission table reads it as <strong>shared data nobody owns</strong> (OQ-174): any member but a Viewer may create one; editing and archiving are Owner/Admin (FR-1.7).</li>
      <li><strong>Oct 2026 review:</strong> icon + colour (fixed palette) on every category (FR-10.1, OQ-57). Both are contract enums mirroring <code>@financas/reference</code>, kept equal by a test (OQ-174).</li>
      <li><strong>OQ-173:</strong> the Accessor re-checks icon and colour and returns <code>invalid_icon</code>/<code>invalid_color</code>; the route&#39;s 422 normally fires first. Names need not be unique.</li>
      <li>See FR-10.1.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-category.html",
    title="Edit Category (incl. Subcategories)",
    subtitle='<span class="route">PATCH /households/:householdId/categories/:categoryId</span> &mdash; FR-10.2. Creating a new Subcategory under this Category is folded into the same request, not a separate endpoint.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant VU as ValidationUtility
    participant CA as CategoryAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /households/:householdId/categories/:categoryId {name?, icon?, color?, subcategories?: [{id?, name}]}
    API->>AM: editCategory(actor, householdId, categoryId, edit)
    AM->>AZ: authorize(actor.userId, householdId, data.edit on shared data, owner none)
    alt not a member
        AZ-->>AM: not_member
        AM-->>API: NotFound
        API-->>User: 404 household.not_found
    else a Member or Viewer
        AZ-->>AM: forbidden
        AM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>AM: allowed
        AM->>VU: checkFields({name}) + checkItems("subcategories", {name})
        alt a name blank once trimmed
            VU-->>AM: [name / subcategories[i].name: string.min]
            AM-->>API: ValidationError
            API-->>User: 422 validation.failed {details}
        else valid
            VU-->>AM: []
            AM->>CA: update(householdId, categoryId, changes &mdash; names trimmed, unsent fields left out)
            Note over CA: one transaction (OQ-173): renames each listed Subcategory<br/>with an id, creates those without, unlisted ones untouched.<br/>A Subcategory has no parent-subcategory field &mdash; the<br/>two-level limit (FR-10.2) is structural, not a runtime check
            alt not this household's Category
                CA-->>AM: not_found (nothing written)
                AM-->>API: NotFound
                API-->>User: 404 category.not_found
            else an id not under this Category
                CA-->>AM: subcategory_not_found (nothing written)
                AM-->>API: NotFound
                API-->>User: 404 subcategory.not_found
            else applied
                CA-->>AM: Category with its Subcategories
                opt something changed
                    AM-->>LOG: log.audit("EditCategory", Category categoryId)
                end
                AM-->>API: Category
                API-->>User: 200 OK Category
            end
        end
    end
""",
    notes="""
    <ul>
      <li><strong>One atomic call (OQ-173)</strong> &mdash; the earlier per-entry <code>upsertSubcategory</code> loop could leave an edit half-applied; the whole PATCH is a single <code>update</code>. A Subcategory <code>id</code> from the body that isn&#39;t under this Category is answered 404 <code>subcategory.not_found</code> (OQ-174).</li>
      <li><strong>An empty edit</strong> reads the Category back and is not audited &mdash; nothing changed.</li>
      <li><strong>No "exceeds two levels" alt-flow shown</strong> &mdash; there is no request shape that could even express a third level (no <code>subcategories</code> field exists on a Subcategory), so there is nothing to reject at runtime.</li>
      <li>See FR-10.2.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-archive-category.html",
    title="Archive Category or Subcategory",
    subtitle='<span class="route">POST /households/:householdId/categories/:categoryId/archive</span> or <span class="route">POST /households/:householdId/categories/:categoryId/subcategories/:subcategoryId/archive</span> &mdash; FR-10.3/10.4. Archiving a Category cascades to all its Subcategories; archiving a Subcategory affects nothing else.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant CA as CategoryAccessor
    participant LOG as LoggingUtility

    alt target is a Category
        User->>API: POST /households/:householdId/categories/:categoryId/archive
        API->>AM: archiveCategory(actor, householdId, categoryId)
    else target is a Subcategory
        User->>API: POST /households/:householdId/categories/:categoryId/subcategories/:subcategoryId/archive
        API->>AM: archiveSubcategory(actor, householdId, categoryId, subcategoryId)
    end
    AM->>AZ: authorize(actor.userId, householdId, data.delete on shared data, owner none)
    alt not a member
        AZ-->>AM: not_member
        AM-->>API: NotFound
        API-->>User: 404 household.not_found
    else a Member or Viewer
        AZ-->>AM: forbidden
        AM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>AM: allowed
        alt target is a Category
            AM->>CA: archive(householdId, categoryId)
            Note over CA: stamps this Category's archived_at, then its live<br/>Subcategories' with the same time &mdash; one transaction<br/>(FR-10.4's cascade) &mdash; already-archived ones keep theirs
            alt not this household's
                CA-->>AM: false
                AM-->>API: NotFound
                API-->>User: 404 category.not_found
            else archived
                CA-->>AM: true
                AM-->>LOG: log.audit("ArchiveCategory", Category categoryId)
                AM-->>API: archived
                API-->>User: 204 No Content
            end
        else target is a Subcategory
            AM->>CA: archiveSubcategory(householdId, categoryId, subcategoryId)
            Note over CA: single-row update &mdash; parent Category and sibling<br/>Subcategories are untouched (FR-10.4)
            alt not under that Category of this household
                CA-->>AM: false
                AM-->>API: NotFound
                API-->>User: 404 subcategory.not_found
            else archived
                CA-->>AM: true
                AM-->>LOG: log.audit("ArchiveSubcategory", Subcategory subcategoryId)
                AM-->>API: archived
                API-->>User: 204 No Content
            end
        end
    end
""",
    notes="""
    <ul>
      <li>No hard delete exists for either resource &mdash; FR-10.3 only ever defines archive, the same one-way shape as Accounts/Holdings, not Budget&#39;s hard-delete shape.</li>
      <li>Archiving is checked as <code>data.delete</code> on shared data nobody owns: Owner/Admin (FR-1.7, OQ-174).</li>
      <li>See FR-10.3, FR-10.4.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
