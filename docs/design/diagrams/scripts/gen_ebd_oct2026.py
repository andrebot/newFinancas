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
    "AlertUtility": "The page's toast queue: at most 3 shown, the rest wait; repeats ignored (OQ-152)",
    "ThemeUtility": "Design tokens, dark / light / system, category palette tokens (OQ-85, NFR-UX-2)",
    "I18nUtility": "Shared ICU catalog — renders notifications by type and errors by code (NFR-I18N-3)",
    "FormattingUtility": "Intl formatting — money in minor units, rates × 10,000, whole percent, dates (NFR-I18N-2)",
    "ClipboardUtility": "Copy to the clipboard with a short-lived 'Copied' (OQ-149)",
    "DownloadUtility": "Hand the user a text file made in the browser (OQ-149)",
}

# name, slug, purpose, [(flow, [interactions], sequence_slug)], [standalone interactions], [utilities], notes
EXPERIENCES = [
    ("Authenticate", "authenticate", "Get in, get out — the entry gate",
     [("Sign In", ["Credential Entry", "MFA Code Entry", "Backup Code Entry"], "sign-in"),
      ("Account Recovery", ["Recovery Request", "New Password Entry", "Reset Complete"], "account-recovery")],
     ["Sign Out"], ["ValidationUtility", "PasswordStrengthUtility", "AlertUtility", "I18nUtility"],
     "Security Maintenance moved to Manage Profile (Q1). 'Remember me' removed (OQ-62). Sign In resumes an unconfirmed MFA enrollment by hosting Onboard's MFA enrollment step (OQ-157, OQ-158). Sign Out is the App Shell drawer's button, handed Authenticate's handler (OQ-156)."),
    ("Onboard", "onboard", "Set up a household from nothing",
     [("Registration", ["Registration Form Entry"], "registration"),
      ("MFA Enrollment", ["MFA Method Selection", "MFA Setup Verification", "Backup Codes Acknowledgement"], "mfa-enrollment"),
      ("Household Setup", ["Household Name Entry"], "household-setup"),
      ("Guided Setup", ["First Account Entry", "Account Cards Field", "Budget Entry", "Setup Done Row", "Wizard Navigation", "Setup Complete Summary"], "guided-setup")],
     [], ["ValidationUtility", "PasswordStrengthUtility", "AlertUtility", "I18nUtility", "FormattingUtility",
          "ClipboardUtility", "DownloadUtility"],
     "Guided Setup (FL6, OQ-196) walks a new household through mockups 11–14: the first account (mandatory, no Skip — FR-1.22) and a budget in inline forms of its own, built from Account Setup's card fields and claim-aware picker, and the seeded categories through Account Setup's Category Management Flow, which Onboard renders and hands into the wizard's categories step (Experiences compose Flows; a Flow never hosts one). Each route opens one stretch: /register runs Registration + MFA Enrollment; /setup (the household gate's) and /households/new (an additional household, OQ-81) run Household Setup, with Cancel only on the latter; /setup/guided runs Guided Setup on the active household (X2G, OQ-198) — a new household opens it, and so does the gate for a household with no account in use, so a drop-off resumes there. Its requests are the shared setup requests Account Setup answers too (experiences/setupRequests.ts). The server's state is the progression (OQ-158)."),
    ("Manage Profile", "manage-profile", "Look after my own account",
     [("Security", ["Password Change", "Session List", "Sign Out All Others"], "security"),
      ("Delete Account", ["Consequences Review", "Type-to-Confirm"], "delete-account")],
     ["Edit Personal Info", "Edit Preferences", "Respond to Invitation"], ["ValidationUtility", "PasswordStrengthUtility", "AlertUtility", "ThemeUtility", "I18nUtility", "FormattingUtility"],
     "New Experience (Q1): split out of Authenticate (Security) and Manage Household (Edit Profile, Delete Account). Hands the App Shell the signed-in user and the pending-invitation count, and owns the invitation.received route (OQ-159). Reads Manage Household's households list for the role and the households owned."),
    ("Manage Household", "manage-household", "Run the household",
     [("Membership Management", ["Member List", "Role Menu", "Invite Member", "Pending Invitations", "Remove Member Confirm", "Transfer Ownership"], "membership-management"),
      ("Household Deletion", ["Consequences Review", "Type-to-Confirm"], "household-deletion")],
     ["Leave Household"], ["ValidationUtility", "AlertUtility", "I18nUtility"],
     "Switch Household is the App Shell's own — its household switcher sets the active household and resets the API cache, no endpoint (OQ-156); 'Create household' there starts Onboard (Q3). Its households list (GET /households) feeds the shell's gate and switcher, brought in with X3 (OQ-159). Built in X4 (OQ-160): the header counts the cached members; Leave Household is its own card above the danger zone; once the household is left or deleted, the shell switches to the next household's Dashboard, or Onboard when none is left."),
    ("Account Setup", "account-setup", "Configure the containers and rules everything else runs on",
     [("Account & Card Management", ["Account Form", "Card Entry with Live Preview", "Archive Confirm"], "account-card-management"),
      ("Category Management", ["Category Card", "Icon & Colour Picker", "Inline Subcategory Entry", "Archive Confirm"], "category-management"),
      ("Budget Management", ["Budget Cards", "Budget Form", "Claim-Aware Category Picker", "Delete Confirm"], "budget-management"),
      ("Goal Management", ["Goal Cards", "Goal Form", "Goal Progress Card", "Exchange-Rate Calculator", "Complete / Reopen / Delete Confirm"], "goal-management")],
     [], ["ValidationUtility", "AlertUtility", "ThemeUtility", "I18nUtility", "FormattingUtility"],
     "Holding Management left this Experience (holdings are created by transactions, maintained in Track Investments). The Exchange-Rate Calculator is client-side only (FR-9)."),
    ("Manage Finances", "manage-finances", "Record and review day-to-day money",
     [("Record Transaction", ["Kind Group & Kind Selection", "Transaction Entry", "Holding Selection", "Investment Buy Entry", "Goal Allocation Entry"], "record-transaction"),
      ("Browse Transactions", ["Filter Panel", "Ledger (lazy, grouped by month/day)", "Expanded Row", "Delete Confirm"], "browse-transactions"),
      ("Month Overview", ["Period Bar", "Currency Switch", "Balance Rail", "Budget Rail", "Goal Rail"], "month-overview")],
     [], ["ValidationUtility", "AlertUtility", "ThemeUtility", "I18nUtility", "FormattingUtility"],
     "Transaction Correction Flow removed — editing reuses Record Transaction's entry Interactions from an expanded ledger row, kind and target shown read-only (OQ-201). Month Overview stays here (Q4): same page, same period state. Transfers are two separate entries (OQ-201)."),
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
# The pages' styles live beside this script, never read back from an output page.
STYLE = (pathlib.Path(__file__).parent / "ebd_tier_style.css").read_text()

LEGEND = """  <div class="legend">
    <div class="legend-item"><span class="swatch" style="background:var(--experience); border-color:var(--experience-border);"></span> Experience</div>
    <div class="legend-item"><span class="swatch" style="background:var(--flow); border-color:var(--flow-border);"></span> Flow</div>
    <div class="legend-item"><span class="swatch" style="background:var(--interaction); border-color:var(--interaction-border);"></span> Interaction</div>
    <div class="legend-item"><span class="swatch" style="background:var(--utility); border-color:var(--utility-border);"></span> Utility</div>
  </div>
"""


def _head(title):
    """The document head, titled after its page."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>{title} — New Finance App</title>
<style>
{STYLE}</style>
</head>
<body>"""


def _tail(notes):
    """The legend, the page's notes and the document's end."""
    paragraphs = "".join(f"\n    <p>{note}</p>" for note in notes)
    return f"""{LEGEND}
  <div class="notes">{paragraphs}
  </div>
</body>
</html>
"""


def _and_list(items):
    """Joins names as prose: "A", "A and B", "A, B and C"."""
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} and {items[-1]}"


def _tier_notes(name, slug, standalone):
    """A tier page's notes: why its standalone Interactions have no Flow, and where its wiring is."""
    notes = []
    if standalone:
        one = len(standalone) == 1
        subject, verb, each = ("it's", "has", "it") if one else ("each is", "have", "each")
        notes.append(
            f"<strong>{_and_list(standalone)} {verb} no Flow column, deliberately:</strong> {subject} a "
            "single atomic action with no accumulated state — wrapping it in a Flow would be the "
            f"\"Flow Proliferation\" smell (a step mistaken for a Flow). The Experience hosts {each} directly, "
            "one Interaction, no intermediate tier.")
    notes.append(
        "<strong>No wiring shown, same discipline as the backend's layered diagram:</strong> this page "
        "answers \"what exists, in which tier\" — the sequence diagrams "
        f"(<code>docs/design/diagrams/ebd-sequences/{slug}-*.html</code>) are where {name}'s "
        "state-down/events-up wiring is traced in detail, one Flow at a time.")
    return notes


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
    (TIERS / f"{slug}.html").write_text(
        _head(f"EBD Tiers — {name}") + body + _tail(_tier_notes(name, slug, standalone)))


def shell_page():
    """App Shell: a layout, not an Experience — hosts chrome and routes events."""
    rows = [("Header", ["Logo", "Notification Bell → Review Insights' Notification Inbox"]),
            ("Nav drawer", ["Identity", "Household Switcher (the shell's own switch — OQ-156)", "Pending invitations → Manage Profile", "Create household → Onboard", "Main nav (one entry per Experience)", "Export audit log → Review Insights", "Profile / Sign out"]),
            ("Routing config", ["invitation.received → Manage Profile (Respond to Invitation)", "holding.matured → Track Investments (Archive Matured Holding)", "active household → every Experience (read-only context)"]),
            ("Household gate", ["No household → Onboard (/setup)", "No account in use, of any visibility → Onboard's Guided Setup (/setup/guided — FR-1.22, OQ-198), asked through the shared useAccountInUse (GET …/account-status)", "Otherwise → the page inside the chrome"])]
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
    (TIERS / "app-shell.html").write_text(_head("App Shell") + body + _tail([
        "<strong>No wiring shown:</strong> this page answers \"what the shell hosts\" — the sequence "
        "diagram (<code>docs/design/diagrams/ebd-sequences/app-shell-notification-routing.html</code>) "
        "traces how a chrome event is routed to the Experience that owns it."]))


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
    ("authenticate-sign-in", "Authenticate — Sign In", f"{R('POST /auth/login')} then {R('POST /auth/mfa/verify')} (or {R('POST /auth/mfa/recover')}); an unconfirmed enrollment resumes through {R('POST /auth/mfa/enrollment/confirm')}. Credentials, then MFA code or backup code (OQ-145, OQ-157).",
     [("CE", "Credential Entry"), ("MFA", "MFA Code Entry"), ("BC", "Backup Code Entry"), FLOW("Sign In"), ("ENR", "MFA Enrollment<br/>step (Onboard's)"), EXP("Authenticate"), ("SHELL", "App Shell"), API],
     """
User->>CE: email + password, submit
CE->>FLOW: emit credentialsEntered
FLOW->>EXP: request submitCredentials(email, password)
EXP->>API: POST /auth/login
alt 401 auth.invalid_credentials / 429
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code) — I18nUtility renders it
else step: enroll (MFA never confirmed, OQ-149)
    API-->>EXP: enrollment token, secret, otpauth URI, recovery codes (kept by the Experience)
    EXP-->>ENR: render in place of Sign In (Onboard's step, hosted here — OQ-157, OQ-158)
    ENR->>API: POST /auth/mfa/enrollment/confirm (the step's own call)
    alt 401 auth.mfa_invalid
        API-->>ENR: error code — its Flow clears the boxes, retried
    else 401 auth.enrollment_expired
        API-->>ENR: error code
        ENR->>EXP: toast (AlertUtility), emit expired → back to Sign In — the password step issues a fresh enrollment
    else ok
        API-->>ENR: tokens (held, not yet a session)
        ENR->>SHELL: backup codes saved → startSession(tokens)
    end
else step: mfa
    API-->>EXP: challengeToken (kept by the Experience)
    EXP-->>FLOW: outcome: ok
    FLOW-->>MFA: render (challenge step)
end
alt authenticator code
    User->>MFA: 6 digits (submits on the last one)
    MFA->>FLOW: emit codeEntered
    FLOW->>EXP: request submitCode(code)
    EXP->>API: POST /auth/mfa/verify
else lost phone
    User->>MFA: 'Use a backup code'
    MFA->>FLOW: emit switchToBackupCode
    FLOW-->>BC: render
    User->>BC: backup code
    BC->>FLOW: emit backupCodeEntered
    FLOW->>EXP: request submitBackupCode(code)
    EXP->>API: POST /auth/mfa/recover
end
alt 401 auth.mfa_invalid
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code) — code cleared, retried alone
else 401 auth.challenge_expired / 429
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code) — back to credentials, email kept
else ok
    API-->>EXP: tokens
    EXP->>SHELL: startSession(tokens) — the signed-out guard takes the user on
    EXP-->>FLOW: outcome: ok
end
""", ["Same error code for unknown user and wrong password (no enumeration); a wrong code is named, since the password is already proven (OQ-145).", "The challenge and enrollment tokens never reach a Flow: the Experience holds them between the calls.", "A resumed enrollment starts the session only once the backup codes are saved, so the guard doesn't leave them unseen (OQ-157); no household → the shell's gate sends the user to Onboard.", "Sign Out (the shell drawer's button, Authenticate's handler): POST /auth/logout, then the session ends here — even when the logout fails (OQ-157).", "No 'Remember me' (OQ-62)."]),
    ("authenticate-account-recovery", "Authenticate — Account Recovery", f"{R('POST /auth/password-reset/request')} then {R('POST /auth/password-reset/confirm')}. Ask for a link; from the link, a new password (OQ-147).",
     [("RR", "Recovery Request"), ("NP", "New Password Entry"), ("RC", "Reset Complete"), FLOW("Account Recovery"), EXP("Authenticate"), API],
     """
User->>RR: email, submit
RR->>FLOW: emit submit(email)
FLOW->>EXP: request requestReset(email)
EXP->>API: POST /auth/password-reset/request
API-->>EXP: 202 (same answer whether or not the email exists)
EXP-->>FLOW: outcome: ok
FLOW-->>RR: state: linkRequested — "check your inbox" note, form kept to ask again
Note over User,RR: user opens the emailed link (sent by NotificationEngine via EmailAccessor, OQ-113)
EXP->>FLOW: mount with token (read from /reset-password?token=…)
User->>NP: new password + confirm (strength meter, advisory)
NP->>FLOW: emit submit(password) — ≥ 12 characters and confirmation matches
FLOW->>EXP: request confirmReset(token, password)
EXP->>API: POST /auth/password-reset/confirm
alt 400 password_reset.token_invalid
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code)
    FLOW-->>RR: back to asking for a link, reason in the banner
else 422 password.too_short (or another failure)
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code)
    FLOW-->>NP: too_short under the field, anything else in the banner — typing kept
else ok
    API-->>EXP: reset, all sessions revoked
    EXP-->>FLOW: outcome: ok
    FLOW-->>RC: done step
    User->>RC: Sign in
    RC->>FLOW: emit signIn
    FLOW->>EXP: emit backToSignIn → Sign In
end
""", ["Password ≥ 12 characters (NFR-SEC-4); the confirmation must match (`password.mismatch`, a client-only field code, OQ-147).", "The token lives in the Flow's state from mount until the reset is sent; the Experience reads it from the URL.", "Every session ends, so Reset Complete leads to Sign In rather than signing in."]),
    ("onboard-registration", "Onboard — Registration", f"{R('POST /auth/register')} on /register, signed out. One form, one request (OQ-148, OQ-158).",
     [("RF", "Registration Form Entry"), FLOW("Registration"), EXP("Onboard"), API],
     """
User->>RF: first + last name, email, password + confirm (strength meter, advisory)
RF->>FLOW: emit submit(registration) — names not blank, valid email, ≥ 12 characters, confirmation matches
FLOW->>EXP: request register(registration)
EXP->>API: POST /auth/register (+ language: the locale shown, OQ-161)
alt 409 user.email_taken / 422 password.too_short (or another failure)
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code)
    FLOW-->>RF: email_taken under the email, too_short under the password, anything else in the banner — typing kept
else 201 created
    API-->>EXP: userId + enrollment token, TOTP secret, otpauth URI, recovery codes (kept by the Experience)
    EXP-->>FLOW: outcome: ok (Flow stays busy)
    EXP->>EXP: advance to MFA Enrollment
end
User->>RF: Sign in instead
RF->>FLOW: emit signIn
FLOW->>EXP: emit signIn → Sign In (keeping where to go back to)
""", ["First/last name split (OQ-29); names and email are trimmed before sending.", "No terms box: mockup 02's \"I agree to the Terms\" is dropped for v1 (OQ-148).", "The TOTP secret and recovery codes never pass through this Flow; the Experience hands them to MFA Enrollment.", "The strength meter rates the password against the name and email typed."]),
    ("onboard-mfa-enrollment", "Onboard — MFA Enrollment", "Mandatory, no skip (FR-1.15). Onboard's MFA enrollment step — also hosted by Authenticate (OQ-157, OQ-158).",
     [("MS", "MFA Method Selection"), ("SV", "MFA Setup Verification"), ("BA", "Backup Codes Acknowledgement"), FLOW("MFA Enrollment"), EXP("Onboard"), ("SHELL", "App Shell"), API],
     """
EXP-->>FLOW: state: enrollment (otpauth URI, secret, recovery codes, account email)
User->>MS: Authenticator app, continue
MS->>FLOW: emit choose(method)
FLOW-->>SV: render QR (otpauth URI) + setup key (copy) + account
User->>SV: 6-digit code (sends itself on the last digit)
SV->>FLOW: emit submit(code)
FLOW->>EXP: request confirm(code)
EXP->>API: POST /auth/mfa/enrollment/confirm {enrollmentToken, mfaCode}
alt 401 auth.mfa_invalid / 429 / another failure
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code)
    FLOW-->>SV: remount (code cleared), reason in the banner
else 401 auth.enrollment_expired
    API-->>EXP: error code
    EXP->>EXP: toast (AlertUtility) → Sign In, whose password step issues a fresh enrollment
else 200 tokens
    API-->>EXP: access + refresh tokens (held, not yet a session)
    EXP-->>FLOW: outcome: ok
    FLOW-->>BA: render every recovery code (download / copy all)
    User->>BA: tick 'I've saved these', Continue
    BA->>FLOW: emit acknowledge
    FLOW->>EXP: emit complete
    EXP->>SHELL: startSession(tokens) — guard → Dashboard, no household → gate → /setup
end
User->>SV: back
SV->>FLOW: emit back → method step (choice kept)
""", ["Method list is configuration (`mfa.methods`; only the authenticator app in v1).",
        "The enrollment comes from POST /auth/register — or from POST /auth/login when the enrollment was never confirmed (`step: enroll`); the Experience mounts the Flow with it (OQ-149).",
        "The session starts only once the codes are saved, so the signed-out guard doesn't take the user away from them (OQ-157, OQ-158).",
        "The QR stays black on white in both themes; the codes are shown this once (FR-1.15)."]),
    ("onboard-household-setup", "Onboard — Household Setup", f"{R('POST /households')} on /setup (no household yet) or /households/new (another one, from the switcher) — OQ-158.",
     [("HN", "Household Name Entry"), FLOW("Household Setup"), EXP("Onboard"), ("SHELL", "App Shell"), API],
     """
User->>HN: household name, Continue
HN->>HN: blank → 'Required.' under the field (nothing sent)
HN->>FLOW: emit submit(name, trimmed)
FLOW->>EXP: request create(name)
EXP->>API: POST /households {name}
alt 422 / another failure
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code)
    FLOW-->>HN: reason in the banner (name kept)
else 201 MyHousehold
    API-->>EXP: household + role Owner (default categories seeded via household.created)
    EXP-->>FLOW: outcome: ok (Flow stays busy)
    EXP->>SHELL: switchHousehold(id) — active, remembered, API cache reset
    EXP->>SHELL: open Guided Setup — /setup/guided, replacing this entry (X2G, OQ-198)
end
opt /households/new (onCancel given)
    User->>HN: Cancel
    HN->>FLOW: emit cancel
    FLOW->>EXP: emit cancel → Dashboard
end
""", ["Default categories arrive with preset icons and colours (OQ-85).",
        "No \"Ideas\" chips: mockup 10's suggestions are dropped; the field starts empty (OQ-150).",
        "/setup gives no way out — a new user must create a household; Cancel appears only on /households/new."]),
    ("onboard-guided-setup", "Onboard — Guided Setup", f"{R('GET /households/:householdId/accounts')}, {R('POST /households/:householdId/accounts')}, {R('POST / PATCH /households/:householdId/budgets')}, the gate's {R('GET /households/:householdId/account-status')}. /setup/guided — mockups 11–14 (OQ-196, OQ-198); the account step is mandatory.",
     [("FAE", "First Account<br/>Entry"), ("CF", "Category<br/>Management Flow"), ("BE", "Budget<br/>Entry"), ("WN", "Wizard<br/>Navigation"), ("SC", "Setup Complete<br/>Summary"), FLOW("Guided Setup"), EXP("Onboard"), ("SHELL", "App Shell"), API],
     """
alt opened by Household Setup
    SHELL->>EXP: /setup/guided — the new household active
else resumed (a drop-off before the first account)
    SHELL->>API: household gate: GET /households/:householdId/account-status — beside GET /households
    API-->>SHELL: inUse false (no Account of any visibility, or all archived)
    SHELL->>EXP: /setup/guided instead of the chrome, carrying {from} (FR-1.22, OQ-198)
end
EXP->>EXP: wait for the user and the active household — a skeleton, a retry on failure
FLOW->>EXP: request loadAccounts() (on mount)
EXP->>API: GET /households/:householdId/accounts
API-->>EXP: accounts
EXP-->>FLOW: outcome
opt the load failed
    FLOW->>EXP: request loadAccounts() again (Try again) — no form until a load succeeds
end
FLOW-->>FAE: step 1 — the accounts in use, then the form inline (no Skip — FR-1.22)
FAE->>FLOW: emit submit {account, cards}
FLOW->>EXP: request createAccount(account)
EXP->>API: POST /households/:householdId/accounts
alt failure
    API-->>EXP: error
    EXP-->>FLOW: outcome {ok: false}
    FLOW-->>FAE: alert in its banner, typing kept
else created
    API-->>EXP: 201 account
    EXP-->>FLOW: outcome {ok, account} → step 2
end
EXP-->>CF: render the seeded categories, handed into step 2's slot
CF->>EXP: emit category writes (POST / PATCH …/categories) — straight to Onboard, not via this Flow
User->>WN: Looks good, continue
FLOW-->>BE: step 3 — the budgets made so far, then the form (optional)
loop each budget created, or loaded back from its Edit
    BE->>FLOW: emit create / edit
    FLOW->>EXP: request createBudget / editBudget
    EXP->>API: POST / PATCH /households/:householdId/budgets[/:budgetId]
    API-->>EXP: saved, or 409 budget.target_already_claimed
    EXP-->>FLOW: outcome, once the budgets are fetched again
end
User->>WN: Finish setup
opt a budget typed and not saved
    FLOW-->>BE: discard confirm (Discard and finish / Keep editing)
end
FLOW-->>SC: render the counts + next steps
SC->>FLOW: emit destination
FLOW->>EXP: finish(destination)
EXP->>SHELL: navigate, replacing the wizard — Transactions, Manage Household, Account Setup ?tab=goals, or the Dashboard (the page held back in {from}, if any)
SHELL->>API: household gate: GET /households/:householdId/account-status (asked again: the create invalidated it)
API-->>SHELL: inUse true → the page inside the chrome
""", ["Steps 1 and 3 are this Flow's own inline forms, as mockups 11 and 13 draw them; the drawers are kept for Account Setup's busier page (OQ-196).", "Both forms carry a Personal / Shared field — Shared to start, Personal for a Viewer — which the mockups leave out (OQ-196).", "The Flow never calls the backend: Onboard hosts it and answers each request through the shared setup requests (experiences/setupRequests.ts — X2G, OQ-198).", "Main nav stays hidden until the household has an account in use, of any visibility: the household gate opens Guided Setup for one that hasn't, so a drop-off resumes here (FR-1.22, OQ-198)."]),
    ("manage-profile-security", "Manage Profile — Security", f"{R('GET /users/me/sessions')}, {R('DELETE /users/me/sessions[/:sessionId]')}, {R('POST /auth/change-password')}. Both panels at once (mockup 70, OQ-154).",
     [("PC", "Password Change"), ("SL", "Session List"), ("SO", "Sign Out All Others"), FLOW("Security"), EXP("Manage Profile"), API],
     """
FLOW->>EXP: request loadSessions() (on mount)
EXP->>API: GET /users/me/sessions
alt failure
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code)
    FLOW-->>SL: render banner + 'Try again' (retry = request loadSessions() again)
else ok
    API-->>EXP: sessions
    EXP-->>FLOW: outcome: ok(sessions)
    FLOW-->>SL: render this device first (tagged), then most recently used — device named from its User-Agent
end
alt revoke one (no confirm)
    User->>SL: Revoke
    SL->>FLOW: emit revoke {sessionId}
    FLOW->>EXP: request revokeSession(id)
    EXP->>API: DELETE /users/me/sessions/:sessionId
else sign out all others (only when others are listed)
    User->>SO: Sign out all others
    SO->>FLOW: emit open
    FLOW-->>SO: render the inline confirm under the header
    User->>SO: Confirm (or Cancel / Escape: closed, focus back on the button)
    SO->>FLOW: emit confirm
    FLOW->>EXP: request revokeOthers()
    EXP->>API: DELETE /users/me/sessions
else change password
    User->>PC: current + new (≥ 12) + confirm
    PC->>FLOW: emit change {currentPassword, newPassword}
    FLOW->>EXP: request changePassword(change)
    EXP->>API: POST /auth/change-password
end
alt failure (network, 404, 422)
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code) — under its field (current_incorrect, too_short) or in the panel's banner
else ok
    API-->>EXP: 200 / 204
    EXP-->>FLOW: outcome: ok — ended sessions dropped from the list, form emptied, success toast
end
""", ["Moved from Authenticate (Q1).",
        "No re-fetch after an action: the Flow drops what the API ended (one session, or every one but this device) — OQ-154.",
        "Only 'sign out all others' asks first (kit InlineConfirm, K26); successes are AlertUtility toasts (FU3)."]),
    ("manage-profile-delete-account", "Manage Profile — Delete Account", f"{R('DELETE /users/me')} — unconditional. Consequences (with the households owned), then the user's email typed to confirm (OQ-151).",
     [("CR", "Consequences Review"), ("TC", "Type-to-Confirm"), FLOW("Delete Account"), EXP("Manage Profile"), API],
     """
EXP-->>FLOW: mount with email + names of the households owned (from GET /households, role Owner)
FLOW-->>CR: render danger zone (personal data deleted, shared data anonymized)
opt owns households
    FLOW-->>CR: ownership note: each passes to another member first, or is deleted if no one else is in it (FR-1.18) + their names
end
User->>CR: 'Delete Account'
CR->>FLOW: emit continue
FLOW-->>TC: render in the button's place (phrase = email)
alt cancel (button or Escape)
    User->>TC: Cancel
    TC->>FLOW: emit cancel
    FLOW-->>CR: render again, text dropped, focus back on its button
else confirm
    User->>TC: type the email (confirm locked until it matches)
    TC->>FLOW: emit confirm
    FLOW->>EXP: request deleteAccount()
    EXP->>API: DELETE /users/me
    alt failure (network, 401)
        API-->>EXP: error code
        EXP-->>FLOW: outcome: failed(code) — banner under the confirm, email kept
    else ok
        API-->>EXP: 204
        EXP-->>FLOW: outcome: ok — Flow stays busy, App Shell signs out
    end
end
""", ["Moved from Manage Household (Q1).",
        "Ownership Check folded into Consequences Review as a note (mockup 70): nothing blocks the deletion — FR-1.18's succession runs server-side (OQ-151).",
        "The danger zone is the kit's DangerZone (K34 family), shared with Household Deletion; the type-to-confirm is K27 (OQ-143)."]),
    ("manage-profile-personal-info-preferences", "Manage Profile — Personal Info & Preferences", f"{R('GET /users/me')}, {R('PATCH /users/me')}. Standalone Edit Personal Info and Edit Preferences, mockup 70 (OQ-159).",
     [("PI", "Edit Personal Info"), ("EP", "Edit Preferences"), EXP("Manage Profile"), ("SHELL", "App Shell"), API],
     """
EXP->>API: GET /users/me (cached — the shell's drawer reads the same cache)
API-->>EXP: user + preferences
EXP-->>PI: render saved names + locked email (Save off until a name changes)
EXP-->>EP: render theme tiles + language switch
alt edit names
    User->>PI: type, Save
    PI->>EXP: emit save {firstName, lastName} (trimmed, neither blank)
    EXP->>API: PATCH /users/me {firstName, lastName}
    alt failure (network, 422)
        API-->>EXP: error code
        EXP-->>PI: banner, typing kept
    else ok
        API-->>EXP: user
        EXP-->>PI: cache replaced → panel starts again from the saved names, toast 'Profile saved.'
    end
else pick a theme or language (no Save)
    User->>EP: pick
    EP->>EXP: emit theme / language
    EXP-->>SHELL: cached user changed at once → ThemeUtility / I18nUtility apply it
    EXP->>API: PATCH /users/me {preferences: {theme} or {language}}
    alt failure
        API-->>EXP: error code
        EXP-->>SHELL: change undone → previous theme / language back, error toast
    else ok
        API-->>EXP: user (replaces the cache)
    end
end
""", ["The shell applies saved preferences through the page's one theme and locale controller (useSavedPreferences, OQ-156); Manage Profile never calls ThemeUtility itself.",
        "Names wait for the answer, so a refused save keeps what is typed (OQ-159)."]),
    ("manage-profile-respond-to-invitation", "Manage Profile — Respond to Invitation", f"{R('GET /users/me/invitations')}, {R('POST /invitations/:invitationId/accept|decline')}. From the profile's panel or the bell (OQ-159).",
     [("RI", "Respond to Invitation"), EXP("Manage Profile"), ("SHELL", "App Shell"), API],
     """
EXP->>API: GET /users/me/invitations (cached — the shell's switcher counts it)
API-->>EXP: pending invitations (household, inviter or 'Someone', role)
opt one or more pending
    EXP-->>RI: render the panel
end
alt from the profile
    User->>RI: Accept / Decline
    RI->>EXP: emit answer {invitationId, accept|decline}
    EXP-->>RI: that button spins, every other answer waits
else from the bell
    SHELL->>EXP: route invitation.received {invitationId, accept|decline}
end
EXP->>API: POST /invitations/:invitationId/accept (or /decline)
alt failure (404 invitation.not_found, 409 invitation.not_pending, network)
    API-->>EXP: error code
    EXP-->>SHELL: outcome failed — error toast, the bell keeps the notification
else ok
    API-->>EXP: 200
    EXP-->>SHELL: outcome done — toast 'You joined …' / '… declined', the bell dismisses it
end
EXP->>API: GET /users/me/invitations again (+ GET /households after an accept: the new one shows in the switcher)
""", ["One thunk serves both entry points, so the request and its toast live in one place.",
        "Accepting never switches households; the user switches when they want to (OQ-159)."]),
    ("manage-household-membership-management", "Manage Household — Membership Management", f"{R('GET /households/:id/members')}, {R('GET/POST/DELETE /households/:id/invitations…')}, {R('PATCH /households/:id/members/:userId/role')}, {R('DELETE /households/:id/members/:userId')}, {R('POST /households/:id/transfer-ownership')}. Mockup 60 (OQ-155).",
     [("ML", "Member List"), ("RM", "Role Menu"), ("RC", "Remove Member Confirm"), ("TO", "Transfer Ownership"), ("IM", "Invite Member"), ("PI", "Pending Invitations"), FLOW("Membership Management"), EXP("Manage Household"), API],
     """
FLOW->>EXP: request load() (on mount)
EXP->>API: GET /households/:id/members + GET /households/:id/invitations, together (403 for a Member/Viewer → no invitations)
alt failure
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code)
    FLOW-->>ML: render banner + 'Try again' (retry = request load() again)
else ok
    API-->>EXP: members, invitations
    EXP-->>FLOW: outcome: ok(members, invitations)
    FLOW-->>ML: render Owner first, then by role — the user's row tagged You
    FLOW-->>PI: render pending only, newest first (Owner/Admin only, with Invite Member)
end
alt change a role (no confirm — never the Owner's, never their own)
    User->>RM: pick Admin / Member / Viewer
    RM->>FLOW: emit change {userId, role} (same role: ignored)
    FLOW->>EXP: request changeRole(userId, role)
    EXP->>API: PATCH /households/:id/members/:userId/role
else remove a member
    User->>ML: Remove
    ML->>FLOW: emit remove {userId}
    FLOW-->>RC: render the inline confirm in that member's row (OQ-160)
    User->>RC: Remove (or Cancel / Escape: the row again, focus on its Remove)
    RC->>FLOW: emit confirm
    FLOW->>EXP: request removeMember(userId)
    EXP->>API: DELETE /households/:id/members/:userId
else transfer ownership (the Owner, to any member — FR-1.20)
    User->>TO: swap button on their row, pick a member
    TO->>FLOW: emit pick {userId}
    FLOW-->>TO: render the inline confirm in the picked member's row ("you become an Admin")
    User->>TO: Transfer ownership (or Cancel)
    TO->>FLOW: emit confirm
    FLOW->>EXP: request transferOwnership(userId)
    EXP->>API: POST /households/:id/transfer-ownership
else invite
    User->>IM: email (checked client-side) + role (Member by default), Send
    IM->>FLOW: emit submit {email, role}
    FLOW->>EXP: request invite({email, role})
    EXP->>API: POST /households/:id/invitations
    Note over API: creates an in-app notification for the invitee (type invitation.received)
else revoke an invitation (no confirm)
    User->>PI: Revoke
    PI->>FLOW: emit revoke {invitationId}
    FLOW->>EXP: request revokeInvitation(id)
    EXP->>API: DELETE /households/:id/invitations/:invitationId
end
alt 409 household.changed
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code) — banner in the panel, then request load() again
else other failure
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code) — invitee codes under the email, the rest in the panel's banner
else ok
    API-->>EXP: 200 / 201 / 204
    EXP-->>FLOW: outcome: ok — lists changed as the API did (no refetch), confirm closed, success toast
    Note over EXP: a role change, remove or transfer refetches the Experience's cached members (header count, Leave's successor) — a transfer also GET /households (the role changed)
end
""", ["Only an Owner/Admin sees the role menus, Remove, Invite Member and Pending Invitations; a Member or Viewer sees the members.",
        "Transfer goes to any member, not only an Admin (FR-1.20, OQ-155); the old Owner becomes an Admin and the list re-sorts.",
        "Revoking an invitation asks nothing — it can be sent again; removing a member asks first (OQ-155).",
        "Every control waits while one request is out."]),
    ("manage-household-household-deletion", "Manage Household — Household Deletion", f"{R('DELETE /households/:householdId')} (Owner only). Consequences, then the household's name typed to confirm (OQ-146).",
     [("CR", "Consequences Review"), ("TC", "Type-to-Confirm"), FLOW("Household Deletion"), EXP("Manage Household"), ("SHELL", "App Shell"), API],
     """
EXP-->>FLOW: mount for the Owner only, with householdName
FLOW-->>CR: render danger zone (every member loses access, shared data removed)
User->>CR: 'Delete Household'
CR->>FLOW: emit continue
FLOW-->>TC: render in the button's place (phrase = householdName)
alt cancel (button or Escape)
    User->>TC: Cancel
    TC->>FLOW: emit cancel
    FLOW-->>CR: render again, text dropped, focus back on its button
else confirm
    User->>TC: type the household name (confirm locked until it matches)
    TC->>FLOW: emit confirm
    FLOW->>EXP: request deleteHousehold()
    EXP->>API: DELETE /households/:householdId
    alt 403 auth.forbidden / 404 household.not_found
        API-->>EXP: error code
        EXP-->>FLOW: outcome: failed(code) — banner under the confirm, name kept
    else ok
        API-->>EXP: 204
        EXP-->>FLOW: outcome: ok — Flow stays busy
        Note over EXP: toast "{household} was deleted."
        EXP->>API: GET /households (fetched again)
        alt another household left
            EXP->>SHELL: switchHousehold(next) — API cache reset → Dashboard
        else none left
            EXP->>SHELL: navigate → Onboard (/setup)
        end
    end
end
""", ["The type-to-confirm is the kit's K27 (OQ-143); matching the name is UI-only — the DELETE takes no phrase."]),
    ("manage-household-leave-household", "Manage Household — Leave Household", f"{R('DELETE /households/:id/members/:userId')} with the caller's own id (FR-1.11, FR-1.18). Its own card above the danger zone (OQ-160).",
     [("LH", "Leave Household"), EXP("Manage Household"), ("SHELL", "App Shell"), API],
     """
EXP->>API: GET /households/:id/members (cached — shared with the header's count)
API-->>EXP: members
EXP-->>LH: mount with householdName + consequence (member: loses access / Owner: successor by FR-1.18 / Owner alone: household deleted)
User->>LH: 'Leave household'
LH-->>LH: render the inline confirm in the button's place
alt cancel (button or Escape)
    User->>LH: Cancel
    LH-->>LH: the button again, focused
else confirm
    User->>LH: Leave
    LH->>EXP: emit leave
    EXP-->>LH: busy
    EXP->>API: DELETE /households/:id/members/:selfUserId
    alt 409 household.changed / other failure
        API-->>EXP: error code
        EXP-->>LH: alert(code) — banner in the card, not busy
    else ok
        API-->>EXP: 204 (an Owner's succession, or the household's deletion when alone, ran server-side)
        Note over EXP: toast "You left {household}."
        EXP->>API: GET /households (fetched again)
        alt another household left
            EXP->>SHELL: switchHousehold(next) — API cache reset → Dashboard
        else none left
            EXP->>SHELL: navigate → Onboard (/setup)
        end
    end
end
""", ["A standalone Interaction, no Flow (EBD): the confirm's open state is the Interaction's own; the request and its failure are the Experience's.",
        "The successor shown is a preview in FR-1.18's order (the longest-tenured Admin, else Member, else Viewer); the API decides.",
        "The leave doesn't refetch the members: the household is no longer the user's."]),
    ("account-setup-account-card-management", "Account Setup — Account & Card Management", f"{R('GET/POST/PATCH /households/:householdId/accounts')}, {R('POST /households/:householdId/accounts/:id/archive')}. Built in FL11 (OQ-192).",
     [("AF", "Account Form"), ("CE", "Card Entry with<br/>Live Preview"), ("AC", "Archive Confirm"), FLOW("Account & Card Management"), EXP("Account Setup"), API],
     """
FLOW->>EXP: request load (as it mounts)
EXP->>API: GET /households/:householdId/accounts
API-->>EXP: accounts with currentBalance and cards (outstandingBalance), archived included
EXP-->>FLOW: outcome: data — live grid + archived section (or failed → retry)
alt add (every member — a Viewer's account is personal, visibility locked)
    User->>AF: name, type (checking / savings / credit card only / investment), currency, today's balance, visibility
else edit (personal: its owner, shared: Owner/Admin or its Member creator)
    User->>AF: name, visibility (its creator only), type + currency shown locked
    opt an attached card
        User->>CE: billing days / expiry (network + last four fixed), or Remove
    end
end
opt add a card (checking, savings or credit card only — FR-2.7)
    User->>CE: number (network detected, preview drawn), closing day, due day, expiry
    CE->>FLOW: emit card {network, last4, days, expiry}
end
AF->>FLOW: emit account (cards left out when the type takes none)
FLOW->>EXP: request create / edit
EXP->>API: POST /households/:householdId/accounts {…, cards} (or PATCH …/accounts/:accountId {…, cards: {add, edit, remove}})
alt 422 / 403 / 409 account.archived
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code) — banner in the drawer, what was typed kept
else ok
    API-->>EXP: the Account as written
    EXP-->>FLOW: outcome: data — the Flow appends / replaces it in its list
    Note over FLOW: toast "{name} created/updated."
end
opt archive (from the edit drawer's danger zone)
    User->>AC: confirm (one-way)
    AC->>FLOW: emit archive
    FLOW->>EXP: request archive
    EXP->>API: POST /households/:householdId/accounts/:accountId/archive
    alt failure
        API-->>EXP: error code
        EXP-->>FLOW: outcome: failed(code) — banner in the drawer, confirm stays open
    else ok
        API-->>EXP: 204
        EXP-->>FLOW: outcome: ok — the Flow stamps archivedAt, it moves to the archived section
        Note over FLOW: toast "{name} archived."
    end
end
opt the tab is hidden — Back or a link, the Flow stays mounted (OQ-197)
    EXP-->>FLOW: active: false
    FLOW-->>AF: the open drawer closes — kept, unseen, while its request is out
end
""", ["Only last4 + network leave the browser — the full number never does (NFR-SEC-7); an attached card's network and last four are fixed (OQ-192).", "One save writes the Account and every card change together, or nothing (OQ-175). The Flow patches its own list from the answer instead of reloading; one request at a time, and the drawer stays open while it is out (OQ-192).", "Guided Setup's step 1 is its own inline form (First Account Entry), built from the same card fields (OQ-196)."]),
    ("account-setup-category-management", "Account Setup — Category Management", f"{R('GET/POST/PATCH /households/:householdId/categories')}, the category and subcategory archive endpoints. Built in FL12 (OQ-193).",
     [("CC", "Category Card"), ("IP", "Icon & Colour Picker"), ("SE", "Inline Subcategory Entry"), ("AC", "Archive Confirm"), FLOW("Category Management"), EXP("Account Setup"), API],
     """
EXP->>API: GET /households/:householdId/categories?includeArchived=true (as the page mounts)
API-->>EXP: categories with their subcategories
EXP-->>FLOW: categories (loading / failed → retry / loaded) — shared with Budget Management
FLOW-->>CC: live cards + archived section
alt new category (Owner, Admin or Member)
    User->>IP: name, icon, colour (18 palette tokens)
    IP->>FLOW: emit categoryDrafted
    FLOW->>EXP: request createCategory
    EXP->>API: POST /households/:householdId/categories
else edit in place (Owner / Admin)
    User->>IP: the card turned into its form — name, icon, colour
    IP->>FLOW: emit categoryEdited
    FLOW->>EXP: request editCategory
    EXP->>API: PATCH /households/:householdId/categories/:categoryId {name, icon, color}
else add a subcategory (Owner / Admin)
    User->>SE: name, ✓
    SE->>FLOW: emit subcategoryAdded
    FLOW->>EXP: request addSubcategory
    EXP->>API: PATCH /households/:householdId/categories/:categoryId {subcategories: [{name}]}
else archive a subcategory (Owner / Admin)
    User->>CC: the chip's archive
    CC->>FLOW: emit archiveSubcategory
    FLOW->>EXP: request archiveSubcategory
    EXP->>API: POST …/categories/:categoryId/subcategories/:subcategoryId/archive
else archive a category (Owner / Admin)
    User->>AC: confirm (names the live subcategories it cascades to)
    AC->>FLOW: emit archive
    FLOW->>EXP: request archiveCategory
    EXP->>API: POST /households/:householdId/categories/:categoryId/archive
end
alt failure
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed(code) — a form's in its banner, typing kept, a card action's toasted
else ok
    API-->>EXP: done
    EXP->>API: GET …/categories?includeArchived=true (fetched again)
    alt list fetched
        API-->>EXP: categories
        EXP-->>FLOW: outcome: ok, categories refreshed — form / confirm closes
    else list fetch failed
        API-->>EXP: error code
        EXP-->>FLOW: outcome: ok, categories + refreshError — banner "may be out of date" → retry
    end
    Note over FLOW: toast "{name} created / updated / added / archived."
end
opt an open edit form's category shows archived in a list fetched again (someone else archived it)
    FLOW-->>IP: form closes
    Note over FLOW: toast "{name} was archived by someone else…" (OQ-194)
end
FLOW-->>CC: re-render (colour via ThemeUtility)
""", ["Colour stored as a token, resolved per theme (OQ-85).", "The Experience answers after the list is fetched again, so the Flow never patches it (OQ-193).", "A subcategory's add is the category's own atomic PATCH — unlisted ones untouched (OQ-173)."]),
    ("account-setup-budget-management", "Account Setup — Budget Management", f"{R('GET/POST/PATCH/DELETE /households/:householdId/budgets')}, with the categories the Experience already holds. Built in FL13 (OQ-194).",
     [("BL", "Budget Cards"), ("BF", "Budget Form"), ("CP", "Claim-Aware<br/>Category Picker"), ("DC", "Delete Confirm"), FLOW("Budget Management"), EXP("Account Setup"), API],
     """
EXP->>API: GET /households/:householdId/budgets (as the page mounts)
API-->>EXP: every shared Budget + the caller's personal ones, with targets (unpaginated, OQ-176)
EXP-->>FLOW: budgets + categories (loading / failed → retry / loaded) — both the Experience's
FLOW-->>BL: cards — name, visibility, currency, target / month, covers (no spend)
opt edit or delete (owner / Owner, Admin, creator)
    User->>BL: click the card (anywhere — its name is its one button)
    BL->>FLOW: emit edit(budgetId) — the edit drawer opens
end
alt add (every member, a Viewer's is personal) or edit
    User->>BF: name (≤ 40), currency + visibility (locked on edit), monthly target
    FLOW-->>CP: groups weighed in the form's scope — claimed rows disabled, naming their budget
    User->>CP: tick whole categories / open a group, tick subcategories
    CP->>BF: emit toggle
    BF->>FLOW: emit budgetSubmitted (ticks taken meanwhile dropped)
    FLOW->>EXP: request createBudget / editBudget
    EXP->>API: POST /households/:householdId/budgets (or PATCH …/:budgetId {name, targetAmount, targets})
else delete (from the edit drawer)
    User->>DC: the drawer's danger zone → its inline confirm
    DC->>FLOW: emit deleteConfirmed
    FLOW->>EXP: request deleteBudget
    EXP->>API: DELETE /households/:householdId/budgets/:budgetId
end
alt 409 budget.target_already_claimed
    API-->>EXP: error code (+ params {categoryId | subcategoryId, budgetId})
    EXP->>API: GET …/budgets (fetched again)
    EXP-->>FLOW: outcome: failed — banner names the target and its budget, picker shows it taken
else 404 budget.not_found (deleted meanwhile)
    API-->>EXP: error code
    EXP->>API: GET …/budgets (fetched again — the budget is gone)
    EXP-->>FLOW: outcome: failed — an edit's drawer closes, a delete's confirm stays
    Note over FLOW: toast "{name} was deleted by someone else…" (edit) / the error (delete)
else 422 validation.failed (a category archived meanwhile)
    API-->>EXP: error code
    EXP->>API: GET …/budgets + GET …/categories?includeArchived=true
    EXP-->>FLOW: outcome: failed — banner, picker drops what is gone
else other failure
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed — a form's in its banner, typing kept, a delete's toasted
else ok
    API-->>EXP: budget (or 204 — its claims are free again)
    EXP->>API: GET …/budgets (fetched again)
    EXP-->>FLOW: outcome: ok, budgets refreshed — the drawer closes
    Note over FLOW: toast "{name} created / updated / deleted."
end
opt the tab is hidden — Back or a link, the Flow stays mounted (OQ-197)
    EXP-->>FLOW: active: false
    FLOW-->>BF: the open drawer closes — kept, unseen, while its request is out
end
""", ["Setup page shows no spend progress (stakeholder) — the list carries definitions only (OQ-176).", "Claims are shared state other members change, so the budgets are the Experience's and fetched again after each write, and after a failure that says they moved (OQ-194).", "Currency and visibility can't change after creation: the edit form shows them locked."]),
    ("account-setup-goal-management", "Account Setup — Goal Management", f"{R('GET/POST/PATCH/DELETE /households/:householdId/goals')}, {R('POST /households/:householdId/goals/:goalId/complete|reopen')} (definitions, AccountManager) + {R('GET /households/:householdId/goal-progress')} (progress, InsightsManager — OQ-177). Built in FL14 (OQ-195).",
     [("GL", "Goal Cards"), ("GF", "Goal Form"), ("GP", "Goal Progress Card"), ("FX", "Exchange-Rate<br/>Calculator"), ("CR", "Complete / Reopen /<br/>Delete Confirm"), FLOW("Goal Management"), EXP("Account Setup"), API],
     """
par definitions, both statuses (as the Goals tab opens)
    EXP->>API: GET /households/:householdId/goals?status=active (and ?status=completed)
    API-->>EXP: goals (name, target + currency, due date, visibility, completedAt)
and progress, both statuses
    EXP->>API: GET /households/:householdId/goal-progress?status=active (and completed)
    API-->>EXP: funded by, each with its contribution in its own currency, per goal
end
alt a status's progress never loaded (404 until M4 builds it)
    EXP-->>FLOW: goals by status, no funding there, progress: failed for that status
    FLOW-->>GL: that status's definition cards under a "progress couldn't load" banner + retry
else both loaded
    EXP-->>FLOW: goals by status, funding joined by goal id
    FLOW-->>GP: target, due countdown, progress pill, funded by
end
User->>GL: Active / Completed (counts on each)
GL->>FLOW: emit status (local — nothing fetched)
opt goal funded in another currency
    User->>FX: '1 USD = 5.20 BRL' (the field sits above the card's hit area)
    FX->>FLOW: emit rateEntered (kept in Flow state only, by pair)
    FLOW-->>GP: ≈ estimate re-rendered (nothing sent)
end
opt edit or a step (owner / Owner, Admin, creator)
    User->>GP: click the card (anywhere — its name is its one button)
    GP->>FLOW: emit edit(goalId) — the edit drawer opens
end
alt add (every member, a Viewer's is personal) or edit
    User->>GF: name (≤ 40), target currency, visibility (locked on edit), target, due date
    GF->>FLOW: emit goalSubmitted
    FLOW->>EXP: request createGoal / editGoal
    EXP->>API: POST /households/:householdId/goals (or PATCH …/:goalId — no visibility)
else complete / reopen / delete (from the edit drawer)
    User->>CR: the drawer's step → its inline confirm (mint, or coral for delete in the danger zone)
    CR->>FLOW: emit confirmed
    FLOW->>EXP: request completeGoal / reopenGoal / deleteGoal
    EXP->>API: POST …/:goalId/complete (or /reopen) — or DELETE …/:goalId
end
alt 404 goal.not_found (deleted meanwhile)
    API-->>EXP: error code
    EXP->>API: GET …/goals + each …/goal-progress that loaded (fetched again — the goal is gone)
    EXP-->>FLOW: outcome: failed — the drawer closes
    Note over FLOW: toast "{name} was deleted by someone else…"
else other failure
    API-->>EXP: error code
    EXP-->>FLOW: outcome: failed — a form's in its banner, typing kept — a step's toasted, confirm kept
else ok
    API-->>EXP: goal (or 204)
    EXP->>API: GET …/goals + each …/goal-progress that loaded (fetched again — one that never loaded waits for Retry)
    opt a refetch fails
        EXP-->>FLOW: last good goals and funding kept, marked stale — "may be out of date" banner + retry
    end
    EXP-->>FLOW: outcome: ok, goals refreshed — the drawer closes (a create shows the Active list)
    Note over FLOW: toast "{name} created / updated / marked completed / reopened / deleted."
end
opt the tab is hidden — Back or a link, the Flow stays mounted (OQ-197)
    EXP-->>FLOW: active: false
    FLOW-->>GF: the open drawer closes — kept, unseen, while its request is out
end
""", ["Allocations are never edited here — always from the Holding (OQ-48).", "FX never leaves the browser (FR-9): the rate lives in the Flow's state, keyed by pair, and every card needing it reads it.", "Definitions and progress are two reads (OQ-177); the definitions show alone when progress fails (OQ-195). A completed Goal can still be edited."]),
    ("manage-finances-record-transaction", "Manage Finances — Record Transaction", f"{R('POST /households/:householdId/transactions')}; edit reuses it with {R('PATCH /households/:householdId/transactions/:id')}. Reads: {R('GET …/accounts/:accountId/holdings')}, {R('GET …/holdings/:holdingId/allocations')}, {R('GET …/holdings/:holdingId/schedule-entries')}.",
     [("KS", "Kind Group &<br/>Kind Selection"), ("TE", "Transaction Entry"), ("HS", "Holding Selection"), ("IB", "Investment Buy Entry"), ("GA", "Goal Allocation Entry"), FLOW("Record Transaction"), EXP("Manage Finances"), API],
     """
alt record
    User->>KS: group (Cash / Transfer / Credit card / Investment), then kind
    KS->>FLOW: emit kindSelected — amount, date, description and category carry over
else edit (from a ledger row, via the Experience)
    EXP-->>FLOW: state: the row (+ a trade's Holding, for its terms)
    FLOW-->>KS: kind and target read-only (OQ-201)
    opt a fixed-term buy
        FLOW->>EXP: request schedule(holdingId)
        EXP->>API: GET …/holdings/:holdingId/schedule-entries
        API-->>EXP: entries
        EXP-->>FLOW: state: an entry posted? → amount, date, units and terms locked (D8)
    end
end
FLOW-->>TE: render the target — a card for charge/refund, a card then its payer (open, not credit-card-only, in the card's currency — OQ-219) for a bill payment, else an open account that isn't credit-card-only
User->>TE: amount (currency from the target), date, description, category + subcategory (optional, every kind)
TE->>FLOW: emit fields
alt investment buy
    FLOW-->>IB: render ticker, asset type (fixed-term ones of the account currency's market — OQ-219), units (optional for fixed-term), rate + spread (CDI/Selic) + due date + interest payment (fixed-term), incentivised (debenture)
    User->>IB: fill in
    IB->>FLOW: emit tradeFields
    opt assign to goals
        User->>GA: goal rows with whole %
        GA->>FLOW: emit allocations (the submit blocks one over 100% or under 1%)
    end
else sell, redemption, dividend, interest or tax (a new one)
    FLOW->>EXP: request holdings(accountId)
    EXP->>API: GET …/accounts/:accountId/holdings
    API-->>EXP: Holdings
    EXP-->>FLOW: state: Holdings (or failed → Try again)
    FLOW-->>HS: render the open ones
    User->>HS: pick one (+ units for a sell or redemption — a redemption starts at the whole position)
    HS->>FLOW: emit holdingSelected (holdingId, quantity?)
    opt sell or redemption
        FLOW->>EXP: request split(holdingId)
        EXP->>API: GET …/holdings/:holdingId/allocations
        API-->>EXP: the visible shares
        EXP-->>FLOW: state: split → pre-filled in GA (OQ-206), sent only once changed
    end
end
FLOW->>EXP: request record(transaction) or save(id, changes) — an edit with no change just closes
EXP->>API: POST /households/:householdId/transactions (or PATCH …/transactions/:id)
alt 4xx (e.g. goal.allocation_exceeds_100, transaction.kind_not_allowed_for_target, transaction.schedule_started)
    API-->>EXP: error code + params
    EXP-->>FLOW: state: error — I18nUtility renders it in the drawer's banner
else 201 / 200
    API-->>EXP: the transaction
    EXP-->>FLOW: done → toast, close → Experience refreshes Browse + Month Overview
end
""", ["No recurring option (OQ-55).", "The Experience, not this Flow, refreshes the sibling Flows on completion.", "OQ-201: the Holding is picked, never typed, for every investment kind but a buy, a category is offered for every kind, a transfer is one side, recorded on its own account.", "OQ-219: any open account but a credit-card-only one pays a card's bill, in the card's currency. Accounts, cards and categories are chips up to 10, a select beyond."]),
    ("manage-finances-browse-transactions", "Manage Finances — Browse Transactions", f"{R('GET /households/:householdId/transactions?…&cursor=')}, {R('DELETE /households/:householdId/transactions/:id')}.",
     [("FP", "Filter Panel"), ("LG", "Ledger"), ("XR", "Expanded Row"), ("DC", "Delete Confirm"), FLOW("Browse Transactions"), EXP("Manage Finances"), API],
     """
EXP->>API: GET /households/:householdId/transactions?filters (infinite query keyed by the applied filters)
API-->>EXP: items, dayTotals, monthCounts, nextCursor
EXP-->>FLOW: state: pages, hasMore, status
FLOW-->>LG: render grouped by month (count) / day (totals, R$ first)
loop user scrolls
    LG->>FLOW: emit reachedEnd
    FLOW->>EXP: request next page
    EXP->>API: GET /households/:householdId/transactions?filters&cursor=…
end
opt filter
    User->>EXP: Filter (page header) — opens the drawer
    EXP-->>FLOW: state: filterOpen, applied filters → draft
    User->>FP: kinds by group, accounts / cards, categories, any date range
    FP->>FLOW: emit draftChanged / show
    FLOW->>EXP: request filtersChange(draft) — once the range is sound
    EXP->>API: GET /households/:householdId/transactions?new filters (first page)
end
User->>LG: click a row
LG->>FLOW: emit rowToggled — one row open at a time
FLOW-->>XR: render details + Edit / Delete (or the archived note)
alt edit
    XR->>FLOW: emit edit
    FLOW->>EXP: request edit(transaction) — Experience opens Record Transaction pre-filled
else delete
    XR->>FLOW: emit delete
    FLOW-->>DC: render confirm in the row
    User->>DC: confirm
    DC->>FLOW: emit confirmDelete
    FLOW->>EXP: request delete(transaction)
    EXP->>API: DELETE /households/:householdId/transactions/:transactionId
    alt 409 / 404
        API-->>EXP: error code + params
        EXP-->>FLOW: outcome: failure — shown in the confirm
    else 204
        API-->>EXP: done — the transactions tag invalidated
        EXP-->>FLOW: outcome: ok → toast, row closed
        EXP->>API: refetch every loaded page (and Month Overview)
    end
end
""", ["Not scoped to the period bar (OQ-61).", "Edit goes through the Experience to Record Transaction — no Flow-to-Flow call.", "OQ-201: month headers show the month's count (monthCounts); accounts and cards are one filter picker; a Category includes its Subcategories.", "OQ-220: the Experience keeps the applied filters and the pages (an RTK Query infinite query, refetched whole after a record, edit or delete); the Flow keeps the drawer's draft and the open row. A Holding filter shows as a removable chip, never picked in the drawer."]),
    ("manage-finances-month-overview", "Manage Finances — Month Overview", f"{R('GET /households/:householdId/reports/month-overview?year=&month=')}.",
     [("PB", "Period Bar"), ("CS", "Period Summary<br/>($ / R$ switch)"), ("RL", "Balance / Budget /<br/>Goal Rails"), FLOW("Month Overview"), EXP("Manage Finances"), API],
     """
EXP->>API: GET /households/:householdId/reports/month-overview?year=&month= (today's month)
API-->>EXP: summary per currency, year strip, balances, budgets, goals
EXP-->>FLOW: period, report (loading / failed / loaded), accounts
FLOW-->>PB: render year + 12 months in the switch's currency
FLOW-->>CS: render In / Out / Total (R$ the first time, then the remembered pick)
FLOW-->>RL: render rails labelled 'Month/Year' (placeholders while loading)
alt pick another month or year
    User->>PB: select
    PB->>FLOW: emit periodChanged
    FLOW->>EXP: periodChanged(year, month)
    EXP->>API: GET /households/:householdId/reports/month-overview?year=&month=
else switch currency
    User->>CS: $ or R$
    CS->>FLOW: emit currencyChanged (local — remembered in this browser, no request)
else the month fails
    EXP-->>FLOW: failed
    FLOW-->>RL: banner "Couldn't load Month/Year" + Try again, in the rails' place
    User->>FLOW: Try again
    FLOW->>EXP: retry
    EXP->>API: GET /households/:householdId/reports/month-overview?year=&month=
end
""", ["FormattingUtility formats every amount in its own currency; nothing is summed across currencies.", "OQ-201: a Goal funded in other currencies shows its own currency's progress and a note pointing to Goals (the exchange rate lives there); a card shows its outstanding at the month's end.", "OQ-221: the Experience holds the month (its query's argument) and refetches it after a record, edit or delete; the Flow keeps only the $ / R$ switch. Its two regions (bar, rails) are placed by the Experience's page grid around Browse's ledger. A failed month never shows the previous month's figures."]),
    ("track-investments-portfolio-overview", "Track Investments — Portfolio Overview", f"{R('GET /households/:householdId/reports/investments-overview')}, {R('GET /households/:householdId/reports/payouts?holdingIds=')}.",
     [("NW", "Net Worth / Allocation /<br/>Coming Due cards"), ("PT", "Payout This Month"), ("HS", "Payout Holding Selector"), ("PC", "Payout Chart"), FLOW("Portfolio Overview"), EXP("Track Investments"), API],
     """
FLOW->>EXP: request overview
EXP->>API: GET /households/:householdId/reports/investments-overview
API-->>EXP: net worth + change, payout this month, allocations, coming due
EXP-->>FLOW: state
FLOW-->>NW: render
FLOW-->>PT: render this month's dividend / interest transactions
FLOW->>EXP: request payouts(default holdings)
EXP->>API: GET /households/:householdId/reports/payouts
API-->>EXP: series
FLOW-->>PC: render top 5 + Others
User->>HS: search, presets, check holdings
HS->>FLOW: emit holdingsSelected
FLOW->>EXP: request payouts(selected)
EXP->>API: GET /households/:householdId/reports/payouts?holdingIds=…
API-->>EXP: series
EXP-->>FLOW: state
FLOW-->>PC: re-render (only the chart refetches)
""", ["Portfolio Builder buttons render disabled (v2)."]),
    ("track-investments-holding-maintenance", "Track Investments — Holding Maintenance", f"{R('GET /households/:householdId/accounts/:id/holdings')} (InsightsManager), {R('GET/PATCH /households/:householdId/holdings/:id/allocations')}, {R('…/valuation-snapshots')} (AccountManager — OQ-178).",
     [("AP", "Account Picker"), ("HT", "Holdings Table"), ("GA", "Goal Allocation Editor"), ("MV", "Market Value Entry"), ("VH", "Value History Editor"), FLOW("Holding Maintenance"), EXP("Track Investments"), API],
     """
User->>AP: pick account
AP->>FLOW: emit accountChosen
FLOW->>EXP: request holdings(accountId)
EXP->>API: GET /households/:householdId/accounts/:accountId/holdings
API-->>EXP: positions (+ expected payout / taxes for fixed-term)
EXP-->>FLOW: state
User->>HT: expand a holding
HT->>FLOW: emit holdingExpanded
FLOW->>EXP: request split + history(holdingId)
par
    EXP->>API: GET /households/:householdId/holdings/:holdingId/allocations
    API-->>EXP: the split over the Goals this member can see
and
    EXP->>API: GET /households/:householdId/holdings/:holdingId/valuation-snapshots
    API-->>EXP: value history, newest first
end
EXP-->>FLOW: state
alt edit goal allocations
    User->>GA: rows with whole %
    GA->>FLOW: emit allocations
    FLOW->>EXP: request saveAllocations
    EXP->>API: PATCH /households/:householdId/holdings/:holdingId
else record a market value (market-priced only)
    User->>MV: value + as-of date
    MV->>FLOW: emit marketValue
    FLOW->>EXP: request recordValue
    EXP->>API: POST /households/:householdId/holdings/:holdingId/valuation-snapshots
else fix a past value
    User->>VH: edit or delete an entry
    VH->>FLOW: emit historyChange
    FLOW->>EXP: request edit / delete snapshot
    EXP->>API: PATCH or DELETE …/valuation-snapshots/:snapshotId
end
API-->>EXP: done or error code (e.g. 409 snapshot.automatic_not_editable, goal.completed, holding.archived)
EXP-->>FLOW: state refreshed
""", ["Positions are read-only (transactions only).", "'See in Transactions' asks the Experience to route to Manage Finances with holdingId — no Flow-to-Flow call.", "The split shows only the Goals this member can see; a share funding someone else's personal Goal is kept by the server on save and still counts toward 100% (OQ-178)."]),
    ("track-investments-rates-maintenance", "Track Investments — Rates Maintenance", f"{R('GET /households/:householdId/index-rates')}, {R('POST/PATCH/DELETE /households/:householdId/index-rates/:index/values')}.",
     [("RC", "Rate Card"), ("RU", "Rate Update Entry"), ("RH", "Rate History Editor"), FLOW("Rates Maintenance"), EXP("Track Investments"), API],
     """
FLOW->>EXP: request rates
EXP->>API: GET /households/:householdId/index-rates
API-->>EXP: every index with history
EXP-->>FLOW: state
FLOW-->>RC: render Selic, CDI, IPCA, IGP-M with charts
alt update
    User->>RU: value + as-of date
    RU->>FLOW: emit rateEntered
    FLOW->>EXP: request record
    EXP->>API: POST /households/:householdId/index-rates/:index/values
else fix history
    User->>RH: edit or delete an entry
    RH->>FLOW: emit historyChange
    FLOW->>EXP: request edit / delete
    EXP->>API: PATCH or DELETE /households/:householdId/index-rates/:index/values/:valueId
end
API-->>EXP: done
EXP-->>FLOW: state refreshed
""", ["Values are × 10,000 on the wire; FormattingUtility shows 10.50% a.a."]),
    ("review-insights-dashboard", "Review Insights — Dashboard", f"{R('GET /households/:householdId/dashboard')}, {R('GET /households/:householdId/reports/payouts?holdingIds=')}.",
     [("PN", "Panels"), ("HS", "Payout Holding Selector"), ("PC", "Payout Chart"), FLOW("Dashboard"), EXP("Review Insights"), API],
     """
FLOW->>EXP: request dashboard
EXP->>API: GET /households/:householdId/dashboard
API-->>EXP: fixed panels
EXP-->>FLOW: state
FLOW-->>PN: render net worth, coming due, rails (over-budget first)
FLOW-->>PC: render payouts
User->>HS: change holdings
HS->>FLOW: emit holdingsSelected
FLOW->>EXP: request payouts(selected)
EXP->>API: GET /households/:householdId/reports/payouts?holdingIds=…
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
    SHELL->>MP: route (routing config) → Respond to Invitation (OQ-159)
    MP->>API: POST /invitations/:invitationId/accept
    MP-->>SHELL: done / failed (Manage Profile toasts either)
else holding.matured — Archive holding
    User->>BELL: Archive holding
    BELL->>SHELL: emit action {type: holding.matured, archive, params}
    SHELL->>TI: route → Archive Matured Holding
    TI->>API: POST /households/:householdId/holdings/:holdingId/archive
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
