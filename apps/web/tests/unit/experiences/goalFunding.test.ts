import type { GoalWithProgress } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import { ownFundingOf, splitGoalsOf } from '../../../src/experiences/goalFunding';
import { goalOf } from './monthFixtures';

// A Goal's own-currency funding (BDT: pure logic shared by Experiences,
// unit; nothing mocked) — what the rail cards and the Goals page both read.

type Funder = GoalWithProgress['fundedBy'][number];

/**
 * Builds a USD Goal funded by the given rows.
 *
 * @param fundedBy - Its funding rows.
 * @returns The Goal with its progress.
 */
const goalFundedBy = (fundedBy: Funder[]): GoalWithProgress => ({
  id: 'trip',
  householdId: 'home',
  ownerUserId: 'jane',
  name: 'Trip to Japan',
  targetAmount: 600000,
  targetCurrency: 'USD',
  dueDate: '2028-04-01',
  visibility: 'shared',
  createdAt: '2026-01-01T00:00:00Z',
  completedAt: null,
  fundedBy,
});

/**
 * Builds one funding row.
 *
 * @param contribution - What it contributes, or null with no value yet.
 * @returns The row.
 */
const funder = (contribution: Funder['contribution']): Funder => ({
  holdingId: 'aapl', name: 'AAPL', percentage: 10, contribution,
});

describe('ownFundingOf', () => {
  it('sums the contributions in the goal\'s own currency', () => {
    const goal = goalFundedBy([
      funder({ currency: 'USD', amount: 48200 }),
      funder({ currency: 'USD', amount: 1800 }),
    ]);
    expect(ownFundingOf(goal)).toEqual({ funded: 50000, unfunded: false, needsRate: false });
  });

  it('leaves other currencies out and says they need a rate', () => {
    const goal = goalFundedBy([
      funder({ currency: 'USD', amount: 48200 }),
      funder({ currency: 'BRL', amount: 1650000 }),
    ]);
    expect(ownFundingOf(goal)).toEqual({ funded: 48200, unfunded: false, needsRate: true });
  });

  it('is unfunded only with no Holding at all', () => {
    expect(ownFundingOf(goalFundedBy([]))).toEqual({
      funded: 0, unfunded: true, needsRate: false,
    });
  });

  it('is funded, at 0, by a Holding with no value yet', () => {
    expect(ownFundingOf(goalFundedBy([funder(null)]))).toEqual({
      funded: 0, unfunded: false, needsRate: false,
    });
  });
});

describe('splitGoalsOf', () => {
  it('lists the active Goals first, each with its own-currency progress rounded down', () => {
    const trip = {
      ...goalOf('trip', [
        {
          holdingId: 'aapl',
          name: 'AAPL',
          percentage: 10,
          contribution: { currency: 'USD', amount: 10000 },
        },
        {
          holdingId: 'cdb',
          name: 'CDB',
          percentage: 10,
          contribution: { currency: 'BRL', amount: 99999 },
        },
      ]),
      targetAmount: 30000,
    };
    const done = goalOf('car');
    expect(splitGoalsOf([trip], [done])).toEqual([
      {
        id: 'trip', name: trip.name, progress: 33, completed: false,
      },
      {
        id: 'car', name: done.name, progress: 0, completed: true,
      },
    ]);
  });
});
