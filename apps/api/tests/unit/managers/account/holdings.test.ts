import { describe, expect, it } from 'vitest';
import {
  canSeeGoal, growsCompletedGoal, hasMatured, hiddenShares, splitRefusal,
} from '../../../../src/managers/account/holdings';

const ANA = '0199c5a0-0000-7000-8000-000000000001';
const BEA = '0199c5a0-0000-7000-8000-000000000002';
const NOW = new Date('2026-10-13T12:00:00Z');

/**
 * A Goal with the given scope.
 *
 * @param visibility - Personal or shared.
 * @param ownerUserId - Its owner.
 * @returns The Goal.
 */
const goal = (visibility: 'personal' | 'shared', ownerUserId: string) => ({
  id: 'g1',
  householdId: 'h1',
  ownerUserId,
  name: 'House',
  targetAmount: 100,
  targetCurrency: 'BRL',
  dueDate: '2030-12-31',
  visibility,
  completedAt: null,
  createdAt: NOW,
});

/**
 * A fixed-term Holding (a CDB) with a position.
 *
 * @param changes - Fields that differ.
 * @returns The Holding.
 */
const holding = (changes: object = {}) => ({
  id: 'cdb',
  accountId: 'a1',
  assetType: 'cdb',
  ticker: null,
  quantity: 1,
  costBasis: 100000,
  rateType: 'cdi',
  rateValue: 1100000,
  incentivised: null,
  archivedAt: null,
  archivedBy: null,
  maturedNotifiedAt: null,
  createdAt: NOW,
  ...changes,
});

/**
 * A schedule entry.
 *
 * @param kind - Its kind.
 * @param date - Its date.
 * @returns The entry.
 */
const entry = (kind: string, date: string) => ({
  id: `${kind}-${date}`, holdingId: 'cdb', kind, amount: 1000, date, postedAt: null, createdAt: NOW,
});

describe('canSeeGoal', () => {
  it('sees every shared Goal, whatever the role', () => {
    expect(canSeeGoal('Viewer', ANA, goal('shared', BEA))).toBe(true);
  });

  it('sees only one\'s own personal Goals, even as Owner', () => {
    expect(canSeeGoal('Viewer', ANA, goal('personal', ANA))).toBe(true);
    expect(canSeeGoal('Owner', ANA, goal('personal', BEA))).toBe(false);
  });
});

describe('hiddenShares', () => {
  it('keeps the shares of Goals the editor can\'t see, as plain pairs', () => {
    const current = [
      {
        id: 'x', holdingId: 'cdb', goalId: 'seen', percentage: 40, createdAt: NOW,
      },
      {
        id: 'y', holdingId: 'cdb', goalId: 'hidden', percentage: 30, createdAt: NOW,
      },
    ];

    expect(hiddenShares(current, new Set(['seen'])))
      .toEqual([{ goalId: 'hidden', percentage: 30 }]);
  });
});

describe('growsCompletedGoal (FR-8.9, OQ-168)', () => {
  const current = [{ goalId: 'done', percentage: 20 }, { goalId: 'open', percentage: 30 }];
  const completed = new Set(['done']);

  it('passes a completed Goal kept unchanged or left out', () => {
    const kept = [{ goalId: 'done', percentage: 20 }];
    const leftOut = [{ goalId: 'open', percentage: 80 }];

    expect(growsCompletedGoal(kept, current, completed)).toBe(false);
    expect(growsCompletedGoal(leftOut, current, completed)).toBe(false);
  });

  it.each([25, 10])('refuses a completed Goal\'s share changed to %i', (percentage) => {
    expect(growsCompletedGoal([{ goalId: 'done', percentage }], current, completed)).toBe(true);
  });

  it('refuses a completed Goal moved to the share another Goal holds', () => {
    expect(growsCompletedGoal([{ goalId: 'done', percentage: 30 }], current, completed)).toBe(true);
  });

  it('refuses a completed Goal added', () => {
    expect(growsCompletedGoal([{ goalId: 'done', percentage: 20 }], [], completed)).toBe(true);
  });
});

describe('hasMatured (FR-5.8, OQ-178)', () => {
  const today = '2026-10-13';
  const schedule = [entry('interest_payment', '2026-04-01'), entry('redemption', '2026-10-12')];

  it('is true for a fixed-term Holding past its redemption date with a position', () => {
    expect(hasMatured(holding(), schedule, today)).toBe(true);
  });

  it('is false on the due date itself', () => {
    expect(hasMatured(holding(), [entry('redemption', today)], today)).toBe(false);
  });

  it('is false with no position, for a market-priced Holding, or with no redemption entry', () => {
    expect(hasMatured(holding({ quantity: 0 }), schedule, today)).toBe(false);
    expect(hasMatured(holding({ assetType: 'stock' }), schedule, today)).toBe(false);
    expect(hasMatured(holding(), [entry('interest_payment', '2026-04-01')], today)).toBe(false);
  });
});

describe('splitRefusal', () => {
  it.each([
    [{ ok: false, reason: 'holding_not_found' } as const, 'holding.not_found'],
    [{ ok: false, reason: 'goal_not_found', goalId: 'g' } as const, 'goal.not_found'],
  ])('answers %j with %s', (result, code) => {
    expect(splitRefusal(result)).toMatchObject({ domainError: { code } });
  });

  it('answers a split past 100% with both totals (FR-8.3)', () => {
    expect(splitRefusal({
      ok: false, reason: 'allocation_exceeds_100', current: 60, requested: 120,
    })).toMatchObject({
      domainError: {
        code: 'goal.allocation_exceeds_100', params: { current: 60, requested: 120 },
      },
    });
  });
});
