import { describe, expect, it } from 'vitest';
import { inTileOrder, netWorthTileOf } from '../../../src/experiences/netWorthTiles';
import { createFormatter } from '../../../src/utilities/formatting';
import { createTranslator } from '../../../src/utilities/i18n';
import { OVERVIEW } from './portfolioFixtures';

// Net Worth Cards' one mapping (BDT: pure helper, unit, the real translator
// and formatter).

const BRL = OVERVIEW.netWorth[0]!;
const translator = createTranslator('en-US');
const formatter = createFormatter('en-US');

describe('netWorthTileOf', () => {
  it('names the tile by its currency and keeps its figure', () => {
    const tile = netWorthTileOf(BRL, translator, formatter);
    expect(tile.label).toBe('Net worth · BRL');
    expect(tile.amount).toBe(35860000);
    expect(tile.currency).toBe('BRL');
  });

  it('places each month on its last day, written in the currency', () => {
    const [august] = netWorthTileOf(BRL, translator, formatter).points;
    expect(august).toEqual({
      key: '2026-08',
      date: '2026-08-31',
      value: 32740000,
      valueLabel: formatter.money(32740000, 'BRL'),
      dateLabel: 'August 2026',
    });
  });

  it('compares against the month before the newest, in the interface language', () => {
    expect(netWorthTileOf(BRL, translator, formatter).change)
      .toEqual({ amount: 3120000, comparedTo: 'Aug' });
    expect(netWorthTileOf(BRL, createTranslator('pt-BR'), createFormatter('pt-BR')).change)
      .toEqual({ amount: 3120000, comparedTo: 'ago.' });
  });

  it('compares against the month before the newest of a longer series (R4 V7)', () => {
    const series = [
      { month: '2026-07', amount: 1 }, { month: '2026-08', amount: 2 },
      { month: '2026-09', amount: 3 },
    ];
    expect(netWorthTileOf({ ...BRL, series }, translator, formatter).change?.comparedTo)
      .toBe('Aug');
  });

  it('has no change when the report leaves it out (a first month)', () => {
    const first = { currency: BRL.currency, amount: BRL.amount, series: BRL.series };
    expect(netWorthTileOf(first, translator, formatter).change).toBeUndefined();
  });

  it('has no change when there is no month to name', () => {
    expect(netWorthTileOf({ ...BRL, series: [] }, translator, formatter).change).toBeUndefined();
  });
});

describe('inTileOrder', () => {
  it('puts USD before BRL, as the mockups draw them', () => {
    expect(inTileOrder(OVERVIEW.netWorth).map((entry) => entry.currency)).toEqual(['USD', 'BRL']);
  });

  it('leaves the report untouched', () => {
    inTileOrder(OVERVIEW.netWorth);
    expect(OVERVIEW.netWorth[0]!.currency).toBe('BRL');
  });
});
