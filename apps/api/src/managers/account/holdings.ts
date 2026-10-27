import { isFixedTerm } from '@financas/reference';
import type {
  AllocationShare, Goal, ReplaceAllocationsResult,
} from '../../accessors/goalAccessor';
import type { InvestmentHolding, ScheduleEntry } from '../../accessors/investmentHoldingAccessor';
import type { Role } from '../../db/schema/values';
import type { DomainError } from '../../utilities/domainError';
import { decide } from '../../utilities/authorization';
import { distinctItems } from '../../utilities/validation';
import { accessToOwned } from '../access';
import type { SignedInContext } from '../requestContext';
import { requireNoProblems } from '../validation';
import { requestLogger, todayOf, type AccountDeps } from './context';
import {
  allocationExceeds100, goalCompleted, goalNotFound, holdingNotFound, holdingNotMatured,
} from './errors';
import { loadHolding, requireOpenHolding } from './holdingAccess';

// Investment administration on the Holding itself (track-investments/uc-02,
// uc-03, FR-5.8, FR-8.2/8.3, FR-11.2): its Goal split — written from the
// Holding, never the Goal (OQ-48) — its archive from the matured notice, and
// its schedule. Position changes only through transactions (FR-5.2).

/**
 * Tells whether a member can see a Goal: every shared one, their own personal
 * ones (FR-8.1) — the permission table's `data.view`.
 *
 * @param role - The member's household role.
 * @param userId - The member.
 * @param goal - The Goal.
 * @returns `true` when it is visible to them.
 */
export const canSeeGoal = (role: Role, userId: string, goal: Goal): boolean => (
  decide(role, userId, accessToOwned(goal, 'data.view')) === 'allowed'
);

/**
 * The shares a split edit leaves alone: those funding Goals the editor can't
 * see, kept as they are (OQ-178).
 *
 * @param current - The Holding's split now.
 * @param visibleGoalIds - The Goals the editor can see.
 * @returns The hidden shares.
 */
export const hiddenShares = (
  current: readonly AllocationShare[],
  visibleGoalIds: ReadonlySet<string>,
): AllocationShare[] => current
  .filter((share) => !visibleGoalIds.has(share.goalId))
  .map(({ goalId, percentage }) => ({ goalId, percentage }));

/**
 * Tells whether a split grows a completed Goal's share or adds one: a pair on a
 * completed Goal passes only unchanged (FR-8.9, OQ-168).
 *
 * @param requested - The new split.
 * @param current - The Holding's split now.
 * @param completedGoalIds - The completed Goals among those named.
 * @returns `true` when the split must be refused.
 */
export const growsCompletedGoal = (
  requested: readonly AllocationShare[],
  current: readonly AllocationShare[],
  completedGoalIds: ReadonlySet<string>,
): boolean => requested.some((share) => completedGoalIds.has(share.goalId) && !current.some(
  (held) => held.goalId === share.goalId && held.percentage === share.percentage,
));

/**
 * Tells whether a Holding may be archived by hand: fixed-term, still holding a
 * position, past its due date — the redemption entry's date (FR-5.8, OQ-178).
 *
 * @param holding - The Holding.
 * @param schedule - Its schedule.
 * @param today - `YYYY-MM-DD` in the app's time zone.
 * @returns `true` when it has matured.
 */
export const hasMatured = (
  holding: InvestmentHolding,
  schedule: readonly ScheduleEntry[],
  today: string,
): boolean => {
  const redemption = schedule.find((entry) => entry.kind === 'redemption');
  return isFixedTerm(holding.assetType) && holding.quantity > 0
    && redemption !== undefined && redemption.date < today;
};

/**
 * Turns GoalAccessor's refusal of a split into the API's answer.
 *
 * @param result - The refusal.
 * @returns `holding.not_found` / `goal.not_found`, or
 *   `goal.allocation_exceeds_100`.
 */
export const splitRefusal = (
  result: Exclude<ReplaceAllocationsResult, { ok: true }>,
): DomainError => {
  if (result.reason === 'holding_not_found') return holdingNotFound();
  if (result.reason === 'goal_not_found') return goalNotFound();
  return allocationExceeds100(result.current, result.requested);
};

/**
 * The Goals of a split the caller can see, by id.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param loaded - The household, and the caller's role.
 * @param goalIds - The Goals named by the split, now or in the edit.
 * @returns The visible ones.
 */
const visibleGoals = async (
  deps: AccountDeps,
  context: SignedInContext,
  loaded: { readonly householdId: string; readonly role: Role },
  goalIds: readonly string[],
): Promise<Map<string, Goal>> => {
  const goals = await deps.goals.findByIds(loaded.householdId, [...new Set(goalIds)]);
  const visible = goals.filter((goal) => canSeeGoal(loaded.role, context.actor.userId, goal));
  return new Map(visible.map((goal) => [goal.id, goal]));
};

/**
 * Checks an edited split: each Goal named once and visible, no completed Goal
 * grown (OQ-168).
 *
 * @param requested - The new split.
 * @param current - The Holding's split now.
 * @param visible - The Goals the caller can see.
 * @throws {DomainError} `validation.failed`; `goal.not_found`; `goal.completed`.
 */
const checkSplit = (
  requested: readonly AllocationShare[],
  current: readonly AllocationShare[],
  visible: ReadonlyMap<string, Goal>,
): void => {
  requireNoProblems(distinctItems('allocations', requested, 'goalId'));
  if (requested.some((share) => !visible.has(share.goalId))) throw goalNotFound();
  const completed = new Set([...visible.values()]
    .filter((goal) => goal.completedAt !== null).map((goal) => goal.id));
  if (growsCompletedGoal(requested, current, completed)) throw goalCompleted();
};

/**
 * Builds the Holding use cases.
 *
 * @param deps - The tier below.
 * @returns `listHoldingAllocations`, `editHolding`, `archiveHolding`,
 *   `listScheduleEntries`.
 */
const createHoldings = (deps: AccountDeps) => ({
  /**
   * A Holding's Goal split, as far as the caller can see it — a share funding
   * someone else's personal Goal is left out (OQ-178).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @returns The visible shares, oldest first.
   * @throws {DomainError} `household.not_found` / `holding.not_found`.
   */
  listHoldingAllocations: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
  ): Promise<AllocationShare[]> => {
    const ids = { householdId, holdingId };
    const { role } = await loadHolding(deps, context, ids, 'data.view');
    const current = await deps.goals.listAllocations({ holdingId: ids.holdingId });
    const visible = await visibleGoals(
      deps,
      context,
      { householdId: ids.householdId, role }, (
        current.map((share) => share.goalId)),
    );
    return current.filter((share) => visible.has(share.goalId))
      .map(({ goalId, percentage }) => ({ goalId, percentage }));
  },

  /**
   * Replaces the split over the Goals the caller can see; shares funding Goals
   * they can't see are kept and still count toward the 100% (uc-02, FR-8.2/8.3,
   * OQ-168, OQ-178).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @param requested - The new visible split; empty removes it.
   * @returns The visible split as written.
   * @throws {DomainError} `household.not_found` / `holding.not_found` /
   *   `goal.not_found`; `auth.forbidden`; `holding.archived` /
   *   `goal.completed` / `goal.allocation_exceeds_100`; `validation.failed`.
   */
  editHolding: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
    requested: readonly AllocationShare[],
  ): Promise<AllocationShare[]> => {
    const ids = { householdId, holdingId };
    const { holding, role } = await loadHolding(deps, context, ids, 'data.edit');
    requireOpenHolding(holding);
    const current = await deps.goals.listAllocations({ holdingId: ids.holdingId });
    const visible = await visibleGoals(deps, context, { householdId: ids.householdId, role }, [
      ...current.map((share) => share.goalId), ...requested.map((share) => share.goalId)]);
    checkSplit(requested, current, visible);
    const split = requested.map(({ goalId, percentage }) => ({ goalId, percentage }));
    // The new split takes effect today; the one before stays as history (OQ-206).
    const result = await deps.goals.replaceAllocations(ids.householdId, ids.holdingId, [
      ...hiddenShares(current, new Set(visible.keys())), ...split], todayOf(deps));
    if (!result.ok) throw splitRefusal(result);
    requestLogger(context).audit('EditHoldingAllocations', {
      entityType: 'InvestmentHolding', entityId: ids.holdingId, householdId: ids.householdId,
    });
    return split;
  },

  /**
   * Archives a matured Holding from its notice — one-way (uc-03, FR-5.8,
   * OQ-72). An archived Holding is left as it is, unaudited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @throws {DomainError} `household.not_found` / `holding.not_found`;
   *   `auth.forbidden`; `holding.not_matured`.
   */
  archiveHolding: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
  ): Promise<void> => {
    const ids = { householdId, holdingId };
    const { holding } = await loadHolding(deps, context, ids, 'data.delete');
    if (holding.archivedAt !== null) return;
    const schedule = await deps.holdings.listSchedule([ids.holdingId]);
    if (!hasMatured(holding, schedule, todayOf(deps))) throw holdingNotMatured();
    if (!(await deps.holdings.archive(ids.holdingId, 'user'))) return;
    requestLogger(context).audit('ArchiveHolding', {
      entityType: 'InvestmentHolding', entityId: ids.holdingId, householdId: ids.householdId,
    });
  },

  /**
   * A fixed-term Holding's contractual cash events, posted or not (FR-11.2);
   * a market-priced one has none.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @returns The entries, by date.
   * @throws {DomainError} `household.not_found` / `holding.not_found`.
   */
  listScheduleEntries: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
  ): Promise<ScheduleEntry[]> => {
    await loadHolding(deps, context, { householdId, holdingId }, 'data.view');
    return deps.holdings.listSchedule([holdingId]);
  },
});

export default createHoldings;
