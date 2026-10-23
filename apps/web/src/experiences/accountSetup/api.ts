import type {
  Goal, GoalCreateRequest, GoalUpdateRequest, GoalWithProgress, ListGoalProgressResponse,
  ListGoalsResponse,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';
import send from '../../api/send';

// The Account Setup Experience's own endpoints (X5; OQ-177, OQ-195): the goals —
// definitions and progress, two reads joined by goal id (OQ-177) — a shared
// list the Experience fetches again after each write before it answers the
// Flow. The accounts, categories and budgets it shares with Onboard and the
// App Shell are in `api/setupApi.ts` (OQ-198).

/** What addresses a goal inside its household (FL14). */
export interface GoalTarget {
  readonly householdId: string;
  readonly goalId: string;
}

/** Which of a household's goals to list: one status at a time (OQ-177). */
export interface GoalListInput {
  readonly householdId: string;
  readonly status: 'active' | 'completed';
}

/** A create, addressed to its household (FR-8.1). */
export type CreateGoalInput = GoalCreateRequest & { readonly householdId: string };

/** An edit — name, target, target currency and/or due date, addressed to its goal (OQ-177). */
export type EditGoalInput = GoalUpdateRequest & GoalTarget;

/** Builds a household's goals path (FL14). */
const goalsPath = (householdId: string) => (
  `/households/${encodeURIComponent(householdId)}/goals`);

/** Builds one goal's path inside its household. */
const goalPath = ({ householdId, goalId }: GoalTarget) => (
  `${goalsPath(householdId)}/${encodeURIComponent(goalId)}`);

/** The Experience's slice of the backend API. */
export const accountSetupApi = backendApi.injectEndpoints({
  endpoints: (build) => ({
    listGoals: build.query<readonly Goal[], GoalListInput>({
      query: ({ householdId, status }) => `${goalsPath(householdId)}?status=${status}`,
      transformResponse: (response: ListGoalsResponse) => response.data ?? [],
    }),
    // InsightsManager's reshaped read (OQ-177), built with M4: until then it
    // fails and the Flow shows the definitions alone (OQ-195).
    listGoalProgress: build.query<readonly GoalWithProgress[], GoalListInput>({
      query: ({ householdId, status }) => (
        `/households/${encodeURIComponent(householdId)}/goal-progress?status=${status}`
      ),
      transformResponse: (response: ListGoalProgressResponse) => response.data ?? [],
    }),
    createGoal: build.mutation<Goal, CreateGoalInput>({
      query: ({ householdId, ...request }) => send('POST', goalsPath(householdId), request),
    }),
    editGoal: build.mutation<Goal, EditGoalInput>({
      query: ({ householdId, goalId, ...changes }) => (
        send('PATCH', goalPath({ householdId, goalId }), changes)
      ),
    }),
    deleteGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('DELETE', goalPath(target)),
    }),
    completeGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('POST', `${goalPath(target)}/complete`),
    }),
    reopenGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('POST', `${goalPath(target)}/reopen`),
    }),
  }),
});

export const {
  useListGoalsQuery,
  useListGoalProgressQuery,
  useCreateGoalMutation,
  useEditGoalMutation,
  useDeleteGoalMutation,
  useCompleteGoalMutation,
  useReopenGoalMutation,
} = accountSetupApi;
