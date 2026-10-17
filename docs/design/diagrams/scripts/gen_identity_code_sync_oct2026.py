"""Bring the Identity & Household call chains in line with IdentityManager as built (task M1).

The chains were drawn before the code and still named design-time methods
(transitionStatus, transitionMembership, canManageMembers, ValidationUtility.check,
generateMFASecret, ...). This rewrites every chain whose use case is built, from
apps/api/src/managers/identity/. Login (uc-14) and MFA Recovery (uc-20) live in
gen_login_lockout_oct2026.py; Delete User (uc-12) is still unbuilt (task 136,
M1D) and is redrawn with it. Idempotent: rerunning produces the same output.
"""
import pathlib
import re

from gen_call_chains_oct2026_lib import E, write

IH = pathlib.Path(__file__).parent.parent / "call-chains" / "identity-household"
SYNCED = "Synced with the code (task M1 audit, Oct 2026)."


def one_line_edges(path: pathlib.Path) -> None:
    """Older pages spread `var edges` over several lines; the shared writer needs one."""
    html = path.read_text()
    path.write_text(re.sub(r"var edges = \[.*?\];", "var edges = [];", html, count=1, flags=re.S))


CHAINS = [
    ("uc-01-create-household.html", "Call Chain — Create Household",
     "Use case 1 of 21 (FR-1.4). Create pattern (Household); the one Manager&harr;Manager effect, through the Service Bus.",
     E((1, "mgr-identity", "util-validation"), (2, "mgr-identity", "acc-user"),
       (3, "mgr-identity", "acc-household"),
       (4, "mgr-identity", "util-servicebus", "a"), (5, "util-servicebus", "mgr-account", "a"),
       (6, "mgr-account", "acc-category"), (7, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>ValidationUtility.checkFields</code> (a name blank once trimmed &rarr; 422 <code>validation.failed</code>) &rarr; &#9313; <code>UserAccessor.findById</code> (the creator&#39;s language; gone &rarr; 401) &rarr; &#9314; <code>HouseholdAccessor.insert(name trimmed, ownerUserId)</code> (the creator is Owner, one transaction) &rarr; &#9315; <code>ServiceBusUtility.publish(&quot;household.created&quot;, {householdId, createdByUserId, language})</code> &rarr; &#9316; <code>AccountManager</code> subscribes &rarr; &#9317; <code>CategoryAccessor.seedDefaults</code> (built, A9 &mdash; once per household, OQ-173; the subscription is wired with <code>AccountManager</code>, M2) &rarr; &#9318; <code>LoggingUtility</code> audit.",
      "<strong>Changed (U3, OQ-165):</strong> the route checks the contract only; trimming the name and refusing a blank one is the Manager&#39;s, through <code>ValidationUtility</code>. " + SYNCED]),
    ("uc-02-delete-household.html", "Call Chain — Delete Household",
     "Use case 2 of 21 (FR-1.7). Owner-only, deliberate dissolution.",
     E((1, "mgr-identity", "util-authz"), (2, "mgr-identity", "acc-household"),
       (3, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>AuthorizationUtility.authorize(household.delete)</code> (non-member &rarr; 404, not Owner &rarr; 403) &rarr; &#9313; <code>HouseholdAccessor.delete(householdId)</code> (household-scoped data goes with it, FK cascade; already gone &rarr; 404) &rarr; &#9314; <code>LoggingUtility</code> audit.",
      "The household is deleted, not moved to a &quot;deleted&quot; status. " + SYNCED]),
    ("uc-04-accept-invitation.html", "Call Chain — Accept Household Invitation",
     "Use case 4 of 21 (FR-1.10). Self-service: only the invitee answers.",
     E((1, "mgr-identity", "acc-invitation"), (2, "mgr-identity", "acc-household"),
       (3, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>InvitationAccessor.findById</code> (missing or someone else&#39;s &rarr; 404, OQ-118), then <code>resolve(id, accepted, now)</code> (guarded &mdash; only while pending, else 409) &rarr; &#9313; <code>HouseholdAccessor.addMember(householdId, userId, role)</code> (<code>already_member</code> is fine) &rarr; &#9314; <code>LoggingUtility</code> audit.",
      "Resolve first, then join (OQ-118): the other order would need undoing a membership whenever a revoke raced in. The Manager checks ownership of the invitation, the Accessor only guards the status. " + SYNCED]),
    ("uc-05-decline-invitation.html", "Call Chain — Decline Household Invitation",
     "Use case 5 of 21 (FR-1.10). No membership is ever created.",
     E((1, "mgr-identity", "acc-invitation"), (2, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>InvitationAccessor.findById</code> (missing or someone else&#39;s &rarr; 404), then <code>resolve(id, declined, now)</code> (guarded, else 409) &rarr; &#9313; <code>LoggingUtility</code> info (not audited).",
      SYNCED]),
    ("uc-06-revoke-invitation.html", "Call Chain — Revoke Household Invitation",
     "Use case 6 of 21 (FR-1.10). Owner/Admin cancels a pending invitation.",
     E((1, "mgr-identity", "util-authz"), (2, "mgr-identity", "acc-invitation"),
       (3, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>AuthorizationUtility.authorize(members.manage)</code> &rarr; &#9313; <code>InvitationAccessor.findById</code> (another household&#39;s &rarr; 404), then <code>resolve(id, revoked, now)</code> (answered meanwhile &rarr; 409) &rarr; &#9314; <code>LoggingUtility</code> audit.",
      SYNCED]),
    ("uc-07-remove-member.html", "Call Chain — Remove Member from Household",
     "Use case 7 of 21 (FR-1.11). Owner/Admin removes another member; never the Owner.",
     E((1, "mgr-identity", "util-authz"), (2, "mgr-identity", "acc-household"),
       (3, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>AuthorizationUtility.authorize(members.manage)</code> &rarr; &#9313; <code>HouseholdAccessor.findMembership</code> (none &rarr; 404, the Owner &rarr; 403 &mdash; the Manager&#39;s rule, OQ-111), then <code>removeMember</code> (guarded, <code>stale</code> &rarr; 409) &rarr; &#9314; <code>LoggingUtility</code> audit.",
      "The Manager decides who may be removed; the Accessor applies it as a guarded write that also refuses an Owner (OQ-107). " + SYNCED]),
    ("uc-08-leave-household.html", "Call Chain — Leave Household",
     "Use case 8 of 21 (FR-1.11/1.18). Self-service; an Owner is succeeded, or the household dissolves.",
     E((1, "mgr-identity", "acc-household"), (2, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>HouseholdAccessor.findMembership</code> &rarr; a non-Owner: <code>removeMember</code>; the Owner: <code>findSuccessor</code>, then <code>swapOwner</code> + <code>removeMember</code>, or <code>dissolve</code> when nobody else is left &mdash; each a guarded write, the whole attempt retried on <code>stale</code> up to 3 times (OQ-107) &rarr; &#9313; <code>LoggingUtility</code> audit (<code>LeaveHousehold</code> or <code>DissolveHousehold</code>).",
      "Corrected: the old chain had succession inside one Accessor call. The Manager decides succession (Manager decides, Accessor applies); the one edge to <code>HouseholdAccessor</code> carries several calls. " + SYNCED]),
    ("uc-09-change-member-role.html", "Call Chain — Change a Member&#39;s Role",
     "Use case 9 of 21 (FR-1.12). Owner/Admin only; never the Owner&#39;s role.",
     E((1, "mgr-identity", "util-authz"), (2, "mgr-identity", "acc-household"),
       (3, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>AuthorizationUtility.authorize(members.manage)</code> &rarr; &#9313; <code>HouseholdAccessor.findMembership</code> (none &rarr; 404, the Owner &rarr; 403), then <code>updateRole</code> (guarded, <code>stale</code> &rarr; 409) &rarr; &#9314; <code>LoggingUtility</code> audit.",
      "Owner as the new role is refused at the route (422) &mdash; that is Transfer Ownership. " + SYNCED]),
    ("uc-10-transfer-ownership.html", "Call Chain — Transfer Ownership",
     "Use case 10 of 21 (FR-1.20). Owner-only atomic swap.",
     E((1, "mgr-identity", "util-authz"), (2, "mgr-identity", "acc-household"),
       (3, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>AuthorizationUtility.authorize(household.transferOwnership)</code> &rarr; &#9313; <code>HouseholdAccessor.findMembership(target)</code> (none &rarr; 404), then <code>swapOwner(householdId, actor, target)</code> (one transaction, never zero or two Owners, guarded &mdash; <code>stale</code> &rarr; 409) &rarr; &#9314; <code>LoggingUtility</code> audit. Transferring to oneself does nothing.",
      SYNCED]),
    ("uc-11-create-user.html", "Call Chain — Create User (Registration)",
     "Use case 11 of 21 (FR-1.1/1.15). One request: the account, its MFA secret and its recovery codes together.",
     E((1, "mgr-identity", "util-validation"), (2, "mgr-identity", "util-authn"),
       (3, "mgr-identity", "acc-user"), (4, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>ValidationUtility</code> (a name blank once trimmed &rarr; 422 <code>validation.failed</code>; password &lt; 12 &rarr; 422 <code>password.too_short</code>, before any work) &rarr; &#9313; <code>AuthenticationUtility.enrollMfa(email)</code> (TOTP secret, sealed, + 10 recovery codes and their hashes) and <code>hashPassword</code> &rarr; &#9314; <code>UserAccessor.insert</code> (one transaction; the unique index on <code>lower(email)</code> decides a duplicate &rarr; 409) &rarr; &#9315; <code>LoggingUtility</code> audit; then &#9313; again, <code>signEnrollmentToken</code>, for the confirmation (OQ-149).",
      "<strong>Changed (U3, OQ-165):</strong> the contract validates the request&#39;s shape at the route; <code>ValidationUtility</code> covers what it can&#39;t say &mdash; a blank name, and the password length the Manager answers itself. " + SYNCED,
      "<strong>Changed (OQ-149):</strong> the first code is now checked by the backend, in a second request &mdash; Confirm MFA Enrollment (uc-11b) &mdash; with the <code>enrollmentToken</code> answered here. It replaces the M1 note that the verify step was the web Flow&#39;s alone: no endpoint existed to check it."]),
    ("uc-13-edit-user.html", "Call Chain — Edit User (Profile)",
     "Use case 13 of 21 (FR-1.21). Names and preferences; the caller&#39;s own profile only.",
     E((1, "mgr-identity", "util-validation"), (2, "mgr-identity", "acc-user"),
       (3, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>ValidationUtility.checkFields</code> (a name sent blank &rarr; 422 <code>validation.failed</code>) &rarr; &#9313; <code>UserAccessor.update(userId, only the fields sent, names trimmed)</code> &mdash; or <code>findById</code> when nothing changes (gone &rarr; 401) &rarr; &#9314; <code>LoggingUtility</code> audit, only when something changed.",
      "<strong>Changed (U3, OQ-165):</strong> the route checks the contract (OQ-116); a blank name is the Manager&#39;s check, through <code>ValidationUtility</code>. " + SYNCED]),
    ("uc-15-logout.html", "Call Chain — Logout",
     "Use case 15 of 21 (FR-1.9). The current session only.",
     E((1, "mgr-identity", "acc-session"), (2, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>SessionAccessor.deleteForUser(userId, sessionId)</code> (the session is deleted; idempotent) &rarr; &#9313; <code>LoggingUtility</code> info.",
      SYNCED]),
    ("uc-16-view-sessions.html", "Call Chain — View Active Sessions",
     "Use case 16 of 21 (FR-1.3). Read-only.",
     E((1, "mgr-identity", "acc-session")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>SessionAccessor.listByUser(userId, now)</code> (active only, most recently used first); the Manager marks <code>current</code> by the access token&#39;s session id (OQ-106).",
      "Per-request logging is middleware and not drawn; only the log and audit calls a Manager makes are. " + SYNCED]),
    ("uc-17-revoke-session.html", "Call Chain — Revoke a Session",
     "Use case 17 of 21 (FR-1.3). One session, or every other one.",
     E((1, "mgr-identity", "acc-session"), (2, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> &#9312; <code>SessionAccessor.deleteForUser(userId, sessionId)</code> (ownership and delete in one statement; not deleted &rarr; 404) &mdash; or <code>deleteAllExceptCurrent(userId, currentSessionId)</code> for &quot;sign out all others&quot; &rarr; &#9313; <code>LoggingUtility</code> info.",
      SYNCED]),
    ("uc-19-change-password.html", "Call Chain — Change Password",
     "Use case 19 of 21 (FR-1.14). Re-supplies the current password; every other session ends.",
     E((1, "mgr-identity", "acc-user"), (2, "mgr-identity", "util-authn"), (3, "mgr-identity", "acc-user"),
       (4, "mgr-identity", "acc-session"), (5, "mgr-identity", "util-logging", "a")),
     ["<strong>Chain:</strong> <code>IdentityManager</code> (new password &lt; 12 &rarr; 422, first) &#9312; <code>UserAccessor.findPasswordHash</code> (gone &rarr; 401) &rarr; &#9313; <code>AuthenticationUtility.verifyPassword</code> (wrong &rarr; 422 <code>password.current_incorrect</code>, not 401) and <code>hashPassword</code> &rarr; &#9314; <code>UserAccessor.updatePasswordHash</code> &rarr; &#9315; <code>SessionAccessor.deleteAllExceptCurrent</code> &rarr; &#9316; <code>LoggingUtility</code> audit.",
      SYNCED]),
]

for filename, title, subtitle, edges, notes in CHAINS:
    path = IH / filename
    one_line_edges(path)
    write(path, title, subtitle, edges, notes)

print(f"Synced {len(CHAINS)} call chains in {IH}")
