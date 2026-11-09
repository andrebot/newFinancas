import type { InvestmentHolding } from '@financas/api-types';
import { holdingIdOf } from './holdingNames';

// Which Holdings the payout chart shows (FL18, FL21; mockups 20, 50; FR-5.9,
// OQ-233): every Holding the first time, then the last choice, remembered
// per household. Choosing every Holding is kept as "all", so a Holding bought
// later joins the chart by itself; a remembered Holding that is gone is
// dropped, from the selector and from the request. "All" asks the payouts
// report for every Holding, with no list — it needs no Holdings read first;
// a list waits for them. Pure, so it tests without React.

/** The remembered choice: every Holding, or these ones. */
export type PayoutSelection = 'all' | readonly string[];

/**
 * Reads a remembered choice.
 *
 * @param stored - What storage holds: `all`, a JSON list of ids, or nothing.
 * @returns The choice; every Holding when nothing (or something unreadable) is stored.
 */
export const parseSelection = (stored: string | null): PayoutSelection => {
  try {
    const parsed: unknown = JSON.parse(stored ?? '"all"');
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')
      ? parsed
      : 'all';
  } catch {
    return 'all';
  }
};

/**
 * Writes a choice for storage.
 *
 * @param selection - The choice.
 * @returns `"all"` or a JSON list of ids.
 */
export const serializeSelection = (selection: PayoutSelection) => JSON.stringify(selection);

/**
 * Lists the Holdings a choice means, among the ones the household has.
 *
 * @param selection - The choice.
 * @param holdings - The household's Holdings.
 * @returns Their ids, in the Holdings' order; a remembered one that is gone is left out.
 */
export const chosenIdsOf = (
  selection: PayoutSelection,
  holdings: readonly InvestmentHolding[],
): string[] => {
  const ids = holdings.map(holdingIdOf);
  return selection === 'all' ? ids : ids.filter((id) => selection.includes(id));
};

/**
 * Turns what the selector chose into the choice to remember.
 *
 * @param ids - The ids chosen.
 * @param holdings - The household's Holdings.
 * @returns `all` when every Holding is chosen, otherwise the ids.
 */
export const selectionOf = (
  ids: readonly string[],
  holdings: readonly InvestmentHolding[],
): PayoutSelection => (
  holdings.length > 0 && holdings.every((holding) => ids.includes(holdingIdOf(holding)))
    ? 'all'
    : [...ids]
);

/**
 * Tells the payouts report which Holdings to sum: what the selector shows, so a
 * remembered Holding that is gone is never asked for (review round 1).
 *
 * @param selection - The choice.
 * @param holdings - The household's Holdings.
 * @returns The ids for `holdingIds`; none for every Holding.
 */
export const queryIdsOf = (
  selection: PayoutSelection,
  holdings: readonly InvestmentHolding[],
): readonly string[] | undefined => (
  selection === 'all' ? undefined : chosenIdsOf(selection, holdings)
);
