#!/usr/bin/env python3
"""Generates docs/design/diagrams/sequences/identity-household/*.html — CUC-1/CUC-2,
20 of 20 use cases. Backend sequence-diagram sweep, see
docs/design/diagrams/scripts/seq_diagram_lib.py's docstring for the semicolon gotcha
this relies on `check_mermaid_source` to catch."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from seq_diagram_lib import page as _page

OUT_DIR = "/home/andrebot/projects/pessoal/newFinancas/docs/design/diagrams/sequences/identity-household"


def page(filename, title, subtitle, mermaid, notes):
    _page(OUT_DIR, filename, title, subtitle, mermaid, notes)

# Shared participant preamble fragments reused across files
P_CORE = """    actor User
    participant API as Hono route
    participant IM as IdentityManager"""

UCS = []

# ---------------------------------------------------------------- UC-01
UCS.append(dict(
    filename="uc-01-create-household.html",
    title="Create Household",
    subtitle='<span class="route">POST /households</span> — FR-1.4. The one Manager&harr;Manager effect in the whole system (VBD doc &sect;3.1b): seeding default Categories is <code>AccountManager</code>&#39;s job, reached only through the Service Bus, never a direct call.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant HA as HouseholdAccessor
    participant SB as ServiceBusUtility
    participant AM as AccountManager
    participant CA as CategoryAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households {name}
    Note over API: name trimmed and non-blank (contract validation, OQ-116)
    API->>IM: createHousehold(actor, name)
    IM->>UA: findById(actor.userId)
    alt the account is gone
        UA-->>IM: none
        IM-->>API: Unauthorized
        API-->>User: 401 auth.unauthenticated
    else found
    UA-->>IM: creator (language)
    IM->>HA: insert(name, ownerUserId = actor.userId)
    HA-->>IM: household (creator is Owner, one transaction)
    IM->>SB: publish("household.created", {householdId, createdByUserId, language})
    Note over SB: fire-and-forget &mdash; AccountManager seeds the default<br/>categories in the creator&#39;s language (OQ-117)
    SB-->>AM: subscribe("household.created")
    AM->>CA: seedDefaults(householdId, language)
    CA-->>AM: default Categories created
    IM-->>LOG: log.audit("CreateHousehold", Household householdId)
    IM-->>API: household + role Owner
    API-->>User: 201 Created MyHousehold
    end
""",
    notes="""
    <ul>
      <li><strong>No <code>IdentityManager</code> &rarr; <code>AccountManager</code> edge</strong> — the Category-seeding call is entirely on <code>AccountManager</code>&#39;s side of the Service Bus subscription; <code>IdentityManager</code> never learns <code>AccountManager</code> or <code>CategoryAccessor</code> exist (VBD doc &sect;3.1b).</li>
      <li><strong>The event carries the creator and their language</strong> (<code>{householdId, createdByUserId, language}</code>, OQ-117): default categories are seeded in the creator&#39;s language, and <code>AccountManager</code> must not reach into Identity&#39;s data to find it.</li>
      <li>The Service Bus hop is fire-and-forget from <code>IdentityManager</code>&#39;s perspective — the 201 response doesn&#39;t wait on Category seeding completing.</li>
      <li>See <code>docs/architecture/backend/01-vbd-decomposition.md</code> &sect;3.1b and FR-1.4/FR-10.1.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-02
UCS.append(dict(
    filename="uc-02-delete-household.html",
    title="Delete Household",
    subtitle='<span class="route">DELETE /households/:householdId</span> — FR-1.7 ("Owner &mdash; full control, including deleting the household"). Owner-only, deliberate dissolution — distinct from FR-1.18&#39;s auto-delete-when-last-member-leaves case (see Leave Household).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant HA as HouseholdAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId
    API->>IM: deleteHousehold(actor, householdId)
    IM->>AZ: authorize(actor.userId, householdId, household.delete)
    alt not a member
        AZ-->>IM: not_member
        IM-->>API: NotFound
        API-->>User: 404 household.not_found (the household isn&#39;t revealed)
    else not the Owner
        AZ-->>IM: forbidden
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>IM: allowed (Owner)
        IM->>HA: delete(householdId)
        Note over HA: everything household-scoped goes with it (FK cascade)
        alt already gone (deleted meanwhile)
            HA-->>IM: not deleted
            IM-->>API: NotFound
            API-->>User: 404 household.not_found
        else deleted
            HA-->>IM: deleted
            IM-->>LOG: log.audit("DeleteHousehold", Household householdId)
            IM-->>API: deleted
            API-->>User: 204 No Content
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Deliberately not the same code path as FR-1.18&#39;s auto-succession.</strong> This is the Owner <em>choosing</em> to dissolve the household outright; FR-1.18&#39;s "delete the household if no member remains" is a side effect of the last member departing (see Leave Household), not this endpoint.</li>
      <li>Unlike every personal/shared split elsewhere in this project, there&#39;s no anonymize-instead-of-delete branch here — dissolving the household destroys the shared record itself, by the Owner&#39;s own explicit request, which is exactly the case FR-1.17&#39;s anonymization rule doesn&#39;t apply to (that rule protects shared data from a <em>member&#39;s</em> unilateral departure, not the Owner&#39;s deliberate deletion of the whole household).</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-03
UCS.append(dict(
    filename="uc-03-invite-user.html",
    title="Invite User to Household",
    subtitle='<span class="route">POST /households/:householdId/invitations</span> — FR-1.5/FR-1.19/OQ-26. Owner/Admin only; target must be an existing registered user — there is no invite-a-non-user flow.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant UA as UserAccessor
    participant HA as HouseholdAccessor
    participant IA as InvitationAccessor
    participant NE as NotificationEngine
    participant NIA as NotificationInboxAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/invitations {email, role}
    API->>IM: inviteUser(actor, householdId, {email, role})
    IM->>AZ: authorize(actor.userId, householdId, members.manage)
    alt not a member
        AZ-->>IM: not_member
        IM-->>API: NotFound
        API-->>User: 404 household.not_found
    else not Owner or Admin
        AZ-->>IM: forbidden
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>IM: allowed
        IM->>UA: findByEmail(email, trimmed)
        alt no registered user (FR-1.19, the Manager&#39;s rule, OQ-109)
            UA-->>IM: none
            IM-->>API: NotFound
            API-->>User: 404 invitation.invitee_not_registered
        else registered
            UA-->>IM: invitee
            IM->>HA: findMembership(householdId, invitee)
            IM->>IA: findPending(householdId, invitee)
            alt already a member
                IM-->>API: Conflict
                API-->>User: 409 invitation.already_member
            else already invited
                IM-->>API: Conflict
                API-->>User: 409 invitation.already_pending
            else neither
                IM->>IA: insert({householdId, invitedUserId, invitedByUserId: actor, role})
                Note over IA: one pending invitation per person per household &mdash; a<br/>simultaneous second invite fails the unique index (OQ-118)
                alt lost a race
                    IA-->>IM: already_pending / invitee_missing
                    IM-->>API: Conflict / NotFound
                    API-->>User: 409 invitation.already_pending / 404 invitee_not_registered
                else inserted
                    IA-->>IM: invitation (pending)
                    IM-->>NE: notify("invitation.received", {userId: invitee}, {invitationId, householdId, inviterUserId, role})
                    Note over NE: routed in-app (OQ-113) &mdash; fire-and-forget,<br/>a failure is logged and the invitation stands
                    NE->>NIA: insert(invitee, "invitation.received", params)
                    IM-->>LOG: log.audit("InviteUser", Invitation invitationId, household)
                    IM-->>API: invitation
                    API-->>User: 201 Created Invitation
                end
            end
        end
    end
""",
    notes="""
    <ul>
      <li><strong>FR-1.19&#39;s "existing user only" rule is the Manager&#39;s (OQ-109):</strong> it looks the email up and answers 404 <code>invitation.invitee_not_registered</code>. The <code>invited_user_id NOT NULL</code> foreign key is the backstop for an account deleted in between (<code>invitee_missing</code>), and a partial unique index allows one pending invitation per person per household, so two simultaneous invites can&#39;t both land (OQ-118).</li>
      <li>The notification is fire-and-forget — the 201 response doesn&#39;t wait on it. <strong><code>NotificationEngine</code> chooses the channel</strong> (in-app for <code>invitation.received</code>, OQ-68); the Manager only says what happened and to whom (OQ-113).</li>
      <li>See FR-1.5, FR-1.19, OQ-26.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-04
UCS.append(dict(
    filename="uc-04-accept-invitation.html",
    title="Accept Household Invitation",
    subtitle='<span class="route">POST /invitations/:invitationId/accept</span> — FR-1.10. Only the invited user can accept; establishes membership with the role specified in the invitation.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant IA as InvitationAccessor
    participant HA as HouseholdAccessor
    participant LOG as LoggingUtility

    User->>API: POST /invitations/:invitationId/accept
    API->>IM: acceptInvitation(actor, invitationId)
    IM->>IA: findById(invitationId)
    alt missing, or not addressed to the caller
        IA-->>IM: none / someone else&#39;s
        IM-->>API: NotFound
        API-->>User: 404 invitation.not_found (the same answer for both, OQ-118)
    else the caller&#39;s invitation
        IA-->>IM: invitation
        IM->>IA: resolve(invitationId, accepted, now)
        Note over IA: guarded &mdash; only while still pending, so a revoke<br/>racing it can&#39;t also win (FR-1.10)
        alt no longer pending (revoked, declined, accepted)
            IA-->>IM: stale
            IM-->>API: Conflict
            API-->>User: 409 invitation.not_pending
        else resolved
            IA-->>IM: resolved
            IM->>HA: addMember(householdId, actor.userId, role)
            Note over IM: resolve first, then join (OQ-118): the other order would<br/>need undoing a membership whenever a revoke raced in
            HA-->>IM: added (already_member is fine)
            IM-->>LOG: log.audit("AcceptInvitation", Invitation invitationId, household)
            IM-->>API: {householdId, role}
            API-->>User: 200 OK {householdId, role}
        end
    end
""",
    notes="""
    <ul>
      <li><code>joined_at</code> is written here, not decoratively — FR-1.18&#39;s succession rule ("longest-tenured Admin, else Member, else Viewer") reads it directly later.</li>
      <li>See FR-1.5, FR-1.10.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-05
UCS.append(dict(
    filename="uc-05-decline-invitation.html",
    title="Decline Household Invitation",
    subtitle='<span class="route">POST /invitations/:invitationId/decline</span> — FR-1.10. No membership is ever created; the invitation is simply resolved.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant IA as InvitationAccessor
    participant LOG as LoggingUtility

    User->>API: POST /invitations/:invitationId/decline
    API->>IM: declineInvitation(actor, invitationId)
    IM->>IA: findById(invitationId)
    alt missing, or not addressed to the caller
        IA-->>IM: none / someone else&#39;s
        IM-->>API: NotFound
        API-->>User: 404 invitation.not_found (the same answer for both, OQ-118)
    else the caller&#39;s invitation
        IA-->>IM: invitation
        IM->>IA: resolve(invitationId, declined, now)
        alt no longer pending
            IA-->>IM: stale
            IM-->>API: Conflict
            API-->>User: 409 invitation.not_pending
        else resolved
            IA-->>IM: resolved
            Note over IM: no membership is ever created
            IM-->>LOG: log.info("Invitation declined") &mdash; not audited (see notes)
            IM-->>API: declined
            API-->>User: 200 OK
        end
    end
""",
    notes="""
    <ul>
      <li>No <code>recordAudit</code> here, deliberately — FR-7.1 scopes the Audit Log to financial/household-<em>data</em> mutations; declining never creates or changes a household resource, only the invitation&#39;s own (non-audited) status.</li>
      <li>See FR-1.10.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-06
UCS.append(dict(
    filename="uc-06-revoke-invitation.html",
    title="Revoke Household Invitation",
    subtitle='<span class="route">DELETE /households/:householdId/invitations/:invitationId</span> — FR-1.10. Owner/Admin cancels a still-pending invitation before the invitee responds.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant IA as InvitationAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId/invitations/:invitationId
    API->>IM: revokeInvitation(actor, householdId, invitationId)
    IM->>AZ: authorize(actor.userId, householdId, members.manage)
    alt not a member
        AZ-->>IM: not_member
        IM-->>API: NotFound
        API-->>User: 404 household.not_found
    else not Owner or Admin
        AZ-->>IM: forbidden
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>IM: allowed
        IM->>IA: findById(invitationId)
        alt missing, or another household&#39;s
            IA-->>IM: none / elsewhere
            IM-->>API: NotFound
            API-->>User: 404 invitation.not_found
        else this household&#39;s
            IA-->>IM: invitation
            IM->>IA: resolve(invitationId, revoked, now)
            alt no longer pending (answered meanwhile)
                IA-->>IM: stale
                IM-->>API: Conflict
                API-->>User: 409 invitation.not_pending
            else resolved
                IA-->>IM: resolved
                IM-->>LOG: log.audit("RevokeInvitation", Invitation invitationId, household)
                IM-->>API: revoked
                API-->>User: 204 No Content
            end
        end
    end
""",
    notes="""
    <ul>
      <li>Distinct actor/authorization path from Decline (FR-1.11&#39;s framing applied to invitations, not membership) — the invitee ends it by declining, the inviter/Admin ends it by revoking, same underlying status transition either way.</li>
      <li>See FR-1.5, FR-1.10.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-07
UCS.append(dict(
    filename="uc-07-remove-member.html",
    title="Remove Member from Household",
    subtitle='<span class="route">DELETE /households/:householdId/members/:userId</span> (actor &ne; userId) — FR-1.11/OQ-27. Owner/Admin removes another member; the Owner can never be removed this way.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant HA as HouseholdAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId/members/:userId
    Note over API: userId &ne; the caller (the caller themself is Leave Household, uc-08)
    API->>IM: removeMember(actor, householdId, userId)
    IM->>AZ: authorize(actor.userId, householdId, members.manage)
    alt not a member
        AZ-->>IM: not_member
        IM-->>API: NotFound
        API-->>User: 404 household.not_found (the household isn&#39;t revealed)
    else member without the role
        AZ-->>IM: forbidden
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>IM: allowed (Owner or Admin)
        IM->>HA: findMembership(householdId, userId)
        alt not a member
            HA-->>IM: none
            IM-->>API: NotFound
            API-->>User: 404 household.member_not_found
        else the Owner
            HA-->>IM: role Owner
            Note over IM: nobody but the Owner ends the Owner&#39;s membership (OQ-111)
            IM-->>API: Forbidden
            API-->>User: 403 auth.forbidden
        else another member
            HA-->>IM: role
            IM->>HA: removeMember(householdId, userId)
            Note over HA: guarded &mdash; never removes an Owner (OQ-107)
            alt stale (made Owner or gone meanwhile)
                HA-->>IM: stale
                IM-->>API: Conflict
                API-->>User: 409 household.changed
            else removed
                HA-->>IM: removed
                IM-->>LOG: log.audit("RemoveMember", User userId, household)
                IM-->>API: removed
                API-->>User: 204 No Content
            end
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Revised (OQ-107):</strong> the Owner-immunity check is a business rule, so it lives in <code>IdentityManager</code>. <code>HouseholdAccessor.removeMember</code> only applies the change, guarded so it never removes the Owner even if a concurrent request made them one.</li>
      <li>Shares its Accessor call with Leave Household (UC-08) — same method, different actor/target relationship (VBD doc &sect;3.1a).</li>
      <li>See FR-1.11, OQ-27.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-08
UCS.append(dict(
    filename="uc-08-leave-household.html",
    title="Leave Household",
    subtitle='<span class="route">DELETE /households/:householdId/members/:userId</span> (userId = the caller) &mdash; FR-1.11/FR-1.18. Self-service, no authorization check. If the leaving member is the Owner, the longest-tenured member takes over first, or the household dissolves when nobody else is left.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant HA as HouseholdAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId/members/:userId (userId = the caller)
    API->>IM: removeMember(actor, householdId, actor.userId)
    Note over IM: self-service &mdash; no permission check. Each attempt decides from<br/>fresh facts, a stale guarded write starts it again, 3 attempts at most (OQ-107)
    loop up to 3 attempts
        IM->>HA: findMembership(householdId, actor.userId)
        alt not a member
            HA-->>IM: none
            IM-->>API: NotFound
            API-->>User: 404 household.not_found
        else a member who is not the Owner
            HA-->>IM: Admin / Member / Viewer
            IM->>HA: removeMember(householdId, actor.userId)
            HA-->>IM: removed (stale &rarr; next attempt)
        else the Owner
            HA-->>IM: Owner
            IM->>HA: findSuccessor(householdId, actor.userId)
            alt nobody else is a member
                HA-->>IM: none
                IM->>HA: dissolve(householdId, actor.userId)
                Note over HA: guarded &mdash; only while nobody else is a member, so someone<br/>who just accepted an invitation isn&#39;t deleted with it (OQ-117)
                HA-->>IM: dissolved (stale &rarr; next attempt)
            else a successor (longest-tenured Admin, then Member, then Viewer)
                HA-->>IM: successor
                IM->>HA: swapOwner(householdId, actor.userId, successor)
                HA-->>IM: swapped (stale &rarr; next attempt)
                IM->>HA: removeMember(householdId, actor.userId)
                HA-->>IM: removed (now an Admin)
            end
        end
    end
    alt still stale after 3 attempts
        IM-->>API: Conflict
        API-->>User: 409 household.changed
    else left or dissolved
        IM-->>LOG: log.audit("LeaveHousehold" or "DissolveHousehold", Household householdId)
        IM-->>API: left
        API-->>User: 204 No Content
    end
""",
    notes="""
    <ul>
      <li><strong><strong>All branches return the same 204, but the decisions are <code>IdentityManager</code>&#39;s (OQ-107):</strong> who succeeds, and whether the household dissolves. <code>HouseholdAccessor</code> applies each step as a guarded write and says <code>stale</code> when the facts changed meanwhile &mdash; the whole decision then runs again from fresh facts, up to three times (<code>households.leaveAttempts</code>), before a 409. <code>dissolve</code> is guarded too (OQ-117): someone who joined a moment ago is never deleted with the household.</li>
      <li>This is the richest of the three "membership ends" flows (Remove Member, Leave, and — via FR-1.17 — Delete User) precisely because it&#39;s the one place FR-1.18&#39;s succession rule is directly, voluntarily triggered rather than a side effect of account deletion.</li>
      <li>See FR-1.11, FR-1.18, OQ-25, OQ-27.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-09
UCS.append(dict(
    filename="uc-09-change-member-role.html",
    title="Change a Member's Role",
    subtitle='<span class="route">PATCH /households/:householdId/members/:userId/role</span> &mdash; FR-1.12. Owner/Admin only; can never assign or remove the Owner role &mdash; that&#39;s Transfer Ownership&#39;s job alone.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant HA as HouseholdAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /households/:householdId/members/:userId/role {role}
    Note over API: role is Admin, Member or Viewer &mdash; Owner is refused here (422),<br/>that&#39;s Transfer Ownership (FR-1.20)
    API->>IM: changeMemberRole(actor, householdId, userId, role)
    IM->>AZ: authorize(actor.userId, householdId, members.manage)
    alt not a member
        AZ-->>IM: not_member
        IM-->>API: NotFound
        API-->>User: 404 household.not_found (the household isn&#39;t revealed)
    else member without the role
        AZ-->>IM: forbidden
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>IM: allowed (Owner or Admin)
        IM->>HA: findMembership(householdId, userId)
        alt not a member
            HA-->>IM: none
            IM-->>API: NotFound
            API-->>User: 404 household.member_not_found
        else the Owner
            HA-->>IM: role Owner
            IM-->>API: Forbidden
            API-->>User: 403 auth.forbidden (never the Owner&#39;s role, OQ-111)
        else another member
            HA-->>IM: role
            IM->>HA: updateRole(householdId, userId, role)
            alt stale (made Owner or gone meanwhile)
                HA-->>IM: stale
                IM-->>API: Conflict
                API-->>User: 409 household.changed
            else updated
                HA-->>IM: updated
                IM-->>LOG: log.audit("ChangeMemberRole", User userId, household)
                IM-->>API: updated
                API-->>User: 200 OK
            end
        end
    end
""",
    notes="""
    <ul>
      <li>The "never Owner" guard is deliberately checked <em>before</em> touching <code>HouseholdAccessor</code> at all in this diagram — it&#39;s a request-shape rejection (this endpoint structurally can&#39;t produce an Owner), distinct from the invariant-at-the-point-of-write pattern used elsewhere (there&#39;s no write attempted to reject here).</li>
      <li>See FR-1.12, FR-1.20.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-10
UCS.append(dict(
    filename="uc-10-transfer-ownership.html",
    title="Transfer Ownership",
    subtitle='<span class="route">POST /households/:householdId/transfer-ownership</span> &mdash; FR-1.20/OQ-28. Owner-only; a single atomic dual-role swap &mdash; the household is never observably left with zero or two Owners.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AZ as AuthorizationUtility
    participant HA as HouseholdAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/transfer-ownership {targetUserId}
    API->>IM: transferOwnership(actor, householdId, targetUserId)
    IM->>AZ: authorize(actor.userId, householdId, household.transferOwnership)
    alt not a member
        AZ-->>IM: not_member
        IM-->>API: NotFound
        API-->>User: 404 household.not_found (the household isn&#39;t revealed)
    else not the Owner
        AZ-->>IM: forbidden
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else allowed
        AZ-->>IM: allowed (Owner)
        opt targetUserId is the caller
            IM-->>API: nothing to do
            API-->>User: 200 OK
        end
        IM->>HA: findMembership(householdId, targetUserId)
        alt not a member
            HA-->>IM: none
            IM-->>API: NotFound
            API-->>User: 404 household.member_not_found
        else a member
            HA-->>IM: role
            IM->>HA: swapOwner(householdId, actor.userId, targetUserId)
            Note over HA: one transaction &mdash; the caller becomes Admin, the target Owner,<br/>never zero or two Owners (OQ-28), guarded (OQ-107)
            alt stale
                HA-->>IM: stale
                IM-->>API: Conflict
                API-->>User: 409 household.changed
            else swapped
                HA-->>IM: swapped
                IM-->>LOG: log.audit("TransferOwnership", User targetUserId, household)
                IM-->>API: transferred
                API-->>User: 200 OK
            end
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Distinct from FR-1.18&#39;s auto-succession</strong> — this is the Owner handing off <em>deliberately</em> while remaining a household member (lands as Admin, not leaving); FR-1.18 only fires when the Owner leaves or is deleted.</li>
      <li>The atomicity guarantee (OQ-28) is a real DB constraint one layer down: a partial unique index on <code>household_memberships (household_id) WHERE role = 'Owner'</code> makes a demote-then-promote sequence structurally unable to land on zero or two Owners, even under concurrent writes.</li>
      <li>See FR-1.20, OQ-28.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-11
UCS.append(dict(
    filename="uc-11-create-user.html",
    title="Create User (Registration)",
    subtitle='<span class="route">POST /auth/register</span> &mdash; FR-1.1/FR-1.15. Every account enrolls TOTP-based MFA and receives recovery codes at registration, before it can be used to log in.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant AN as AuthenticationUtility
    participant LOG as LoggingUtility

    User->>API: POST /auth/register {email, password, firstName, lastName, language?}
    Note over API: validated against the contract (OQ-93): a well-formed email,<br/>names trimmed and non-blank (OQ-116)
    alt request invalid
        API-->>User: 422 validation.failed {details}
    else valid
        API->>IM: register(input)
        alt password shorter than 12 characters
            Note over IM: the Manager&#39;s rule, before any work (BDT plan)
            IM-->>API: ValidationError
            API-->>User: 422 password.too_short {min: 12}
        else long enough
            IM->>AN: enrollMfa(email)
            Note over AN: TOTP secret (encrypted at rest, NFR-SEC-3) + 10<br/>single-use recovery codes, stored only as hashes (FR-1.15, OQ-100)
            AN-->>IM: {secret, encryptedSecret, recoveryCodes[], recoveryCodeHashes[]}
            IM->>AN: hashPassword(password)
            AN-->>IM: passwordHash
            IM->>UA: insert({email, names, language, passwordHash, encryptedMfaSecret, recoveryCodeHashes})
            Note over UA: language = the locale registered in (OQ-161) —<br/>absent → the column default, pt-BR
            Note over UA: one transaction, the unique index on lower(email)<br/>decides a duplicate &mdash; no separate lookup to race (OQ-103)
            alt email already registered
                UA-->>IM: {ok: false, reason: email_taken}
                IM-->>API: Conflict
                API-->>User: 409 user.email_taken
            else created
                UA-->>IM: {ok: true, user}
                Note over UA: mfa_confirmed_at stays null until the first code (OQ-149)
                IM-->>LOG: log.audit("CreateUser", User userId)
                IM->>AN: signEnrollmentToken({userId, email})
                AN-->>IM: enrollmentToken (15-minute JWT, its own audience)
                IM-->>API: {userId, enrollmentToken, totpSecret, otpauthUri, recoveryCodes[]}
                API-->>User: 201 Created {userId, enrollmentToken, totpSecret, otpauthUri (the QR), recoveryCodes[]}
            end
        end
    end
""",
    notes="""
    <ul>
      <li><strong>MFA enrollment is not optional or deferred</strong> — FR-1.15 requires it complete before the account can log in at all, so it happens inline in registration, not as a follow-up step.</li>
      <li><strong>Confirmed by its first code (OQ-149).</strong> The enrollment stays unconfirmed until <code>POST /auth/mfa/enrollment/confirm</code> (UC-11b) receives a code from the app, with the <code>enrollmentToken</code> answered here; that confirmation opens the first session. Signing in before then answers a fresh enrollment instead of a challenge (UC-14), so a user who closed the tab before scanning is never locked out.</li>
      <li><code>otpauthUri</code> carries the issuer and TOTP settings (<code>config/constants.ts</code>), so the web app draws the QR without repeating them.</li>
      <li><strong>The account starts in the language it registered in (OQ-161).</strong> The web app sends the locale it shows; without it the account is pt-BR. Otherwise the app would switch language once the user signs in and their saved preference applies.</li>
      <li>The recovery codes are returned exactly once, at creation — the backend stores only their hashes (<code>mfa_recovery_codes.code_hash</code>), never the plaintext codes themselves after this response.</li>
      <li><strong>Redrawn to the implementation (M1):</strong> the route is <code>POST /auth/register</code> (was shown as <code>POST /users</code>); request shape is checked at the route against the contract, not by a <code>ValidationUtility</code>; a duplicate email is the insert&#39;s typed result, not a prior lookup that two simultaneous registrations could both pass.</li>
      <li>See FR-1.1, FR-1.15, OQ-29 (first_name/last_name resolved during data modeling), OQ-114, OQ-116, OQ-149.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-11b
UCS.append(dict(
    filename="uc-11b-confirm-mfa-enrollment.html",
    title="Confirm MFA Enrollment",
    subtitle='<span class="route">POST /auth/mfa/enrollment/confirm</span> &mdash; FR-1.15/OQ-149. The first authenticator code proves the app was set up: it confirms the enrollment, once, and opens the first session. Follows Create User (UC-11), or a sign-in to an unconfirmed account (UC-14).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant AN as AuthenticationUtility
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    User->>API: POST /auth/mfa/enrollment/confirm {enrollmentToken, mfaCode}
    API->>IM: confirmMfaEnrollment(input, deviceInfo = User-Agent)
    IM->>AN: verifyEnrollmentToken(enrollmentToken)
    AN-->>IM: {userId, email} (or none)
    alt token expired or not valid
        IM-->>API: Unauthorized
        API-->>User: 401 auth.enrollment_expired (sign in again)
    else token valid
        IM->>UA: findLoginLock(emailKey), then findByEmail(email)
        UA-->>IM: lockedUntil, user with encryptedMfaSecret
        Note over IM: locked &rarr; 429 &mdash; user gone or not the one named &rarr; enrollment_expired
        IM->>AN: verifyTotp(encryptedMfaSecret, mfaCode)
        AN-->>IM: valid / invalid
        alt wrong code
            IM->>UA: recordLoginFailure(emailKey, &hellip;) (+ lockLogin at 5)
            IM-->>API: Unauthorized
            API-->>User: 401 auth.mfa_invalid (retry the code)
        else code valid
            IM->>UA: clearLoginFailures(emailKey)
            IM->>UA: confirmMfaEnrollment(userId, now)
            Note over UA: guarded on mfa_confirmed_at IS NULL &mdash;<br/>a token confirms once (OQ-107 pattern)
            alt already confirmed
                UA-->>IM: stale
                IM-->>API: Unauthorized
                API-->>User: 401 auth.enrollment_expired
            else confirmed
                UA-->>IM: confirmed
                IM->>AN: issueOpaqueToken(), signAccessToken({userId, sessionId, systemRole})
                IM->>SA: insert(userId, tokenHash, deviceInfo, expiresAt = now + 30 days, now)
                SA-->>IM: session
                IM-->>LOG: log.audit("ConfirmMfaEnrollment", Session sessionId)
                IM-->>API: {accessToken, refreshToken}
                API-->>User: 200 OK {accessToken, refreshToken}
            end
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Why a confirmation step (OQ-149):</strong> registration answers the secret once; without a live code nothing proves the user&#39;s app holds it, and a wrong scan would only show at the next sign-in &mdash; with no way back in. The first code closes that gap and is also what signs the new user in, so Onboard continues to Household Setup with a session.</li>
      <li><strong>Same protections as sign-in&#39;s second step:</strong> the enrollment token is a stateless JWT with its own audience (it never passes as a challenge or an access token), wrong codes count against the per-address lockout (OQ-114), and success clears it.</li>
      <li><strong>An unconfirmed account can always finish:</strong> the token lasts 15 minutes (<code>config/constants.ts</code>); after that, signing in with the password answers a fresh enrollment (UC-14), replacing the secret and recovery codes no one saw.</li>
      <li>See FR-1.15, OQ-114, OQ-145, OQ-149.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-12
UCS.append(dict(
    filename="uc-12-delete-user.html",
    title="Delete User (GDPR Right-to-Erasure)",
    subtitle='<span class="route">DELETE /users/me</span> &mdash; FR-1.17/FR-1.18/OQ-25. One of the two widest-fan-out flows in the system (the other is Record Transaction&#39;s investment-buy sub-case). Personal data is hard-deleted; shared data is anonymized, not deleted.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant HA as HouseholdAccessor
    participant AA as AccountAccessor
    participant IHA as InvestmentHoldingAccessor
    participant ATA as AccountTransactionAccessor
    participant CTA as CardTransactionAccessor
    participant BA as BudgetAccessor
    participant OA as GoalAccessor
    participant UA as UserAccessor
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /users/me
    API->>IM: deleteUser(actor)
    loop for each household actor belongs to
        Note over IM: same as Leave Household (UC-08) — the Manager decides:<br/>non-Owner → removeMember, Owner → findSuccessor then<br/>swapOwner + removeMember, or delete(householdId) if alone (OQ-107)
        IM->>HA: findMembership / findSuccessor / swapOwner / removeMember / delete
        HA-->>IM: applied
    end
    Note over IM: for every resource actor owns or contributed to,<br/>branch on personal vs. shared (FR-1.17)
    IM->>AA: cascade-delete personal Accounts, null owner_user_id on shared Accounts
    AA-->>IM: done (personal Accounts' own Holdings/balances go with them)
    IM->>IHA: cascade-delete Holdings under deleted personal Accounts
    IHA-->>IM: done (Valuation Snapshots, schedule entries, Goal allocations cascade too)
    IM->>ATA: null actor reference on retained shared Account Transactions
    ATA-->>IM: done
    IM->>CTA: null actor reference on retained shared Card Transactions
    CTA-->>IM: done
    IM->>BA: cascade-delete personal Budgets, null owner_user_id on shared Budgets
    BA-->>IM: done
    IM->>OA: cascade-delete personal Goals, null owner_user_id on shared Goals
    OA-->>IM: done
    IM->>UA: delete(actor)
    Note over UA: credentials, MFA secret/recovery codes — gone (NFR-COMP-4)
    UA-->>IM: deleted
    IM->>SA: deleteAllForUser(actor)
    SA-->>IM: all sessions revoked
    IM-->>LOG: logActivity(correlationId, actor, "DeleteUser")
    IM-->>LOG: recordAudit(actor, "User", actor)
    IM-->>API: deleted
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li><strong>No alt/error branches shown</strong> &mdash; this is intentionally the one flow in this area with no rejection path: a user can always delete their own account, unconditionally (FR-1.17).</li>
      <li><strong>Trigger equivalence:</strong> the personal-vs-shared branch fires identically whether triggered here (full account deletion) or by Leave/Remove Member (household departure alone) &mdash; see the cross-cutting note at the top of <code>docs/architecture/02-data-model.md</code>.</li>
      <li><strong>Confirmed, not a gap:</strong> if a deleted user&#39;s personal Holding was funding a still-live <em>shared</em> Goal, that Goal survives and its progress simply recomputes from whatever Holdings remain &mdash; "the user removed their finances from the household."</li>
      <li><code>audit_log_entries.actor_id</code> is a plain value, not a foreign key &mdash; this row (and every other audit entry naming this actor) survives untouched; there is nothing to rewrite or purge (OQ-25/NFR-AUD-1).</li>
      <li>See FR-1.17, FR-1.18, OQ-25.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-13
UCS.append(dict(
    filename="uc-13-edit-user.html",
    title="Edit User (Profile)",
    subtitle='<span class="route">PATCH /users/me</span> &mdash; profile fields (first/last name) and, since the Oct 2026 review, preferences (theme dark/light/system, language &mdash; FR-1.21); email and password have their own dedicated flows.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /users/me {firstName?, lastName?, preferences?: {theme?, language?}}
    Note over API: validated against the contract (OQ-93): names trimmed and<br/>non-blank, theme and language from their sets, nothing filled in (OQ-116)
    alt request invalid
        API-->>User: 422 validation.failed {details}
    else valid
        API->>IM: editProfile(actor, input)
        alt nothing to change
            IM->>UA: findById(actor.userId)
            UA-->>IM: user
        else some fields sent
            IM->>UA: update(actor.userId, {only the fields sent})
            UA-->>IM: user
            IM-->>LOG: log.audit("EditUser", User actor.userId)
        end
        Note over IM: no user (the account is gone) &rarr; 401 auth.unauthenticated
        IM-->>API: user
        API-->>User: 200 OK User {id, email, firstName, lastName, createdAt, preferences}
    end
""",
    notes="""
    <ul>
      <li>Deliberately the plainest flow in this whole area &mdash; no cross-table effects, no cascades, just a validated field update.</li>
      <li>See FR-1.1/OQ-29.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-14
UCS.append(dict(
    filename="uc-14-login.html",
    title="Login",
    subtitle='<span class="route">POST /auth/login</span> then <span class="route">POST /auth/mfa/verify</span> &mdash; FR-1.2/OQ-30/OQ-114/OQ-145. Two steps: the password earns a five-minute challenge, the MFA code trades it for a session. The password step answers one 401 for every failure; both steps count against the same per-address lockout &mdash; whether or not an account exists.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant AN as AuthenticationUtility
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    Note over User,LOG: Step 1 &mdash; the password
    User->>API: POST /auth/login {email, password}
    API->>IM: login(input)
    IM->>UA: findLoginLock(emailKey)
    Note over UA: emailKey = trimmed, lower-cased email &mdash; login_attempts<br/>is kept per address, not per account (OQ-114)
    UA-->>IM: lockedUntil (or none)
    alt address locked (lockedUntil > now)
        IM-->>API: TooManyRequests {retryAfterSeconds}
        API-->>User: 429 auth.too_many_attempts (Retry-After)
    else not locked
        IM->>UA: findByEmail(email)
        UA-->>IM: user with passwordHash (or none)
        IM->>AN: verifyPassword(passwordHash or a dummy hash, password)
        Note over IM: a missing user still costs one Argon2 check &mdash;<br/>response time doesn&#39;t reveal whether the email exists
        AN-->>IM: valid / invalid
        alt no user or wrong password
            IM->>UA: recordLoginFailure(emailKey, now, windowStart = now &minus; 15 min)
            Note over UA: atomic: failures older than the window are<br/>forgotten, then this one is counted
            UA-->>IM: failuresInWindow
            opt failuresInWindow &ge; 5 (the Manager&#39;s rule)
                IM->>UA: lockLogin(emailKey, until = now + 15 min)
            end
            IM-->>API: Unauthorized
            API-->>User: 401 auth.invalid_credentials (same for both)
        else password valid, MFA enrollment unconfirmed (OQ-149)
            IM->>AN: enrollMfa(email)
            AN-->>IM: {secret, otpauthUri, encryptedSecret, recoveryCodes[], recoveryCodeHashes[]}
            IM->>UA: replaceMfaEnrollment(userId, {encryptedMfaSecret, recoveryCodeHashes})
            Note over UA: guarded on mfa_confirmed_at IS NULL &mdash;<br/>confirmed meanwhile &rarr; stale &rarr; the challenge below
            UA-->>IM: replaced
            IM-->>LOG: log.audit("RestartMfaEnrollment", User userId)
            IM->>AN: signEnrollmentToken({userId, email})
            AN-->>IM: enrollmentToken
            IM-->>API: {step: enroll, enrollmentToken, totpSecret, otpauthUri, recoveryCodes[]}
            API-->>User: 200 OK &mdash; finish the enrollment (UC-11b)
        else password valid
            IM->>AN: signChallengeToken({userId, email})
            Note over AN: five-minute JWT, its own audience &mdash;<br/>never passes as an access token (OQ-145)
            AN-->>IM: challengeToken
            IM-->>API: {step: mfa, challengeToken}
            API-->>User: 200 OK {step: mfa, challengeToken}
        end
    end

    Note over User,LOG: Step 2 &mdash; the MFA code
    User->>API: POST /auth/mfa/verify {challengeToken, mfaCode}
    API->>IM: verifyMfa(input, deviceInfo = User-Agent)
    IM->>AN: verifyChallengeToken(challengeToken)
    AN-->>IM: {userId, email} (or none)
    alt challenge expired or not valid
        IM-->>API: Unauthorized
        API-->>User: 401 auth.challenge_expired (start again)
    else challenge valid
        IM->>UA: findLoginLock(emailKey), then findByEmail(email)
        UA-->>IM: lockedUntil, user with encryptedMfaSecret, systemRole
        Note over IM: locked &rarr; 429 &mdash; user gone or not the one challenged &rarr; challenge_expired
        IM->>AN: verifyTotp(encryptedMfaSecret, mfaCode)
        AN-->>IM: valid / invalid
        alt wrong code
            IM->>UA: recordLoginFailure(emailKey, &hellip;) (+ lockLogin at 5)
            IM-->>API: Unauthorized
            API-->>User: 401 auth.mfa_invalid (retry the code)
        else code valid
            IM->>UA: clearLoginFailures(emailKey)
            IM->>AN: issueOpaqueToken()
            AN-->>IM: {token, tokenHash}
            IM->>SA: insert(userId, tokenHash, deviceInfo, expiresAt = now + 30 days, now)
            Note over SA: stores only the hash (OQ-100)
            SA-->>IM: session
            IM->>AN: signAccessToken({userId, sessionId, systemRole})
            Note over AN: sid tells the device apart (OQ-106), role is the system role (OQ-111)
            AN-->>IM: accessToken (15-minute JWT)
            IM-->>LOG: log.audit("Login", Session sessionId)
            IM-->>API: {accessToken, refreshToken}
            API-->>User: 200 OK {accessToken, refreshToken}
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Two steps (OQ-145).</strong> The single request (password + MFA code together) made a wrong code indistinguishable from a wrong password, so the user had to retype everything. Now the password step answers a five-minute challenge token and the code is retried alone, as in most apps.</li>
      <li><strong>Enumeration guard kept where it matters:</strong> the password step still answers <code>auth.invalid_credentials</code> for an unknown email and a wrong password alike, and a missing user still costs a password check. Step 2 names a wrong code (<code>auth.mfa_invalid</code>) &mdash; its caller already proved the password, so that reveals nothing new.</li>
      <li><strong>Lockout (OQ-114) spans both steps:</strong> 5 failures &mdash; wrong passwords and wrong codes alike &mdash; within 15 minutes lock the <em>address</em> for 15 minutes (<code>config/constants.ts</code>). Only a full sign-in clears the count; a correct password does not, or it could buy endless code guesses. The count lives in <code>login_attempts</code>, keyed by address, so an address with no account locks exactly like one with an account. The Manager decides; <code>UserAccessor</code> applies (atomic count, lock, clear).</li>
      <li><strong>The challenge token is stateless</strong> (a JWT naming the user and address): no table, and reusing it within its five minutes still needs a correct code, under the same lockout.</li>
      <li>The access token is never persisted (OQ-30); only the refresh token is server-tracked in <code>sessions</code>.</li>
      <li><strong>Unconfirmed MFA enrollment (OQ-149):</strong> an account whose first authenticator code never arrived gets no challenge &mdash; the right password answers a fresh enrollment (new secret and recovery codes, replacing the ones no one saw), confirmed through UC-11b. The answer is tagged by <code>step</code> (<code>mfa</code> or <code>enroll</code>). A wrong password is answered as before, so this reveals nothing to someone without it.</li>
      <li>See FR-1.2, FR-1.15, OQ-30, OQ-100, OQ-106, OQ-111, OQ-114, OQ-145, OQ-149.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-14b
UCS.append(dict(
    filename="uc-14b-refresh-tokens.html",
    title="Refresh Tokens",
    subtitle='<span class="route">POST /auth/refresh</span> &mdash; OQ-30/OQ-100/OQ-106. Exchanges a refresh token for a new pair; each refresh token works once. Part of staying signed in after Login (UC-14).',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AN as AuthenticationUtility
    participant SA as SessionAccessor
    participant UA as UserAccessor
    participant LOG as LoggingUtility

    User->>API: POST /auth/refresh {refreshToken}
    API->>IM: refresh(refreshToken)
    IM->>AN: hashOpaqueToken(refreshToken)
    AN-->>IM: presentedHash
    IM->>AN: issueOpaqueToken()
    AN-->>IM: {token, tokenHash}
    IM->>SA: rotate(presentedHash, tokenHash, expiresAt = now + 30 days, now)
    Note over SA: guarded: applies only while presentedHash is the session&#39;s<br/>current, unexpired token, and remembers it as the previous one
    alt rotated
        SA-->>IM: session
        IM->>UA: findById(session.userId)
        UA-->>IM: user (systemRole)
        Note over IM: no user (the account is gone) &rarr; 401 auth.refresh_invalid
        IM->>AN: signAccessToken({userId, sessionId, systemRole})
        AN-->>IM: accessToken
        IM-->>API: {accessToken, refreshToken = token}
        API-->>User: 200 OK
    else stale
        SA-->>IM: stale
        IM->>SA: findByReplacedToken(presentedHash)
        alt it was already used &mdash; a replay, likely a stolen token
            SA-->>IM: {sessionId, userId}
            IM->>SA: deleteForUser(userId, sessionId)
            Note over IM: ends that session only &mdash; the user&#39;s other devices stay signed in
            SA-->>IM: deleted
            IM-->>LOG: log.warn("Refresh token replayed &mdash; session ended")
        else unknown, expired or revoked
            SA-->>IM: none
        end
        IM-->>API: Unauthorized
        API-->>User: 401 auth.refresh_invalid
    end
""",
    notes="""
    <ul>
      <li><strong>Rotation:</strong> every refresh issues a new refresh token (30-day sliding expiry) and consumes the old one, so each works once (OQ-100).</li>
      <li><strong>Replay ends that session only</strong> (stakeholder decision, Oct 2026): whoever holds the old token &mdash; thief or victim &mdash; must sign in again on that device; other devices are untouched, and an attacker replaying an old token can&#39;t sign the user out everywhere.</li>
      <li>The system role comes from the user record at each refresh, so a role change takes effect within one access-token lifetime (OQ-111).</li>
      <li>No access token needed &mdash; this is how a client gets one back after it expires.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-15
UCS.append(dict(
    filename="uc-15-logout.html",
    title="Logout",
    subtitle='<span class="route">POST /auth/logout</span> &mdash; FR-1.9. Terminates the current session only; every other active session/device is unaffected.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    User->>API: POST /auth/logout
    API->>IM: logout(actor, currentSessionId)
    IM->>SA: deleteForUser(actor, currentSessionId)
    Note over SA: invalidates this refresh token only (FR-1.9) &mdash;<br/>the access token simply expires shortly after, unrevoked
    SA-->>IM: revoked
    IM-->>LOG: log.info("Logout")
    IM-->>API: logged out
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li>No <code>recordAudit</code> &mdash; a logout isn&#39;t a financial/household-data mutation (FR-7.1&#39;s scope).</li>
      <li>Idempotent by design: logging out an already-terminated session still returns 204, not an error.</li>
      <li>The frontend always clears its own locally-held token state on logout regardless of the backend mechanism (OQ-30) &mdash; not shown here since it&#39;s client-side, not a backend call.</li>
      <li>See FR-1.9.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-16
UCS.append(dict(
    filename="uc-16-view-sessions.html",
    title="View Active Sessions",
    subtitle='<span class="route">GET /users/me/sessions</span> &mdash; FR-1.3. Read-only; no alt flows.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant SA as SessionAccessor

    User->>API: GET /users/me/sessions
    API->>IM: listSessions(actor)
    IM->>SA: listByUser(actor, now)
    Note over SA: active only, most recently used first
    SA-->>IM: [{id, deviceInfo, createdAt, lastUsedAt}, ...]
    Note over IM: current = (id == the access token's sid) (OQ-106)
    IM-->>API: sessions[]
    API-->>User: 200 OK {data: [{id, deviceInfo, createdAt, lastUsedAt, current}, ...]}
""",
    notes="""
    <ul>
      <li>No <code>LoggingUtility</code> call at all &mdash; a plain read, consistent with <code>InsightsManager</code>&#39;s pattern elsewhere of reads never triggering <code>recordAudit</code> (and this one is so lightweight it skips even <code>logActivity</code>).</li>
      <li>See FR-1.3.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-17
UCS.append(dict(
    filename="uc-17-revoke-session.html",
    title="Revoke a Session",
    subtitle='<span class="route">DELETE /users/me/sessions/:sessionId</span> and, since the Oct 2026 review, <span class="route">DELETE /users/me/sessions</span> (sign out all others) &mdash; FR-1.3. Only the owning user can revoke their own sessions.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /users/me/sessions/:sessionId
    API->>IM: revokeSession(actor, sessionId)
    IM->>SA: deleteForUser(actor, sessionId)
    Note over SA: ownership check and delete in one statement (OQ-106)
    alt not the actor's, or doesn't exist
        SA-->>IM: not deleted
        IM-->>API: NotFound
        API-->>User: 404 session.not_found
    else the actor's
        SA-->>IM: revoked
        IM-->>LOG: log.info("Session revoked", {sessionId})
        IM-->>API: revoked
        API-->>User: 204 No Content
    end

    Note over User,API: Variant &mdash; sign out all other sessions (FR-1.3, OQ-62)
    User->>API: DELETE /users/me/sessions
    API->>IM: revokeOtherSessions(actor, currentSessionId)
    IM->>SA: deleteAllExceptCurrent(actor, currentSessionId)
    Note over SA: same method Change Password (UC-19) already uses
    SA-->>IM: other sessions revoked
    IM-->>LOG: log.info("Other sessions revoked", {ended})
    IM-->>API: revoked
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li><strong>404, not 403, for a session belonging to someone else</strong> &mdash; deliberately doesn&#39;t confirm the session ID exists at all to a non-owner, same enumeration-avoidance instinct as Login&#39;s 401.</li>
      <li>See FR-1.3.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-18
UCS.append(dict(
    filename="uc-18-reset-password.html",
    title="Reset Forgotten Password",
    subtitle='Two-step flow &mdash; <span class="route">POST /auth/password-reset/request</span> then <span class="route">POST /auth/password-reset/confirm</span> &mdash; FR-1.13/OQ-115. The link works once, for 30 minutes; using it ends every session and lifts any login lock.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant NE as NotificationEngine
    participant EA as EmailAccessor
    participant AN as AuthenticationUtility
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    Note over User,API: Step 1 — request a reset token
    User->>API: POST /auth/password-reset/request {email}
    API->>IM: requestPasswordReset(email)
    IM-->>API: accepted (before any lookup)
    API-->>User: 202 Accepted
    Note over IM: the rest runs after the response, so neither the answer<br/>nor its timing reveals whether the email has an account (OQ-115)
    IM->>UA: findByEmail(email)
    opt user exists
        UA-->>IM: found
        IM->>AN: issueOpaqueToken()
        AN-->>IM: {token, tokenHash}
        IM->>UA: storeResetToken(userId, tokenHash, expiresAt = now + 30 min)
        Note over UA: only the hash is stored (OQ-100)
        UA-->>IM: stored
        IM->>NE: notify("password.reset", recipient = {email, language}, params = {resetLink, expiresInMinutes: 30})
        Note over NE: resetLink = WEB_APP_URL + /reset-password?token=&hellip; &mdash;<br/>routed to email, rendered in the recipient&#39;s language (OQ-113)
        NE->>EA: send({to, subject, body})
        Note over EA: only sends &mdash; provider = configuration (EMAIL_PROVIDER),<br/>v1 console, terminal only (OQ-112)
        EA-->>NE: sent
        IM-->>LOG: log.info("Password reset link sent")
    end
    Note over IM: a failure here is logged (log.error), never returned

    Note over User,API: Step 2 — submit token + new password
    User->>API: POST /auth/password-reset/confirm {token, newPassword}
    API->>IM: confirmPasswordReset(token, newPassword)
    alt newPassword shorter than 12 characters
        Note over IM: checked first, so a too-short password<br/>never uses up a valid link (OQ-103)
        IM-->>API: ValidationError
        API-->>User: 422 password.too_short {min: 12}
    else password long enough
    IM->>AN: hashOpaqueToken(token)
    AN-->>IM: tokenHash
    IM->>UA: consumeResetToken(tokenHash, now)
    Note over UA: atomic &mdash; unused and unexpired, then marked used:<br/>the link works exactly once (FR-1.13)
    alt token invalid, expired or already used
        UA-->>IM: not consumed
        IM-->>API: BadRequest
        API-->>User: 400 password_reset.token_invalid
    else token consumed
        UA-->>IM: userId
        IM->>AN: hashPassword(newPassword)
        AN-->>IM: passwordHash
        IM->>UA: updatePasswordHash(userId, passwordHash)
        UA-->>IM: updated
        IM->>SA: deleteAllForUser(userId)
        Note over SA: every active session invalidated (FR-1.13) &mdash;<br/>unlike Change Password, there is no "current session" to spare
        SA-->>IM: all sessions revoked
        IM->>UA: findById(userId), then clearLoginFailures(emailKey)
        Note over UA: resetting proves control of the email,<br/>so any login lock on it is lifted (OQ-115)
        UA-->>IM: cleared
        IM-->>LOG: log.audit("ResetPassword", User userId)
        IM-->>API: reset
        API-->>User: 200 OK
    end
    end
""",
    notes="""
    <ul>
      <li><strong>One use case, two HTTP requests</strong> &mdash; shown as a single diagram since FR-1.13 describes them as one continuous flow, separated by however long the user takes to check their email.</li>
      <li>Step 1 answers 202 <strong>before</strong> looking anything up (OQ-115): the branch runs after the response (<code>opt</code>, not <code>alt</code>), so neither the answer nor how long it took leaks account existence. A failure to send is logged, never returned.</li>
      <li><strong>Email is a channel the Engine chooses</strong>, not one the Manager asks for (OQ-113): the Manager supplies a recipient with an email and language because <code>password.reset</code> is routed to email — the type system rejects a recipient without them.</li>
      <li>Contrast with Change Password (UC-19): a forgotten-password reset can&#39;t spare "the current session" (the user isn&#39;t logged in at all), so every session goes.</li>
      <li>See FR-1.13.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-19
UCS.append(dict(
    filename="uc-19-change-password.html",
    title="Change Password",
    subtitle='<span class="route">POST /auth/change-password</span> &mdash; FR-1.14. Requires re-supplying the current password; invalidates every other active session except the one making the change.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant AN as AuthenticationUtility
    participant UA as UserAccessor
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    User->>API: POST /auth/change-password {currentPassword, newPassword}
    API->>IM: changePassword(actor, input)
    alt newPassword shorter than 12 characters
        Note over IM: checked first &mdash; no secret involved
        IM-->>API: ValidationError
        API-->>User: 422 password.too_short {min: 12}
    else long enough
        IM->>UA: findPasswordHash(actor.userId)
        UA-->>IM: passwordHash
        Note over IM: no hash (the account is gone) &rarr; 401 auth.unauthenticated
        IM->>AN: verifyPassword(passwordHash, currentPassword)
        alt current password incorrect
            AN-->>IM: invalid
            IM-->>API: ValidationError
            API-->>User: 422 password.current_incorrect
            Note over API: not 401 &mdash; the user is signed in and stays so,<br/>a 401 would make the web app sign them out (OQ-115)
        else current password correct
            AN-->>IM: valid
            IM->>AN: hashPassword(newPassword)
            AN-->>IM: newPasswordHash
            IM->>UA: updatePasswordHash(actor.userId, newPasswordHash)
            UA-->>IM: updated
            IM->>SA: deleteAllExceptCurrent(actor.userId, actor.sessionId)
            Note over SA: every other active session invalidated (FR-1.3/1.14)<br/>&mdash; the session making this change survives
            SA-->>IM: other sessions revoked
            IM-->>LOG: log.audit("ChangePassword", User actor.userId)
            IM-->>API: changed
            API-->>User: 200 OK
        end
    end
""",
    notes="""
    <ul>
      <li>Contrast with Reset Password (UC-18): here the user is already authenticated, so the session that submitted the change is deliberately spared &mdash; a forgotten-password reset has no such session to spare.</li>
      <li>See FR-1.14.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-20
UCS.append(dict(
    filename="uc-20-mfa-recovery.html",
    title="Recover MFA via Backup Code",
    subtitle='<span class="route">POST /auth/mfa/recover</span> &mdash; FR-1.16/OQ-145. Login&#39;s second step with a single-use recovery code in place of the MFA code; exhausting/losing all of them falls outside self-service (OQ-24), not modeled here.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant AN as AuthenticationUtility
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    Note over User,LOG: after Login&#39;s password step answered {challengeToken} (UC-14)
    User->>API: POST /auth/mfa/recover {challengeToken, recoveryCode}
    API->>IM: recoverWithCode(input, deviceInfo = User-Agent)
    IM->>AN: verifyChallengeToken(challengeToken)
    AN-->>IM: {userId, email} (or none)
    alt challenge expired or not valid
        IM-->>API: Unauthorized
        API-->>User: 401 auth.challenge_expired (start again)
    else challenge valid
        IM->>UA: findLoginLock(emailKey), then findByEmail(email)
        UA-->>IM: lockedUntil, user
        Note over IM: locked &rarr; 429 &mdash; user gone or not the one challenged &rarr; challenge_expired
        IM->>AN: hashRecoveryCode(recoveryCode)
        AN-->>IM: codeHash
        IM->>UA: consumeRecoveryCode(userId, codeHash, now)
        Note over UA: atomic UPDATE &hellip; WHERE unused &mdash; single-use (FR-1.16),<br/>never reached without a proven password, so no code is wasted
        UA-->>IM: consumed / not
        alt code used or unknown
            IM->>UA: recordLoginFailure(emailKey, &hellip;) (+ lockLogin at 5)
            IM-->>API: Unauthorized
            API-->>User: 401 auth.mfa_invalid (retry the code)
        else code consumed
            IM->>UA: clearLoginFailures(emailKey)
            IM->>AN: issueOpaqueToken()
            AN-->>IM: {token, tokenHash}
            IM->>SA: insert(userId, tokenHash, deviceInfo, expiresAt, now)
            SA-->>IM: session
            IM->>AN: signAccessToken({userId, sessionId, systemRole})
            AN-->>IM: accessToken
            IM-->>LOG: log.audit("MfaRecovery", Session sessionId)
            IM-->>API: {accessToken, refreshToken}
            API-->>User: 200 OK {accessToken, refreshToken}
        end
    end
""",
    notes="""
    <ul>
      <li>Functionally an alternate second factor to Login&#39;s TOTP step, not a separate account-recovery mechanism &mdash; it needs the challenge from Login&#39;s password step, so the password is always proven first.</li>
      <li><strong>Same second step as Login (OQ-145):</strong> the same challenge check, the same lockout (a wrong code counts like a wrong password, OQ-114) and the same <code>auth.mfa_invalid</code> for a used or unknown code &mdash; naming the code is safe once the password is proven.</li>
      <li><strong>v1 scope limit (FR-1.16):</strong> if recovery codes are also exhausted or lost, there is no further self-service path &mdash; a manual/support-assisted process outside this system, not diagrammed since it isn&#39;t a backend flow (OQ-24).</li>
      <li>See FR-1.16, OQ-24, OQ-114, OQ-145.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-21 (Oct 2026)
UCS.append(dict(
    filename="uc-21-list-my-households.html",
    title="List My Households",
    subtitle='<span class="route">GET /households</span> + <span class="route">GET /users/me/invitations</span> (both existed) &mdash; FR-1.8/OQ-60. Feeds the household switcher in the main menu.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant HA as HouseholdAccessor
    participant IA as InvitationAccessor

    User->>API: GET /households
    API->>IM: listMyHouseholds(actor)
    IM->>HA: listForUser(actor)
    HA-->>IM: [{id, name, createdAt, role}, ...]
    IM-->>API: households
    API-->>User: 200 OK
    User->>API: GET /users/me/invitations
    API->>IM: listMyInvitations(actor)
    IM->>IA: listPendingForUser(actor)
    IA-->>IM: [{id, householdId, householdName, role, invitedByUserId, inviterFirstName, inviterLastName, createdAt}, ...]
    IM-->>API: invitations
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>Switching is client-side:</strong> the frontend keeps the active household and sends it with each request; <code>AuthorizationUtility</code> checks membership on every call (NFR-SEC-6).</li>
      <li>Plain reads of Identity&#39;s own entities &rarr; <code>IdentityManager</code> (read-ownership rule). <strong>The names come with the invitation</strong> (OQ-116): the invitee isn&#39;t a member yet, so the frontend couldn&#39;t look up the household or the inviter &mdash; the inviter&#39;s names are null when that account was deleted (shown as &ldquo;Someone&rdquo;, OQ-82). Each household comes with the caller&#39;s role.</li>
      <li>See FR-1.8, FR-1.10, OQ-60, OQ-62.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
