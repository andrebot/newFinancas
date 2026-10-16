import type { Locale } from '@financas/i18n';
import type { User, UserPreferences } from '@financas/api-types';
import { useCallback, useState } from 'react';
import { sessionEnded } from '../../api/baseQuery';
import { failureOf, toRequestOutcome } from '../../api/outcome';
import { profile as profileSettings, theme as themeSettings } from '../../config/constants';
import { Avatar, avatarTone } from '../../kit/avatar/Avatar';
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
import type { ThemePreference } from '../../utilities/theme';
import { useGetCurrentUserQuery, useHouseholds } from '../../api/identityApi';
import {
  useChangePasswordMutation,
  useDeleteCurrentUserMutation,
  useEditCurrentUserMutation,
  useLazyListSessionsQuery,
  useListMyInvitationsQuery,
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
} from './api';
import { DeleteAccountFlow } from './flows/deleteAccount/DeleteAccountFlow';
import { SecurityFlow, type SecurityFlowProps } from './flows/security/SecurityFlow';
import type { SessionsOutcome } from './flows/security/securityState';
import { EditPersonalInfo, type PersonalInfo } from './interactions/EditPersonalInfo';
import { EditPreferences } from './interactions/EditPreferences';
import { RespondToInvitation, type Answering } from './interactions/RespondToInvitation';
import { respondToInvitation, type InvitationAnswer } from './respondToInvitation';

// Manage Profile Experience (X3, EBD; OQ-159): look after my own account. It
// hosts the Security and Delete Account Flows and the standalone Edit Personal
// Info, Edit Preferences and Respond to Invitation, as mockup 70 lays them out,
// and is the only tier here that calls the backend. The user comes from the
// same cache the App Shell's drawer reads, so a saved edit shows there too; a
// picked theme or language applies at once through the shell. The households
// are Manage Household's list: the header names the user's role in the active
// one, and Delete Account lists those they own. A deleted account ends the
// session, and the shell's guard opens Sign In.

/** A panel's props: the signed-in user. */
export interface UserPanelProps {
  readonly user: User;
}

/**
 * Builds the Security Flow's requests. Loading the sessions is stable, so the
 * Flow fetches them once as it mounts.
 *
 * @returns The Flow's four requests.
 */
const useSecurityRequests = (): SecurityFlowProps => {
  const [listSessions] = useLazyListSessionsQuery();
  const [revokeSession] = useRevokeSessionMutation();
  const [revokeOtherSessions] = useRevokeOtherSessionsMutation();
  const [changePassword] = useChangePasswordMutation();

  const onLoadSessions = useCallback(async (): Promise<SessionsOutcome> => {
    const result = await listSessions();
    if (result.isSuccess) return { ok: true, sessions: result.data };
    // An awaited trigger has settled, so a result that isn't a success failed.
    return { ok: false, error: failureOf(result.error as Parameters<typeof failureOf>[0]) };
  }, [listSessions]);

  return {
    onLoadSessions,
    onRevokeSession: async (sessionId) => toRequestOutcome(await revokeSession(sessionId)),
    onRevokeOthers: async () => toRequestOutcome(await revokeOtherSessions()),
    onChangePassword: async (change) => toRequestOutcome(await changePassword(change)),
  };
};

/** The header's props. */
interface ProfileHeaderProps extends UserPanelProps {
  readonly households: readonly ShellHousehold[];
}

/**
 * Renders the page header: the avatar, the name, the email and the user's
 * role in the active household.
 *
 * @param props - The user and their households.
 * @returns The header.
 */
function ProfileHeader({ user, households }: ProfileHeaderProps) {
  const translator = useI18n();
  const activeId = useAppSelector(selectActiveHouseholdId);
  const active = households.find((household) => household.id === activeId);
  const description = active
    ? translator.text('profile', 'header.description', {
      email: user.email,
      role: translator.text('membership', `role.${active.role}`),
      household: active.name,
    })
    : user.email;
  return (
    <PageHeader
      eyebrow={translator.text('profile', 'header.eyebrow')}
      title={`${user.firstName} ${user.lastName}`}
      description={description}
      leading={(
        <Avatar
          size="lg"
          firstName={user.firstName}
          lastName={user.lastName}
          tone={avatarTone(user.id, true)}
        />
      )}
    />
  );
}

/**
 * Saves the user's names and toasts a done save; a failure shows in the panel.
 *
 * @param props - The signed-in user.
 * @returns Edit Personal Info, keyed on the saved names.
 */
function PersonalInfoPanel({ user }: UserPanelProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const [editUser, { isLoading }] = useEditCurrentUserMutation();
  const [failure, setFailure] = useState<RequestFailure>();

  /**
   * Sends the names.
   *
   * @param info - The names, trimmed.
   */
  const save = async (info: PersonalInfo) => {
    setFailure(undefined);
    const result = await editUser(info);
    if (result.error === undefined) {
      alerts.success(translator.text('profile', 'personal.saved'));
      return;
    }
    setFailure(failureOf(result.error));
  };

  return (
    <EditPersonalInfo
      key={`${user.firstName}\n${user.lastName}`}
      saved={{ firstName: user.firstName, lastName: user.lastName }}
      email={user.email}
      busy={isLoading}
      alert={failure && translator.error(failure.code, failure.params)}
      onSave={save}
    />
  );
}

/**
 * Applies and saves each picked preference; one the API refuses is undone and
 * toasted.
 *
 * @param props - The signed-in user.
 * @returns Edit Preferences.
 */
function PreferencesPanel({ user }: UserPanelProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const [editUser] = useEditCurrentUserMutation();

  /**
   * Sends one preference.
   *
   * @param preferences - The picked preference.
   */
  const save = async (preferences: UserPreferences) => {
    const result = await editUser({ preferences });
    if (result.error !== undefined) {
      alerts.error(translator.text('profile', 'preferences.failed'));
    }
  };

  return (
    <EditPreferences
      theme={user.preferences.theme ?? themeSettings.defaultPreference}
      language={user.preferences.language ?? translator.locale}
      onTheme={(theme: ThemePreference) => save({ theme })}
      onLanguage={(language: Locale) => save({ language })}
    />
  );
}

/**
 * Lists the invitations waiting for an answer and sends the user's; nothing
 * shows when none is waiting.
 *
 * @returns Respond to Invitation, or nothing.
 */
function InvitationsPanel() {
  const translator = useI18n();
  const alerts = useAlerts();
  const dispatch = useAppDispatch();
  const invitations = useListMyInvitationsQuery().data ?? [];
  const [answering, setAnswering] = useState<Answering>();

  /**
   * Sends an answer; the list is fetched again once it is in.
   *
   * @param invitationId - The invitation.
   * @param picked - What the user answers.
   */
  const answer = async (invitationId: string, picked: InvitationAnswer) => {
    setAnswering({ invitationId, answer: picked });
    await dispatch(respondToInvitation(invitationId, picked, { alerts, translator }));
    setAnswering(undefined);
  };

  if (invitations.length === 0) return null;
  return <RespondToInvitation invitations={invitations} answering={answering} onAnswer={answer} />;
}

/** The danger zone's props. */
interface DeleteAccountPanelProps extends UserPanelProps {
  readonly households: readonly ShellHousehold[];
}

/**
 * Deletes the account, then ends the session; the shell's guard takes the
 * user to Sign In.
 *
 * @param props - The user and their households.
 * @returns The Delete Account Flow.
 */
function DeleteAccountPanel({ user, households }: DeleteAccountPanelProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const dispatch = useAppDispatch();
  const [deleteUser] = useDeleteCurrentUserMutation();
  const owned = households
    .filter((household) => household.role === 'Owner')
    .map((household) => household.name);

  /**
   * Sends the deletion and, once done, signs the user out.
   *
   * @returns The Flow's outcome.
   */
  const remove = async () => {
    const result = await deleteUser();
    if (result.error === undefined) {
      alerts.success(translator.text('profile', 'deleted'));
      dispatch(sessionEnded());
    }
    return toRequestOutcome(result);
  };

  return <DeleteAccountFlow email={user.email} ownedHouseholds={owned} onDelete={remove} />;
}

/** The page's props: the user, and whether Delete Account is offered. */
interface ProfilePageProps extends UserPanelProps {
  readonly deleteAccount: boolean;
}

/**
 * Lays out the profile for a loaded user, as mockup 70 does.
 *
 * @param props - The signed-in user, and whether Delete Account is offered.
 * @returns The page's sections.
 */
function ProfilePage({ user, deleteAccount }: ProfilePageProps) {
  const households = useHouseholds();
  const security = useSecurityRequests();
  const list = households.status === 'ready' ? households.data : [];
  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader user={user} households={list} />
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <PersonalInfoPanel user={user} />
        <PreferencesPanel user={user} />
      </div>
      <SecurityFlow {...security} />
      <InvitationsPanel />
      {deleteAccount && <DeleteAccountPanel user={user} households={list} />}
    </div>
  );
}

/** The Experience's configuration. */
export interface ManageProfileExperienceProps {
  /** Offer Delete Account; off until its endpoint exists (`profile.deleteAccount`). */
  readonly deleteAccount?: boolean;
}

/**
 * Renders the profile once the user loads: a skeleton until then, a retry if
 * the load fails.
 *
 * @param props - The Experience's configuration.
 * @returns The page.
 */
export function ManageProfileExperience({
  deleteAccount = profileSettings.deleteAccount,
}: ManageProfileExperienceProps = {}) {
  const translator = useI18n();
  const { data: user, isError, refetch } = useGetCurrentUserQuery();

  if (user) {
    return <ProfilePage user={user} deleteAccount={deleteAccount} />;
  }
  if (isError) {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('profile', 'failed')}
        action={(
          <Button onClick={() => refetch()}>
            {translator.text('profile', 'retry')}
          </Button>
        )}
      />
    );
  }
  return <SkeletonRows label={translator.text('profile', 'loading')} />;
}
