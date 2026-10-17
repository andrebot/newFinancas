import { useEffect, useState, type ReactNode } from 'react';
import { useAlerts } from '../../../../utilities/AlertProvider';
import type { Translator } from '../../../../utilities/i18n';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import { InviteMember, type InviteRequest } from './interactions/InviteMember';
import { MemberList } from './interactions/MemberList';
import { PendingInvitations } from './interactions/PendingInvitations';
import { RemoveMemberConfirm } from './interactions/RemoveMemberConfirm';
import { TransferOwnershipButton, TransferOwnershipConfirm } from './interactions/TransferOwnership';
import { fullName } from '../../../../utilities/personName';
import {
  afterAction, afterLoad, confirmCancelled, confirmOpened, INITIAL_MEMBERSHIP, loading,
  managesMembers, needsReload, selfRole, started,
  type AssignableRole, type HouseholdMember, type InviteOutcome, type MembershipAction,
  type MembershipOutcome, type MembershipState, type MembershipView, type OpenConfirm,
  type Panel,
} from './membershipState';

// Membership Management Flow (FL9, EBD; OQ-155): an Owner/Admin runs the
// household's people, as mockup 60 draws it — the members, whose roles change
// at a pick (FR-1.12) and who are removed behind a confirm (FR-1.11); the
// invite (FR-1.5, FR-1.19); the pending invitations, revoked at once
// (FR-1.10); and, for the Owner, handing ownership to any member (FR-1.20).
// A Member or Viewer sees the members only. It fetches both lists as it
// mounts, owns them, what is out, the open confirm and each panel's last
// failure, and toasts what succeeded. It never calls the backend: each
// request goes up to the Manage Household Experience, which answers an
// outcome. A success changes the lists as the API did; `household.changed`
// fetches them again.

/** What the Flow asks of the Experience. */
export interface MembershipManagementFlowProps {
  /** The signed-in user: their row, their role, what they may do. */
  readonly selfUserId: string;
  /** The Experience's own actions on the user's row: Leave Household. */
  readonly selfActions?: ReactNode;
  /** Lists the members and, for an Owner/Admin, the invitations. */
  readonly onLoad: () => Promise<MembershipOutcome>;
  /** `PATCH /households/:id/members/:userId/role`. */
  readonly onChangeRole: (userId: string, role: AssignableRole) => Promise<RequestOutcome>;
  /** `DELETE /households/:id/members/:userId` (someone else). */
  readonly onRemoveMember: (userId: string) => Promise<RequestOutcome>;
  /** `POST /households/:id/transfer-ownership`. */
  readonly onTransferOwnership: (userId: string) => Promise<RequestOutcome>;
  /** `POST /households/:id/invitations`. */
  readonly onInvite: (invite: InviteRequest) => Promise<InviteOutcome>;
  /** `DELETE /households/:id/invitations/:invitationId`. */
  readonly onRevokeInvitation: (invitationId: string) => Promise<RequestOutcome>;
}

// The server's objections to an invitee, shown under the email field.
const INVITEE_CODES: ReadonlySet<string> = new Set([
  'invitation.invitee_not_registered',
  'invitation.already_member',
  'invitation.already_pending',
]);

/**
 * Splits an invite's failure between the email field and the banner.
 *
 * @param error - The last failure, if any.
 * @param translator - The current locale's translator.
 * @returns The translated message, under the place it shows.
 */
export const placeInviteFailure = (error: RequestFailure | undefined, translator: Translator) => {
  if (!error) return {};
  const message = translator.error(error.code, error.params);
  return INVITEE_CODES.has(error.code) ? { emailError: message } : { alert: message };
};

/**
 * Names whom a request is about: the member's full name, or the invitee's
 * email for a revoke.
 *
 * @param action - The request (not an invite).
 * @param view - The lists as they were when it was sent.
 * @returns The name or email; empty when the list didn't hold them.
 */
const subjectOf = (
  action: Exclude<MembershipAction, { kind: 'invite' }>,
  view: MembershipView,
) => {
  if (view.status !== 'loaded') return '';
  if (action.kind === 'revoke') {
    return view.invitations.find(({ id }) => id === action.invitationId)?.email ?? '';
  }
  const member = view.members.find(({ userId }) => userId === action.userId);
  return member ? fullName(member) : '';
};

/**
 * Says what a request did, for its success toast.
 *
 * @param action - The request that succeeded.
 * @param view - The lists as they were when it was sent.
 * @param translator - The current locale's translator.
 * @returns The toast's text.
 */
export const successText = (
  action: MembershipAction,
  view: MembershipView,
  translator: Translator,
) => {
  if (action.kind === 'invite') {
    return translator.text('membership', 'invite.done', { email: action.email });
  }
  const subject = subjectOf(action, view);
  switch (action.kind) {
    case 'revoke': return translator.text('membership', 'invitations.done', { email: subject });
    case 'role': {
      return translator.text('membership', 'role.done', { name: subject, role: action.role });
    }
    case 'remove': return translator.text('membership', 'remove.done', { name: subject });
    default: return translator.text('membership', 'transfer.done', { name: subject });
  }
};

/**
 * Reads the loaded members, or none while the lists aren't loaded.
 *
 * @param view - The panels' content.
 * @returns The members.
 */
const membersOf = (view: MembershipView) => (view.status === 'loaded' ? view.members : []);

/**
 * Finds the invitation whose revoke is out.
 *
 * @param out - The request that is out, if any.
 * @returns Its id, or `undefined` when no revoke is out.
 */
const revokingIdOf = (out: MembershipAction | undefined) => (
  out?.kind === 'revoke' ? out.invitationId : undefined
);

/** The open confirm's props. */
interface MembershipConfirmProps {
  readonly confirm: OpenConfirm;
  readonly members: readonly HouseholdMember[];
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Renders the open confirm: removing the member, or making them the Owner.
 *
 * @param props - Which confirm, about whom, the busy state and the handlers.
 * @returns The confirm.
 */
function MembershipConfirm({
  confirm, members, busy, onConfirm, onCancel,
}: MembershipConfirmProps) {
  const member = members.find(({ userId }) => userId === confirm.userId);
  const name = member ? fullName(member) : '';
  const Confirm = confirm.kind === 'remove' ? RemoveMemberConfirm : TransferOwnershipConfirm;
  return <Confirm name={name} busy={busy} onConfirm={onConfirm} onCancel={onCancel} />;
}

/** The Owner's transfer button's props. */
interface OwnerTransferProps {
  readonly members: readonly HouseholdMember[];
  readonly selfUserId: string;
  readonly locked: boolean;
  readonly onPick: (userId: string) => void;
}

/**
 * Renders the transfer button on the Owner's row, when there is anyone to
 * hand the household to.
 *
 * @param props - The members, the signed-in user, the lock and the handler.
 * @returns The button, or nothing for anyone but an Owner with company.
 */
function OwnerTransfer({
  members, selfUserId, locked, onPick,
}: OwnerTransferProps) {
  const candidates = members.filter(({ userId }) => userId !== selfUserId);
  const isOwner = members.some(({ userId, role }) => userId === selfUserId && role === 'Owner');
  if (!isOwner || candidates.length === 0) return null;
  return <TransferOwnershipButton candidates={candidates} disabled={locked} onPick={onPick} />;
}

/**
 * Renders the members, invite and pending invitations panels and runs their
 * requests.
 *
 * @param props - The signed-in user, their row's actions and the Experience's requests.
 * @returns The panels.
 */
export function MembershipManagementFlow({
  selfUserId, selfActions, onLoad, onChangeRole, onRemoveMember, onTransferOwnership,
  onInvite, onRevokeInvitation,
}: MembershipManagementFlowProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const [state, setState] = useState<MembershipState>(INITIAL_MEMBERSHIP);
  const { view, out, confirm } = state;
  const role = selfRole(view, selfUserId);
  const locked = out !== undefined;
  const members = membersOf(view);

  /** Fetches the lists again (a retry, or after the membership changed). */
  const reload = async () => {
    setState(loading);
    const outcome = await onLoad();
    setState((current) => afterLoad(current, outcome));
  };

  // The lists are fetched as the Flow mounts. The Experience passes a stable
  // request, so this runs once; an answer after unmounting is dropped.
  useEffect(() => {
    let mounted = true;
    onLoad().then((outcome) => {
      if (mounted) setState((current) => afterLoad(current, outcome));
    });
    return () => {
      mounted = false;
    };
  }, [onLoad]);

  /**
   * Sends a request and applies its outcome: a toast on success, a reload
   * when the membership changed under it.
   *
   * @param action - What is sent.
   * @param request - The Experience's request for it.
   */
  const run = async (
    action: MembershipAction,
    request: () => Promise<RequestOutcome | InviteOutcome>,
  ) => {
    const text = successText(action, view, translator);
    setState((current) => started(current, action));
    const outcome = await request();
    setState((current) => afterAction(current, outcome));
    if (outcome.ok) alerts.success(text);
    if (needsReload(outcome)) await reload();
  };

  /**
   * Changes a member's role, unless they already have it.
   *
   * @param userId - The member.
   * @param picked - The role picked.
   */
  const changeRole = (userId: string, picked: AssignableRole) => {
    if (members.some((member) => member.userId === userId && member.role === picked)) return;
    run({ kind: 'role', userId, role: picked }, () => onChangeRole(userId, picked));
  };

  /**
   * Sends what the open confirm asks: the remove, or the transfer.
   *
   * @param open - The open confirm.
   */
  const confirmed = (open: OpenConfirm) => {
    const request = open.kind === 'remove' ? onRemoveMember : onTransferOwnership;
    run({ kind: open.kind, userId: open.userId }, () => request(open.userId));
  };

  /**
   * Builds the handler that opens a confirm about a member.
   *
   * @param kind - Which confirm.
   * @returns The handler, taking the member's id.
   */
  const opener = (kind: OpenConfirm['kind']) => (userId: string) => {
    setState((current) => confirmOpened(current, { kind, userId }));
  };

  /**
   * Translates a panel's last failure, if it has one.
   *
   * @param panel - The panel.
   * @returns The message, or `undefined`.
   */
  const failure = (panel: Panel) => {
    const error = state.errors[panel];
    return error && translator.error(error.code, error.params);
  };

  return (
    <div className="flex flex-col gap-6">
      <MemberList
        view={view}
        selfUserId={selfUserId}
        canManage={managesMembers(role)}
        locked={locked}
        alert={failure('members')}
        confirm={confirm && {
          userId: confirm.userId,
          element: (
            <MembershipConfirm
              confirm={confirm}
              members={members}
              busy={locked}
              onConfirm={() => confirmed(confirm)}
              onCancel={() => setState(confirmCancelled)}
            />
          ),
        }}
        selfActions={(
          <>
            <OwnerTransfer
              members={members}
              selfUserId={selfUserId}
              locked={locked}
              onPick={opener('transfer')}
            />
            {selfActions}
          </>
        )}
        onRoleChange={changeRole}
        onRemove={opener('remove')}
        onRetry={reload}
      />
      {view.status === 'loaded' && managesMembers(role) && (
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <InviteMember
            key={state.inviteForm}
            busy={out?.kind === 'invite'}
            disabled={locked}
            {...placeInviteFailure(state.errors.invite, translator)}
            onSubmit={(invite) => run({ kind: 'invite', ...invite }, () => onInvite(invite))}
          />
          <PendingInvitations
            invitations={view.invitations}
            revokingId={revokingIdOf(out)}
            locked={locked}
            alert={failure('invitations')}
            onRevoke={(invitationId) => run(
              { kind: 'revoke', invitationId },
              () => onRevokeInvitation(invitationId),
            )}
          />
        </div>
      )}
    </div>
  );
}
