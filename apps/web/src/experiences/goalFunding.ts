import type { GoalWithProgress } from '@financas/api-types';

// What funds a Goal in its own currency (FR-8.5, OQ-201, OQ-215), read the
// same way by every Experience that shows one: Account Setup's Goals tab,
// Manage Finances' Month Overview and the Dashboard. No rate enters here —
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
