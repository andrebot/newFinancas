import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Goal, GoalWithProgress } from '@financas/api-types';
import { shell } from '../../config/constants';
import { toRequestOutcome, type EndpointResult } from '../../api/outcome';
import { useActiveHousehold } from '../../shell/activeHousehold';
import { Button } from '../../kit/button/Button';
import { EmptyState } from '../../kit/emptyState/EmptyState';
import { PageHeader } from '../../kit/pageHeader/PageHeader';
import { SegmentedControl } from '../../kit/segmentedControl/SegmentedControl';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import type { ShellHousehold } from '../../shell/shellConfig';
import { useI18n } from '../../utilities/I18nProvider';
import type { RequestOutcome } from '../../utilities/requestOutcome';
import {
  useListGoalsQuery, useListGoalProgressQuery, useCreateGoalMutation, useEditGoalMutation,
  useDeleteGoalMutation, useCompleteGoalMutation, useReopenGoalMutation,
} from '../../api/goalsApi';
import { AccountManagementFlow } from './flows/accountManagement/AccountManagementFlow';
import { BudgetManagementFlow } from './flows/budgetManagement/BudgetManagementFlow';
import { CategoryManagementFlow } from './flows/categoryManagement/CategoryManagementFlow';
import {
  GoalManagementFlow, type GoalManagementFlowProps,
} from './flows/goalManagement/GoalManagementFlow';
import {
  listViewOf, useAccountRequests, useBudgets, useCategories, type ListQueryState,
} from '../setupRequests';
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
// OQ-195). The open tab lives in the address (`?tab=budgets`), and a tab once
// opened stays mounted, only hidden, so a switch keeps its state (OQ-197). The
// page is keyed on the household, so a switch starts it afresh. The accounts,
// categories and budgets are answered by the setup requests it shares with
// Onboard's Guided Setup step (`setupRequests.ts`, OQ-198).

/** The tabs between the setup sections (mockup 40). */
export type SetupTab = 'accounts' | 'categories' | 'budgets' | 'goals';

const TABS: readonly SetupTab[] = ['accounts', 'categories', 'budgets', 'goals'];

/**
 * Reads the open tab from the address's search parameter: the one it names,
 * or Accounts when it names none or one that doesn't exist.
 *
 * @param value - The parameter's value, if any.
 * @returns The tab.
 */
export const tabOf = (value: string | null): SetupTab => (
  TABS.find((tab) => tab === value) ?? 'accounts'
);

/** The household a setup page works in. */
interface AccountPanelProps {
  readonly household: ShellHousehold;
}

/**
 * Tells which failure a status's list carries: its definitions', or — once
 * both have loaded — a progress refetch's, since the funding it shows may then
 * be out of date (OQ-193).
 *
 * @param goals - The definitions' query.
 * @param progress - The progress read's query.
 * @returns The failure, if any.
 */
const goalListErrorOf = (
  goals: ListQueryState<Goal>,
  progress: ListQueryState<GoalWithProgress>,
) => {
  if (goals.error !== undefined || goals.data === undefined) return goals.error;
  return progress.data === undefined ? undefined : progress.error;
};

/**
 * Joins a status's goals to their progress by goal id (OQ-177): each goal gets
 * its funding once the progress read holds it, and none while that read is
 * loading or never loaded — the definitions show on their own (OQ-195). A
 * progress refetch that failed keeps the funding and marks the list stale.
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
      ? { goal, funding: { fundedBy: found.fundedBy } }
      : { goal };
  });
  return listViewOf('goals', { data: entries, error: goalListErrorOf(goals, progress) });
};

/**
 * Reads how a status's progress read went: loaded once it holds data (a later
 * failure marks the list stale instead), failed if it never loaded, loading
 * otherwise.
 *
 * @param query - The status's progress query.
 * @returns Its status.
 */
export const progressStatusOf = (query: ListQueryState<GoalWithProgress>): ProgressStatus => {
  if (query.data !== undefined) return 'loaded';
  return query.error === undefined ? 'loading' : 'failed';
};

/**
 * Holds the goals the caller can see — both statuses, each joined to its
 * progress — and builds the Goal Management Flow's requests (FL14). After a
 * success, or a failure that says a goal is gone (404), it waits for the
 * definitions and the progress to be read again — the refetch the `Goals`
 * tag started, which these join (PR #145) — and answers only then.
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
  const progressQueries = [activeProgress, completedProgress];

  /** Fetches every goal read again, once all have settled (a retry). */
  const refetchAll = () => Promise.all(
    [activeGoals, completedGoals, ...progressQueries].map((query) => query.refetch()),
  );

  /**
   * Fetches the goals again after a write, once all have settled: a progress
   * read that never loaded is left to Retry, since it would only fail again
   * (until `M4` builds it, OQ-195).
   */
  const refetchAfterWrite = () => Promise.all(
    [activeGoals, completedGoals, ...progressQueries.filter(
      (query) => progressStatusOf(query) !== 'failed',
    )].map((query) => query.refetch()),
  );

  /**
   * Answers a write once the goals are fetched again, when it went through or
   * says its goal is gone. The write's outcome stands either way.
   *
   * @param result - What the write's trigger resolved to.
   * @returns Its outcome.
   */
  const answer = async (result: EndpointResult<unknown>): Promise<RequestOutcome> => {
    const outcome = toRequestOutcome(result);
    if (outcome.ok || outcome.error.code === 'goal.not_found') await refetchAfterWrite();
    return outcome;
  };

  return {
    goals: {
      active: goalListViewOf(activeGoals, activeProgress),
      completed: goalListViewOf(completedGoals, completedProgress),
      progress: {
        active: progressStatusOf(activeProgress),
        completed: progressStatusOf(completedProgress),
      },
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
 * @param props - The household, the signed-in user and whether the tab is open.
 * @returns The Goal Management Flow.
 */
function GoalsTab({ household, userId, active }: SetupPageProps & { readonly active: boolean }) {
  const goals = useGoals(household.id);
  return (
    <GoalManagementFlow selfUserId={userId} role={household.role} active={active} {...goals} />
  );
}

/**
 * Holds the open tab in the address, replacing the entry on a switch so tab
 * clicks don't fill the history, and the tabs opened so far — mounted from
 * their first opening on, so a switch back finds them as they were.
 *
 * @returns The open tab, the tabs opened so far and the switch.
 */
const useSetupTabs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOf(searchParams.get(shell.tabParam));
  const [opened, setOpened] = useState<ReadonlySet<SetupTab>>(() => new Set([tab]));
  // A tab reached through the address (Back, a link) counts as opened too.
  if (!opened.has(tab)) setOpened(new Set([...opened, tab]));

  /**
   * Opens a tab.
   *
   * @param next - The tab to open.
   */
  const openTab = (next: SetupTab) => {
    // Only the tab moves: the address's other parameters stay as they were.
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set(shell.tabParam, next);
      return params;
    }, { replace: true });
  };

  return { tab, opened, openTab };
};

/**
 * Renders the active household's setup page: its header — the open section's
 * title and description (mockups 40–43) — with the tabs and, under each tab
 * opened so far, that section's flow, hidden while another is open.
 *
 * @param props - The household and the signed-in user.
 * @returns The page.
 */
function SetupPage({ household, userId }: SetupPageProps) {
  const translator = useI18n();
  const { tab, opened, openTab } = useSetupTabs();
  const requests = useAccountRequests(household.id);
  const categories = useCategories(household.id);
  const budgets = useBudgets(household.id);

  /**
   * Renders a section's flow.
   *
   * @param value - The section.
   * @returns Its flow.
   */
  const renderPanel = (value: SetupTab) => {
    if (value === 'accounts') {
      return (
        <AccountManagementFlow
          selfUserId={userId}
          role={household.role}
          active={value === tab}
          {...requests}
        />
      );
    }
    if (value === 'categories') {
      return <CategoryManagementFlow role={household.role} {...categories} />;
    }
    if (value === 'budgets') {
      return (
        <BudgetManagementFlow
          selfUserId={userId}
          role={household.role}
          active={value === tab}
          categories={categories.categories}
          {...budgets}
        />
      );
    }
    return <GoalsTab household={household} userId={userId} active={value === tab} />;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={translator.text('accountSetup', 'eyebrow')}
        title={translator.text('accountSetup', `tab.${tab}`)}
        description={translator.text('accountSetup', `description.${tab}`)}
        tabs={(
          <SegmentedControl
            label={translator.text('accountSetup', 'tabs.label')}
            options={TABS.map((value) => ({
              value, label: translator.text('accountSetup', `tab.${value}`),
            }))}
            value={tab}
            onChange={openTab}
          />
        )}
      />
      {TABS.filter((value) => opened.has(value)).map((value) => (
        <div key={value} hidden={value !== tab}>
          {renderPanel(value)}
        </div>
      ))}
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
