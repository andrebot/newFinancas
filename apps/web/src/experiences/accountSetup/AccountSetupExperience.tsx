import { useCallback, useState } from 'react';
import type { SerializedError } from '@reduxjs/toolkit';
import type { Account, Category } from '@financas/api-types';
import type { ApiError } from '../../api/errors';
import {
  failureOf, toDataOutcome, toRequestOutcome, type EndpointResult,
} from '../../api/outcome';
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
import type { RequestOutcome } from '../../utilities/requestOutcome';
import {
  useArchiveAccountMutation, useCreateAccountMutation, useEditAccountMutation,
  useLazyListAccountsQuery, useListCategoriesQuery, useCreateCategoryMutation,
  useEditCategoryMutation, useArchiveCategoryMutation, useArchiveSubcategoryMutation,
} from './api';
import {
  AccountManagementFlow, type AccountManagementFlowProps,
} from './flows/accountManagement/AccountManagementFlow';
import {
  CategoryManagementFlow, type CategoryManagementFlowProps,
} from './flows/categoryManagement/CategoryManagementFlow';
import type { CategoriesView } from './flows/categoryManagement/categoryManagementState';

// The Account Setup Experience (X5, EBD; OQ-175): the household's setup page,
// as mockup 40 lays it out — a header with its tabs and, under each tab, that
// section's flow. Accounts (FL11) and Categories (FL12) are live; Budgets and
// Goals show an empty state until their flows land in FL13–FL14. It is the
// only tier here that calls the backend: it answers the Flows' requests with
// outcomes, and owns the open tab and the household's category list — shared
// read-only data Category Management writes and Budget Management will read
// (EBD). The page is keyed on the household, so a switch starts it afresh.

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

/** What the categories query holds, as far as the Flow's view needs. */
interface CategoriesQueryState {
  readonly data?: readonly Category[] | undefined;
  readonly error?: ApiError | SerializedError | undefined;
}

/**
 * Reads the categories query into the Flow's view: its failure while the last
 * fetch failed — even over an older list, which may lack a write that just
 * went through (OQ-193) — else its data once there is some (kept while it
 * refetches), else loading. The query keeps its error until a fetch succeeds.
 *
 * @param query - The query's data and error.
 * @returns The view.
 */
export const categoriesViewOf = ({ data, error }: CategoriesQueryState): CategoriesView => {
  if (error !== undefined) return { status: 'failed', error: failureOf(error) };
  if (data !== undefined) return { status: 'loaded', categories: data };
  return { status: 'loading' };
};

/**
 * Holds the household's category list — the Experience's, shared by its
 * Flows — and builds the Category Management Flow's requests (FL12). After a
 * successful write it fetches the list again and answers only then, so the
 * Flow's spinner stops on a list that already holds the change — or, if that
 * fetch fails, on the list's failure and its retry, never on a stale list.
 *
 * @param householdId - The household.
 * @returns The list and the Flow's requests.
 */
const useCategories = (householdId: string): Omit<CategoryManagementFlowProps, 'role'> => {
  const categoriesQuery = useListCategoriesQuery(householdId);
  const { refetch } = categoriesQuery;
  const [createCategory] = useCreateCategoryMutation();
  const [editCategory] = useEditCategoryMutation();
  const [archiveCategory] = useArchiveCategoryMutation();
  const [archiveSubcategory] = useArchiveSubcategoryMutation();

  /**
   * Answers a write: on a success, once the list is fetched again. The write
   * went through either way, so it stays ok; a failed fetch shows in the
   * list's view instead.
   *
   * @param result - What the write's trigger resolved to.
   * @returns Its outcome.
   */
  const answer = async (result: EndpointResult<unknown>): Promise<RequestOutcome> => {
    const outcome = toRequestOutcome(result);
    if (outcome.ok) await refetch();
    return outcome;
  };

  return {
    categories: categoriesViewOf(categoriesQuery),
    onRetry: () => {
      refetch();
    },
    onCreate: async (category) => answer(await createCategory({ householdId, ...category })),
    onEdit: async (edit) => answer(await editCategory({
      householdId, categoryId: edit.categoryId, name: edit.name, icon: edit.icon, color: edit.color,
    })),
    // Adding a subcategory is the same atomic edit, listing only the new one
    // (OQ-173: unlisted ones are untouched).
    onAddSubcategory: async (categoryId, name) => answer(await editCategory({
      householdId, categoryId, subcategories: [{ name }],
    })),
    onArchiveCategory: async (categoryId) => answer(
      await archiveCategory({ householdId, categoryId }),
    ),
    onArchiveSubcategory: async (categoryId, subcategoryId) => answer(
      await archiveSubcategory({ householdId, categoryId, subcategoryId }),
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
  const categories = useCategories(household.id);

  /** Renders whichever tab is active. */
  const renderTab = () => {
    if (tab === 'accounts') {
      return (
        <AccountManagementFlow
          key={household.id}
          selfUserId={userId}
          role={household.role}
          {...requests}
        />
      );
    }
    if (tab === 'categories') {
      return (
        <CategoryManagementFlow key={household.id} role={household.role} {...categories} />
      );
    }
    return (
      <EmptyState icon="info-outline" title={translator.text('accountSetup', `tab.${tab}.soon`)} />
    );
  };

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
      {renderTab()}
    </div>
  );
}

/**
 * Renders the active household's setup page once the user and the household
 * are known: a skeleton until then, a retry if the user can't be loaded.
 *
 * @returns The page.
 */
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
