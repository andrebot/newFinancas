import type {
  Goal, GoalCreateRequest, GoalUpdateRequest, GoalWithProgress, ListGoalProgressResponse,
  ListGoalsResponse,
} from '@financas/api-types';
import backendApi, { changedTags } from './backendApi';
import send from './send';

// The goals endpoints several Experiences share (X5, X6; OQ-177, OQ-195,
// PR #145): the definitions and their progress — two reads Account Setup
// joins by goal id (OQ-177) — and the goal writes. Account Setup manages the
// goals; Manage Finances reads their progress for a buy's split. Like
// `setupApi.ts`, they belong to no one Experience, so each imports them from
// here and never from a sibling, and they share one cache.
// - Both reads provide the shared `Goals` tag (`backendApi.ts`): a progress
//   read only once it loaded, so a failed one waits for Retry (OQ-195). Each
//   goal write that went through — or found its goal already gone —
//   invalidates it, and so does a transaction write (a buy's split moves the
//   funding). The Month Overview provides it too: its Goals rail.
// - Account Setup still waits for the goals to be read again before it
//   answers its Flow; that refetch joins the read the tag started.

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
/**
 * Names what a goal write changed: the goals, once it went through or found
 * its goal already gone.
 *
 * @param _result - What it returned (unused).
 * @param error - Its failure, if any.
 * @returns The tags to invalidate.
 */
const goalWriteTags = (_result: unknown, error: unknown) => (
  changedTags(['Goals'], error, 'goal.not_found')
);

/** The shared goals endpoints. */
export const goalsApi = backendApi.injectEndpoints({
  endpoints: (build) => ({
    listGoals: build.query<readonly Goal[], GoalListInput>({
      query: ({ householdId, status }) => `${goalsPath(householdId)}?status=${status}`,
      transformResponse: (response: ListGoalsResponse) => response.data ?? [],
      providesTags: ['Goals'],
    }),
    // InsightsManager's reshaped read (OQ-177): when it fails, Goal
    // Management shows the definitions alone (OQ-195).
    listGoalProgress: build.query<readonly GoalWithProgress[], GoalListInput>({
      query: ({ householdId, status }) => (
        `/households/${encodeURIComponent(householdId)}/goal-progress?status=${status}`
      ),
      transformResponse: (response: ListGoalProgressResponse) => response.data ?? [],
      providesTags: (_result, error) => (error ? [] : ['Goals']),
    }),
    createGoal: build.mutation<Goal, CreateGoalInput>({
      query: ({ householdId, ...request }) => send('POST', goalsPath(householdId), request),
      invalidatesTags: goalWriteTags,
    }),
    editGoal: build.mutation<Goal, EditGoalInput>({
      query: ({ householdId, goalId, ...changes }) => (
        send('PATCH', goalPath({ householdId, goalId }), changes)
      ),
      invalidatesTags: goalWriteTags,
    }),
    deleteGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('DELETE', goalPath(target)),
      invalidatesTags: goalWriteTags,
    }),
    completeGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('POST', `${goalPath(target)}/complete`),
      invalidatesTags: goalWriteTags,
    }),
    reopenGoal: build.mutation<void, GoalTarget>({
      query: (target) => send('POST', `${goalPath(target)}/reopen`),
      invalidatesTags: goalWriteTags,
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
} = goalsApi;
