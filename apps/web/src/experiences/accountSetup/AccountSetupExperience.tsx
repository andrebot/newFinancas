import { useCallback, useState } from 'react';
import type { Account } from '@financas/api-types';
import { toDataOutcome, toRequestOutcome, type EndpointResult } from '../../api/outcome';
import { useGetCurrentUserQuery, useHouseholds } from '../../api/identityApi';
import { Button } from '../../kit/button/Button';
import { EmptyState } from '../../kit/emptyState/EmptyState';
import { PageHeader } from '../../kit/pageHeader/PageHeader';
import { SegmentedControl } from '../../kit/segmentedControl/SegmentedControl';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import type { ShellHousehold } from '../../shell/shellConfig';
import { selectActiveHouseholdId } from '../../shell/shellState';
import { useAppSelector } from '../../store';
import { useI18n } from '../../utilities/I18nProvider';
import {
  useArchiveAccountMutation, useCreateAccountMutation, useEditAccountMutation,
  useLazyListAccountsQuery,
} from './api';
import {
  AccountManagementFlow, type AccountManagementFlowProps,
} from './flows/accountManagement/AccountManagementFlow';

// The Account Setup Experience (X5, EBD; OQ-175): the household's setup page,
// as mockup 40 lays it out — a header with its tabs and, under the Accounts
// tab, the Account & Card Management Flow. Categories, Budgets and Goals take
// their own flows in FL12–FL14; until then they show an empty state. It is
// the only tier here that calls the backend: it answers the Flow's requests
// with outcomes and keeps nothing of its own but the open tab. The page is
// keyed on the household, so a switch starts it afresh.

/** The tabs between the setup sections (mockup 40). */
type SetupTab = 'accounts' | 'categories' | 'budgets' | 'goals';

const TABS: readonly SetupTab[] = ['accounts', 'categories', 'budgets', 'goals'];

/** What a request to the accounts' endpoints needs. */
interface AccountPanelProps {
  readonly household: ShellHousehold;
}

/**
 * Builds the Account Management Flow's requests for one household. The load
 * is stable, so the Flow fetches once as it mounts.
 *
 * @param householdId - The household.
 * @returns The Flow's four requests.
 */
const useAccountRequests = (
  householdId: string,
): Omit<AccountManagementFlowProps, 'selfUserId' | 'role'> => {
  const [loadAccounts] = useLazyListAccountsQuery();
  const [createAccount] = useCreateAccountMutation();
  const [editAccount] = useEditAccountMutation();
  const [archiveAccount] = useArchiveAccountMutation();

  /** Lists the household's accounts, archived included. */
  const onLoad = useCallback(async () => (
    // An awaited trigger has settled: its result holds the data or the error.
    toDataOutcome(await (
      loadAccounts(householdId) as Promise<EndpointResult<readonly Account[]>>
    ))
  ), [householdId, loadAccounts]);

  return {
    onLoad,
    onCreate: async (account) => toDataOutcome(await createAccount({
      householdId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      visibility: account.visibility,
      ...(account.openingBalance === null ? {} : { openingBalance: account.openingBalance }),
      cards: account.cards,
    })),
    onEdit: async (edit) => toDataOutcome(await editAccount({
      householdId,
      accountId: edit.accountId,
      name: edit.name,
      ...(edit.visibility === undefined ? {} : { visibility: edit.visibility }),
      ...(edit.cards === undefined ? {} : { cards: edit.cards }),
    })),
    onArchive: async (accountId) => toRequestOutcome(
      await archiveAccount({ householdId, accountId }),
    ),
  };
};

/** The setup page's props. */
interface SetupPageProps extends AccountPanelProps {
  /** The signed-in user's id. */
  readonly userId: string;
}

/**
 * Renders the active household's setup page: its header with the tabs and,
 * under each tab, that section's flow (an empty state until it is built).
 *
 * @param props - The household and the signed-in user.
 * @returns The page.
 */
function SetupPage({ household, userId }: SetupPageProps) {
  const translator = useI18n();
  const [tab, setTab] = useState<SetupTab>('accounts');
  const requests = useAccountRequests(household.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={translator.text('accountSetup', 'eyebrow')}
        title={household.name}
        description={translator.text('accountSetup', 'description')}
        tabs={(
          <SegmentedControl
            label={translator.text('accountSetup', 'tabs.label')}
            options={TABS.map((value) => ({
              value, label: translator.text('accountSetup', `tab.${value}`),
            }))}
            value={tab}
            onChange={setTab}
          />
        )}
      />
      {tab === 'accounts' ? (
        <AccountManagementFlow
          key={household.id}
          selfUserId={userId}
          role={household.role}
          {...requests}
        />
      ) : (
        <EmptyState
          icon="info-outline"
          title={translator.text('accountSetup', `tab.${tab}.soon`)}
        />
      )}
    </div>
  );
}

/**
 * Renders the active household's setup page once the user and the household
 * are known: a skeleton until then, a retry if the user can't be loaded.
 *
 * @returns The page.
 */
// eslint-disable-next-line import-x/prefer-default-export
export function AccountSetupExperience() {
  const translator = useI18n();
  const { data: user, isError, refetch } = useGetCurrentUserQuery();
  const households = useHouseholds();
  const activeId = useAppSelector(selectActiveHouseholdId);
  const household = households.status === 'ready'
    ? households.data.find(({ id }) => id === activeId)
    : undefined;

  if (user && household) {
    return <SetupPage key={household.id} household={household} userId={user.id} />;
  }
  if (isError) {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('accountSetup', 'failed')}
        action={(
          <Button onClick={() => refetch()}>
            {translator.text('accountSetup', 'retry')}
          </Button>
        )}
      />
    );
  }
  return <SkeletonRows label={translator.text('accountSetup', 'loading')} />;
}
