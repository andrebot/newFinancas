import { useCallback, useState } from 'react';
import type { SerializedError } from '@reduxjs/toolkit';
import type { Account, Goal, GoalWithProgress } from '@financas/api-types';
import type { ApiError } from '../../api/errors';
import {
  failureOf, toDataOutcome, toRequestOutcome, type EndpointResult,
} from '../../api/outcome';
import { useActiveHousehold } from '../../api/activeHousehold';
import { Button } from '../../kit/button/Button';
import { EmptyState } from '../../kit/emptyState/EmptyState';
import { PageHeader } from '../../kit/pageHeader/PageHeader';
import { SegmentedControl } from '../../kit/segmentedControl/SegmentedControl';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import type { ShellHousehold } from '../../shell/shellConfig';
import { useI18n } from '../../utilities/I18nProvider';
import type { RequestOutcome } from '../../utilities/requestOutcome';
import {
  useArchiveAccountMutation, useCreateAccountMutation, useEditAccountMutation,
  useLazyListAccountsQuery, useListCategoriesQuery, useCreateCategoryMutation,
  useEditCategoryMutation, useArchiveCategoryMutation, useArchiveSubcategoryMutation,
  useListBudgetsQuery, useCreateBudgetMutation, useEditBudgetMutation, useDeleteBudgetMutation,
  useListGoalsQuery, useListGoalProgressQuery, useCreateGoalMutation, useEditGoalMutation,
  useDeleteGoalMutation, useCompleteGoalMutation, useReopenGoalMutation,
} from './api';
import {
  AccountManagementFlow, type AccountManagementFlowProps,
} from './flows/accountManagement/AccountManagementFlow';
import {
  BudgetManagementFlow, type BudgetManagementFlowProps,
} from './flows/budgetManagement/BudgetManagementFlow';
import {
  CategoryManagementFlow, type CategoryManagementFlowProps,
} from './flows/categoryManagement/CategoryManagementFlow';
import {
  GoalManagementFlow, type GoalManagementFlowProps,
} from './flows/goalManagement/GoalManagementFlow';
import type {
  GoalEntry, GoalsView, ProgressStatus, SharedListView,
} from './sharedLists';

// The Account Setup Experience (X5, EBD; OQ-175): the household's setup page,
// as mockup 40 lays it out — a header with its tabs and, under each tab, that
// section's flow: Accounts (FL11), Categories (FL12), Budgets (FL13) and Goals
// (FL14). It is the only tier here that calls the backend: it answers the
// Flows' requests with outcomes, and owns the open tab, the household's
// category list — shared read-only data Category Management writes and Budget
// Management reads (EBD) — the budgets, whose claims other members change too
// (OQ-194), and the goals, their definitions joined to their progress (OQ-177,
// OQ-195). The page is keyed on the household, so a switch starts it afresh.

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

/** What a list query holds, as far as a Flow's view needs. */
interface ListQueryState<Item> {
  readonly data?: readonly Item[] | undefined;
  readonly error?: ApiError | SerializedError | undefined;
}

/**
 * Reads a list query into a Flow's view: its data once there is some (kept
 * while it refetches) under the view's field, its failure, or loading. A list
 * whose latest fetch failed carries that failure, since it may lack a write
 * that just went through (OQ-193); the query keeps its error until a fetch
 * succeeds.
 *
 * @param field - The view's field for the items, e.g. `categories`.
 * @param query - The query's data and error.
 * @returns The view.
 */
export const listViewOf = <Field extends string, Item>(
  field: Field,
  { data, error }: ListQueryState<Item>,
): SharedListView<Field, Item> => {
  if (data !== undefined) {
    const loaded = error === undefined
      ? { status: 'loaded', [field]: data }
      : { status: 'loaded', [field]: data, refreshError: failureOf(error) };
    // A computed key widens to a string index; it is exactly `field`.
    return loaded as SharedListView<Field, Item>;
  }
  if (error !== undefined) return { status: 'failed', error: failureOf(error) };
  return { status: 'loading' };
};

/**
 * Holds the household's category list — the Experience's, shared by its
 * Flows — and builds the Category Management Flow's requests (FL12). After a
 * successful write it fetches the list again and answers only then, so the
 * Flow's spinner stops on a list that already holds the change — or, if that
 * fetch fails, on the list beside its failure and a retry.
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
    categories: listViewOf('categories', categoriesQuery),
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

/** The failures that mean the lists moved under the form (OQ-194). */
const STALE_CODES: ReadonlySet<string> = new Set([
  'budget.target_already_claimed', 'budget.not_found', 'validation.failed',
]);

/**
 * Tells which lists to fetch again before answering a budget write: the
 * budgets after a success, or after a failure that says they moved — a
 * target claimed meanwhile (409), a budget deleted meanwhile (404) — and the
 * categories too after a target refused as gone (422, a category archived
 * meanwhile), so the picker shows what is free now.
 *
 * @param outcome - The write's outcome.
 * @returns Which lists to fetch again.
 */
export const listsToRefresh = (outcome: RequestOutcome) => {
  if (outcome.ok) return { budgets: true, categories: false };
  const { code } = outcome.error;
  return { budgets: STALE_CODES.has(code), categories: code === 'validation.failed' };
};

/**
 * Holds the budgets the caller can see — the Experience's, since their claims
 * are shared state other members change — and builds the Budget Management
 * Flow's requests (FL13). After a write it fetches what moved again and
 * answers only then, so the picker already shows what is free.
 *
 * @param householdId - The household.
 * @returns The budgets' view and the Flow's requests.
 */
const useBudgets = (
  householdId: string,
): Omit<BudgetManagementFlowProps, 'selfUserId' | 'role' | 'categories'> => {
  const budgetsQuery = useListBudgetsQuery(householdId);
  // The same subscription Category Management reads: only its refetch is needed here.
  const { refetch: refetchCategories } = useListCategoriesQuery(householdId);
  const { refetch: refetchBudgets } = budgetsQuery;
  const [createBudget] = useCreateBudgetMutation();
  const [editBudget] = useEditBudgetMutation();
  const [deleteBudget] = useDeleteBudgetMutation();

  /**
   * Answers a write once the lists it moved are fetched again. The write's
   * outcome stands either way; a failed fetch shows in the lists' view.
   *
   * @param result - What the write's trigger resolved to.
   * @returns Its outcome.
   */
  const answer = async (result: EndpointResult<unknown>): Promise<RequestOutcome> => {
    const outcome = toRequestOutcome(result);
    const refresh = listsToRefresh(outcome);
    await Promise.all([
      refresh.budgets ? refetchBudgets() : undefined,
      refresh.categories ? refetchCategories() : undefined,
    ]);
    return outcome;
  };

  return {
    budgets: listViewOf('budgets', budgetsQuery),
    onRetry: () => {
      refetchBudgets();
      refetchCategories();
    },
    onCreate: async (budget) => answer(await createBudget({ householdId, ...budget })),
    onEdit: async ({ budgetId, ...changes }) => answer(
      await editBudget({ householdId, budgetId, ...changes }),
    ),
    onDelete: async (budgetId) => answer(await deleteBudget({ householdId, budgetId })),
  };
};

/**
 * Joins a status's goals to their progress by goal id (OQ-177): each goal gets
 * its funding once the progress read holds it, and none while that read is
 * loading or has failed — the definitions show on their own (OQ-195).
 *
 * @param goals - The definitions' query.
 * @param progress - The progress read's query.
 * @returns The status's list as Goal Management sees it.
 */
export const goalListViewOf = (
  goals: ListQueryState<Goal>,
  progress: ListQueryState<GoalWithProgress>,
): SharedListView<'goals', GoalEntry> => {
  const byId = new Map((progress.data ?? []).map((item) => [item.id, item]));
  const entries = goals.data?.map((goal): GoalEntry => {
    const found = byId.get(goal.id);
    return found
      ? { goal, funding: { contributions: found.contributions, fundedBy: found.fundedBy } }
      : { goal };
  });
  return listViewOf('goals', { data: entries, error: goals.error });
};

/**
 * Reads how the progress read went, both statuses together: failed if either
 * failed, loading while either has no data yet, loaded otherwise.
 *
 * @param queries - Each status's progress query.
 * @returns The joint status.
 */
export const progressStatusOf = (
  ...queries: readonly ListQueryState<GoalWithProgress>[]
): ProgressStatus => {
  if (queries.some((query) => query.error !== undefined)) return 'failed';
  if (queries.some((query) => query.data === undefined)) return 'loading';
  return 'loaded';
};

/**
 * Holds the goals the caller can see — both statuses, each joined to its
 * progress — and builds the Goal Management Flow's requests (FL14). After a
 * success, or a failure that says a goal is gone (404), it fetches the
 * definitions and the progress again and answers only then.
 *
 * @param householdId - The household.
 * @returns The goals' view and the Flow's requests.
 */
const useGoals = (householdId: string): Omit<GoalManagementFlowProps, 'selfUserId' | 'role'> => {
  const activeGoals = useListGoalsQuery({ householdId, status: 'active' });
  const completedGoals = useListGoalsQuery({ householdId, status: 'completed' });
  const activeProgress = useListGoalProgressQuery({ householdId, status: 'active' });
  const completedProgress = useListGoalProgressQuery({ householdId, status: 'completed' });
  const [createGoal] = useCreateGoalMutation();
  const [editGoal] = useEditGoalMutation();
  const [deleteGoal] = useDeleteGoalMutation();
  const [completeGoal] = useCompleteGoalMutation();
  const [reopenGoal] = useReopenGoalMutation();
  const queries = [activeGoals, completedGoals, activeProgress, completedProgress];

  /** Fetches every goal read again, once all have settled. */
  const refetchAll = () => Promise.all(queries.map((query) => query.refetch()));

  /**
   * Answers a write once the goals are fetched again, when it went through or
   * says its goal is gone. The write's outcome stands either way.
   *
   * @param result - What the write's trigger resolved to.
   * @returns Its outcome.
   */
  const answer = async (result: EndpointResult<unknown>): Promise<RequestOutcome> => {
    const outcome = toRequestOutcome(result);
    if (outcome.ok || outcome.error.code === 'goal.not_found') await refetchAll();
    return outcome;
  };

  return {
    goals: {
      active: goalListViewOf(activeGoals, activeProgress),
      completed: goalListViewOf(completedGoals, completedProgress),
      progress: progressStatusOf(activeProgress, completedProgress),
    } satisfies GoalsView,
    onRetry: () => {
      refetchAll();
    },
    onCreate: async (goal) => answer(await createGoal({ householdId, ...goal })),
    onEdit: async ({ goalId, ...changes }) => answer(
      await editGoal({ householdId, goalId, ...changes }),
    ),
    onDelete: async (goalId) => answer(await deleteGoal({ householdId, goalId })),
    onComplete: async (goalId) => answer(await completeGoal({ householdId, goalId })),
    onReopen: async (goalId) => answer(await reopenGoal({ householdId, goalId })),
  };
};

/** The setup page's props. */
interface SetupPageProps extends AccountPanelProps {
  /** The signed-in user's id. */
  readonly userId: string;
}

/**
 * Renders the Goals tab: its own component, so the goal reads start only once
 * the tab is opened.
 *
 * @param props - The household and the signed-in user.
 * @returns The Goal Management Flow.
 */
function GoalsTab({ household, userId }: SetupPageProps) {
  const goals = useGoals(household.id);
  return <GoalManagementFlow selfUserId={userId} role={household.role} {...goals} />;
}

/**
 * Renders the active household's setup page: its header with the tabs and,
 * under each tab, that section's flow.
 *
 * @param props - The household and the signed-in user.
 * @returns The page.
 */
function SetupPage({ household, userId }: SetupPageProps) {
  const translator = useI18n();
  const [tab, setTab] = useState<SetupTab>('accounts');
  const requests = useAccountRequests(household.id);
  const categories = useCategories(household.id);
  const budgets = useBudgets(household.id);

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
    if (tab === 'budgets') {
      return (
        <BudgetManagementFlow
          key={household.id}
          selfUserId={userId}
          role={household.role}
          categories={categories.categories}
          {...budgets}
        />
      );
    }
    return <GoalsTab key={household.id} household={household} userId={userId} />;
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
  const active = useActiveHousehold();

  if (active.status === 'ready') {
    const { household, userId } = active.data;
    return <SetupPage key={household.id} household={household} userId={userId} />;
  }
  if (active.status === 'failed') {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('accountSetup', 'failed')}
        action={(
          <Button onClick={active.retry}>
            {translator.text('accountSetup', 'retry')}
          </Button>
        )}
      />
    );
  }
  return <SkeletonRows label={translator.text('accountSetup', 'loading')} />;
}
