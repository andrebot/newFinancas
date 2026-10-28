import type { AllocationShare } from '../../accessors/goalAccessor';

// A buy's allocations split the purchase, not the Holding (OQ-168): buying into
// an existing market-priced Holding re-weights the whole split by value, so
// every Goal keeps exactly its money. The re-weighting is pure — TransactionManager
// computes it and writes it through `replaceAllocations`.

/**
 * Rounds whole percents by largest remainder so they keep their exact total —
 * a split need not reach 100% (OQ-87/OQ-168): each floor plus one for the
 * biggest fractions, up to the rounded sum of the exacts.
 *
 * @param exact - Each Goal's exact percentage.
 * @returns The rounded shares, 0% ones dropped; ties keep input order.
 */
export const roundByLargestRemainder = (exact: readonly {
  readonly goalId: string;
  readonly percentage: number;
}[]): AllocationShare[] => {
  const floors = exact.map(({ goalId, percentage }) => ({
    goalId, whole: Math.floor(percentage), fraction: percentage - Math.floor(percentage),
  }));
  const exactTotal = exact.reduce((sum, share) => sum + share.percentage, 0);
  const remaining = Math.round(exactTotal) - floors.reduce((sum, share) => sum + share.whole, 0);
  const order = floors.map((share, index) => ({ ...share, index }))
    .sort((first, second) => (second.fraction - first.fraction) || (first.index - second.index));
  for (const share of order.slice(0, remaining)) floors[share.index]!.whole += 1;
  return floors.filter((share) => share.whole > 0).map(({ goalId, whole }) => ({
    goalId, percentage: whole,
  }));
};

/**
 * Adds one Goal's money to the running total of a re-weighted split.
 *
 * @param money - The per-Goal totals so far.
 * @param goalId - The Goal.
 * @param amount - Minor units added to it.
 */
const addMoney = (money: Map<string, number>, goalId: string, amount: number): void => {
  if (amount !== 0) money.set(goalId, (money.get(goalId) ?? 0) + amount);
};

/**
 * Re-weights a Holding's split after a buy into it (OQ-168): each Goal keeps
 * its existing value — the position at this buy's unit price — plus whatever
 * of the purchase is allocated to it, and whole percents are rounded by largest
 * remainder so they still add up; a share that rounds to 0% is dropped.
 *
 * @param current - The Holding's split now (hidden shares included).
 * @param currentValue - Its existing value: quantity × this buy's unit price.
 * @param purchase - How the purchase itself is allocated.
 * @param purchaseValue - The purchase, in minor units.
 * @returns The new whole-percent split; empty when nothing funds a Goal.
 */
export const reweightSplit = (
  current: readonly AllocationShare[],
  currentValue: number,
  purchase: readonly AllocationShare[],
  purchaseValue: number,
): AllocationShare[] => {
  const total = currentValue + purchaseValue;
  if (total <= 0) return [];
  const money = new Map<string, number>();
  current.forEach((share) => {
    const part = (currentValue * share.percentage) / 100;
    addMoney(money, share.goalId, part);
  });
  purchase.forEach((share) => {
    const part = (purchaseValue * share.percentage) / 100;
    addMoney(money, share.goalId, part);
  });
  const exact = [...money.entries()].map(([goalId, amount]) => ({
    goalId, percentage: (amount * 100) / total,
  }));
  return roundByLargestRemainder(exact);
};
