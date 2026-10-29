// How the grouped list (K41, OQ-217) gathers the caller's items under their
// months and days. Pure, so it tests without React. The items come already
// ordered (the ledger's newest first) and keep that order; a month or day
// split across two pages joins up again, since the caller passes every item
// loaded so far.

/** A day's items, in the order given. */
export interface ListDay<Item> {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly items: readonly Item[];
}

/** A month's days, in the order given. */
export interface ListMonth<Item> {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly days: readonly ListDay<Item>[];
}

/**
 * Groups items under their month, then their day. A new group starts each
 * time the date changes, so the groups follow the items' own order.
 *
 * @param items - The items, already ordered.
 * @param dateOf - Reads an item's date, `YYYY-MM-DD`.
 * @returns The months, each with its days.
 */
export const groupByMonthAndDay = <Item>(
  items: readonly Item[],
  dateOf: (item: Item) => string,
): ListMonth<Item>[] => {
  const months: { month: string; days: { date: string; items: Item[] }[] }[] = [];
  items.forEach((item) => {
    const date = dateOf(item);
    const month = date.slice(0, 7);
    if (months.at(-1)?.month !== month) months.push({ month, days: [] });
    const { days } = months.at(-1)!;
    if (days.at(-1)?.date !== date) days.push({ date, items: [] });
    days.at(-1)!.items.push(item);
  });
  return months;
};
