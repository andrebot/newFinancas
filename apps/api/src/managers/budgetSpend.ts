import { findKind, type Direction } from '@financas/reference';
import type { MonthSpend } from '../accessors/budgetAccessor';
import { monthOf } from '../accessors/calendarMonth';
import type { MonthKindTotal } from '../accessors/ledgerQuery';

// A Budget's spend (FR-4.5, OQ-201 D4): money out minus money in across its
// claimed categories. TransactionManager counts each transaction as it is
// written; AccountManager restates a month from the ledgers when a Budget is
// created or its claims change (OQ-166). Shared here so the two always agree.

/**
 * One amount's share of a Budget's spend: money in lowers it.
 *
 * @param direction - Which way the money moved.
 * @param amount - The stored, positive amount.
 * @returns The signed spend.
 */
export const signedSpend = (direction: Direction, amount: number): number => (
  direction === 'in' ? -amount : amount
);

/**
 * Folds the ledgers' sums into each month's spend in the Budget's currency.
 *
 * @param sums - Sums by month (`YYYY-MM`), currency and kind, from both ledgers.
 * @param currency - The Budget's currency; sums in another are left out.
 * @returns Each month's spend, for every month with a sum.
 */
export const spendByMonth = (
  sums: readonly MonthKindTotal[],
  currency: string,
): MonthSpend[] => {
  const totals = new Map<string, number>();
  sums.filter((sum) => sum.currency === currency).forEach((sum) => {
    const direction = findKind(sum.kind)?.direction === 'in' ? 'in' : 'out';
    totals.set(sum.month, (totals.get(sum.month) ?? 0) + signedSpend(direction, sum.total));
  });
  return [...totals].map(([month, amount]) => ({ month: monthOf(`${month}-01`), amount }));
};
