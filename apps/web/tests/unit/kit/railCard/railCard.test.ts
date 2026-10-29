import { describe, expect, it } from 'vitest';
import { railCard } from '../../../../src/config/constants';
import { budgetStatus, goalStatus } from '../../../../src/kit/railCard/railCard';

// Kit helpers (BDT: Interaction tier → unit): pure, nothing to stand in for.

describe('budgetStatus', () => {
  it('is mint with what is left while on track', () => {
    expect(budgetStatus(14550, 30000)).toEqual({
      percent: 48, tone: 'mint', over: false, remainder: 15450,
    });
  });

  it('turns sun from the near-limit share', () => {
    const near = railCard.budgetNearPercent;
    expect(budgetStatus(near * 100 - 1, 10000).tone).toBe('mint');
    expect(budgetStatus(near * 100, 10000).tone).toBe('sun');
  });

  it('is sun with nothing left when used up exactly, not over', () => {
    expect(budgetStatus(40000, 40000)).toEqual({
      percent: 100, tone: 'sun', over: false, remainder: 0,
    });
  });

  it('is coral and over by the excess once spend passes the target', () => {
    expect(budgetStatus(425000, 400000)).toEqual({
      percent: 106, tone: 'coral', over: true, remainder: 25000,
    });
  });

  it('reads 0% and more than the target left when refunds outweigh spend', () => {
    expect(budgetStatus(-2000, 40000)).toEqual({
      percent: 0, tone: 'mint', over: false, remainder: 42000,
    });
  });
});

describe('goalStatus', () => {
  it('gives the percent and what is to go', () => {
    expect(goalStatus(320000, 1000000)).toEqual({ percent: 32, reached: false, toGo: 680000 });
  });

  it('is reached at the target and past it, with nothing to go', () => {
    expect(goalStatus(1000000, 1000000)).toEqual({ percent: 100, reached: true, toGo: 0 });
    expect(goalStatus(1100000, 1000000)).toEqual({ percent: 110, reached: true, toGo: 0 });
  });
});
