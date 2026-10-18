import { describe, expect, it } from 'vitest';
import { groupByCurrentCycle } from '../../../../src/managers/account/accountViews';

const NOW = new Date('2026-10-13T12:00:00Z');

/**
 * A card closing on a day.
 *
 * @param id - The card's id.
 * @param closingDay - Its closing day.
 * @returns The card.
 */
const card = (id: string, closingDay: number) => ({
  id,
  accountId: 'a1',
  network: 'visa',
  last4: '1111',
  closingDay,
  dueDay: 20,
  expirationMonth: 1,
  expirationYear: 2030,
  createdAt: NOW,
});

describe('groupByCurrentCycle', () => {
  it('groups cards by the cycle of today: this month up to its closing day, else the next', () => {
    const cards = [card('c1', 17), card('c2', 5), card('c3', 31), card('c4', 16)];

    expect(groupByCurrentCycle(cards, '2026-10-17')).toEqual([
      { cycle: { year: 2026, month: 10 }, creditCardIds: ['c1', 'c3'] },
      { cycle: { year: 2026, month: 11 }, creditCardIds: ['c2', 'c4'] },
    ]);
  });

  it('rolls December over into January', () => {
    expect(groupByCurrentCycle([card('c1', 10)], '2026-12-20')).toEqual([
      { cycle: { year: 2027, month: 1 }, creditCardIds: ['c1'] },
    ]);
  });

  it('has no groups without cards', () => {
    expect(groupByCurrentCycle([], '2026-10-17')).toEqual([]);
  });
});
