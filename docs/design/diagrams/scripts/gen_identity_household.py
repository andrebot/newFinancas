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
    participant VU as ValidationUtility
    participant HA as HouseholdAccessor
    participant SB as ServiceBusUtility
    participant AM as AccountManager
    participant CA as CategoryAccessor
    participant LOG as LoggingUtility

    User->>API: POST /households {name}
    API->>IM: createHousehold(actor, input)
    IM->>VU: check(name)
    alt name missing/invalid
        VU-->>IM: rejected
        IM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>IM: ok
        IM->>HA: insert(household, ownerId=actor)
        Note over HA: validated write — auto-assigns actor as Owner
        HA-->>IM: householdId
        IM->>SB: publish("household.created", {householdId})
        SB-->>AM: subscribe("household.created")
        AM->>CA: seedDefaults(householdId)
        CA-->>AM: default Categories created
        IM-->>LOG: logActivity(correlationId, actor, "CreateHousehold")
        IM-->>LOG: recordAudit(actor, "Household", householdId)
        IM-->>API: householdId
        API-->>User: 201 Created {householdId}
    end
""",
    notes="""
    <ul>
      <li><strong>No <code>IdentityManager</code> &rarr; <code>AccountManager</code> edge</strong> — the Category-seeding call is entirely on <code>AccountManager</code>&#39;s side of the Service Bus subscription; <code>IdentityManager</code> never learns <code>AccountManager</code> or <code>CategoryAccessor</code> exist (VBD doc &sect;3.1b).</li>
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
    IM->>AZ: canManageMembers(actor, householdId)?
    alt actor is not the Owner
        AZ-->>IM: denied
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else actor is the Owner
        AZ-->>IM: allowed
        IM->>HA: delete(householdId)
        Note over HA: cascading hard delete — every household-scoped<br/>record (accounts, categories, budgets, goals,<br/>holdings, memberships, invitations) goes with it &mdash;<br/>this is dissolution, not a member departing
        HA-->>IM: deleted
        IM-->>LOG: logActivity(correlationId, actor, "DeleteHousehold")
        IM-->>LOG: recordAudit(actor, "Household", householdId)
        IM-->>API: deleted
        API-->>User: 204 No Content
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
    participant IA as InvitationAccessor
    participant ND as NotificationDeliveryUtility
    participant LOG as LoggingUtility

    User->>API: POST /households/:householdId/invitations {email, role}
    API->>IM: inviteUser(actor, householdId, email, role)
    IM->>AZ: canManageMembers(actor, householdId)?
    alt not authorized
        AZ-->>IM: denied
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>IM: allowed
        IM->>IA: insert(householdId, email, role, invitedBy=actor)
        alt no registered user matches email
            IA-->>IM: rejected (FR-1.19)
            IM-->>API: NotFound
            API-->>User: 404 invitation.invitee_not_registered
        else user exists
            IA-->>IM: invitationId (status: pending)
            IM-->>ND: deliver(invitedUserId, type = "invitation.received", params = {invitationId, householdId, inviterUserId, role})
            IM-->>LOG: logActivity(correlationId, actor, "InviteUser")
            IM-->>LOG: recordAudit(actor, "Invitation", invitationId)
            IM-->>API: invitationId
            API-->>User: 201 Created {invitationId, status: "pending"}
        end
    end
""",
    notes="""
    <ul>
      <li><strong>FR-1.19&#39;s "existing user only" rule lives in <code>InvitationAccessor.insert</code>&#39;s validated write</strong> — a real DB constraint per the data model doc (<code>invited_user_id NOT NULL</code>), not application-level filtering before the insert.</li>
      <li>The notification delivery is fire-and-forget — the 201 response doesn&#39;t wait on the email/in-app delivery succeeding.</li>
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
    IM->>IA: accept(invitationId, actor)
    alt actor is not the invited user
        IA-->>IM: rejected
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else invitation not pending (already resolved/revoked)
        IA-->>IM: rejected
        IM-->>API: Conflict
        API-->>User: 409 invitation.not_pending
    else pending and actor matches
        IA-->>IM: status = accepted
        IM->>HA: addMember(householdId, actor, role)
        HA-->>IM: membership created
        IM-->>LOG: logActivity(correlationId, actor, "AcceptInvitation")
        IM-->>LOG: recordAudit(actor, "HouseholdMembership", householdId)
        IM-->>API: {householdId, role}
        API-->>User: 200 OK {householdId, role}
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
    IM->>IA: decline(invitationId, actor)
    alt actor is not the invited user
        IA-->>IM: rejected
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else invitation not pending
        IA-->>IM: rejected
        IM-->>API: Conflict
        API-->>User: 409 invitation.not_pending
    else pending and actor matches
        IA-->>IM: status = declined
        IM-->>LOG: logActivity(correlationId, actor, "DeclineInvitation")
        IM-->>API: declined
        API-->>User: 200 OK {status: "declined"}
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
    IM->>AZ: canManageMembers(actor, householdId)?
    alt not authorized
        AZ-->>IM: denied
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>IM: allowed
        IM->>IA: revoke(invitationId)
        alt invitation not pending
            IA-->>IM: rejected
            IM-->>API: Conflict
            API-->>User: 409 invitation.not_pending
        else pending
            IA-->>IM: status = revoked
            IM-->>LOG: logActivity(correlationId, actor, "RevokeInvitation")
            IM-->>LOG: recordAudit(actor, "Invitation", invitationId)
            IM-->>API: revoked
            API-->>User: 204 No Content
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
    API->>IM: removeMember(actor, householdId, userId)
    IM->>AZ: canManageMembers(actor, householdId)?
    alt not authorized
        AZ-->>IM: denied
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else authorized
        AZ-->>IM: allowed
        IM->>HA: transitionMembership(householdId, userId, actor)
        alt userId is the Owner
            HA-->>IM: rejected (FR-1.11/OQ-27 — Owner can only leave by their own action)
            IM-->>API: Forbidden
            API-->>User: 403 auth.forbidden
        else userId is not the Owner
            HA-->>IM: membership removed
            IM-->>LOG: logActivity(correlationId, actor, "RemoveMember")
            IM-->>LOG: recordAudit(actor, "HouseholdMembership", householdId)
            IM-->>API: removed
            API-->>User: 204 No Content
        end
    end
""",
    notes="""
    <ul>
      <li><strong>The Owner-immunity check lives inside <code>HouseholdAccessor.transitionMembership</code>&#39;s validated write</strong>, not as a pre-check in <code>IdentityManager</code> — same seam as every other invariant enforced at the point of persistence in this project.</li>
      <li>Shares its Accessor call with Leave Household (UC-08) — same method, different actor/target relationship (VBD doc &sect;3.1a).</li>
      <li>See FR-1.11, OQ-27.</li>
    </ul>
""",
))

# ---------------------------------------------------------------- UC-08
UCS.append(dict(
    filename="uc-08-leave-household.html",
    title="Leave Household",
    subtitle='<span class="route">DELETE /households/:householdId/members/me</span> (actor == target) &mdash; FR-1.11/FR-1.18. Self-service, no authorization check needed. If the leaving member is the Owner, auto-succession fires atomically.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant HA as HouseholdAccessor
    participant LOG as LoggingUtility

    User->>API: DELETE /households/:householdId/members/me
    API->>IM: removeMember(actor, householdId, actor)
    Note over IM: actor == target — leaving is always self-service,<br/>the authorization check is skipped entirely (FR-1.11)
    IM->>HA: transitionMembership(householdId, actor, actor)
    alt actor is the Owner AND another member remains
        HA-->>IM: membership removed,<br/>longest-tenured Admin (else Member, else Viewer) promoted to Owner
        Note over HA: one atomic write — FR-1.18&#39;s succession rule,<br/>never observably zero or two Owners (OQ-25)
    else actor is the Owner AND no other member remains
        HA-->>IM: membership removed, household itself deleted (FR-1.18)
    else actor is not the Owner
        HA-->>IM: membership removed
    end
    IM-->>LOG: logActivity(correlationId, actor, "LeaveHousehold")
    IM-->>LOG: recordAudit(actor, "HouseholdMembership", householdId)
    IM-->>API: left
    API-->>User: 204 No Content
""",
    notes="""
    <ul>
      <li><strong>All three branches return the same 204</strong> — the succession/deletion complexity is entirely internal to <code>HouseholdAccessor</code>&#39;s validated write; the caller never needs to know which branch fired.</li>
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
    API->>IM: changeRole(actor, householdId, userId, role)
    IM->>AZ: canManageMembers(actor, householdId)?
    alt not authorized
        AZ-->>IM: denied
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else role requested is Owner
        AZ-->>IM: allowed
        IM-->>API: rejected — use Transfer Ownership instead (FR-1.20)
        API-->>User: 422 validation.failed {details}
    else role is Admin/Member/Viewer
        AZ-->>IM: allowed
        IM->>HA: updateRole(householdId, userId, role)
        HA-->>IM: role updated
        IM-->>LOG: logActivity(correlationId, actor, "ChangeMemberRole")
        IM-->>LOG: recordAudit(actor, "HouseholdMembership", householdId)
        IM-->>API: updated
        API-->>User: 200 OK {userId, role}
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
    IM->>AZ: canManageMembers(actor, householdId)?
    alt actor is not the current Owner
        AZ-->>IM: denied
        IM-->>API: Forbidden
        API-->>User: 403 auth.forbidden
    else targetUserId is not an existing member
        AZ-->>IM: allowed
        IM-->>API: NotFound
        API-->>User: 404 household.member_not_found
    else valid target member
        AZ-->>IM: allowed
        IM->>HA: transferOwnership(householdId, actor, targetUserId)
        Note over HA: atomic dual-role swap — targetUserId becomes Owner,<br/>actor demoted to Admin, one write not two (OQ-28)
        HA-->>IM: transferred
        IM-->>LOG: logActivity(correlationId, actor, "TransferOwnership")
        IM-->>LOG: recordAudit(actor, "HouseholdMembership", householdId)
        IM-->>API: transferred
        API-->>User: 200 OK {newOwnerId: targetUserId}
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
    subtitle='<span class="route">POST /users</span> &mdash; FR-1.1/FR-1.15. Every account enrolls TOTP-based MFA and receives recovery codes at registration, before it can be used to log in.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant VU as ValidationUtility
    participant UA as UserAccessor
    participant AN as AuthenticationUtility
    participant LOG as LoggingUtility

    User->>API: POST /users {email, password, firstName, lastName}
    API->>IM: register(input)
    IM->>VU: check(email, password, firstName, lastName)
    alt password shorter than 12 characters (NFR-SEC-4, OQ-64)
        VU-->>IM: rejected
        IM-->>API: ValidationError
        API-->>User: 422 password.too_short {min: 12}
    else other validation fails (missing fields, malformed email)
        VU-->>IM: rejected
        IM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>IM: ok
        IM->>UA: findByEmail(email)
        alt email already registered
            UA-->>IM: found
            IM-->>API: Conflict
            API-->>User: 409 user.email_taken
        else email available
            UA-->>IM: not found
            IM->>AN: hashPassword(password)
            AN-->>IM: passwordHash
            IM->>AN: enrollMfa(email)
            Note over AN: TOTP secret (encrypted at rest, NFR-SEC-3) + 10<br/>single-use recovery codes, stored only as hashes (FR-1.15, OQ-100)
            AN-->>IM: {totpSecret, encryptedSecret, recoveryCodes[], recoveryCodeHashes[]}
            IM->>UA: insert(user, passwordHash, encryptedSecret, recoveryCodeHashes)
            UA-->>IM: userId
            IM-->>LOG: logActivity(correlationId, userId, "CreateUser")
            IM-->>LOG: recordAudit(userId, "User", userId)
            IM-->>API: {userId, totpSecret, recoveryCodes[]}
            API-->>User: 201 Created {userId, totpSecret (QR-encodable), recoveryCodes[]}
        end
    end
""",
    notes="""
    <ul>
      <li><strong>MFA enrollment is not optional or deferred</strong> — FR-1.15 requires it complete before the account can log in at all, so it happens inline in registration, not as a follow-up step.</li>
      <li>The recovery codes are returned exactly once, at creation — the backend stores only their hashes (<code>mfa_recovery_codes.code_hash</code>), never the plaintext codes themselves after this response.</li>
      <li>See FR-1.1, FR-1.15, OQ-29 (first_name/last_name resolved during data modeling).</li>
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
        IM->>HA: transitionMembership(householdId, actor, actor)
        opt actor is the Owner of this household
            Note over HA: same FR-1.18 succession/dissolution logic<br/>as Leave Household (UC-08) — one atomic write
        end
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
    participant VU as ValidationUtility
    participant UA as UserAccessor
    participant LOG as LoggingUtility

    User->>API: PATCH /users/me {firstName?, lastName?, preferences?: {theme, language}}
    API->>IM: editProfile(actor, input)
    IM->>VU: check(input) &mdash; theme in {dark, light, system}, language in {pt-BR, en-US}
    alt validation fails
        VU-->>IM: rejected
        IM-->>API: ValidationError
        API-->>User: 422 validation.failed {details}
    else valid
        VU-->>IM: ok
        IM->>UA: update(actor, {firstName, lastName, preferences})
        UA-->>IM: updated
        IM-->>LOG: logActivity(correlationId, actor, "EditProfile")
        IM-->>LOG: recordAudit(actor, "User", actor)
        IM-->>API: updated
        API-->>User: 200 OK {firstName, lastName, preferences}
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
    subtitle='<span class="route">POST /auth/login</span> &mdash; FR-1.2/OQ-30. Password and MFA code supplied together in one request; JWT access token is stateless, the refresh token is the server-tracked, revocable record.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant AN as AuthenticationUtility
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    User->>API: POST /auth/login {email, password, mfaCode}
    API->>IM: login(input, deviceInfo)
    IM->>UA: findByEmail(email)
    alt no matching user
        UA-->>IM: not found
        IM-->>API: Unauthorized
        API-->>User: 401 auth.invalid_credentials
    else user found
        UA-->>IM: user record (passwordHash, totpSecret)
        IM->>AN: verifyPassword(passwordHash, password)
        alt password incorrect
            AN-->>IM: invalid
            IM-->>API: Unauthorized
            API-->>User: 401 auth.invalid_credentials
        else password correct
            AN-->>IM: valid
            IM->>AN: verifyTotp(totpSecret, mfaCode)
            alt MFA code incorrect or missing
                AN-->>IM: invalid
                IM-->>API: Unauthorized
                API-->>User: 401 auth.mfa_invalid
            else MFA valid
                AN-->>IM: valid
                IM->>AN: issueOpaqueToken()
                AN-->>IM: {refreshToken, refreshTokenHash}
                IM->>SA: insert(userId, refreshTokenHash, deviceInfo, expiresAt)
                Note over SA: stores only the hash (OQ-100), 30-day sliding expiry
                SA-->>IM: sessionId
                IM->>AN: signAccessToken({userId, sessionId})
                Note over AN: the session ID (sid) tells the current device apart (OQ-106)
                AN-->>IM: accessToken (15-minute JWT)
                IM-->>LOG: logActivity(correlationId, userId, "Login")
                IM-->>LOG: recordAudit(userId, "Session", sessionId)
                IM-->>API: {accessToken, refreshToken}
                API-->>User: 200 OK {accessToken, refreshToken}
            end
        end
    end
""",
    notes="""
    <ul>
      <li><strong>Identical 401 for "no such user" and "wrong password"</strong> &mdash; deliberate, avoids leaking which emails are registered (standard practice, not explicitly an NFR but consistent with this project&#39;s security-conscious defaults elsewhere).</li>
      <li>The access token is never persisted anywhere (OQ-30) &mdash; it simply expires; only the refresh token is server-tracked in <code>sessions</code>, which is what View/Revoke Sessions (UC-16/17) actually operate on.</li>
      <li>See FR-1.2, OQ-30.</li>
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
    IM-->>LOG: logActivity(correlationId, actor, "Logout")
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
    API-->>User: 200 OK [{id, deviceInfo, createdAt, lastUsedAt, current}, ...]
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
        IM-->>LOG: logActivity(correlationId, actor, "RevokeSession")
        IM-->>API: revoked
        API-->>User: 204 No Content
    end

    Note over User,API: Variant &mdash; sign out all other sessions (FR-1.3, OQ-62)
    User->>API: DELETE /users/me/sessions
    API->>IM: revokeOtherSessions(actor, currentSessionId)
    IM->>SA: deleteAllExceptCurrent(actor, currentSessionId)
    Note over SA: same method Change Password (UC-19) already uses
    SA-->>IM: other sessions revoked
    IM-->>LOG: logActivity(correlationId, actor, "RevokeOtherSessions")
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
    subtitle='Two-step flow &mdash; <span class="route">POST /auth/password-reset/request</span> then <span class="route">POST /auth/password-reset/confirm</span> &mdash; FR-1.13. A valid token invalidates every active session, not just the one making the change.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant ND as NotificationDeliveryUtility
    participant AN as AuthenticationUtility
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    Note over User,API: Step 1 — request a reset token
    User->>API: POST /auth/password-reset/request {email}
    API->>IM: requestPasswordReset(email)
    IM->>UA: findByEmail(email)
    opt user exists
        UA-->>IM: found
        IM->>AN: issueOpaqueToken()
        AN-->>IM: {token, tokenHash}
        IM->>UA: storeResetToken(userId, tokenHash, expiresAt)
        Note over UA: only the hash is stored (OQ-100)
        UA-->>IM: stored
        IM-->>ND: deliver(channel = email, to = email, type = "password.reset", params = {resetLink, expiresAt}, language = user.preferences.language)
        Note over ND: email channel inside the Utility (OQ-84) &mdash; template from the<br/>shared i18n catalog, provider set by configuration
    end
    Note over IM: 202 returned either way &mdash; existence of the<br/>email is never revealed either way
    IM-->>API: accepted
    API-->>User: 202 Accepted

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
        IM-->>LOG: logActivity(correlationId, userId, "ResetPassword")
        IM-->>LOG: recordAudit(userId, "User", userId)
        IM-->>API: reset
        API-->>User: 200 OK
    end
    end
""",
    notes="""
    <ul>
      <li><strong>One use case, two HTTP requests</strong> &mdash; shown as a single diagram since FR-1.13 describes them as one continuous flow, separated by however long the user takes to check their email.</li>
      <li>Step 1 always returns 202 regardless of whether the email matched anything &mdash; the branch is entirely internal (<code>opt</code>, not <code>alt</code>), so no observable response difference leaks account existence.</li>
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
    API->>IM: changePassword(actor, currentSessionId, input)
    IM->>AN: verifyPassword(actor.passwordHash, currentPassword)
    alt current password incorrect
        AN-->>IM: invalid
        IM-->>API: Unauthorized
        API-->>User: 401 auth.invalid_credentials
    else newPassword shorter than 12 characters
        AN-->>IM: valid
        IM-->>API: ValidationError
        API-->>User: 422 password.too_short {min: 12}
    else current password correct
        AN-->>IM: valid
        IM->>AN: hashPassword(newPassword)
        AN-->>IM: newPasswordHash
        IM->>UA: updatePasswordHash(actor, newPasswordHash)
        UA-->>IM: updated
        IM->>SA: deleteAllExceptCurrent(actor, currentSessionId)
        Note over SA: every other active session invalidated (FR-1.3/1.14)<br/>&mdash; the session making this change survives
        SA-->>IM: other sessions revoked
        IM-->>LOG: logActivity(correlationId, actor, "ChangePassword")
        IM-->>LOG: recordAudit(actor, "User", actor)
        IM-->>API: changed
        API-->>User: 200 OK
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
    subtitle='<span class="route">POST /auth/mfa/recover</span> &mdash; FR-1.16. Each recovery code is single-use; exhausting/losing all of them falls outside self-service (OQ-24), not modeled here.',
    mermaid="""
sequenceDiagram
""" + P_CORE + """
    participant UA as UserAccessor
    participant AN as AuthenticationUtility
    participant SA as SessionAccessor
    participant LOG as LoggingUtility

    User->>API: POST /auth/mfa/recover {email, password, recoveryCode}
    API->>IM: recoverMfa(input, deviceInfo)
    IM->>UA: findByEmail(email)
    alt no matching user or password incorrect
        UA-->>IM: invalid
        IM-->>API: Unauthorized
        API-->>User: 401 auth.invalid_credentials
    else user + password valid
        UA-->>IM: userId
        IM->>AN: hashRecoveryCode(recoveryCode)
        AN-->>IM: codeHash
        IM->>UA: consumeRecoveryCode(userId, codeHash)
        Note over UA: atomic UPDATE &hellip; SET used_at WHERE code_hash = ?<br/>AND used_at IS NULL &mdash; single-use, can never be replayed (FR-1.16)
        alt code invalid, unknown, or already used
            UA-->>IM: not consumed
            IM-->>API: Unauthorized
            API-->>User: 401 auth.recovery_code_invalid
        else code valid and unused
            UA-->>IM: consumed
            IM->>AN: issueOpaqueToken()
            AN-->>IM: {refreshToken, refreshTokenHash}
            IM->>SA: insert(userId, refreshTokenHash, deviceInfo, expiresAt)
            SA-->>IM: sessionId
            IM->>AN: signAccessToken({userId, sessionId})
            AN-->>IM: accessToken
            IM-->>LOG: logActivity(correlationId, userId, "MfaRecovery")
            IM-->>LOG: recordAudit(userId, "Session", sessionId)
            IM-->>API: {accessToken, refreshToken}
            API-->>User: 200 OK {accessToken, refreshToken}
        end
    end
""",
    notes="""
    <ul>
      <li>Functionally an alternate second factor to Login&#39;s TOTP step, not a separate account-recovery mechanism &mdash; it still requires the correct password first, same as normal login.</li>
      <li><strong>v1 scope limit (FR-1.16):</strong> if recovery codes are also exhausted or lost, there is no further self-service path &mdash; a manual/support-assisted process outside this system, not diagrammed since it isn&#39;t a backend flow (OQ-24).</li>
      <li>See FR-1.16, OQ-24.</li>
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
    HA-->>IM: [{householdId, name, role, memberCount}, ...]
    IM-->>API: households
    API-->>User: 200 OK
    User->>API: GET /users/me/invitations
    API->>IM: listMyInvitations(actor)
    IM->>IA: listPendingForUser(actor)
    IA-->>IM: [{invitationId, householdId, householdName, inviterUserId, role, sentAt}, ...]
    IM-->>API: invitations
    API-->>User: 200 OK
""",
    notes="""
    <ul>
      <li><strong>Switching is client-side:</strong> the frontend keeps the active household and sends it with each request; <code>AuthorizationUtility</code> checks membership on every call (NFR-SEC-6).</li>
      <li>Plain reads of Identity&#39;s own entities &rarr; <code>IdentityManager</code> (read-ownership rule). <code>inviterUserId</code> is resolved for display by the frontend (OQ-82 pattern).</li>
      <li>See FR-1.8, FR-1.10, OQ-60, OQ-62.</li>
    </ul>
""",
))

for uc in UCS:
    page(uc["filename"], uc["title"], uc["subtitle"], uc["mermaid"], uc["notes"])

print(f"Generated {len(UCS)} files in {OUT_DIR}")
