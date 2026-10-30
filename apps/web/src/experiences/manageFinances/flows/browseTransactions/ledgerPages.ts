import type { Currency, LedgerItem, TransactionPage } from '@financas/api-types';
import type { GroupedListStatus } from '../../../../kit/groupedList/GroupedList';

// The ledger as loaded so far (FL16; OQ-207, OQ-220): the Experience's
// infinite query hands the Flow every page it holds — refetched whole after a
// record, an edit or a delete — and the Flow reads them as one list. A row
// seen on an earlier page isn't drawn twice; a day's totals and a month's
// count are the server's, over the whole filtered set, so a day or month split
// across two pages keeps the same figures.

/** What the Experience holds of the ledger. */
export interface LoadedLedger {
  /** Every page loaded so far, oldest request first. */
  readonly pages: readonly TransactionPage[];
  /** Whether more pages follow. */
  readonly hasMore: boolean;
  /** Whether a page is loading or failed. */
  readonly status: GroupedListStatus;
}

/** A day's net in one currency. */
export interface DayTotal {
  readonly currency: Currency;
  readonly net: number;
}

/** The ledger read as one list. */
export interface LedgerView {
  /** The rows, newest first, each once. */
  readonly items: readonly LedgerItem[];
  /** Each day's nets, R$ first; `YYYY-MM-DD` keys. */
  readonly dayTotals: ReadonlyMap<string, readonly DayTotal[]>;
  /** Each month's count; `YYYY-MM` keys. */
  readonly monthCounts: ReadonlyMap<string, number>;
}

/** The currencies' order in a day's totals: R$ first (OQ-217). */
const CURRENCY_ORDER: readonly Currency[] = ['BRL', 'USD'];

/**
 * Keys a row: ids are unique across both ledgers, the ledger keeps it safe.
 *
 * @param item - The row.
 * @returns Its key.
 */
export const rowKeyOf = (item: LedgerItem) => `${item.ledger}:${item.id}`;

/**
 * Keeps each row once, in order.
 *
 * @param pages - The pages.
 * @returns The rows.
 */
const itemsOf = (pages: readonly TransactionPage[]) => {
  const seen = new Set<string>();
  return pages.flatMap((page) => page.items ?? []).filter((item) => {
    const key = rowKeyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Gathers each day's nets, one per currency, R$ first.
 *
 * @param pages - The pages.
 * @returns The nets by day.
 */
const dayTotalsOf = (pages: readonly TransactionPage[]) => {
  const byDay = new Map<string, Map<Currency, number>>();
  pages.flatMap((page) => page.dayTotals ?? []).forEach(({ date, currency, net }) => {
    if (!date || !currency) return;
    const day = byDay.get(date) ?? new Map<Currency, number>();
    day.set(currency, net ?? 0);
    byDay.set(date, day);
  });
  return new Map([...byDay].map(([date, nets]) => [
    date,
    [...nets]
      .sort(([one], [other]) => CURRENCY_ORDER.indexOf(one) - CURRENCY_ORDER.indexOf(other))
      .map(([currency, net]) => ({ currency, net })),
  ]));
};

/**
 * Reads the pages as one list.
 *
 * @param pages - The pages loaded so far.
 * @returns The rows, the day totals and the month counts.
 */
export const ledgerViewOf = (pages: readonly TransactionPage[]): LedgerView => ({
  items: itemsOf(pages),
  dayTotals: dayTotalsOf(pages),
  monthCounts: new Map(pages.flatMap((page) => page.monthCounts ?? []).flatMap(
    ({ month, count }) => (month === undefined ? [] : [[month, count ?? 0] as const]),
  )),
});
