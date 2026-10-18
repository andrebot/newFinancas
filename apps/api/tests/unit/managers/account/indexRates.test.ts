import { describe, expect, it } from 'vitest';
import { rateChangesOf, seriesOf } from '../../../../src/managers/account/indexRates';

const NOW = new Date('2026-10-13T12:00:00Z');

/**
 * A recorded value.
 *
 * @param indexCode - Its index.
 * @param asOfDate - Its day.
 * @returns The value.
 */
const rate = (indexCode: 'selic' | 'ipca', asOfDate: string) => ({
  id: `${indexCode}-${asOfDate}`,
  householdId: 'h1',
  indexCode,
  value: 100000,
  asOfDate,
  createdByUserId: null,
  createdAt: NOW,
});

describe('seriesOf (OQ-172, OQ-178)', () => {
  it('gives every index its unit and its values, in the in-code order', () => {
    const ipca = rate('ipca', '2026-09-01');
    const newer = rate('selic', '2026-10-01');
    const older = rate('selic', '2026-09-01');

    expect(seriesOf([ipca, newer, older])).toEqual([
      { index: 'selic', unit: 'annual_percent', values: [newer, older] },
      { index: 'cdi', unit: 'annual_percent', values: [] },
      { index: 'ipca', unit: 'trailing_12m_percent', values: [ipca] },
      { index: 'igpm', unit: 'trailing_12m_percent', values: [] },
    ]);
  });
});

describe('rateChangesOf', () => {
  it('renames each field sent to the Accessor\'s name', () => {
    expect(rateChangesOf({ value: -2000, asOf: '2026-10-01' }))
      .toEqual({ value: -2000, asOfDate: '2026-10-01' });
  });

  it('leaves out the fields not sent', () => {
    expect(rateChangesOf({ value: 1 })).toEqual({ value: 1 });
    expect(rateChangesOf({ asOf: '2026-10-01' })).toEqual({ asOfDate: '2026-10-01' });
    expect(rateChangesOf({})).toEqual({});
  });
});
