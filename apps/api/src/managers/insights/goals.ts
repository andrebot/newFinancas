import { monthEnd } from '../../utilities/calendarMonth';
import type { Goal, GoalStatus } from '../../accessors/goalAccessor';
import type { GoalWithProgress, Viewer } from '../../engines/reporting';
import { accessToOwned, memberOnly, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import { todayOf, type InsightsDeps } from './context';
import { goalNotFound } from './errors';
import { monthAskedFor, type MonthAsked } from './reports';

// Goal progress (FR-8.5/8.7): the reshaped read OQ-177 moved out of
// AccountManager's plain list. The Manager decides which Goals the viewer sees
// and which day "now" is; ReportingEngine does the rest — a Holding in an
// Account the viewer can't see counts, unnamed (OQ-206).

/** Loads one Goal the caller may read, or refuses like the API does. */
const loadGoal = async (
  deps: InsightsDeps,
  context: SignedInContext,
  householdId: string,
  goalId: string,
): Promise<Goal> => {
  const goal = await deps.goals.findById(householdId, goalId);
  await requireAccess(
    deps.authorization,
    context.actor.userId,
    householdId,
    accessToOwned(goal, 'data.view'),
    goalNotFound,
  );
  if (!goal) throw goalNotFound();
  return goal;
};

/**
 * Builds the Goal progress use cases.
 *
 * @param deps - The tier below.
 * @returns `goalProgressList` and `goalProgressFor`.
 */
export const createGoals = (deps: InsightsDeps) => ({
  /**
   * The Goals the caller sees, each with what funds it today (FR-8.5).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param status - Active or completed.
   * @returns Each Goal with its progress, in the order listed.
   * @throws {DomainError} `household.not_found`.
   */
  goalProgressList: async (
    context: SignedInContext,
    householdId: string,
    status: GoalStatus,
  ): Promise<GoalWithProgress[]> => {
    const viewerUserId = context.actor.userId;
    await requireAccess(deps.authorization, viewerUserId, householdId, memberOnly);
    const goals = await deps.goals.list(householdId, viewerUserId, status);
    return deps.reporting.goalProgress(
      { householdId, viewerUserId },
      goals,
      todayOf(deps),
    );
  },

  /**
   * One Goal's progress — today when no month is asked, that month's end by
   * month (FR-8.7).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @param asked - The year and/or month; today's when absent.
   * @returns The Goal with its progress on that day.
   * @throws {DomainError} `household.not_found` / `goal.not_found`.
   */
  goalProgressFor: async (
    context: SignedInContext,
    householdId: string,
    goalId: string,
    asked?: MonthAsked,
  ): Promise<GoalWithProgress> => {
    const goal = await loadGoal(deps, context, householdId, goalId);
    const viewer: Viewer = { householdId, viewerUserId: context.actor.userId };
    const day = asked?.year === undefined && asked?.month === undefined
      ? todayOf(deps)
      : monthEnd(monthAskedFor(deps, asked));
    const [progress] = await deps.reporting.goalProgress(viewer, [goal], day);
    if (!progress) throw goalNotFound();
    return progress;
  },
});

export type Goals = ReturnType<typeof createGoals>;
