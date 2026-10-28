import { describe, expect, it } from 'vitest';
import type { Goal } from '../../../src/accessors/goalAccessor';
import { canSeeGoal, growsCompletedGoal, hiddenShares } from '../../../src/managers/goalSplit';

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
const goal = (visibility: 'personal' | 'shared', ownerUserId: string): Goal => ({
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

describe('canSeeGoal (FR-8.1)', () => {
  it('sees every shared Goal, whatever the role', () => {
    expect(canSeeGoal('Viewer', ANA, goal('shared', BEA))).toBe(true);
  });

  it("sees only one's own personal Goals, even as Owner", () => {
    expect(canSeeGoal('Viewer', ANA, goal('personal', ANA))).toBe(true);
    expect(canSeeGoal('Owner', ANA, goal('personal', BEA))).toBe(false);
  });
});

describe('hiddenShares (OQ-178)', () => {
  it("keeps the shares of Goals the editor can't see, as plain pairs", () => {
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

  it.each([25, 10])("refuses a completed Goal's share changed to %i", (percentage) => {
    expect(growsCompletedGoal([{ goalId: 'done', percentage }], current, completed)).toBe(true);
  });

  it('refuses a completed Goal moved to the share another Goal holds', () => {
    expect(growsCompletedGoal([{ goalId: 'done', percentage: 30 }], current, completed)).toBe(true);
  });

  it('refuses a completed Goal added', () => {
    expect(growsCompletedGoal([{ goalId: 'done', percentage: 20 }], [], completed)).toBe(true);
  });
});
