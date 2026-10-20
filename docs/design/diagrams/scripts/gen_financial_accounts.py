#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/financial-accounts/*.html — CUC-3,
3 of 3 use cases (Open Banking trio deferred, not modeled) — and rewrites the
matching call chains in docs/design/diagrams/call-chains/financial-accounts/
(as built in M2 part 2, OQ-175). Idempotent."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import check_mermaid_source, page as _page
from gen_call_chains_oct2026_lib import CC, E, write as write_chain

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sequences", "financial-accounts")


def page(filename, title, subtitle, mermaid, notes):
    problems = check_mermaid_source(mermaid, filename)
    assert not problems, problems
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)


P_CORE = """    actor User
    participant API as Hono route
    participant AM as AccountManager"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-create-account.html",
    title="Create Financial Account",
    subtitle='<span class="route">POST /households/:householdId/accounts</span> &mdash; FR-2.1/2.7. <code>type</code> and <code>currency</code> are immutable once set (OQ-32) &mdash; there is no edit path for either, ever. The Account and its cards are written together or not at all (OQ-175).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant VU as ValidationUtility
    participant UW as UnitOfWorkUtility
    participant AA as AccountAccessor
    participant CA as CreditCardAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/accounts {name, type, currency, visibility, openingBalance?, cards?: [{network, last4, closingDay, dueDay, expirationMonth, expirationYear}]}
    Note over API: contract check first: type, currency, CardNetwork,<br/>last4 = 4 digits, days 1&ndash;31, month 1&ndash;12 &rarr; 422 validation.failed
    API->>AM: createAccount(context, householdId, input)
    AM->>AU: authorize(actor, householdId, {data.create, visibility, ownerUserId: actor})
    alt not a member
        AU-->>AM: not_member
        AM-->>API: 404 household.not_found
    else shared Account by a role that may not create (Viewer)
        AU-->>AM: forbidden
        AM-->>API: 403 auth.forbidden
    else allowed (a personal Account is anyone&#39;s own)
        AU-->>AM: allowed
        AM->>VU: checkFields({name: nonBlank})
        alt blank name
            AM-->>API: 422 validation.failed {name}
        else cards on an investment Account (FR-2.7)
            AM-->>API: 422 account.cards_not_allowed
        else valid
            AM->>UW: inTransaction(work)
            Note over UW,CA: one DB transaction &mdash; the work gets both Accessors over it
            AM->>AA: insert({householdId, ownerUserId: actor, name, type, currency, visibility, startingBalance, startingBalanceDate: today})
            Note over AA: also writes the first account_month_balances row,<br/>opening and ending at the opening balance (OQ-169)
            loop each card, one at a time
                AM->>CA: insert({accountId, ...card}, today)
                Note over CA: first credit_card_month_balances row at 0,<br/>in the billing cycle today falls in (OQ-170)
            end
            UW-->>AM: committed (a failure rolls every write back)
            AM-->>LOG: audit CreateAccount, AttachCreditCard per card
            AM-->>API: Account {currentBalance: openingBalance, cards: outstandingBalance 0}
            API-->>User: 201 Created
        end
    end
""",
    notes="""
    <ul>
      <li>Attaching a card at creation is optional (FR-2.7 doesn&#39;t require an account to have a card at all) &mdash; the same combined-form principle used for editing (OQ-35) applies from the start.</li>
      <li>&ldquo;Today&rdquo; is the app time zone&#39;s date (OQ-104), read from the Manager&#39;s clock.</li>
      <li><strong>Oct 2026 review:</strong> four account types (OQ-76); also the mandatory first step of every household&#39;s guided setup (FR-1.22).</li>
      <li>See FR-2.1, FR-2.2, FR-2.7, OQ-175.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-edit-account.html",
    title="Edit Financial Account (incl. Credit Cards)",
    subtitle='<span class="route">PATCH /households/:householdId/accounts/:accountId</span> &mdash; FR-2.9/OQ-35. Attaching, editing, and removing this account&#39;s Credit Cards is folded into this same request, in one write (OQ-175) &mdash; not separate endpoints.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant VU as ValidationUtility
    participant UW as UnitOfWorkUtility
    participant AA as AccountAccessor
    participant CA as CreditCardAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /households/:householdId/accounts/:accountId {name?, visibility?, cards?: {add?, edit?: [{id, ...}], remove?: [id]}}
    Note over API: no field for type/currency exists (OQ-32)
    API->>AM: editAccount(context, householdId, accountId, edit)
    AM->>AA: findById(householdId, accountId)
    AA-->>AM: account (or none)
    AM->>AU: authorize(actor, householdId, {data.edit, account.visibility, account.ownerUserId})
    alt not a member
        AM-->>API: 404 household.not_found
    else missing, or someone else&#39;s personal Account
        AM-->>API: 404 account.not_found
    else role may not edit (a Member may edit a shared one they created)
        AM-->>API: 403 auth.forbidden
    else allowed
        alt account archived (one-way, FR-2.4)
            AM-->>API: 409 account.archived
        else visibility changed by someone other than the creator (FR-2.3, OQ-169)
            AM-->>API: 403 auth.forbidden
        else
            AM->>VU: checkFields({name: nonBlank})
            AM->>CA: listByAccounts([accountId])
            alt blank name
                AM-->>API: 422 validation.failed {name}
            else a card added to an investment Account (FR-2.7)
                AM-->>API: 422 account.cards_not_allowed
            else an edited or removed card id not on this Account
                AM-->>API: 404 credit_card.not_found
            else all checked
                AM->>UW: inTransaction(work)
                AM->>AA: update(householdId, accountId, {name, visibility})
                loop add, then edit, then remove &mdash; one at a time
                    AM->>CA: insert({accountId, ...card}, today) / update(accountId, cardId, changes) / remove(accountId, cardId)
                end
                Note over AM,CA: an Account or card gone meanwhile &rarr; 404, the whole edit rolls back
                UW-->>AM: committed
                AM-->>LOG: audit EditAccount (if name/visibility changed), AttachCreditCard / EditCreditCard / RemoveCreditCard per card
                AM->>AA: balancesAsOf([accountId], today&#39;s month)
                AM->>CA: listByAccounts([accountId]), balancesAsOf(cardIds, current cycle)
                AM-->>API: Account {currentBalance, cards: outstandingBalance}
                API-->>User: 200 OK
            end
        end
    end
""",
    notes="""
    <ul>
      <li>FR-2.9&#39;s combined-form decision (OQ-35) means there is no separate <code>POST /households/:householdId/accounts/:id/cards</code> endpoint at all &mdash; card attach/edit/remove only ever happens through this one request.</li>
      <li>Every check runs before the transaction opens, so a refused edit writes nothing. A new closing day applies to movements written after it (OQ-170). Removing a card drops its Card Transactions and balances; the Budget spend its charges accrued stays (OQ-174).</li>
      <li>An empty edit reads the Account back, unaudited.</li>
      <li>See FR-2.3, FR-2.7, FR-2.9, OQ-32, OQ-35, OQ-175.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-archive-account.html",
    title="Archive Financial Account",
    subtitle='<span class="route">POST /households/:householdId/accounts/:accountId/archive</span> &mdash; FR-2.4/OQ-34. One-way, no unarchive path. Auto-disconnects Open Banking sync if linked (OQ-36) &mdash; currently a no-op since that trigger is parked.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AU as AuthorizationUtility
    participant AA as AccountAccessor
    participant OB as OpenBankingConnectionAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/accounts/:accountId/archive
    API->>AM: archiveAccount(context, householdId, accountId)
    AM->>AA: findById(householdId, accountId)
    AA-->>AM: account (or none)
    AM->>AU: authorize(actor, householdId, {data.delete, account.visibility, account.ownerUserId})
    alt not a member
        AM-->>API: 404 household.not_found
    else missing, or someone else&#39;s personal Account
        AM-->>API: 404 account.not_found
    else role may not archive
        AM-->>API: 403 auth.forbidden
    else already archived
        Note over AM: nothing written, unaudited
        AM-->>API: done
        API-->>User: 204 No Content
    else allowed
        AM->>AA: archive(householdId, accountId)
        Note over AA: sets archived_at, one-way &mdash; no unarchive endpoint exists (OQ-34)
        AA-->>AM: archived
        opt account has an active Open Banking connection
            AM->>OB: disconnect(accountId)
            Note over OB: parked &mdash; Open Banking trio deferred (CUC-3/CUC-4)<br/>&mdash; this branch is currently unreachable, kept here since<br/>OQ-36 already confirmed the intended behavior
            OB-->>AM: disconnected
        end
        AM-->>LOG: audit ArchiveAccount
        AM-->>API: archived
        API-->>User: 204 No Content
    end
""",
    notes="""
    <ul>
      <li>An archived Account takes no new transactions (FR-2.4, OQ-169 &mdash; <code>TransactionManager</code>&#39;s check) and can&#39;t be edited (409 <code>account.archived</code>, OQ-175).</li>
      <li>See FR-2.4, OQ-34, OQ-36.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])
print(f"Generated {len(UCS)} files in {OUT_DIR}")

# ------------------------------------------------------------ call chains
FA = CC / "financial-accounts"
UOW = "<code>UnitOfWorkUtility.inTransaction</code> wraps the Accessor writes in one transaction (OQ-175) &mdash; not drawn on the shared layout."

write_chain(
    FA / "uc-01-create-account.html",
    "Call Chain — Create Financial Account",
    "Use case 1 of 3 in the Manage Financial Accounts set (CUC-3, FR-2.1/2.7). Create pattern, optional inline Credit Cards. As built in M2 part 2 (OQ-175).",
    E((1, "mgr-account", "util-authz"), (2, "mgr-account", "util-validation"),
      (3, "mgr-account", "acc-account"), (4, "mgr-account", "acc-creditcard"),
      (5, "mgr-account", "util-logging", "a")),
    [
        "<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility.authorize(data.create)</code> (sync) → ② <code>ValidationUtility.checkFields(...)</code> (sync) → ③ <code>AccountAccessor.insert(...)</code> (sync) → ④ <code>CreditCardAccessor.insert(...)</code> (sync, one per inline card) → ⑤ <code>LoggingUtility</code> (async).",
        "<strong>Corrected (OQ-175):</strong> the authorization call is needed after all — a personal Account is anyone&#39;s own, but a shared one needs a role that may create (a Viewer may not).",
        UOW,
    ],
)
write_chain(
    FA / "uc-02-edit-account.html",
    "Call Chain — Edit Financial Account (incl. Credit Cards)",
    "Use case 2 of 3 in the Manage Financial Accounts set (CUC-3, FR-2.3/FR-2.9, OQ-35). Edit pattern, Credit Card changes folded in. As built in M2 part 2 (OQ-175).",
    E((1, "mgr-account", "acc-account"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "util-validation"), (4, "mgr-account", "acc-creditcard"),
      (5, "mgr-account", "util-logging", "a")),
    [
        "<strong>Chain:</strong> <code>AccountManager</code> ① <code>AccountAccessor.findById(...)</code> (sync — the Account&#39;s visibility and owner feed the check; later <code>update</code> and <code>balancesAsOf</code>) → ② <code>AuthorizationUtility.authorize(data.edit)</code> (sync) → ③ <code>ValidationUtility.checkFields(...)</code> (sync) → ④ <code>CreditCardAccessor.listByAccounts / insert / update / remove</code> (sync, one call per changed card) → ⑤ <code>LoggingUtility</code> (async).",
        "<strong>No smell:</strong> same two Accessors as Create (UC-1) — folding Credit Card management into Edit Account (OQ-35) introduced no new component.",
        UOW,
    ],
)
write_chain(
    FA / "uc-03-archive-account.html",
    "Call Chain — Archive Financial Account",
    "Use case 3 of 3 in the Manage Financial Accounts set (CUC-3, FR-2.4). Lifecycle Transition (Account → archived), cascades Open Banking disconnect. As built in M2 part 2 (OQ-175).",
    E((1, "mgr-account", "acc-account"), (2, "mgr-account", "util-authz"),
      (3, "mgr-account", "acc-obconn"), (4, "mgr-account", "util-logging", "a")),
    [
        "<strong>Chain:</strong> <code>AccountManager</code> ① <code>AccountAccessor.findById / archive(...)</code> (sync) → ② <code>AuthorizationUtility.authorize(data.delete)</code> (sync, between the read and the write) → ③ <code>OpenBankingConnectionAccessor.disconnect(...)</code> (sync, only if linked — parked component) → ④ <code>LoggingUtility</code> (async).",
        "<strong>Corrected (OQ-175):</strong> archiving is a data.delete on the Account, so it is authorized like any write; an already archived Account is left as it is.",
    ],
)
print(f"Rewrote 3 call chains in {FA}")
