import { describe, expect, it } from 'vitest';
import { hasMatured, splitRefusal } from '../../../../src/managers/account/holdings';

const NOW = new Date('2026-10-13T12:00:00Z');

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
  rateSpread: null,
  incentivised: null,
  interestPayment: 'at_maturity' as const,
  dueDate: '2027-05-03',
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
