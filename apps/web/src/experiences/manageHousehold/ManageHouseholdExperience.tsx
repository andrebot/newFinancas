import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { failureOf, toRequestOutcome, type EndpointResult } from '../../api/outcome';
import { shell } from '../../config/constants';
import { Button } from '../../kit/button/Button';
import { EmptyState } from '../../kit/emptyState/EmptyState';
import { PageHeader } from '../../kit/pageHeader/PageHeader';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import type { ShellHousehold } from '../../shell/shellConfig';
import { selectActiveHouseholdId } from '../../shell/shellState';
import { useAppDispatch, useAppSelector } from '../../store';
import { useAlerts } from '../../utilities/AlertProvider';
import { useI18n } from '../../utilities/I18nProvider';
import type { RequestFailure } from '../../utilities/requestOutcome';
import { useGetCurrentUserQuery } from '../manageProfile/api';
import {
  useChangeMemberRoleMutation,
  useCreateInvitationMutation,
  useDeleteHouseholdMutation,
  useHouseholds,
  useLazyListHouseholdInvitationsQuery,
  useLazyListMembersQuery,
  useLeaveHouseholdMutation,
  useListMembersQuery,
  useRemoveMemberMutation,
  useRevokeInvitationMutation,
  useTransferOwnershipMutation,
} from './api';
import { HouseholdDeletionFlow } from './flows/householdDeletion/HouseholdDeletionFlow';
import {
  MembershipManagementFlow, type MembershipManagementFlowProps,
} from './flows/membershipManagement/MembershipManagementFlow';
import type {
  HouseholdMember, ListedInvitation, MembershipOutcome,
} from './flows/membershipManagement/membershipState';
import { moveOnFrom } from './householdExit';
import { leaveConsequence } from './interactions/leaveConsequence';
import { LeaveHousehold } from './interactions/LeaveHousehold';

// Manage Household Experience (X4, EBD; OQ-160): run the active household, as
// mockup 60 lays it out — the header, the Membership Management Flow, then
// Leave Household (its own card, OQ-160) and, for the Owner only, the
// Household Deletion Flow. It is the only tier here that calls the backend.
// The page is keyed on the household, so a switch starts it afresh. Once the
// user has left or deleted the household, a toast says so and the App Shell
// switches to the next household's Dashboard, or Onboard when none is left.

/** What a request to the members' endpoints needs. */
interface HouseholdPanelProps {
  readonly household: ShellHousehold;
}

/** Leave Household's props: the household, the user and the way out. */
interface LeavePanelProps extends HouseholdPanelProps {
  readonly userId: string;
  /** The household is gone: toasts the text, then moves the user on. */
  readonly onGone: (toast: string) => Promise<void>;
}

/** Moves the user on from a household gone, after toasting the text. */
type HouseholdExit = (goneId: string, toast: string) => Promise<void>;

// A Member or Viewer can't list the invitations (403); they have none to see.
const FORBIDDEN = 'auth.forbidden';

/**
 * Reads the invitations' answer for the Flow's load.
 *
 * @param result - What the invitations' trigger resolved to.
 * @returns The invitations (none when forbidden), or the failure.
 */
export const invitationsOf = (
  result: EndpointResult<readonly ListedInvitation[]>,
): readonly ListedInvitation[] | RequestFailure => {
  if (result.error === undefined) return result.data;
  const failure = failureOf(result.error);
  return failure.code === FORBIDDEN ? [] : failure;
};

/**
 * Builds the Membership Management Flow's requests for one household. The
 * load is stable, so the Flow fetches once as it mounts.
 *
 * @param householdId - The household.
 * @returns The Flow's six requests.
 */
const useMembershipRequests = (
  householdId: string,
): Omit<MembershipManagementFlowProps, 'selfUserId' | 'selfActions'> => {
  const [loadMembers] = useLazyListMembersQuery();
  const [loadInvitations] = useLazyListHouseholdInvitationsQuery();
  const [changeRole] = useChangeMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [transferOwnership] = useTransferOwnershipMutation();
  const [createInvitation] = useCreateInvitationMutation();
  const [revokeInvitation] = useRevokeInvitationMutation();

  const onLoad = useCallback(async (): Promise<MembershipOutcome> => {
    // An awaited trigger has settled: its result holds the data or the error.
    const [members, invitations] = await Promise.all([
      loadMembers(householdId) as Promise<EndpointResult<readonly HouseholdMember[]>>,
      loadInvitations(householdId) as Promise<EndpointResult<readonly ListedInvitation[]>>,
    ]);
    if (members.error !== undefined) return { ok: false, error: failureOf(members.error) };
    const listed = invitationsOf(invitations);
    if ('code' in listed) return { ok: false, error: listed };
    return { ok: true, members: members.data, invitations: listed };
  }, [householdId, loadMembers, loadInvitations]);

  return {
    onLoad,
    onChangeRole: async (userId, role) => toRequestOutcome(
      await changeRole({ householdId, userId, role }),
    ),
    onRemoveMember: async (userId) => toRequestOutcome(await removeMember({ householdId, userId })),
    onTransferOwnership: async (userId) => toRequestOutcome(
      await transferOwnership({ householdId, userId }),
    ),
    onInvite: async (invite) => {
      const result = await createInvitation({ householdId, ...invite });
      if (result.error !== undefined) return { ok: false, error: failureOf(result.error) };
      const { id, role, createdAt } = result.data;
      return { ok: true, invitation: { id, role, createdAt } };
    },
    onRevokeInvitation: async (invitationId) => toRequestOutcome(
      await revokeInvitation({ householdId, invitationId }),
    ),
  };
};

/**
 * Renders the page header: the household's name and how many members it has.
 *
 * @param props - The household.
 * @returns The header.
 */
function HouseholdHeader({ household }: HouseholdPanelProps) {
  const translator = useI18n();
  const members = useListMembersQuery(household.id).data;
  return (
    <PageHeader
      eyebrow={translator.text('household', 'header.eyebrow')}
      title={household.name}
      description={members && translator.text('household', 'header.description', {
        count: members.length,
      })}
    />
  );
}

/**
 * Leaves the household once the user confirms; a failure shows in the card.
 * It shows once the members are known, since what leaving does depends on them.
 *
 * @param props - The household, the user and the way out.
 * @returns Leave Household, or nothing while the members load.
 */
function LeavePanel({ household, userId, onGone }: LeavePanelProps) {
  const translator = useI18n();
  const members = useListMembersQuery(household.id).data;
  const [leaveHousehold] = useLeaveHouseholdMutation();
  const [leaving, setLeaving] = useState(false);
  const [failure, setFailure] = useState<RequestFailure>();

  /** Sends the leave; once done, the user moves on. */
  const leave = async () => {
    setLeaving(true);
    setFailure(undefined);
    const result = await leaveHousehold({ householdId: household.id, userId });
    if (result.error === undefined) {
      await onGone(translator.text('household', 'leave.done', { householdName: household.name }));
      return;
    }
    setLeaving(false);
    setFailure(failureOf(result.error));
  };

  if (!members) return null;
  return (
    <LeaveHousehold
      householdName={household.name}
      consequence={leaveConsequence(members, userId)}
      busy={leaving}
      alert={failure && translator.error(failure.code, failure.params)}
      onLeave={leave}
    />
  );
}

/**
 * Deletes the household for its Owner; once done, the user moves on.
 *
 * @param props - The household and the way out.
 * @returns The Household Deletion Flow.
 */
function DeletionPanel({ household, onGone }: Omit<LeavePanelProps, 'userId'>) {
  const translator = useI18n();
  const [deleteHousehold] = useDeleteHouseholdMutation();

  /**
   * Sends the deletion.
   *
   * @returns The Flow's outcome.
   */
  const remove = async () => {
    const result = await deleteHousehold(household.id);
    if (result.error === undefined) {
      await onGone(translator.text('household', 'deleted', { householdName: household.name }));
    }
    return toRequestOutcome(result);
  };

  return <HouseholdDeletionFlow householdName={household.name} onDelete={remove} />;
}

/**
 * Lays out the household page, as mockup 60 does.
 *
 * @param props - The household, the user and the way out of a household gone.
 * @returns The page's sections.
 */
function HouseholdPage({
  household, userId, onExit,
}: Omit<LeavePanelProps, 'onGone'> & { readonly onExit: HouseholdExit }) {
  const requests = useMembershipRequests(household.id);
  const onGone = (toast: string) => onExit(household.id, toast);
  return (
    <div className="flex flex-col gap-6">
      <HouseholdHeader household={household} />
      <MembershipManagementFlow selfUserId={userId} {...requests} />
      <LeavePanel household={household} userId={userId} onGone={onGone} />
      {household.role === 'Owner' && <DeletionPanel household={household} onGone={onGone} />}
    </div>
  );
}

/**
 * Builds the way out of a household the user no longer belongs to: the
 * toast, then the next household's Dashboard, or Onboard. It lives here, not
 * in the keyed page, which unmounts as the shell switches households.
 *
 * @returns The handler.
 */
const useHouseholdExit = (): HouseholdExit => {
  const alerts = useAlerts();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  return async (goneId, toast) => {
    alerts.success(toast);
    const destination = await dispatch(moveOnFrom(goneId));
    navigate(shell.paths[destination]);
  };
};

/**
 * Renders the active household's page once the user and the household are
 * known: a skeleton until then, a retry if the user can't be loaded.
 *
 * @returns The page.
 */
export function ManageHouseholdExperience() {
  const translator = useI18n();
  const { data: user, isError, refetch } = useGetCurrentUserQuery();
  const households = useHouseholds();
  const activeId = useAppSelector(selectActiveHouseholdId);
  const onExit = useHouseholdExit();
  const household = households.status === 'ready'
    ? households.data.find(({ id }) => id === activeId)
    : undefined;

  if (user && household) {
    return (
      <HouseholdPage key={household.id} household={household} userId={user.id} onExit={onExit} />
    );
  }
  if (isError) {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('household', 'failed')}
        action={<Button onClick={() => refetch()}>{translator.text('household', 'retry')}</Button>}
      />
    );
  }
  return <SkeletonRows label={translator.text('household', 'loading')} />;
}
