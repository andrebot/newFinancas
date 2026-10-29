import { describe, expect, it } from 'vitest';
import {
  addableGoals,
  allocatedTotal,
  isAllocationValid,
  isShareMissing,
  rowOf,
  segmentsOf,
  type AllocationRow,
} from '../../../../src/kit/allocationEditor/allocation';

// Pure helpers of the allocation editor (BDT: Interaction tier → unit):
// nothing to stand in for.

/**
 * Builds a share of the split.
 *
 * @param goalId - Its Goal, also used as the name.
 * @param percent - Its percent, or `null` while empty.
 * @returns The row.
 */
const share = (goalId: string, percent: number | null): AllocationRow => ({
  goalId, name: goalId, percent,
});

describe('allocatedTotal', () => {
  it('adds the shares up, an empty box counting as nothing', () => {
    expect(allocatedTotal([share('house', 60), share('car', null), share('fund', 25)])).toBe(85);
  });

  it('is 0 for an empty split and may pass 100', () => {
    expect(allocatedTotal([])).toBe(0);
    expect(allocatedTotal([share('house', 70), share('car', 40)])).toBe(110);
  });
});

describe('isShareMissing', () => {
  it('flags an empty box and a share under 1%', () => {
    expect(isShareMissing(share('house', null))).toBe(true);
    expect(isShareMissing(share('house', 0))).toBe(true);
  });

  it('accepts a share from 1% up', () => {
    expect(isShareMissing(share('house', 1))).toBe(false);
  });
});

describe('isAllocationValid', () => {
  it('accepts an empty split and one up to exactly 100%', () => {
    expect(isAllocationValid([])).toBe(true);
    expect(isAllocationValid([share('house', 60), share('car', 40)])).toBe(true);
  });

  it('refuses a split over 100%', () => {
    expect(isAllocationValid([share('house', 60), share('car', 41)])).toBe(false);
  });

  it('refuses a split with an empty or 0% share', () => {
    expect(isAllocationValid([share('house', 60), share('car', null)])).toBe(false);
    expect(isAllocationValid([share('house', 0)])).toBe(false);
  });
});

describe('addableGoals', () => {
  it('leaves out the Goals already in the split, keeping the given order', () => {
    const goals = [
      { id: 'house', name: 'House' },
      { id: 'car', name: 'Car' },
      { id: 'fund', name: 'Fund' },
    ];

    expect(addableGoals(goals, [share('car', 10)])).toEqual([goals[0], goals[2]]);
  });
});

describe('segmentsOf', () => {
  it('draws one segment per share, sky and its soft shade by turns, empty as 0', () => {
    expect(segmentsOf([share('house', 60), share('car', null), share('fund', 25)])).toEqual([
      { value: 60, tone: 'sky' },
      { value: 0, tone: 'skysoft' },
      { value: 25, tone: 'sky' },
    ]);
  });
});

describe('rowOf', () => {
  it('turns a Goal into an empty share, keeping its progress', () => {
    expect(rowOf({ id: 'house', name: 'House', progress: 57 })).toEqual({
      goalId: 'house', name: 'House', percent: null, progress: 57,
    });
  });
});
