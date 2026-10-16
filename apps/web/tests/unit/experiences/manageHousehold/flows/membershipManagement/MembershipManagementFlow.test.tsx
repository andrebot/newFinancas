import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { InviteMemberProps } from '../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/InviteMember';
import type { MemberListProps } from '../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/MemberList';
import type { PendingInvitationsProps } from '../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/PendingInvitations';
import type { RemoveMemberConfirmProps } from '../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/RemoveMemberConfirm';
import type {
  TransferOwnershipButtonProps, TransferOwnershipConfirmProps,
} from '../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/TransferOwnership';
import {
  MembershipManagementFlow, placeInviteFailure, successText, type MembershipManagementFlowProps,
} from '../../../../../../src/experiences/manageHousehold/flows/membershipManagement/MembershipManagementFlow';
import type {
  HouseholdMember, InviteOutcome, MembershipOutcome,
} from '../../../../../../src/experiences/manageHousehold/flows/membershipManagement/membershipState';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import { createTranslator } from '../../../../../../src/utilities/i18n';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interactions beneath mocked): each Interaction is a
// stub that shows what it was given and emits from plain buttons. The
// Experience is represented by stub requests; the toast queue and the
// translator are the real Utilities.

vi.mock('../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/MemberList', () => ({
  /**
   * Member List's stand-in: the status, the members and roles, and the Flow's slots.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  MemberList: ({
    view, canManage, locked, alert, confirm, selfActions, onRoleChange, onRemove, onRetry,
  }: MemberListProps) => (
    <div
      data-testid="members"
      data-status={view.status}
      data-members={view.status === 'loaded'
        ? view.members.map(({ userId, role }) => `${userId}:${role}`).join('|') : ''}
      data-can-manage={String(canManage)}
      data-locked={String(locked)}
      data-alert={alert ?? ''}
      data-confirm-for={confirm?.userId ?? ''}
    >
      {confirm?.element}
      {selfActions}
      <button type="button" onClick={() => onRoleChange('sam', 'Admin')}>sam to admin</button>
      <button type="button" onClick={() => onRoleChange('sam', 'Member')}>sam stays member</button>
      <button type="button" onClick={() => onRemove('sam')}>remove sam</button>
      <button type="button" onClick={() => onRemove('ghost')}>remove ghost</button>
      <button type="button" onClick={onRetry}>retry</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/RemoveMemberConfirm', () => ({
  /**
   * The remove confirm's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  RemoveMemberConfirm: ({
    name, busy, onConfirm, onCancel,
  }: RemoveMemberConfirmProps) => (
    <div data-testid="remove" data-name={name} data-busy={String(busy)}>
      <button type="button" onClick={onConfirm}>confirm remove</button>
      <button type="button" onClick={onCancel}>cancel remove</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/TransferOwnership', () => ({
  /**
   * The transfer button's stand-in: the candidates, and a pick of Sam.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  TransferOwnershipButton: ({ candidates, disabled, onPick }: TransferOwnershipButtonProps) => (
    <button
      type="button"
      data-testid="transfer"
      data-candidates={candidates.map(({ userId }) => userId).join('|')}
      disabled={disabled}
      onClick={() => onPick('sam')}
    >
      pick sam
    </button>
  ),
  /**
   * The transfer confirm's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  TransferOwnershipConfirm: ({
    name, busy, onConfirm, onCancel,
  }: TransferOwnershipConfirmProps) => (
    <div data-testid="transfer-confirm" data-name={name} data-busy={String(busy)}>
      <button type="button" onClick={onConfirm}>confirm transfer</button>
      <button type="button" onClick={onCancel}>cancel transfer</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/InviteMember', () => ({
  /**
   * Invite Member's stand-in: an uncontrolled draft shows a remount.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  InviteMember: ({
    busy, disabled, emailError, alert, onSubmit,
  }: InviteMemberProps) => (
    <div
      data-testid="invite"
      data-busy={String(busy)}
      data-disabled={String(disabled)}
      data-email-error={emailError ?? ''}
      data-alert={alert ?? ''}
    >
      <input aria-label="draft" />
      <button type="button" onClick={() => onSubmit({ email: 'lee@example.com', role: 'Viewer' })}>
        invite
      </button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/PendingInvitations', () => ({
  /**
   * Pending Invitations' stand-in: the ids and the revoke state.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  PendingInvitations: ({
    invitations, revokingId, locked, alert, onRevoke,
  }: PendingInvitationsProps) => (
    <div
      data-testid="invitations"
      data-ids={invitations.map(({ id }) => id).join('|')}
      data-revoking={revokingId ?? ''}
      data-locked={String(locked)}
      data-alert={alert ?? ''}
    >
      <button type="button" onClick={() => onRevoke('morgan')}>revoke morgan</button>
    </div>
  ),
}));

/**
 * Builds a member.
 *
 * @param userId - Their id.
 * @param firstName - Their first name.
 * @param role - Their role.
 * @returns The member.
 */
const member = (
  userId: string,
  firstName: string,
  role: HouseholdMember['role'],
): HouseholdMember => ({
  userId,
  firstName,
  lastName: 'Doe',
  email: `${userId}@example.com`,
  role,
  joinedAt: '2025-01-01T00:00:00Z',
});

const MEMBERS = [
  member('sam', 'Sam', 'Member'), member('jane', 'Jane', 'Owner'), member('alex', 'Alex', 'Admin'),
];
const LOADED: MembershipOutcome = {
  ok: true,
  members: MEMBERS,
  invitations: [{
    id: 'morgan',
    email: 'morgan@example.com',
    role: 'Member',
    createdAt: '2026-10-12T00:00:00Z',
    status: 'pending',
  }],
};
const OK: RequestOutcome = { ok: true };
const INVITED: InviteOutcome = {
  ok: true, invitation: { id: 'lee', role: 'Viewer', createdAt: '2026-10-15T00:00:00Z' },
};
const UNAVAILABLE = { ok: false, error: { code: 'network.unavailable' } } as const;
const CHANGED = { ok: false, error: { code: 'household.changed' } } as const;
const CONNECT = "Couldn't connect. Check your connection and try again.";

/** A request whose answer the test gives when it wants. */
interface Pending<T> {
  readonly request: () => Promise<T>;
  readonly answer: (value: T) => Promise<void>;
}

/**
 * Builds a request that waits until the test answers it.
 *
 * @returns The request and its answer.
 */
const pending = <T,>(): Pending<T> => {
  let resolve: (value: T) => void = () => {};
  return {
    request: vi.fn(() => new Promise<T>((settle) => {
      resolve = settle;
    })),
    answer: async (value) => {
      await act(async () => resolve(value));
    },
  };
};

/**
 * Renders the Flow inside a real toast queue, signed in as Jane (the Owner)
 * by default, with stub requests that answer at once.
 *
 * @param props - The props and requests to override.
 * @returns The requests, the queue and the render result.
 */
const renderFlow = async (props: Partial<MembershipManagementFlowProps> = {}) => {
  const requests: MembershipManagementFlowProps = {
    selfUserId: 'jane',
    onLoad: vi.fn(async () => LOADED),
    onChangeRole: vi.fn(async () => OK),
    onRemoveMember: vi.fn(async () => OK),
    onTransferOwnership: vi.fn(async () => OK),
    onInvite: vi.fn(async () => INVITED),
    onRevokeInvitation: vi.fn(async () => OK),
    ...props,
  };
  const queue: AlertQueue = createAlertQueue(3);
  let view: ReturnType<typeof renderInLocale> | undefined;
  await act(async () => {
    view = renderInLocale(
      <AlertProvider queue={queue}><MembershipManagementFlow {...requests} /></AlertProvider>,
    );
  });
  return { requests, queue, view: view! };
};

const membersPanel = () => screen.getByTestId('members');
const invitePanel = () => screen.getByTestId('invite');
const invitationsPanel = () => screen.getByTestId('invitations');
const toasts = (queue: AlertQueue) => queue.visible().map(({ message }) => message);

/**
 * Clicks a stub's button and lets the outcome land.
 *
 * @param name - The button's name.
 */
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

describe('MembershipManagementFlow — loading', () => {
  it('fetches as it mounts and lists the Owner first, with the manager panels', async () => {
    const load = pending<MembershipOutcome>();
    await renderFlow({ onLoad: load.request });
    expect(membersPanel().dataset.status).toBe('loading');
    expect(screen.queryByTestId('invite')).toBeNull();

    await load.answer(LOADED);
    expect(membersPanel().dataset).toMatchObject({
      status: 'loaded',
      members: 'jane:Owner|alex:Admin|sam:Member',
      canManage: 'true',
      locked: 'false',
    });
    expect(invitationsPanel().dataset.ids).toBe('morgan');
  });

  it('shows a Member the members only, with no transfer', async () => {
    await renderFlow({ selfUserId: 'sam', selfActions: <span>leave</span> });
    expect(membersPanel().dataset).toMatchObject({ canManage: 'false' });
    expect(screen.queryByTestId('invite')).toBeNull();
    expect(screen.queryByTestId('invitations')).toBeNull();
    expect(screen.queryByTestId('transfer')).toBeNull();
    expect(screen.getByText('leave')).toBeTruthy();
  });

  it('retries a failed load', async () => {
    const onLoad = vi.fn<() => Promise<MembershipOutcome>>()
      .mockResolvedValueOnce(UNAVAILABLE)
      .mockResolvedValueOnce(LOADED);
    await renderFlow({ onLoad });
    expect(membersPanel().dataset.status).toBe('failed');

    await click('retry');
    expect(onLoad).toHaveBeenCalledTimes(2);
    expect(membersPanel().dataset.status).toBe('loaded');
  });

  it('drops an answer that lands after unmounting', async () => {
    const load = pending<MembershipOutcome>();
    const { view } = await renderFlow({ onLoad: load.request });
    view.unmount();
    await load.answer(LOADED);
    expect(screen.queryByTestId('members')).toBeNull();
  });
});

describe('MembershipManagementFlow — roles and removal', () => {
  it('changes a role, toasting it, and skips a pick of the same role', async () => {
    const { requests, queue } = await renderFlow();
    await click('sam stays member');
    expect(requests.onChangeRole).not.toHaveBeenCalled();

    await click('sam to admin');
    expect(requests.onChangeRole).toHaveBeenCalledWith('sam', 'Admin');
    expect(membersPanel().dataset.members).toBe('jane:Owner|alex:Admin|sam:Admin');
    expect(toasts(queue)).toEqual(['Sam Doe is now an Admin.']);
  });

  it('locks every control while a request is out; its failure shows in the panel', async () => {
    const change = pending<RequestOutcome>();
    await renderFlow({ onChangeRole: change.request });
    await click('sam to admin');
    expect(membersPanel().dataset.locked).toBe('true');
    expect(invitePanel().dataset.disabled).toBe('true');
    expect(invitationsPanel().dataset.locked).toBe('true');

    await change.answer(UNAVAILABLE);
    expect(membersPanel().dataset).toMatchObject({
      locked: 'false', alert: CONNECT, members: 'jane:Owner|alex:Admin|sam:Member',
    });
  });

  it('removes a member behind the confirm', async () => {
    const remove = pending<RequestOutcome>();
    const { requests, queue } = await renderFlow({ onRemoveMember: remove.request });
    await click('remove sam');
    expect(screen.getByTestId('remove').dataset).toMatchObject({ name: 'Sam Doe', busy: 'false' });
    expect(requests.onRemoveMember).not.toHaveBeenCalled();

    await click('confirm remove');
    expect(screen.getByTestId('remove').dataset.busy).toBe('true');
    await remove.answer(OK);
    expect(remove.request).toHaveBeenCalledWith('sam');
    expect(screen.queryByTestId('remove')).toBeNull();
    expect(membersPanel().dataset.members).toBe('jane:Owner|alex:Admin');
    expect(toasts(queue)).toEqual(['Sam Doe was removed from the household.']);
  });

  it('names nobody in the confirm for someone no longer listed', async () => {
    await renderFlow();
    await click('remove ghost');
    expect(screen.getByTestId('remove').dataset.name).toBe('');
  });

  it('closes the remove confirm on cancel', async () => {
    await renderFlow();
    await click('remove sam');
    await click('cancel remove');
    expect(screen.queryByTestId('remove')).toBeNull();
  });
});

describe('MembershipManagementFlow — ownership', () => {
  it('lets the Owner hand the household to any other member, behind the confirm', async () => {
    const { requests, queue } = await renderFlow();
    expect(screen.getByTestId('transfer').dataset.candidates).toBe('alex|sam');

    await click('pick sam');
    expect(screen.getByTestId('transfer-confirm').dataset.name).toBe('Sam Doe');
    await click('confirm transfer');

    expect(requests.onTransferOwnership).toHaveBeenCalledWith('sam');
    expect(membersPanel().dataset).toMatchObject({
      members: 'sam:Owner|jane:Admin|alex:Admin',
    });
    expect(screen.queryByTestId('transfer')).toBeNull();
    expect(toasts(queue)).toEqual(['Sam Doe is now the Owner. You are an Admin.']);
  });

  it('closes the transfer confirm on cancel', async () => {
    await renderFlow();
    await click('pick sam');
    await click('cancel transfer');
    expect(screen.queryByTestId('transfer-confirm')).toBeNull();
  });

  it('offers no transfer to an Admin, nor to an Owner alone', async () => {
    const { view } = await renderFlow({ selfUserId: 'alex' });
    expect(screen.queryByTestId('transfer')).toBeNull();
    view.unmount();

    const alone: MembershipOutcome = { ok: true, members: [MEMBERS[1]!], invitations: [] };
    await renderFlow({ onLoad: async () => alone });
    expect(screen.queryByTestId('transfer')).toBeNull();
  });
});

describe('MembershipManagementFlow — invitations', () => {
  it('sends an invite: the invitation listed first, the form emptied, a toast', async () => {
    const invite = pending<InviteOutcome>();
    const { queue } = await renderFlow({ onInvite: invite.request });
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'typed' } });
    await click('invite');
    expect(invitePanel().dataset.busy).toBe('true');

    await invite.answer(INVITED);
    expect(invite.request).toHaveBeenCalledWith({ email: 'lee@example.com', role: 'Viewer' });
    expect(invitationsPanel().dataset.ids).toBe('lee|morgan');
    expect(screen.getByLabelText<HTMLInputElement>('draft').value).toBe('');
    expect(toasts(queue)).toEqual(['Invitation sent to lee@example.com.']);
  });

  it('places an objection to the invitee under the field and keeps the draft', async () => {
    await renderFlow({
      onInvite: async () => ({ ok: false, error: { code: 'invitation.invitee_not_registered' } }),
    });
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'typed' } });
    await click('invite');
    expect(invitePanel().dataset).toMatchObject({
      emailError: 'No registered user has this email.', alert: '', busy: 'false',
    });
    expect(screen.getByLabelText<HTMLInputElement>('draft').value).toBe('typed');
  });

  it('revokes an invitation at once, toasting it, and shows a failure in its panel', async () => {
    const onRevokeInvitation = vi.fn<(id: string) => Promise<RequestOutcome>>()
      .mockResolvedValueOnce(UNAVAILABLE)
      .mockResolvedValueOnce(OK);
    const { queue } = await renderFlow({ onRevokeInvitation });
    await click('revoke morgan');
    expect(invitationsPanel().dataset).toMatchObject({
      alert: CONNECT, ids: 'morgan', revoking: '',
    });

    await click('revoke morgan');
    expect(onRevokeInvitation).toHaveBeenCalledWith('morgan');
    expect(invitationsPanel().dataset).toMatchObject({ alert: '', ids: '' });
    expect(toasts(queue)).toEqual(['Invitation to morgan@example.com revoked.']);
  });

  it('marks the revoke that is out', async () => {
    const revoke = pending<RequestOutcome>();
    await renderFlow({ onRevokeInvitation: revoke.request });
    await click('revoke morgan');
    expect(invitationsPanel().dataset.revoking).toBe('morgan');
    await revoke.answer(OK);
  });
});

describe('MembershipManagementFlow — the membership changed', () => {
  it('shows why and fetches the lists again', async () => {
    const onLoad = vi.fn<() => Promise<MembershipOutcome>>()
      .mockResolvedValueOnce(LOADED)
      .mockResolvedValueOnce({ ...LOADED, members: MEMBERS.slice(1) });
    await renderFlow({ onLoad, onRemoveMember: async () => CHANGED });
    await click('remove sam');
    await click('confirm remove');

    expect(onLoad).toHaveBeenCalledTimes(2);
    expect(membersPanel().dataset).toMatchObject({
      members: 'jane:Owner|alex:Admin',
      alert: 'The members of this household changed while you were editing. Please try again.',
    });
    expect(screen.queryByTestId('remove')).toBeNull();
  });
});

describe('MembershipManagementFlow — helpers', () => {
  const translator = createTranslator('en-US');

  it('places an invite failure: invitee codes under the field, the rest in the banner', () => {
    expect(placeInviteFailure(undefined, translator)).toEqual({});
    expect(placeInviteFailure({ code: 'invitation.already_pending' }, translator))
      .toEqual({ emailError: 'User has a pending invitation.' });
    expect(placeInviteFailure({ code: 'invitation.already_member' }, translator))
      .toEqual({ emailError: 'User is already a member.' });
    expect(placeInviteFailure({ code: 'network.unavailable' }, translator))
      .toEqual({ alert: CONNECT });
  });

  it('names nobody in a toast when the lists were not loaded or held no match', () => {
    expect(successText({ kind: 'remove', userId: 'sam' }, { status: 'loading' }, translator))
      .toBe(' was removed from the household.');
    const empty = { status: 'loaded', members: [], invitations: [] } as const;
    expect(successText({ kind: 'transfer', userId: 'x' }, empty, translator))
      .toBe(' is now the Owner. You are an Admin.');
    expect(successText({ kind: 'revoke', invitationId: 'x' }, empty, translator))
      .toBe('Invitation to  revoked.');
  });
});
