import { describe, expect, it } from 'vitest';
import {
  activeFilterCount, chosenInGroup, holdingFilters, kindCodesOf, monthBoundsOf, NO_FILTERS,
  queryOf, withGroupKinds,
} from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerFilters';

// The ledger's filters (BDT: Flow rules, unit — pure).

const SEPTEMBER = { year: 2026, month: 9 };

describe('kind groups', () => {
  it("lists a group's kinds in picker order", () => {
    expect(kindCodesOf('credit_card'))
      .toEqual(['credit_card_bill_payment', 'charge', 'refund', 'card_fee']);
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
    })).toBe(4);
    expect(activeFilterCount({ ...NO_FILTERS, creditCardIds: ['visa1'] })).toBe(1);
  });
});

describe('monthBoundsOf', () => {
  it('bounds a month to its first and last day', () => {
    expect(monthBoundsOf(SEPTEMBER)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthBoundsOf({ year: 2028, month: 2 })).toEqual({
      from: '2028-02-01', to: '2028-02-29',
    });
  });
});

describe('queryOf (OQ-255)', () => {
  it('sends only the month for no filter', () => {
    expect(queryOf(NO_FILTERS, SEPTEMBER)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('sends only the lists with something, within the month', () => {
    expect(queryOf({ ...NO_FILTERS, kinds: ['charge'], creditCardIds: ['visa1'] }, SEPTEMBER))
      .toEqual({
        kinds: ['charge'], creditCardIds: ['visa1'], from: '2026-09-01', to: '2026-09-30',
      });
  });

  it('sends a Holding across every month: no dates', () => {
    expect(queryOf({ ...NO_FILTERS, holdingId: 'bbas3' }, SEPTEMBER))
      .toEqual({ holdingId: 'bbas3' });
  });
});

describe('holdingFilters', () => {
  it('filters by the Holding alone', () => {
    expect(holdingFilters('bbas3')).toEqual({ ...NO_FILTERS, holdingId: 'bbas3' });
  });
});
