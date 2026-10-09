#!/usr/bin/env python3
"""Generate the October 2026 EBD re-decomposition artifacts
(docs/architecture/11-ebd-review-2026-10.md, confirmed by the stakeholder):

- docs/design/diagrams/ebd-tiers/<experience>.html  — 8 Experiences + the App Shell
- docs/design/diagrams/ebd-sequences/<experience>-<flow>.html — 21 Flows + shell routing

The decomposition lives once, in EXPERIENCES below; the EBD doc's tier
tables are generated from the same data (see `tier_markdown`), so the
doc, tier diagrams and sequences can't drift apart. Rerun after edits;
never hand-edit the HTML output.
"""
import os
import pathlib
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as seq_page  # noqa: E402

ROOT = pathlib.Path(__file__).parent.parent
TIERS = ROOT / "ebd-tiers"
SEQS = ROOT / "ebd-sequences"

UTILS = {
    "ValidationUtility": "Field rules shared by every form (email, password ≥ 12, money, dates)",
    "PasswordStrengthUtility": "Strength meter for register / reset / change password",
    "AlertUtility": "Toasts and inline banners",
    "ThemeUtility": "Design tokens, dark / light / system, category palette tokens (OQ-85, NFR-UX-2)",
    "I18nUtility": "Shared ICU catalog — renders notifications by type and errors by code (NFR-I18N-3)",
    "FormattingUtility": "Intl formatting — money in minor units, rates × 10,000, whole percent, dates (NFR-I18N-2)",
}

# name, slug, purpose, [(flow, [interactions], sequence_slug)], [standalone interactions], [utilities], notes
EXPERIENCES = [
    ("Authenticate", "authenticate", "Get in, get out — the entry gate",
     [("Sign In", ["Credential Entry", "MFA Code Entry", "Backup Code Entry"], "sign-in"),
      ("Account Recovery", ["Recovery Request", "New Password Entry"], "account-recovery")],
     ["Sign Out"], ["ValidationUtility", "PasswordStrengthUtility", "AlertUtility", "I18nUtility"],
     "Security Maintenance moved to Manage Profile (Q1). 'Remember me' removed (OQ-62)."),
    ("Onboard", "onboard", "Set up a household from nothing",
     [("Registration", ["Registration Form Entry"], "registration"),
      ("MFA Enrollment", ["MFA Method Selection", "MFA Setup Verification", "Backup Codes Acknowledgement"], "mfa-enrollment"),
      ("Household Setup", ["Household Name Entry"], "household-setup"),
      ("Guided Setup", ["Wizard Navigation", "Setup Complete Summary"], "guided-setup")],
     [], ["ValidationUtility", "PasswordStrengthUtility", "AlertUtility", "I18nUtility", "FormattingUtility"],
     "Guided Setup composes Account Setup's Account & Card (mandatory, no Skip — FR-1.22), Category and Budget Flows. Registration + MFA Enrollment are skipped by configuration when the user is already signed in (additional household, OQ-81)."),
    ("Manage Profile", "manage-profile", "Look after my own account",
     [("Security", ["Password Change", "Session List", "Sign Out All Others"], "security"),
      ("Delete Account", ["Ownership Check", "Consequences Review", "Type-to-Confirm"], "delete-account")],
     ["Edit Personal Info", "Edit Preferences", "Respond to Invitation"], ["ValidationUtility", "PasswordStrengthUtility", "AlertUtility", "ThemeUtility", "I18nUtility"],
     "New Experience (Q1): split out of Authenticate (Security) and Manage Household (Edit Profile, Delete Account)."),
    ("Manage Household", "manage-household", "Run the household",
     [("Membership Management", ["Member List", "Role Menu", "Invite Member", "Pending Invitations", "Remove Member Confirm", "Transfer Ownership"], "membership-management"),
      ("Household Deletion", ["Consequences Review", "Type-to-Confirm"], "household-deletion")],
     ["Leave Household", "Switch Household"], ["ValidationUtility", "AlertUtility", "I18nUtility"],
     "Switch Household is hosted by the App Shell's household switcher; 'Create household' there starts Onboard (Q3)."),
    ("Account Setup", "account-setup", "Configure the containers and rules everything else runs on",
     [("Account & Card Management", ["Account Form", "Card Entry with Live Preview", "Archive Confirm"], "account-card-management"),
      ("Category Management", ["Category Card", "Icon & Colour Picker", "Inline Subcategory Entry", "Archive Confirm"], "category-management"),
      ("Budget Management", ["Budget Form", "Claim-Aware Category Picker", "Delete Confirm"], "budget-management"),
      ("Goal Management", ["Goal Form", "Goal Progress Card", "Exchange-Rate Calculator", "Complete / Reopen Confirm"], "goal-management")],
     [], ["ValidationUtility", "AlertUtility", "ThemeUtility", "I18nUtility", "FormattingUtility"],
     "Holding Management left this Experience (holdings are created by transactions, maintained in Track Investments). The Exchange-Rate Calculator is client-side only (FR-9)."),
    ("Manage Finances", "manage-finances", "Record and review day-to-day money",
     [("Record Transaction", ["Kind Group & Kind Selection", "Transaction Entry", "Investment Buy Entry", "Goal Allocation Entry"], "record-transaction"),
      ("Browse Transactions", ["Filter Panel", "Ledger (lazy, grouped by month/day)", "Expanded Row", "Delete Confirm"], "browse-transactions"),
      ("Month Overview", ["Period Bar", "Currency Switch", "Balance Rail", "Budget Rail", "Goal Rail"], "month-overview")],
     [], ["ValidationUtility", "AlertUtility", "ThemeUtility", "I18nUtility", "FormattingUtility"],
     "Transaction Correction Flow removed — editing reuses Record Transaction's entry Interactions from an expanded ledger row. Month Overview stays here (Q4): same page, same period state."),
    ("Track Investments", "track-investments", "Follow and maintain investments",
     [("Portfolio Overview", ["Net Worth Cards", "Payout This Month", "Payout Holding Selector", "Payout Chart", "Allocation Cards", "Coming Due"], "portfolio-overview"),
      ("Holding Maintenance", ["Account Picker", "Holdings Table", "Goal Allocation Editor", "Market Value Entry", "Value History Editor"], "holding-maintenance"),
      ("Rates Maintenance", ["Rate Card", "Rate Update Entry", "Rate History Editor"], "rates-maintenance")],
     ["Archive Matured Holding"], ["ValidationUtility", "AlertUtility", "ThemeUtility", "I18nUtility", "FormattingUtility"],
     "New Experience (Q2). Portfolio Builders stay disabled (v2)."),
    ("Review Insights", "review-insights", "See the state of things",
     [("Dashboard", ["Net Worth Cards", "Coming Due", "Payout Holding Selector", "Payout Chart", "Balance / Budget / Goal Rails"], "dashboard")],
     ["Export Audit Log", "Notification Inbox"], ["AlertUtility", "ThemeUtility", "I18nUtility", "FormattingUtility"],
     "v1 Dashboard is fixed (widgets v3); Reporting v2. Notification Inbox is hosted by the App Shell's bell. Audit log browsing removed — FR-7.2 is export only."),
]


# ---------------------------------------------------------------- tier pages
_tpl = (TIERS / "authenticate.html").read_text()
HEAD = _tpl[: _tpl.index("<body>") + len("<body>")]
TAIL = _tpl[_tpl.index('  <div class="legend">'):]


def _box(cls, text):
    return f'<div class="box {cls}">{text}</div>'


def tier_page(name, slug, purpose, flows, standalone, utils, note):
    """One static tier diagram per Experience (no wiring, same convention as before)."""
    cols = len(flows) + (1 if standalone else 0)
    grid = f'style="grid-template-columns: repeat({cols}, 1fr);"'
    labels = "".join(f'<div class="col-label">{f[0]}</div>' for f in flows) + ('<div class="col-label">(standalone)</div>' if standalone else "")
    flow_boxes = "".join(_box("flow", f"{f[0]} Flow") for f in flows) + (_box("no-flow", "no Flow — hosted by the Experience") if standalone else "")
    inter = "".join('<div class="interaction-column">' + "".join(_box("interaction", i) for i in f[1]) + "</div>" for f in flows)
    if standalone:
        inter += '<div class="interaction-column">' + "".join(_box("interaction", i) for i in standalone) + "</div>"
    util_html = "".join(_box("utility", u) for u in utils)
    body = f"""
  <h1>EBD Tiers — {name}</h1>
  <p class="subtitle">
    {purpose}. Static structure only — no state/event wiring. Oct 2026 re-decomposition
    (<code>docs/architecture/11-ebd-review-2026-10.md</code>); full reasoning in
    <code>docs/architecture/frontend/01-ebd-decomposition.md</code>. {note}
  </p>

  <div class="architecture">
    <div class="layers">
      <div class="layer-band">
        <div class="band-label">Experience</div>
        <div class="tier-grid" {grid}>
          <div class="box experience" style="grid-column: 1 / span {cols};">{name}</div>
        </div>
      </div>
      <div class="layer-band">
        <div class="tier-row">
          <div class="tier-label">Flows</div>
          <div class="tier-grid" {grid}>{labels}</div>
          <div class="tier-grid" {grid}>{flow_boxes}</div>
        </div>
        <div class="tier-row">
          <div class="tier-label">Interactions</div>
          <div class="tier-grid" {grid}>{inter}</div>
        </div>
      </div>
    </div>
    <div class="utilities-sidebar">
      <div class="band-label">Cross-Cutting Utilities</div>
      {util_html}
      <div class="utility-note">Shared across Experiences; no knowledge of any journey.</div>
    </div>
  </div>

"""
    (TIERS / f"{slug}.html").write_text(HEAD + body + TAIL)


def shell_page():
    """App Shell: a layout, not an Experience — hosts chrome and routes events."""
    rows = [("Header", ["Logo", "Notification Bell → Review Insights' Notification Inbox"]),
            ("Nav drawer", ["Identity", "Household Switcher → Manage Household's Switch Household", "Create household → Onboard", "Main nav (one entry per Experience)", "Export audit log → Review Insights", "Profile / Sign out"]),
            ("Routing config", ["invitation.received → Manage Profile (Respond to Invitation)", "holding.matured → Track Investments (Archive Matured Holding)", "active household → every Experience (read-only context)"])]
    cols = len(rows)
    grid = f'style="grid-template-columns: repeat({cols}, 1fr);"'
    labels = "".join(f'<div class="col-label">{r[0]}</div>' for r in rows)
    inter = "".join('<div class="interaction-column">' + "".join(_box("interaction", i) for i in r[1]) + "</div>" for r in rows)
    body = f"""
  <h1>App Shell — layout around every Experience</h1>
  <p class="subtitle">
    Not an Experience (stakeholder decision Q3): holds no journey state and never calls the backend for a
    journey. It hosts the chrome every page shares and routes chrome events to the Experience that owns them —
    routing is configuration (event type → Experience), so a new notification type needs one routing entry and
    one catalog string, nothing else.
  </p>
  <div class="architecture">
    <div class="layers">
      <div class="layer-band">
        <div class="band-label">Shell</div>
        <div class="tier-grid" {grid}><div class="box experience" style="grid-column: 1 / span {cols};">App Shell (layout)</div></div>
      </div>
      <div class="layer-band">
        <div class="tier-row">
          <div class="tier-label">Hosts</div>
          <div class="tier-grid" {grid}>{labels}</div>
          <div class="tier-grid" {grid}>{inter}</div>
        </div>
      </div>
    </div>
    <div class="utilities-sidebar">
      <div class="band-label">Cross-Cutting Utilities</div>
      {''.join(_box('utility', u) for u in ('ThemeUtility', 'I18nUtility', 'AlertUtility'))}
    </div>
  </div>

"""
    (TIERS / "app-shell.html").write_text(HEAD + body + TAIL)


def tier_markdown():
    """Markdown tier tables for the EBD doc (same data as the diagrams)."""
    out = []
    for name, slug, purpose, flows, standalone, utils, note in EXPERIENCES:
        out.append(f"### {name}\n\n**Purpose:** {purpose}. {note}\n")
        out.append("| Flow | Interactions | Sequence |\n|---|---|---|")
        for f, inter, seq in flows:
            out.append(f"| {f} | {', '.join(inter)} | `docs/design/diagrams/ebd-sequences/{slug}-{seq}.html` |")
        if standalone:
            out.append(f"| *(standalone)* | {', '.join(standalone)} | — |")
        out.append(f"\n**Utilities:** {', '.join(utils)}. Tier diagram: `docs/design/diagrams/ebd-tiers/{slug}.html`.\n")
    return "\n".join(out)


# ---------------------------------------------------------------- sequences
def seq(slug, title, subtitle, participants, body, notes):
    """EBD sequence page: User → Interactions → Flow → Experience → API."""
    lines = ["sequenceDiagram", "    actor User"] + [f"    participant {a} as {l}" for a, l in participants]
    mer = "\n".join(lines) + "\n" + "\n".join("    " + b for b in body.strip("\n").split("\n")) + "\n"
    seq_page(str(SEQS), f"{slug}.html", title, subtitle, mer, f"<ul>{''.join(f'<li>{n}</li>' for n in notes)}</ul>")


R = lambda s: f'<span class="route">{s}</span>'
FLOW = lambda n: ("FLOW", f"{n}<br/>Flow")
EXP = lambda n: ("EXP", f"{n}<br/>Experience")
API = ("API", "Backend API")

SEQUENCES = [
    ("authenticate-sign-in", "Authenticate — Sign In", f"{R('POST /auth/login')}. Credentials, then MFA code or backup code.",
     [("CE", "Credential Entry"), ("MFA", "MFA Code Entry"), ("BC", "Backup Code Entry"), FLOW("Sign In"), EXP("Authenticate"), API],
     """
User->>CE: email + password, submit
CE->>FLOW: emit credentialsEntered
FLOW-->>MFA: render (challenge step)
alt authenticator code
    User->>MFA: 6 digits
    MFA->>FLOW: emit codeEntered
else lost phone
    User->>MFA: 'Use a backup code'
    MFA->>FLOW: emit switchToBackupCode
    FLOW-->>BC: render
    User->>BC: backup code
    BC->>FLOW: emit backupCodeEntered
end
FLOW->>EXP: request signIn(credentials, challenge)
EXP->>API: POST /auth/login (or /auth/mfa/recover)
alt 401 auth.invalid_credentials or auth.mfa_invalid
    API-->>EXP: error code
    EXP-->>FLOW: state: error(code) — I18nUtility renders it
else ok
    API-->>EXP: tokens
    EXP-->>FLOW: state: signedIn → App Shell takes over
end
""", ["Same error code for unknown user and wrong password (no enumeration).", "No 'Remember me' (OQ-62)."]),
    ("authenticate-account-recovery", "Authenticate — Account Recovery", f"{R('POST /auth/password-reset/request')} then {R('POST /auth/password-reset/confirm')}.",
     [("RR", "Recovery Request"), ("NP", "New Password Entry"), FLOW("Account Recovery"), EXP("Authenticate"), API],
     """
User->>RR: email, submit
RR->>FLOW: emit recoveryRequested
FLOW->>EXP: request requestReset(email)
EXP->>API: POST /auth/password-reset/request
API-->>EXP: 202 (same answer whether or not the email exists)
EXP-->>FLOW: state: emailSent
Note over User,RR: user opens the emailed link (sent by NotificationDeliveryUtility, OQ-84)
User->>NP: new password + confirm (strength meter)
NP->>FLOW: emit passwordChosen
FLOW->>EXP: request confirmReset(token, password)
EXP->>API: POST /auth/password-reset/confirm
alt 422 password.too_short or 400 password_reset.token_invalid
    API-->>EXP: error code
    EXP-->>FLOW: state: error(code)
else ok
    API-->>EXP: reset, all sessions revoked
    EXP-->>FLOW: state: done → Sign In
end
""", ["Password ≥ 12 characters (NFR-SEC-4)."]),
    ("onboard-registration", "Onboard — Registration", f"{R('POST /auth/register')}. Skipped by configuration when already signed in (OQ-81).",
     [("RF", "Registration Form Entry"), FLOW("Registration"), EXP("Onboard"), API],
     """
User->>RF: first + last name, email, password, confirm, terms
RF->>FLOW: emit registrationSubmitted
FLOW->>EXP: request register(fields)
EXP->>API: POST /auth/register
alt 409 user.email_taken or 422 password.too_short
    API-->>EXP: error code
    EXP-->>FLOW: state: error(code)
else created
    API-->>EXP: userId + TOTP secret
    EXP-->>FLOW: complete → Experience advances to MFA Enrollment
end
""", ["First/last name split (OQ-29)."]),
    ("onboard-mfa-enrollment", "Onboard — MFA Enrollment", "Mandatory, no skip (FR-1.15).",
     [("MS", "MFA Method Selection"), ("SV", "MFA Setup Verification"), ("BA", "Backup Codes Acknowledgement"), FLOW("MFA Enrollment"), EXP("Onboard"), API],
     """
User->>MS: Authenticator app, continue
MS->>FLOW: emit methodChosen
FLOW-->>SV: render QR + setup key
User->>SV: 6-digit code
SV->>FLOW: emit codeEntered
FLOW->>EXP: request verifyMfa(code)
EXP->>API: verify MFA enrollment
API-->>EXP: verified + recovery codes
EXP-->>FLOW: state: recoveryCodes
FLOW-->>BA: render 8 codes (download / copy)
User->>BA: 'I've saved these'
BA->>FLOW: emit acknowledged
FLOW->>EXP: complete → Household Setup
""", ["Method list is configuration (only the authenticator app in v1)."]),
    ("onboard-household-setup", "Onboard — Household Setup", f"{R('POST /households')}. Also the entry for an additional household from the switcher.",
     [("HN", "Household Name Entry"), FLOW("Household Setup"), EXP("Onboard"), API],
     """
User->>HN: household name (or pick an idea)
HN->>FLOW: emit nameEntered
FLOW->>EXP: request createHousehold(name)
EXP->>API: POST /households
API-->>EXP: householdId (default categories seeded via household.created)
EXP-->>FLOW: complete → Guided Setup
""", ["Default categories arrive with preset icons and colours (OQ-85)."]),
    ("onboard-guided-setup", "Onboard — Guided Setup", "Composes Account Setup's Flows as wizard steps; the account step is mandatory.",
     [("WN", "Wizard Navigation"), ("ACF", "Account & Card<br/>Management Flow"), ("CF", "Category<br/>Management Flow"), ("BF", "Budget<br/>Management Flow"), ("SC", "Setup Complete<br/>Summary"), FLOW("Guided Setup"), EXP("Onboard"), API],
     """
FLOW-->>ACF: step 1 (no Skip — FR-1.22)
ACF->>FLOW: emit accountSubmitted {account, cards}
FLOW->>EXP: request createAccount(...)
EXP->>API: POST /accounts
API-->>EXP: created
FLOW-->>CF: step 2 — review seeded categories
CF->>FLOW: emit categoriesReviewed {changes}
FLOW->>EXP: request apply category changes
EXP->>API: POST / PATCH /categories
FLOW-->>BF: step 3 — optional budget(s)
alt user creates a budget
    BF->>FLOW: emit budgetSubmitted
    FLOW->>EXP: request createBudget
    EXP->>API: POST /budgets
else Finish
    User->>WN: Finish setup
    WN->>FLOW: emit finish
end
FLOW-->>SC: render summary + next steps
FLOW->>EXP: complete → App Shell (Dashboard)
""", ["A composed Flow's backend calls route through whichever Experience hosts it — here Onboard (convention kept from the original decomposition).", "Main nav stays hidden until this completes."]),
    ("manage-profile-security", "Manage Profile — Security", f"{R('POST /auth/change-password')}, {R('GET /users/me/sessions')}, {R('DELETE /users/me/sessions[/:sessionId]')}.",
     [("PC", "Password Change"), ("SL", "Session List"), ("SO", "Sign Out All Others"), FLOW("Security"), EXP("Manage Profile"), API],
     """
FLOW->>EXP: request sessions
EXP->>API: GET /users/me/sessions
API-->>EXP: sessions
EXP-->>FLOW: state: sessions
FLOW-->>SL: render (This device / others)
alt revoke one
    User->>SL: Revoke
    SL->>FLOW: emit revokeSession {id}
    FLOW->>EXP: request revoke(id)
    EXP->>API: DELETE /users/me/sessions/:sessionId
else sign out all others
    User->>SO: Sign out all others
    SO->>FLOW: emit revokeOthers
    FLOW->>EXP: request revokeOthers
    EXP->>API: DELETE /users/me/sessions
else change password
    User->>PC: current + new (≥ 12) + confirm
    PC->>FLOW: emit passwordChange
    FLOW->>EXP: request changePassword
    EXP->>API: POST /auth/change-password
end
API-->>EXP: done or error code
EXP-->>FLOW: state refreshed
""", ["Moved from Authenticate (Q1)."]),
    ("manage-profile-delete-account", "Manage Profile — Delete Account", f"{R('DELETE /users/me')}.",
     [("OC", "Ownership Check"), ("CR", "Consequences Review"), ("TC", "Type-to-Confirm"), FLOW("Delete Account"), EXP("Manage Profile"), API],
     """
FLOW-->>OC: render — Owner? ownership passes to another member first (FR-1.18)
User->>OC: continue
OC->>FLOW: emit ownershipUnderstood
FLOW-->>CR: render consequences (personal data deleted, shared data anonymized)
User->>CR: continue
CR->>FLOW: emit consequencesAccepted
User->>TC: type the confirmation phrase
TC->>FLOW: emit confirmed
FLOW->>EXP: request deleteAccount
EXP->>API: DELETE /users/me
API-->>EXP: 204
EXP-->>FLOW: complete → App Shell signs out
""", ["Moved from Manage Household (Q1)."]),
    ("manage-household-membership-management", "Manage Household — Membership Management", f"{R('GET/POST/PATCH/DELETE /households/:id/members…, /invitations…, /transfer-ownership')}.",
     [("ML", "Member List"), ("RM", "Role Menu"), ("IM", "Invite Member"), ("PI", "Pending Invitations"), FLOW("Membership Management"), EXP("Manage Household"), API],
     """
FLOW->>EXP: request members + pending invitations
EXP->>API: GET /households/:id/members, GET /households/:id/invitations
API-->>EXP: lists
EXP-->>FLOW: state
FLOW-->>ML: render members
alt change a role
    User->>RM: pick Admin / Member / Viewer
    RM->>FLOW: emit roleChosen
    FLOW->>EXP: request changeRole
    EXP->>API: PATCH /households/:id/members/:userId/role
else invite
    User->>IM: email + role, Send
    IM->>FLOW: emit inviteSubmitted
    FLOW->>EXP: request invite
    EXP->>API: POST /households/:id/invitations
    Note over API: creates an in-app notification for the invitee (type invitation.received)
else revoke an invitation
    User->>PI: Revoke
    PI->>FLOW: emit revokeInvitation
    FLOW->>EXP: request revoke
    EXP->>API: DELETE /households/:id/invitations/:invitationId
end
API-->>EXP: done or error code (e.g. 404 invitation.invitee_not_registered)
EXP-->>FLOW: state refreshed
""", ["Remove member and Transfer ownership follow the same confirm-then-request shape."]),
    ("manage-household-household-deletion", "Manage Household — Household Deletion", f"{R('DELETE /households/:householdId')} (Owner only).",
     [("CR", "Consequences Review"), ("TC", "Type-to-Confirm"), FLOW("Household Deletion"), EXP("Manage Household"), API],
     """
FLOW-->>CR: render (every member loses access, shared data removed)
User->>CR: continue
CR->>FLOW: emit consequencesAccepted
User->>TC: type the household name
TC->>FLOW: emit confirmed
FLOW->>EXP: request deleteHousehold
EXP->>API: DELETE /households/:householdId
API-->>EXP: 204
EXP-->>FLOW: complete → App Shell switches to another household or Onboard
""", []),
    ("account-setup-account-card-management", "Account Setup — Account & Card Management", f"{R('POST/PATCH /accounts')}, {R('POST /accounts/:id/archive')}.",
     [("AF", "Account Form"), ("CE", "Card Entry with<br/>Live Preview"), ("AC", "Archive Confirm"), FLOW("Account & Card Management"), EXP("Account Setup"), API],
     """
User->>AF: name, type (checking / savings / credit card only / investment), currency, balance, visibility
AF->>FLOW: emit accountFields
opt add a card
    User->>CE: number (network detected), closing day, due day, expiry
    CE->>FLOW: emit cardAdded {network, last4, days, expiry}
end
FLOW->>EXP: request saveAccount(account, cards)
EXP->>API: POST /accounts (or PATCH /accounts/:accountId)
API-->>EXP: saved or 422 validation.failed
EXP-->>FLOW: state
opt archive
    User->>AC: confirm (one-way)
    AC->>FLOW: emit archive
    FLOW->>EXP: request archive
    EXP->>API: POST /accounts/:accountId/archive
end
""", ["Only last4 + network leave the browser — the full number never does (NFR-SEC-7).", "Reused as Guided Setup step 1."]),
    ("account-setup-category-management", "Account Setup — Category Management", f"{R('POST/PATCH /categories')}, archive endpoints.",
     [("CC", "Category Card"), ("IP", "Icon & Colour Picker"), ("SE", "Inline Subcategory Entry"), ("AC", "Archive Confirm"), FLOW("Category Management"), EXP("Account Setup"), API],
     """
alt new category
    User->>IP: name, icon, colour (18 palette tokens)
    IP->>FLOW: emit categoryDrafted
    FLOW->>EXP: request createCategory
    EXP->>API: POST /categories
else add a subcategory
    User->>SE: name, ✓
    SE->>FLOW: emit subcategoryAdded
    FLOW->>EXP: request updateCategory(subcategories)
    EXP->>API: PATCH /categories/:categoryId
else archive
    User->>AC: confirm (cascades to subcategories)
    AC->>FLOW: emit archive
    FLOW->>EXP: request archive
    EXP->>API: POST /categories/:categoryId/archive
end
API-->>EXP: done
EXP-->>FLOW: state refreshed
FLOW-->>CC: re-render (colour via ThemeUtility)
""", ["Colour stored as a token, resolved per theme (OQ-85)."]),
    ("account-setup-budget-management", "Account Setup — Budget Management", f"{R('POST/PATCH/DELETE /budgets')}.",
     [("BF", "Budget Form"), ("CP", "Claim-Aware<br/>Category Picker"), ("DC", "Delete Confirm"), FLOW("Budget Management"), EXP("Account Setup"), API],
     """
FLOW-->>CP: render categories — claimed ones disabled, showing which budget owns them
User->>BF: name, currency, visibility, monthly target
User->>CP: pick free categories / subcategories
CP->>FLOW: emit coverChosen
BF->>FLOW: emit budgetSubmitted
FLOW->>EXP: request saveBudget
EXP->>API: POST /budgets (or PATCH)
alt 409 budget.target_already_claimed
    API-->>EXP: error code (claimed meanwhile)
    EXP-->>FLOW: state: error — picker refreshes
else saved
    API-->>EXP: budget
    EXP-->>FLOW: state refreshed
end
""", ["Setup page shows no spend progress (stakeholder)."]),
    ("account-setup-goal-management", "Account Setup — Goal Management", f"{R('POST/PATCH/DELETE /goals')}, {R('POST /goals/:id/complete|reopen')}, {R('GET /goals')}.",
     [("GF", "Goal Form"), ("GP", "Goal Progress Card"), ("FX", "Exchange-Rate<br/>Calculator"), ("CR", "Complete / Reopen<br/>Confirm"), FLOW("Goal Management"), EXP("Account Setup"), API],
     """
FLOW->>EXP: request goals(status)
EXP->>API: GET /goals?status=active
API-->>EXP: goals with per-currency contributions + funded by
EXP-->>FLOW: state
FLOW-->>GP: render progress
opt goal mixes currencies
    User->>FX: '1 USD = 5.20 BRL'
    FX->>FLOW: emit rateEntered (kept in Flow state only)
    FLOW-->>GP: re-render blended estimate (nothing sent)
end
alt create / edit
    User->>GF: name, currency, visibility, target, due date
    GF->>FLOW: emit goalSubmitted
    FLOW->>EXP: request saveGoal
    EXP->>API: POST /goals (or PATCH)
else complete / reopen
    User->>CR: confirm
    CR->>FLOW: emit transition
    FLOW->>EXP: request complete or reopen
    EXP->>API: POST /goals/:goalId/complete (or /reopen)
end
""", ["Allocations are never edited here — always from the Holding (OQ-48).", "FX never leaves the browser (FR-9)."]),
    ("manage-finances-record-transaction", "Manage Finances — Record Transaction", f"{R('POST /transactions')}; edit reuses it with {R('PATCH /transactions/:id')}.",
     [("KS", "Kind Group &<br/>Kind Selection"), ("TE", "Transaction Entry"), ("IB", "Investment Buy Entry"), ("GA", "Goal Allocation Entry"), FLOW("Record Transaction"), EXP("Manage Finances"), API],
     """
User->>KS: group (Cash / Transfer / Credit card / Investment), then kind
KS->>FLOW: emit kindSelected
alt investment buy
    FLOW-->>IB: render asset type, ticker, quantity, rate + due date (fixed-term), incentivised (debenture)
    User->>IB: fill in
    IB->>FLOW: emit tradeFields
    opt assign to goals
        User->>GA: goal rows with whole %
        GA->>FLOW: emit allocations (Flow keeps the total ≤ 100)
    end
else any other kind
    FLOW-->>TE: render fields for the kind (account narrows by kind)
end
User->>TE: amount (currency from account), date, category, description
TE->>FLOW: emit fields
FLOW->>EXP: request record(transaction)
EXP->>API: POST /transactions
alt 4xx (e.g. goal.allocation_exceeds_100, transaction.investment_not_allowed_on_account)
    API-->>EXP: error code + params
    EXP-->>FLOW: state: error — I18nUtility renders it
else 201
    API-->>EXP: transactionId
    EXP-->>FLOW: complete → Experience refreshes Browse + Month Overview
end
""", ["No recurring option (OQ-55).", "The Experience, not this Flow, refreshes the sibling Flows on completion."]),
    ("manage-finances-browse-transactions", "Manage Finances — Browse Transactions", f"{R('GET /transactions?…&cursor=')}, {R('DELETE /transactions/:id')}.",
     [("FP", "Filter Panel"), ("LG", "Ledger"), ("XR", "Expanded Row"), ("DC", "Delete Confirm"), FLOW("Browse Transactions"), EXP("Manage Finances"), API],
     """
FLOW->>EXP: request page(filters, cursor = null)
EXP->>API: GET /transactions
API-->>EXP: items, dayTotals, nextCursor
EXP-->>FLOW: state: page
FLOW-->>LG: render grouped by month / day
loop user scrolls
    LG->>FLOW: emit reachedEnd
    FLOW->>EXP: request page(filters, nextCursor)
    EXP->>API: GET /transactions?cursor=…
end
opt filter
    User->>FP: kinds, accounts, cards, categories, holding, any date range
    FP->>FLOW: emit filtersApplied
    FLOW->>EXP: request page(new filters, null)
end
User->>LG: click a row
LG->>FLOW: emit rowSelected
FLOW-->>XR: render details + Edit / Delete
alt edit
    XR->>FLOW: emit edit
    FLOW->>EXP: request edit(transaction) — Experience opens Record Transaction pre-filled
else delete
    User->>DC: confirm
    DC->>FLOW: emit delete
    FLOW->>EXP: request delete(id)
    EXP->>API: DELETE /transactions/:transactionId
end
""", ["Not scoped to the period bar (OQ-61).", "Edit goes through the Experience to Record Transaction — no Flow-to-Flow call."]),
    ("manage-finances-month-overview", "Manage Finances — Month Overview", f"{R('GET /reports/month-overview?year=&month=')}.",
     [("PB", "Period Bar"), ("CS", "Currency Switch"), ("RL", "Balance / Budget /<br/>Goal Rails"), FLOW("Month Overview"), EXP("Manage Finances"), API],
     """
FLOW->>EXP: request overview(year, month = today)
EXP->>API: GET /reports/month-overview
API-->>EXP: summary per currency, year strip, balances, budgets, goals
EXP-->>FLOW: state
FLOW-->>PB: render year + 12 months (mini in/out bars)
FLOW-->>RL: render rails labelled 'Month/Year'
alt pick another month or year
    User->>PB: select
    PB->>FLOW: emit periodChanged
    FLOW->>EXP: request overview(year, month)
    EXP->>API: GET /reports/month-overview
else switch currency
    User->>CS: $ or R$
    CS->>FLOW: emit currencyChanged (local — no request)
end
""", ["FormattingUtility formats every amount in its own currency; nothing is summed across currencies."]),
    ("track-investments-portfolio-overview", "Track Investments — Portfolio Overview", f"{R('GET /reports/investments-overview')}, {R('GET /reports/payouts?holdingIds=')}.",
     [("NW", "Net Worth / Allocation /<br/>Coming Due cards"), ("PT", "Payout This Month"), ("HS", "Payout Holding Selector"), ("PC", "Payout Chart"), FLOW("Portfolio Overview"), EXP("Track Investments"), API],
     """
FLOW->>EXP: request overview
EXP->>API: GET /reports/investments-overview
API-->>EXP: net worth + change, payout this month, allocations, coming due
EXP-->>FLOW: state
FLOW-->>NW: render
FLOW-->>PT: render this month's dividend / interest transactions
FLOW->>EXP: request payouts(default holdings)
EXP->>API: GET /reports/payouts
API-->>EXP: series
FLOW-->>PC: render top 5 + Others
User->>HS: search, presets, check holdings
HS->>FLOW: emit holdingsSelected
FLOW->>EXP: request payouts(selected)
EXP->>API: GET /reports/payouts?holdingIds=…
API-->>EXP: series
EXP-->>FLOW: state
FLOW-->>PC: re-render (only the chart refetches)
""", ["Portfolio Builder buttons render disabled (v2)."]),
    ("track-investments-holding-maintenance", "Track Investments — Holding Maintenance", f"{R('GET /accounts/:id/holdings')}, {R('PATCH /holdings/:id')}, {R('…/valuation-snapshots')}.",
     [("AP", "Account Picker"), ("HT", "Holdings Table"), ("GA", "Goal Allocation Editor"), ("MV", "Market Value Entry"), ("VH", "Value History Editor"), FLOW("Holding Maintenance"), EXP("Track Investments"), API],
     """
User->>AP: pick account
AP->>FLOW: emit accountChosen
FLOW->>EXP: request holdings(accountId)
EXP->>API: GET /accounts/:accountId/holdings
API-->>EXP: positions (+ expected payout / taxes for fixed-term)
EXP-->>FLOW: state
User->>HT: expand a holding
HT->>FLOW: emit holdingExpanded
alt edit goal allocations
    User->>GA: rows with whole %
    GA->>FLOW: emit allocations
    FLOW->>EXP: request saveAllocations
    EXP->>API: PATCH /holdings/:holdingId
else record a market value (market-priced only)
    User->>MV: value + as-of date
    MV->>FLOW: emit marketValue
    FLOW->>EXP: request recordValue
    EXP->>API: POST /holdings/:holdingId/valuation-snapshots
else fix a past value
    User->>VH: edit or delete an entry
    VH->>FLOW: emit historyChange
    FLOW->>EXP: request edit / delete snapshot
    EXP->>API: PATCH or DELETE …/valuation-snapshots/:snapshotId
end
API-->>EXP: done or error code (e.g. 409 snapshot.automatic_not_editable)
EXP-->>FLOW: state refreshed
""", ["Positions are read-only (transactions only).", "'See in Transactions' asks the Experience to route to Manage Finances with holdingId — no Flow-to-Flow call."]),
    ("track-investments-rates-maintenance", "Track Investments — Rates Maintenance", f"{R('GET /index-rates')}, {R('POST/PATCH/DELETE /index-rates/:index/values')}.",
     [("RC", "Rate Card"), ("RU", "Rate Update Entry"), ("RH", "Rate History Editor"), FLOW("Rates Maintenance"), EXP("Track Investments"), API],
     """
FLOW->>EXP: request rates
EXP->>API: GET /index-rates
API-->>EXP: every index with history
EXP-->>FLOW: state
FLOW-->>RC: render Selic, CDI, IPCA, IGP-M with charts
alt update
    User->>RU: value + as-of date
    RU->>FLOW: emit rateEntered
    FLOW->>EXP: request record
    EXP->>API: POST /index-rates/:index/values
else fix history
    User->>RH: edit or delete an entry
    RH->>FLOW: emit historyChange
    FLOW->>EXP: request edit / delete
    EXP->>API: PATCH or DELETE /index-rates/:index/values/:valueId
end
API-->>EXP: done
EXP-->>FLOW: state refreshed
""", ["Values are × 10,000 on the wire; FormattingUtility shows 10.50% a.a."]),
    ("review-insights-dashboard", "Review Insights — Dashboard", f"{R('GET /dashboard')}, {R('GET /reports/payouts?holdingIds=')}.",
     [("PN", "Panels"), ("HS", "Payout Holding Selector"), ("PC", "Payout Chart"), FLOW("Dashboard"), EXP("Review Insights"), API],
     """
FLOW->>EXP: request dashboard
EXP->>API: GET /dashboard
API-->>EXP: fixed panels
EXP-->>FLOW: state
FLOW-->>PN: render net worth, coming due, rails (over-budget first)
FLOW-->>PC: render payouts
User->>HS: change holdings
HS->>FLOW: emit holdingsSelected
FLOW->>EXP: request payouts(selected)
EXP->>API: GET /reports/payouts?holdingIds=…
API-->>EXP: series
EXP-->>FLOW: state
FLOW-->>PC: re-render
""", ["Widgets are v3, reports v2."]),
    ("app-shell-notification-routing", "App Shell — Notification Routing", f"{R('GET /notifications')}, {R('POST /notifications/seen')}, {R('DELETE /notifications/:id')} + the owning Experience's own endpoint.",
     [("BELL", "Notification Inbox<br/>(Review Insights)"), ("SHELL", "App Shell"), ("MP", "Manage Profile<br/>Experience"), ("TI", "Track Investments<br/>Experience"), API],
     """
SHELL->>API: GET /notifications (via Review Insights) — read-only, polled
API-->>SHELL: [{id, type, params, seenAt}]
SHELL-->>BELL: badge = count of seenAt null
User->>BELL: open the bell
BELL->>SHELL: emit inboxOpened
SHELL-->>BELL: render each via I18nUtility (type → catalog string, IDs resolved)
SHELL->>API: POST /notifications/seen {ids shown} (OQ-105)
alt invitation.received — Accept
    User->>BELL: Accept
    BELL->>SHELL: emit action {type: invitation.received, accept, params}
    SHELL->>MP: route (routing config) → Respond to Invitation
    MP->>API: POST /invitations/:invitationId/accept
else holding.matured — Archive holding
    User->>BELL: Archive holding
    BELL->>SHELL: emit action {type: holding.matured, archive, params}
    SHELL->>TI: route → Archive Matured Holding
    TI->>API: POST /holdings/:holdingId/archive
end
API-->>SHELL: done
SHELL->>API: DELETE /notifications/:notificationId
""", ["The inbox never performs the action itself — the owning Experience does (Q3).", "A new type = one routing entry + one catalog string."]),
]


def main():
    for name, slug, purpose, flows, standalone, utils, note in EXPERIENCES:
        tier_page(name, slug, purpose, flows, standalone, utils, note)
    shell_page()
    for old in SEQS.glob("*.html"):
        old.unlink()
    for slug, title, subtitle, parts, body, notes in SEQUENCES:
        seq(slug, title, subtitle, parts, body, notes)
    flows = sum(len(e[3]) for e in EXPERIENCES)
    print(f"tiers: {len(EXPERIENCES)} + shell, flows: {flows}, sequences: {len(SEQUENCES)}")


if __name__ == "__main__":
    main()
