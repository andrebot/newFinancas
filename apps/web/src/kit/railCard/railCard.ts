import { railCard as railCardSettings } from '../../config/constants';
import { wholePercent } from '../progress/progress';
import type { RingTone } from '../progressRing/ProgressRing';

// What the rail cards (K36, OQ-215) read from their figures: a budget's
// percent, tone and what is left or over; a goal's percent and what is to
// go. Pure, so it tests without React. Percents are `wholePercent`'s: whole,
// rounded down, not held to 100 (the ring holds its fill, OQ-209).

/** A budget's state on its card. */
export interface BudgetStatus {
  /** Spend against the target, whole, rounded down; 0 when refunds outweigh spend. */
  readonly percent: number;
  /** Mint on track, sun near the limit (reached included), coral over it. */
  readonly tone: Extract<RingTone, 'mint' | 'sun' | 'coral'>;
  /** Spend is above the target: the card reads "Over by". */
  readonly over: boolean;
  /** What is left (target − spend), or what it is over by (spend − target); never negative. */
  readonly remainder: number;
}

/** A goal's state on its card. */
export interface GoalStatus {
  /** Funded against the target, whole, rounded down. */
  readonly percent: number;
  /** Funded reaches the target. */
  readonly reached: boolean;
  /** What is left to reach the target; zero once it is reached. */
  readonly toGo: number;
}

/** The placeholder sizes a card rail gives `placeholderClassName` while it loads. */
export const RAIL_CARD_PLACEHOLDERS = {
  /** A balance card: 150px wide on a phone, 196px from `md` (mockups 34, 30). */
  balance: 'h-24 w-37.5 md:h-29 md:w-49',
  /** A budget's or a goal's card: 230px wide on a phone, 272px from `md`. */
  ring: 'h-19.5 w-57.5 md:h-23.5 md:w-68',
} as const;

/**
 * Picks a budget's tone: coral once spend passes the target, sun from
 * `railCard.budgetNearPercent` (a budget used up exactly is sun, not over).
 *
 * @param percent - Spend against the target, whole.
 * @param over - Whether spend is above the target.
 * @returns The ring's tone.
 */
const budgetTone = (percent: number, over: boolean): BudgetStatus['tone'] => {
  if (over) return 'coral';
  return percent >= railCardSettings.budgetNearPercent ? 'sun' : 'mint';
};

/**
 * Reads a budget's state for the month from its spend and target.
 *
 * @param spend - Money out − money in across its categories, in minor units (OQ-201).
 * @param target - The month's target, in minor units.
 * @returns Its percent, tone, whether it is over and by how much, or what is left.
 */
export const budgetStatus = (spend: number, target: number): BudgetStatus => {
  const over = spend > target;
  const percent = wholePercent(spend, target);
  return {
    percent,
    tone: budgetTone(percent, over),
    over,
    remainder: Math.abs(target - spend),
  };
};

/**
 * Reads a goal's state from what funds it in its own currency and its target.
 *
 * @param funded - What is counted in the goal's own currency, in minor units.
 * @param target - The goal's target, in minor units.
 * @returns Its percent, whether it is reached and what is to go.
 */
export const goalStatus = (funded: number, target: number): GoalStatus => ({
  percent: wholePercent(funded, target),
  reached: funded >= target,
  toGo: Math.max(0, target - funded),
});
