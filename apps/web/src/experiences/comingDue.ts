import type { InvestmentHolding, InvestmentsOverviewReport } from '@financas/api-types';
import { portfolio } from '../config/constants';
import { monthOfDate } from './reportMonths';

// What Coming Due shows of each fixed-term Holding still open (FL18, FL21;
// mockups 20, 50; OQ-233): its type, from the Holdings list, and either how
// many months away it is due — when that is soon — or the year. Soonest
// first. Pure, so it tests without React.

/** One fixed-term Holding still open, as the report sends it. */
export type ComingDueEntry = InvestmentsOverviewReport['comingDue'][number];

/** When a Holding comes due, as a row reads it. */
export type DueIn = | { readonly soon: true; readonly months: number }
  | { readonly soon: false; readonly year: string };

/** One row of the Coming Due list. */
export interface ComingDueRow {
  readonly entry: ComingDueEntry;
  /** The Holding's asset type; unknown when the Holdings list doesn't hold it. */
  readonly assetType: string | undefined;
  readonly dueIn: DueIn;
}

/**
 * Counts the whole months from one month to another.
 *
 * @param from - `YYYY-MM`.
 * @param to - `YYYY-MM`.
 * @returns How many months later `to` is.
 */
const monthsBetween = (from: string, to: string) => (
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12
    + Number(to.slice(5, 7)) - Number(from.slice(5, 7))
);

/**
 * Tells how a due date reads: soon in months, or later by its year.
 *
 * @param dueDate - `YYYY-MM-DD`.
 * @param today - `YYYY-MM-DD`.
 * @returns The months away while soon, otherwise the year.
 */
export const dueInOf = (dueDate: string, today: string): DueIn => {
  const months = monthsBetween(monthOfDate(today), monthOfDate(dueDate));
  return months <= portfolio.comingDueSoonMonths
    ? { soon: true, months: Math.max(0, months) }
    : { soon: false, year: dueDate.slice(0, 4) };
};

/**
 * Builds the Coming Due rows, soonest first.
 *
 * @param entries - The report's fixed-term Holdings still open.
 * @param holdings - The household's Holdings, for each one's type.
 * @param today - `YYYY-MM-DD`.
 * @returns The rows; a tie keeps the report's order.
 */
export const comingDueRowsOf = (
  entries: readonly ComingDueEntry[],
  holdings: readonly InvestmentHolding[],
  today: string,
): ComingDueRow[] => {
  const types = new Map(holdings.map((holding) => [holding.id, holding.assetType]));
  return [...entries]
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
    .map((entry) => ({
      entry,
      assetType: types.get(entry.holdingId),
      dueIn: dueInOf(entry.dueDate, today),
    }));
};
