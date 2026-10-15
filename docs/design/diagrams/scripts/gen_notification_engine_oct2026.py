"""Apply the NotificationEngine rework (OQ-113) to docs/design/diagrams/.

NotificationDeliveryUtility becomes NotificationEngine (domain knowledge: which
channel each notification type uses, and rendering) plus EmailAccessor (sends
through the configured email provider). Only Managers call the Engine.

1. Every call chain gets the new layout: NotificationEngine in the Engines row
   (spanning the Identity and Account columns, its two callers), EmailAccessor
   in the Access Layer, the Utility removed from the sidebar.
2. Invite User, Reset Password and Notify Matured Holding chains are rewritten.
3. The layered static diagram (03) and the component call-graph (02) follow.
4. The EBD account-recovery sequence's note is reworded.
The three sequence diagrams are changed in gen_identity_household.py and
gen_track_investments.py. Idempotent: rerunning produces the same output.
"""
import pathlib

from gen_call_chains_oct2026_lib import E, write

ROOT = pathlib.Path(__file__).parent.parent
CC = ROOT / "call-chains"
DECIDED = 'Updated by the NotificationEngine rework (OQ-113).'

EMPTY_PAIR = '<div class="box empty-slot">—</div><div class="box empty-slot">—</div>'
ENGINE_CC = '<div class="box engine" id="eng-notify" style="grid-column: span 2">NotificationEngine</div>'
EMAIL_CC = '<div class="box accessor" id="acc-email">EmailAccessor</div>'
UTIL_CC = '      <div class="box utility" id="util-notify">NotificationDeliveryUtility</div>\n'


def chain_layout(s: str) -> str:
    """Swap the Utility for the Engine + EmailAccessor in a call-chain page's layout."""
    if 'id="eng-notify"' not in s:
        s = s.replace(EMPTY_PAIR, ENGINE_CC, 1)
        s = s.replace('<div class="box accessor" id="acc-invitation">InvitationAccessor</div>',
                      '<div class="box accessor" id="acc-invitation">InvitationAccessor</div>\n            ' + EMAIL_CC, 1)
    return s.replace(UTIL_CC, "")


# ------------------------------------------------------------------ 1. layout everywhere
for f in CC.rglob("*.html"):
    f.write_text(chain_layout(f.read_text()))

# ------------------------------------------------------------------ 2. changed chains
IH = CC / "identity-household"
I = "the Identity &amp; Household set (CUC-2"
write(IH / "uc-03-invite-user.html", "Call Chain — Invite User to Household",
      f"Use case 3 of 21 in {I}, FR-1.5/FR-1.19). Create pattern. {DECIDED}",
      E((1, "mgr-identity", "util-authz"), (2, "mgr-identity", "acc-user"), (3, "mgr-identity", "acc-household"),
        (4, "mgr-identity", "acc-invitation"), (5, "mgr-identity", "eng-notify", "a"), (6, "eng-notify", "acc-inbox"),
        (7, "mgr-identity", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>IdentityManager</code> ① <code>AuthorizationUtility.authorize(members.manage)</code> → ② <code>UserAccessor.findByEmail</code> (FR-1.19, the Manager&#39;s rule, OQ-109) → ③ <code>HouseholdAccessor.findMembership</code> + ④ <code>InvitationAccessor.findPending</code> / <code>insert</code> (duplicate checks) → ⑤ <code>NotificationEngine.notify(\"invitation.received\", {userId})</code> (async) → ⑥ the Engine routes it in-app: <code>NotificationInboxAccessor.insert</code> → ⑦ <code>LoggingUtility</code> (async).",
       "<strong>Corrected drift:</strong> the previous chain said <code>deliver(email)</code> and skipped the invitee/duplicate checks; invitations are in-app (OQ-68) and the checks are the Manager&#39;s (OQ-109).",
       "<strong>The Engine chooses the channel</strong> from the notification type (OQ-113); the Manager only says what happened and to whom."])
write(IH / "uc-18-reset-password.html", "Call Chain — Reset Forgotten Password",
      f"Use case 18 of 21 in {I}, FR-1.13). Edit pattern (User.password), unauthenticated entry, two round-trips. {DECIDED}",
      E((1, "mgr-identity", "acc-user"), (2, "mgr-identity", "util-authn"), (3, "mgr-identity", "acc-user"),
        (4, "mgr-identity", "eng-notify", "a"), (5, "eng-notify", "acc-email"),
        (6, "mgr-identity", "util-authn"), (7, "mgr-identity", "acc-user"), (8, "mgr-identity", "acc-session"),
        (9, "mgr-identity", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>IdentityManager</code> ① <code>UserAccessor.findByEmail</code> → ② <code>AuthenticationUtility.issueOpaqueToken</code> → ③ <code>UserAccessor.storeResetToken</code> → ④ <code>NotificationEngine.notify(\"password.reset\", {email, language})</code> (async) → ⑤ the Engine routes it to email, renders it from the i18n catalog and calls <code>EmailAccessor.send({to, subject, body})</code> — <em>round-trip boundary</em> — ⑥ <code>AuthenticationUtility.hashOpaqueToken</code> / <code>hashPassword</code> → ⑦ <code>UserAccessor.consumeResetToken</code> / <code>updatePasswordHash</code>, then <code>findById</code> + <code>clearLoginFailures</code> (the reset lifts any login lock, OQ-115) → ⑧ <code>SessionAccessor.deleteAllForUser</code> → ⑨ <code>LoggingUtility</code> (async).",
       "<strong>EmailAccessor only sends;</strong> the provider is its configuration (<code>EMAIL_PROVIDER</code>, v1 <code>console</code>, terminal only — OQ-112). Rendering stays in the Engine (OQ-113).",
       "Step numbers follow the current sequence diagram (token issue/hash via <code>AuthenticationUtility</code>, OQ-100); the previous chain predated it."])
TI = CC / "track-investments"
T = "the Track Investments &amp; Net Worth set (CUC-6)"
write(TI / "uc-11-notify-matured-holding.html", "Call Chain — Notify Matured Holding",
      f"Use case 11 of 12 in {T}, FR-5.8, FR-6.5. System-Trigger + subscriber. {DECIDED}",
      E((1, "acc-holding", "util-servicebus", "a"), (2, "util-servicebus", "mgr-account", "a"), (3, "mgr-account", "eng-notify"),
        (4, "eng-notify", "acc-inbox"), (5, "mgr-account", "acc-holding"), (6, "mgr-account", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>investmentsDaily</code> → ① <code>InvestmentHoldingAccessor.findMaturedWithPosition(today)</code> → <code>ServiceBusUtility.publish(\"holding.matured\")</code> (async) → ② <code>AccountManager</code> subscribes → ③ <code>NotificationEngine.notify(\"holding.matured\", {userId})</code> per owner (sync — the Manager needs the outcome) → ④ in-app: <code>NotificationInboxAccessor.insert</code> → ⑤ <code>InvestmentHoldingAccessor.markMaturedNotified</code> only after every owner was notified → ⑥ <code>LoggingUtility</code> (async).",
       "Same trigger shape as the scheduled cash events (§3.2a). <code>NotificationInboxAccessor</code> has two callers: the Engine writes, <code>InsightsManager</code> reads (View/Delete Notification) — a shared Accessor, not an Accessor→Accessor call."])

# ------------------------------------------------------------------ 3. static diagrams
L3 = ROOT / "03-backend-layered-architecture.html"
s = L3.read_text()
if "NotificationEngine" not in s:
    s = s.replace('<div class="box empty-slot">—</div>\n            <div class="box empty-slot">—</div>',
                  '<div class="box engine" style="grid-column: span 2">NotificationEngine</div>', 1)
    s = s.replace('<div class="box accessor">InvitationAccessor</div>',
                  '<div class="box accessor">InvitationAccessor</div>\n            <div class="box accessor">EmailAccessor</div>', 1)
    s = s.replace('      <div class="box utility">NotificationDeliveryUtility</div>\n', "")
NOTE = '    <p><strong>Notification placements (OQ-113)'
if NOTE not in s:
    s = s.replace('    <p><strong>No wiring shown deliberately.</strong>', NOTE + ''':</strong>
    these three don't follow the one-owner-per-column rule, so don't read
    ownership into their position. <code>NotificationEngine</code> spans
    Identity and Account because both of those Managers call it — it is not a
    fifth Manager's Engine. <code>EmailAccessor</code> is called only by the
    Engine and sits under its left half. <code>NotificationInboxAccessor</code>
    stays under Insights: the Engine writes it, <code>InsightsManager</code>
    reads it for the inbox screens.</p>
    <p><strong>No wiring shown deliberately.</strong>''', 1)
L3.write_text(s)

C2 = ROOT / "02-vbd-component-diagram.html"
s = C2.read_text()
if "E_Notify" not in s:
    s = s.replace("        U_Notify[NotificationDeliveryUtility]\n", "")
    s = s.replace("        A_Inbox[(NotificationInboxAccessor)]\n", "")
    s = s.replace('    subgraph Utilities["Cross-Cutting Utilities"]',
                  '    subgraph Notifications["Notifications"]\n        E_Notify[NotificationEngine]\n'
                  '        A_Inbox[(NotificationInboxAccessor)]\n        A_Email[(EmailAccessor)]\n    end\n\n'
                  '    subgraph Utilities["Cross-Cutting Utilities"]', 1)
    s = s.replace("    M_Acct --> U_Notify\n    M_Id --> U_Notify\n",
                  "    M_Acct --> E_Notify\n    M_Id --> E_Notify\n    E_Notify --> A_Inbox\n    E_Notify --> A_Email\n")
    s = s.replace("    Insights -.-> Utilities\n", "    Insights -.-> Utilities\n    Notifications -.-> Utilities\n")
    s = s.replace("    wired again (invitations, matured holdings). Still 4 Managers,\n    2 Engines, 7 Utilities, 18 active Accessors.",
                  "    wired again (invitations, matured holdings). Still 4 Managers,\n    2 Engines, 7 Utilities, 18 active Accessors.\n"
                  "    <strong>Oct 2026 (OQ-113):</strong> <code>NotificationDeliveryUtility</code> reclassified as\n"
                  "    <code>NotificationEngine</code> — it holds domain knowledge (which channel each\n"
                  "    notification type uses, rendering email from the catalog), and only Managers may\n"
                  "    cause a notification; sending email becomes <code>EmailAccessor</code>.\n"
                  "    4 Managers, 3 Engines, 6 Utilities, 17 active Accessors (16 + EmailAccessor; the VBD doc corrected the earlier 18).")
C2.write_text(s)

# ------------------------------------------------------------------ 4. EBD note
EB = ROOT / "ebd-sequences" / "authenticate-account-recovery.html"
EB.write_text(EB.read_text().replace("(sent by NotificationDeliveryUtility, OQ-84)",
                                     "(sent by NotificationEngine via EmailAccessor, OQ-113)"))
