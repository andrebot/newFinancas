import type { Account, Currency, MonthOverviewReport } from '@financas/api-types';
import { money, monthOverview as settings } from '../../../../config/constants';
import type { PeriodMonth } from '../../../../kit/periodBar/periodBar';

// What the Month Overview Flow (FL17, FR-6.11, OQ-221) reads from the
// report: the year strip and the summary narrowed to the $ / R$ switch's
// currency — never summed across currencies — how far back the period bar
// reaches, and which currency the switch opens on. Pure, so it tests without
// React.

/** One currency's month: money in, money out and the net, in minor units. */
export interface MonthFigures {
  readonly in: number;
  readonly out: number;
  readonly net: number;
}

const NOTHING: MonthFigures = { in: 0, out: 0, net: 0 };

/**
 * Narrows the year strip to one currency, each month read as its number.
 *
 * @param yearStrip - The report's months, in every currency.
 * @param currency - The switch's currency.
 * @returns The months the period bar draws; a month left out reads as empty.
 */
export const stripOf = (
  yearStrip: MonthOverviewReport['yearStrip'],
  currency: Currency,
): PeriodMonth[] => yearStrip
  .filter((row) => row.currency === currency)
  .map((row) => ({ month: Number(row.month.slice(5, 7)), in: row.in, out: row.out }));

/**
 * Picks one currency's in, out and net for the month.
 *
 * @param summary - The report's per-currency figures.
 * @param currency - The switch's currency.
 * @returns Its figures; zeros when nothing moved in it.
 */
export const figuresOf = (
  summary: MonthOverviewReport['summary'],
  currency: Currency,
): MonthFigures => {
  const row = summary.find((item) => item.currency === currency);
  return row ? { in: row.in, out: row.out, net: row.net } : NOTHING;
};

/**
 * Reads the earliest year the period bar reaches: the household's creation
 * or an account's starting-balance date, whichever is first. History
 * backdated before both stays in the ledger (OQ-221).
 *
 * @param accounts - The accounts the user can see, archived ones included.
 * @param householdCreatedAt - When the household was created, ISO.
 * @returns The year.
 */
export const firstYearOf = (accounts: readonly Account[], householdCreatedAt: string) => (
  Math.min(
    Number(householdCreatedAt.slice(0, 4)),
    ...accounts.map((account) => Number(account.startingBalanceDate.slice(0, 4))),
  )
);

/**
 * Reads the switch's remembered currency.
 *
 * @param stored - What storage holds, if anything.
 * @returns The currency, or the default when nothing (or something unknown) is stored.
 */
export const rememberedCurrency = (stored: string | null): Currency => (
  money.currencies.find((currency) => currency === stored) ?? settings.defaultCurrency
);
