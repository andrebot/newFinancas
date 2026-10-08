#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/financial-accounts/*.html — CUC-3,
3 of 3 use cases (Open Banking trio deferred, not modeled)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/financial-accounts"


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

P_CORE = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-create-account.html",
    title="Create Financial Account",
    subtitle='<span class="route">POST /accounts</span> &mdash; FR-2.1. <code>type</code> and <code>currency</code> are immutable once set (OQ-32) &mdash; there is no edit path for either, ever.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant AA as AccountAccessor
    participant CA as CreditCardAccessor
    participant LOG as LoggingUtility

    User->>API: POST /accounts {name, type: checking|savings|credit_card_only|investment, currency, visibility, openingBalance, cards?}
    API->>AM: createAccount(actor, input)
    AM->>VU: check(name, type, currency)
    alt validation fails (missing name, unsupported type/currency)
        VU-->>AM: rejected
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>AM: ok
        AM->>AA: insert(account, ownerId=actor)
        Note over AA: also creates the account's FIRST account_month_balances<br/>row, opening_balance = input (no opening_balance column<br/>on accounts itself, see 02-data-model.md)
        AA-->>AM: accountId
        opt cards included in the request
            AM->>CA: insert(accountId, cardDetails)
            CA-->>AM: cardId
        end
        AM-->>LOG: logActivity(correlationId, actor, "CreateAccount")
        AM-->>LOG: recordAudit(actor, "Account", accountId)
        AM-->>API: accountId
        API-->>User: 201 Created {accountId}
    end
""",
    notes="""
    <ul>
      <li>Attaching a card at creation is optional (FR-2.7 doesn&#39;t require an account to have a card at all) &mdash; the same combined-form principle used for editing (OQ-35) applies from the start.</li>
      <li><strong>Oct 2026 review:</strong> four account types (OQ-76); also the mandatory first step of every household&#39;s guided setup (FR-1.22).</li>
      <li>See FR-2.1, FR-2.2, FR-2.7.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-account.html",
    title="Edit Financial Account (incl. Credit Cards)",
    subtitle='<span class="route">PATCH /accounts/:accountId</span> &mdash; FR-2.9/OQ-35. Attaching, editing, and removing this account&#39;s Credit Cards is folded into this same request &mdash; not four separate endpoints.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant AA as AccountAccessor
    participant CA as CreditCardAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /accounts/:accountId {name, visibility, cards: [...]}
    API->>AM: editAccount(actor, accountId, input)
    AM->>VU: check(input)
    alt request attempts to change type or currency
        VU-->>AM: rejected (OQ-32/FR-2.2 &mdash; immutable once set)
        AM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else no type/currency change requested
        VU-->>AM: ok
        AM->>AA: update(accountId, {name, visibility})
        AA-->>AM: updated
        loop for each card change in the request
            AM->>AA: findById(accountId)
            alt account.type not in {checking, savings, credit_card}
                AA-->>AM: rejected (FR-2.7)
                AM-->>API: ValidationError
                API-->>User: 422 validation.failed {details}
            else account type allows cards
                AM->>CA: insert/update/delete(cardDetails)
                CA-->>AM: applied
            end
        end
        AM-->>LOG: logActivity(correlationId, actor, "EditAccount")
        AM-->>LOG: recordAudit(actor, "Account", accountId)
        AM-->>API: updated
        API-->>User: 200 OK
    end
""",
    notes="""
    <ul>
      <li>FR-2.9&#39;s combined-form decision (OQ-35) means there is no separate <code>POST /accounts/:id/cards</code> endpoint at all &mdash; card attach/edit/remove only ever happens through this one request.</li>
      <li>See FR-2.7, FR-2.9, OQ-32, OQ-35.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-archive-account.html",
    title="Archive Financial Account",
    subtitle='<span class="route">POST /accounts/:accountId/archive</span> &mdash; FR-2.4/OQ-34. One-way, no unarchive path. Auto-disconnects Open Banking sync if linked (OQ-36) &mdash; currently a no-op since that trigger is parked.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AA as AccountAccessor
    participant OB as OpenBankingConnectionAccessor
    participant LOG as LoggingUtility

    User->>API: POST /accounts/:accountId/archive
    API->>AM: archiveAccount(actor, accountId)
    AM->>AA: archive(accountId)
    Note over AA: sets archived_at, one-way &mdash; no unarchive endpoint exists (OQ-34)
    AA-->>AM: archived
    opt account has an active Open Banking connection
        AM->>OB: disconnect(accountId)
        Note over OB: parked &mdash; Open Banking trio deferred (CUC-3/CUC-4)<br/>&mdash; this branch is currently unreachable, kept here since<br/>OQ-36 already confirmed the intended behavior
        OB-->>AM: disconnected
    end
    AM-->>LOG: logActivity(correlationId, actor, "ArchiveAccount")
    AM-->>LOG: recordAudit(actor, "Account", accountId)
    AM-->>API: archived
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li>No alt/rejection branch shown &mdash; matches the confirmed call chain (<code>docs/design/diagrams/call-chains/financial-accounts/uc-03-archive-account.html</code>), which has no <code>AuthorizationUtility</code> edge for this flow.</li>
      <li>See FR-2.4, OQ-34, OQ-36.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
