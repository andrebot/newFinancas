import type { AllocationShare, Goal } from '../accessors/goalAccessor';
import type { Role } from '../db/schema/values';
import { decide } from '../utilities/authorization';
import { accessToOwned } from './access';

// A Holding's Goal split (FR-8.2/8.3): the rules both Managers apply —
// AccountManager when the split is edited on the Holding, TransactionManager
// when a trade carries one at record time (OQ-54/OQ-168). Shared here so the
// two tiers never disagree; each Manager keeps its own error mapping.

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
