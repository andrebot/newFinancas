import type { InvestmentsOverviewReport } from '@financas/api-types';
import { portfolio } from '../config/constants';
import type { StatTileProps } from '../kit/statTile/StatTile';
import type { Formatter } from '../utilities/formatting';
import type { Translator } from '../utilities/i18n';
import { monthEnd, shiftMonth } from './reportMonths';

// Net Worth Cards' one mapping (FL18, FL21; OQ-231, OQ-233): a `netWorth`
// entry of the investments overview, as K37's props — the same tiles on the
// Investments overview and the Dashboard. A month's figure sits on the
// month's last day; the change compares against the month before the series'
// newest, and there is no pill when the report leaves the change out (a first
// month). Pure, so it tests without React.

/** One currency's net worth, as the report sends it. */
export type NetWorthEntry = InvestmentsOverviewReport['netWorth'][number];

/**
 * Builds a tile's change pill, when there is a change to show.
 *
 * @param entry - The currency's net worth.
 * @param formatter - Writes the month compared against.
 * @returns The change, or nothing without one or without a month to name.
 */
const changeOf = (entry: NetWorthEntry, formatter: Formatter): StatTileProps['change'] => {
  const newest = entry.series.at(-1);
  if (entry.changeVsPreviousMonth === undefined || newest === undefined) return undefined;
  return {
    amount: entry.changeVsPreviousMonth,
    comparedTo: formatter.date(`${shiftMonth(newest.month, -1)}-01`, 'monthShort'),
  };
};

/**
 * Maps one currency's net worth to a Stat tile.
 *
 * @param entry - The currency's net worth.
 * @param translator - Names the tile.
 * @param formatter - Writes the points and the month compared against.
 * @returns The tile's props, without the chart's look, which is the page's.
 */
export const netWorthTileOf = (
  entry: NetWorthEntry,
  translator: Translator,
  formatter: Formatter,
): StatTileProps => ({
  label: translator.text('netWorthCards', 'label', { currency: entry.currency }),
  amount: entry.amount,
  currency: entry.currency,
  change: changeOf(entry, formatter),
  points: entry.series.map(({ month, amount }) => ({
    key: month,
    date: monthEnd(month),
    value: amount,
    valueLabel: formatter.money(amount, entry.currency),
    dateLabel: formatter.date(`${month}-01`, 'monthYear'),
  })),
});

/**
 * Puts the currencies in the order the tiles are drawn (mockups 20, 50).
 *
 * @param entries - The report's net worth, one entry per currency.
 * @returns The entries, in `portfolio.netWorthOrder`.
 */
export const inTileOrder = (entries: readonly NetWorthEntry[]): NetWorthEntry[] => (
  [...entries].sort((first, second) => {
    const order: readonly string[] = portfolio.netWorthOrder;
    return order.indexOf(first.currency) - order.indexOf(second.currency);
  })
);
