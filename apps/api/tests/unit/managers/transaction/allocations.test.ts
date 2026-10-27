import { describe, expect, it } from 'vitest';
import type { AllocationShare } from '../../../../src/accessors/goalAccessor';
import {
  reweightSplit,
  roundByLargestRemainder,
} from '../../../../src/managers/transaction/allocations';

// OQ-168: a buy into an existing market-priced Holding re-weights the whole split
// by value — every Goal keeps exactly its money; whole percents keep their exact
// total (they need not reach 100) and 0% shares are dropped.

const share = (goalId: string, percentage: number): AllocationShare => ({ goalId, percentage });

describe('reweightSplit', () => {
  it('keeps each Goal its money when a buy funds another Goal', () => {
    const current = [share('A', 50), share('B', 50)]; // worth 10_000 total
    const purchase = [share('C', 100)]; // 10_000 more, all to C
    expect(reweightSplit(current, 10_000, purchase, 10_000)).toEqual([
      share('A', 25), share('B', 25), share('C', 50),
    ]);
  });

  it('drops the old split when the position is worth nothing (OQ-171)', () => {
    const current = [share('A', 100)]; // zeroed position: its shares are worth 0
    const purchase = [share('B', 100)];
    expect(reweightSplit(current, 0, purchase, 5_000)).toEqual([share('B', 100)]);
  });

  it('keeps a Goal funded by both the position and the buy', () => {
    const current = [share('A', 60), share('B', 40)]; // worth 1_000 → A 600, B 400
    const purchase = [share('A', 50), share('C', 50)]; // 3_000 more → A +1_500, C 1_500
    // Totals: A 2_100 (52.5%), B 400 (10%), C 1_500 (37.5%) of 4_000; the tie on
    // the .5 fractions goes to A, which comes first (OQ-87).
    expect(reweightSplit(current, 1_000, purchase, 3_000)).toEqual([
      share('A', 53), share('B', 10), share('C', 37),
    ]);
  });

  it('returns nothing when no Goal is funded and the total is zero', () => {
    expect(reweightSplit([], 0, [], 0)).toEqual([]);
  });

  it('lets the split fall short of 100% (OQ-87)', () => {
    // A owns a position worth 1_000; an unallocated buy adds 2_000 → A is 33.3%.
    expect(reweightSplit([share('A', 100)], 1_000, [], 2_000)).toEqual([share('A', 33)]);
  });
});

describe('roundByLargestRemainder', () => {
  it('keeps the exact total with three equal thirds', () => {
    const result = roundByLargestRemainder([
      { goalId: 'A', percentage: 100 / 3 },
      { goalId: 'B', percentage: 100 / 3 },
      { goalId: 'C', percentage: 100 - 2 * (100 / 3) },
    ]);
    // The .333… fractions tie between A and B in float; input order gives A the extra.
    expect(result).toEqual([share('A', 34), share('B', 33), share('C', 33)]);
    expect(result.reduce((sum, part) => sum + part.percentage, 0)).toBe(100);
  });

  it('gives the extra percent to the biggest fraction', () => {
    const result = roundByLargestRemainder([
      { goalId: 'A', percentage: 50.2 },
      { goalId: 'B', percentage: 49.7 },
      { goalId: 'C', percentage: 0.1 },
    ]);
    expect(result).toEqual([share('A', 50), share('B', 50)]);
  });

  it('keeps input order on a tie (OQ-87)', () => {
    const result = roundByLargestRemainder([
      { goalId: 'A', percentage: 50.5 },
      { goalId: 'B', percentage: 50.5 },
    ]);
    expect(result).toEqual([share('A', 51), share('B', 50)]);
  });

  it('drops a share that rounds to zero', () => {
    const result = roundByLargestRemainder([
      { goalId: 'A', percentage: 0.4 },
      { goalId: 'B', percentage: 99.6 },
    ]);
    expect(result).toEqual([share('B', 100)]);
  });

  it('returns nothing for an empty split', () => {
    expect(roundByLargestRemainder([])).toEqual([]);
  });
});
