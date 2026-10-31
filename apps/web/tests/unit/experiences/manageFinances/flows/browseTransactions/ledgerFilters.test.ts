import { describe, expect, it } from 'vitest';
import {
  activeFilterCount, chosenInGroup, holdingFilters, isRangeClear, kindCodesOf, NO_FILTERS,
  queryOf, rangeProblemsOf, withGroupKinds,
} from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerFilters';

// The ledger's filters (BDT: Flow rules, unit — pure).

const range = (from: string, to: string) => ({ preset: 'custom' as const, from, to });

describe('kind groups', () => {
  it("lists a group's kinds in picker order", () => {
    expect(kindCodesOf('credit_card')).toEqual(['credit_card_bill_payment', 'charge', 'refund']);
  });

  it("picks a group's ticked kinds", () => {
    expect(chosenInGroup(['deposit', 'charge', 'pix_payment'], 'cash'))
      .toEqual(['deposit', 'pix_payment']);
  });

  it("replaces a group's kinds, keeping the others and the picker order", () => {
    expect(withGroupKinds(['charge', 'deposit'], 'cash', ['pix_receipt', 'withdrawal']))
      .toEqual(['withdrawal', 'pix_receipt', 'charge']);
    expect(withGroupKinds(['charge', 'deposit'], 'cash', [])).toEqual(['charge']);
  });
});

describe('activeFilterCount', () => {
  it('counts nothing for no filter', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
  });

  it('counts each kind of filter once — accounts and cards are one', () => {
    expect(activeFilterCount({
      kinds: ['charge', 'refund'],
      accountIds: ['itau'],
      creditCardIds: ['visa1'],
      categoryIds: ['groceries'],
      holdingId: 'bbas3',
      range: range('2026-01-01', ''),
    })).toBe(5);
    expect(activeFilterCount({ ...NO_FILTERS, creditCardIds: ['visa1'] })).toBe(1);
    expect(activeFilterCount({ ...NO_FILTERS, range: range('', '2026-01-01') })).toBe(1);
  });
});

describe('queryOf', () => {
  it('sends nothing for no filter', () => {
    expect(queryOf(NO_FILTERS)).toEqual({});
  });

  it('sends only the lists with something, the Holding and the set dates', () => {
    expect(queryOf({
      ...NO_FILTERS,
      kinds: ['charge'],
      creditCardIds: ['visa1'],
      holdingId: 'bbas3',
      range: range('2026-01-01', ''),
    })).toEqual({
      kinds: ['charge'], creditCardIds: ['visa1'], holdingId: 'bbas3', from: '2026-01-01',
    });
    expect(queryOf({ ...NO_FILTERS, range: range('', '2026-02-01') }))
      .toEqual({ to: '2026-02-01' });
  });
});

describe('holdingFilters', () => {
  it('filters by the Holding alone', () => {
    expect(holdingFilters('bbas3')).toEqual({ ...NO_FILTERS, holdingId: 'bbas3' });
  });
});

describe('the range check', () => {
  it('passes an open or ordered range', () => {
    expect(isRangeClear(rangeProblemsOf(NO_FILTERS.range))).toBe(true);
    expect(isRangeClear(rangeProblemsOf(range('2026-01-01', '2026-01-01')))).toBe(true);
  });

  it('refuses a malformed date and a To before From', () => {
    expect(rangeProblemsOf(range('2026-13-01', ''))).toEqual({
      from: { code: 'string.format', params: { format: 'date' } },
    });
    const reversed = rangeProblemsOf(range('2026-02-01', '2026-01-01'));
    expect(reversed).toEqual({ to: { code: 'date.before_start' } });
    expect(isRangeClear(reversed)).toBe(false);
  });

  it('refuses a range with only its From wrong (review V4)', () => {
    expect(isRangeClear(rangeProblemsOf(range('2026-13-01', '')))).toBe(false);
  });
});
