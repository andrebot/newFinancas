import type { GoalWithProgress } from '@financas/api-types';
import type { AllocationGoal } from '../kit/allocationEditor/allocation';
import { wholePercent } from '../kit/progress/progress';

// What funds a Goal in its own currency (FR-8.5, OQ-201, OQ-215), read the
// same way by every Experience that shows one: Account Setup's Goals tab,
// Manage Finances' Month Overview and the Dashboard — and the Goals a Holding's
// split names, in Record Transaction and Holding Maintenance alike. No rate enters here —
// converting is the Goals tab's alone (FR-9.1) — so the rail cards and the
// Goals page agree on what is funded, what is not and what needs a rate.
// Pure, and owned by no Experience, so none of them reaches into another.

/** A Goal's funding in its own currency. */
export interface OwnFunding {
  /** The contributions in the Goal's currency, summed, in minor units. */
  readonly funded: number;
  /** No Holding funds it at all — not merely funding worth nothing yet. */
  readonly unfunded: boolean;
  /** Some contribution is in another currency, left out of `funded` for want of a rate. */
  readonly needsRate: boolean;
}

/**
 * Reads what funds a Goal in its own currency, and whether others fund it too.
 *
 * @param goal - The Goal with its progress, as the reads send it.
 * @returns The own-currency sum and the unfunded and needs-a-rate flags.
 */
export const ownFundingOf = (goal: GoalWithProgress): OwnFunding => {
  const contributions = goal.fundedBy.flatMap((funder) => (
    funder.contribution ? [funder.contribution] : []
  ));
  const own = contributions.filter((item) => item.currency === goal.targetCurrency);
  return {
    funded: own.reduce((sum, item) => sum + item.amount, 0),
    unfunded: goal.fundedBy.length === 0,
    needsRate: own.length < contributions.length,
  };
};

/** A Goal as a Holding's split names it: whether it is completed, too (FR-8.9). */
export interface SplitGoal extends AllocationGoal {
  /** A completed Goal's share is kept or removed, never grown. */
  readonly completed: boolean;
}

/**
 * Reads the Goals as a trade's split names them: each with its progress in
 * its own currency — whole percent, rounded down — and whether it is
 * completed, the active ones first.
 *
 * @param active - The active Goals with their progress.
 * @param completed - The completed ones.
 * @returns The split's Goals.
 */
export const splitGoalsOf = (
  active: readonly GoalWithProgress[],
  completed: readonly GoalWithProgress[],
): readonly SplitGoal[] => [
  ...active.map((goal) => ({ goal, completed: false })),
  ...completed.map((goal) => ({ goal, completed: true })),
].map(({ goal, completed: done }) => ({
  id: goal.id,
  name: goal.name,
  progress: wholePercent(ownFundingOf(goal).funded, goal.targetAmount),
  completed: done,
}));
