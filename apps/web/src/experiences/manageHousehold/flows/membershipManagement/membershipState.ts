import { household } from '../../../../config/constants';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import { sortMembers } from '../../memberOrder';

// Membership Management Flow's state (FL9, OQ-155): the household's members and
// pending invitations as the Flow last fetched them, the request that is out,
// the open confirm (remove a member, or hand ownership over) and the last
// failure of each panel. The transitions are pure so the Flow's rules test
// without React. A success changes the lists the way the API did, so nothing
// is fetched again — except after `household.changed`, when the Flow reloads.

/** A household role (FR-1.6). */
export type Role = (typeof household.roleOrder)[number];

/** A role an Owner/Admin may give (FR-1.12): never the Owner. */
export type AssignableRole = (typeof household.assignableRoles)[number];

/** One member, as `GET /households/:id/members` lists them. */
export interface HouseholdMember {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly role: Role;
  /** When they joined (ISO 8601). */
  readonly joinedAt: string;
}

/** One pending invitation, as the household's Owner/Admin sees it. */
export interface PendingInvitation {
  readonly id: string;
  /** Who it invites. */
  readonly email: string;
  readonly role: AssignableRole;
  /** When it was sent (ISO 8601). */
  readonly createdAt: string;
}

/** An invitation as `GET /households/:id/invitations` lists it: every status. */
export interface ListedInvitation extends PendingInvitation {
  readonly status: 'pending' | 'accepted' | 'declined' | 'revoked';
}

/** What the Experience answers for the lists: both, or why they failed. */
export type MembershipOutcome = {
  readonly ok: true;
  readonly members: readonly HouseholdMember[];
  /** Empty for a Member or Viewer, who can't list them (403). */
  readonly invitations: readonly ListedInvitation[];
} | { readonly ok: false; readonly error: RequestFailure };

/** The invitation the API created, as `POST /households/:id/invitations` returns it. */
export interface CreatedInvitation {
  readonly id: string;
  readonly role: AssignableRole;
  readonly createdAt: string;
}

/** What the Experience answers for an invite: the invitation, or why it failed. */
export type InviteOutcome = { readonly ok: true; readonly invitation: CreatedInvitation }
  | { readonly ok: false; readonly error: RequestFailure };

/** The panels' content: loading, failed with a retry, or the two lists. */
export type MembershipView = { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: RequestFailure }
  | {
    readonly status: 'loaded';
    readonly members: readonly HouseholdMember[];
    readonly invitations: readonly PendingInvitation[];
  };

/** A request the Flow sends, with what its success changes. */
export type MembershipAction = {
  readonly kind: 'role';
  readonly userId: string;
  readonly role: AssignableRole;
} | { readonly kind: 'remove'; readonly userId: string }
  | { readonly kind: 'transfer'; readonly userId: string }
  | { readonly kind: 'revoke'; readonly invitationId: string }
  | { readonly kind: 'invite'; readonly email: string; readonly role: AssignableRole };

/** The confirm that is open: removing a member, or making them the Owner. */
export interface OpenConfirm {
  readonly kind: 'remove' | 'transfer';
  readonly userId: string;
}

/** The panel a failure shows in. */
export type Panel = 'members' | 'invite' | 'invitations';

/** The Flow's accumulated state. */
export interface MembershipState {
  readonly view: MembershipView;
  /** The request that is out, if any: its control spins and the others wait. */
  readonly out?: MembershipAction | undefined;
  readonly confirm?: OpenConfirm | undefined;
  /** Each panel's last failure. */
  readonly errors: Readonly<Partial<Record<Panel, RequestFailure | undefined>>>;
  /** Goes up after each invite sent, so the invite form starts empty again. */
  readonly inviteForm: number;
}

/** The Flow as it opens: the lists loading, nothing out. */
export const INITIAL_MEMBERSHIP: MembershipState = {
  view: { status: 'loading' },
  out: undefined,
  confirm: undefined,
  errors: {},
  inviteForm: 0,
};

/** The code the API answers when the membership changed under a request (OQ-107). */
export const HOUSEHOLD_CHANGED = 'household.changed';

/** The panel each request's failure shows in. */
const PANELS: Record<MembershipAction['kind'], Panel> = {
  role: 'members',
  remove: 'members',
  transfer: 'members',
  invite: 'invite',
  revoke: 'invitations',
};

/**
 * Keeps the pending invitations, newest first.
 *
 * @param invitations - Every invitation, any status.
 * @returns The pending ones, without their status.
 */
export const pendingOnly = (
  invitations: readonly ListedInvitation[],
): readonly PendingInvitation[] => invitations
  .filter((invitation) => invitation.status === 'pending')
  .map(({
    id, email, role, createdAt,
  }) => ({
    id, email, role, createdAt,
  }))
  .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

/**
 * Tells whether a role manages the household's members (Owner or Admin).
 *
 * @param role - The role, if known.
 * @returns Whether it may invite, change roles and remove.
 */
export const managesMembers = (role: Role | undefined) => (
  (household.managerRoles as readonly string[]).includes(role ?? '')
);

/**
 * Finds the signed-in user's role in the loaded list.
 *
 * @param view - The panels' content.
 * @param selfUserId - The signed-in user's id.
 * @returns Their role, or `undefined` while the list isn't loaded.
 */
export const selfRole = (view: MembershipView, selfUserId: string): Role | undefined => (
  view.status === 'loaded'
    ? view.members.find((member) => member.userId === selfUserId)?.role
    : undefined
);

/**
 * Marks the lists as loading again (a retry, or a reload after the membership
 * changed). Each panel's failure stays, so a `household.changed` is still read.
 *
 * @param state - The current state.
 * @returns The state while the lists are fetched, with no confirm open.
 */
export const loading = (state: MembershipState): MembershipState => ({
  ...state, view: { status: 'loading' }, confirm: undefined,
});

/**
 * Applies the Experience's answer for the lists.
 *
 * @param state - The state while the lists were fetched.
 * @param outcome - The lists, or why they failed.
 * @returns The state with the lists sorted, or the failure and its retry.
 */
export const afterLoad = (
  state: MembershipState,
  outcome: MembershipOutcome,
): MembershipState => ({
  ...state,
  view: outcome.ok
    ? {
      status: 'loaded',
      members: sortMembers(outcome.members),
      invitations: pendingOnly(outcome.invitations),
    }
    : { status: 'failed', error: outcome.error },
});

/**
 * Opens a confirm, dropping the members panel's last failure.
 *
 * @param state - The current state.
 * @param confirm - Which one, about whom.
 * @returns The state with the confirm open.
 */
export const confirmOpened = (
  state: MembershipState,
  confirm: OpenConfirm,
): MembershipState => ({
  ...state, confirm, errors: { ...state.errors, members: undefined },
});

/**
 * Closes the open confirm.
 *
 * @param state - The current state.
 * @returns The state with no confirm open.
 */
export const confirmCancelled = (state: MembershipState): MembershipState => ({
  ...state, confirm: undefined,
});

/**
 * Marks a request as out and drops its panel's last failure.
 *
 * @param state - The current state.
 * @param action - The request.
 * @returns The state while it is out.
 */
export const started = (
  state: MembershipState,
  action: MembershipAction,
): MembershipState => ({
  ...state, out: action, errors: { ...state.errors, [PANELS[action.kind]]: undefined },
});

/**
 * Changes one member's role.
 *
 * @param members - The members.
 * @param userId - Whose role changes.
 * @param role - The new role.
 * @returns The members, re-sorted.
 */
const withRole = (
  members: readonly HouseholdMember[],
  userId: string,
  role: Role,
) => sortMembers(members.map((member) => (
  member.userId === userId ? { ...member, role } : member
)));

/**
 * Hands ownership to a member: they become Owner, the Owner an Admin (FR-1.20).
 *
 * @param members - The members.
 * @param userId - The new Owner.
 * @returns The members, re-sorted.
 */
const withOwner = (members: readonly HouseholdMember[], userId: string) => sortMembers(
  members.map((member) => {
    if (member.userId === userId) return { ...member, role: 'Owner' as const };
    return member.role === 'Owner' ? { ...member, role: 'Admin' as const } : member;
  }),
);

/**
 * Applies a request's success to the loaded lists, as the API did.
 *
 * @param view - The loaded lists.
 * @param action - The request that succeeded.
 * @param created - The invitation an invite created.
 * @returns The lists after it.
 */
const applied = (
  view: Extract<MembershipView, { status: 'loaded' }>,
  action: MembershipAction,
  created?: CreatedInvitation,
): MembershipView => {
  const { members, invitations } = view;
  switch (action.kind) {
    case 'role': return { ...view, members: withRole(members, action.userId, action.role) };
    case 'remove': {
      return { ...view, members: members.filter(({ userId }) => userId !== action.userId) };
    }
    case 'transfer': return { ...view, members: withOwner(members, action.userId) };
    case 'revoke': {
      return { ...view, invitations: invitations.filter(({ id }) => id !== action.invitationId) };
    }
    default: return created
      ? { ...view, invitations: [{ ...created, email: action.email }, ...invitations] }
      : view;
  }
};

/**
 * Applies the Experience's answer for the request that was out. Success
 * changes the lists, closes the confirm and, after an invite, empties the
 * form; a failure keeps everything and shows why in the request's panel.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer (an invite's carries the invitation).
 * @returns The next state.
 */
export const afterAction = (
  state: MembershipState,
  outcome: RequestOutcome | InviteOutcome,
): MembershipState => {
  const { out, view } = state;
  if (!out) return state;
  if (!outcome.ok) {
    return {
      ...state, out: undefined, errors: { ...state.errors, [PANELS[out.kind]]: outcome.error },
    };
  }
  const created = 'invitation' in outcome ? outcome.invitation : undefined;
  return {
    ...state,
    view: view.status === 'loaded' ? applied(view, out, created) : view,
    out: undefined,
    confirm: undefined,
    inviteForm: out.kind === 'invite' ? state.inviteForm + 1 : state.inviteForm,
  };
};

/**
 * Tells whether a failure means the membership changed under the request, so
 * the lists must be fetched again.
 *
 * @param outcome - The Experience's answer.
 * @returns Whether to reload.
 */
export const needsReload = (outcome: RequestOutcome | InviteOutcome) => (
  !outcome.ok && outcome.error.code === HOUSEHOLD_CHANGED
);
