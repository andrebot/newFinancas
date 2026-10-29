import { describe, expect, it } from 'vitest';
import {
  allOptions, applyPreset, chosenNames, countChosen, everyValue, toggleValue,
} from '../../../../src/kit/multiSelect/choices';
import type { SelectEntry } from '../../../../src/kit/select/options';

// Kit helpers (BDT: Utility → unit, pure): the multi-select's moves on the
// choice, with nothing mocked.

type Holding = 'cash' | 'xpml' | 'knri' | 'vale' | 'cdb';

const holdings: readonly SelectEntry<Holding>[] = [
  { value: 'cash', label: 'Cash' },
  {
    group: 'FIIs',
    options: [
      { value: 'xpml', label: 'XPML11' },
      { value: 'knri', label: 'KNRI11' },
    ],
  },
  {
    group: 'Stocks',
    options: [
      { value: 'vale', label: 'VALE3' },
      { value: 'cdb', label: 'CDB Inter', disabledReason: 'Archived' },
    ],
  },
];

describe('allOptions', () => {
  it('lists loose and grouped options in display order', () => {
    expect(allOptions(holdings).map((option) => option.value))
      .toEqual(['cash', 'xpml', 'knri', 'vale', 'cdb']);
  });
});

describe('toggleValue', () => {
  it('adds a ticked option in display order, not tick order', () => {
    expect(toggleValue(holdings, ['vale'], 'xpml', true)).toEqual(['xpml', 'vale']);
  });

  it('removes an unticked option', () => {
    expect(toggleValue(holdings, ['xpml', 'vale'], 'xpml', false)).toEqual(['vale']);
  });

  it('drops values no option holds', () => {
    expect(toggleValue(holdings, ['gone' as Holding], 'cash', true)).toEqual(['cash']);
  });
});

describe('applyPreset', () => {
  it('replaces the choice with the preset’s values', () => {
    expect(applyPreset(holdings, ['cash', 'vale'], ['knri', 'xpml'])).toEqual(['xpml', 'knri']);
  });

  it('leaves disabled options as they were', () => {
    expect(applyPreset(holdings, ['cdb'], [])).toEqual(['cdb']);
    expect(applyPreset(holdings, [], everyValue(holdings)))
      .toEqual(['cash', 'xpml', 'knri', 'vale']);
  });
});

describe('everyValue', () => {
  it('lists every value, disabled ones too', () => {
    expect(everyValue(holdings)).toEqual(['cash', 'xpml', 'knri', 'vale', 'cdb']);
  });
});

describe('chosenNames', () => {
  it('lists the first chosen labels in display order and counts the rest', () => {
    expect(chosenNames(holdings, ['vale', 'cash', 'knri', 'xpml'], 3))
      .toEqual({ names: ['Cash', 'XPML11', 'KNRI11'], more: 1 });
  });

  it('counts nothing left over when every name fits', () => {
    expect(chosenNames(holdings, ['vale'], 3)).toEqual({ names: ['VALE3'], more: 0 });
    expect(chosenNames(holdings, [], 3)).toEqual({ names: [], more: 0 });
  });
});

describe('countChosen', () => {
  it('counts the chosen options of one section', () => {
    const section = { label: 'FIIs', options: allOptions(holdings).slice(1, 3) };
    expect(countChosen(section, ['xpml', 'vale'])).toBe(1);
  });
});
