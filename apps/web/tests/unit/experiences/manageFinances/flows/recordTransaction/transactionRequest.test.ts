import { describe, expect, it } from 'vitest';
import { EMPTY_TERMS } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/transactionForm';
import {
  changesOf, createRequestOf, editableOf, editFormOf,
} from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/transactionRequest';
import { CDB, accountRowOf, formOf } from './fixtures';

// What the Record Transaction form sends (BDT: Flow tier, pure → unit): each
// kind's create request with only the fields it takes, the form an edit opens
// with, and the changes it sends — no mocks.

const SPLIT = [{ goalId: 'house', name: 'House', percent: 60 }];
const CDB_TERMS = {
  rateType: 'cdi',
  rateValue: 1_100_000,
  spread: 500,
  dueDate: '2028-03-15',
  interestPayment: 'monthly',
  incentivised: true,
} as const;

describe('createRequestOf', () => {
  it('sends a cash kind on its account, trimming the description, without empty optionals', () => {
    const request = createRequestOf(formOf({
      kind: 'pix_payment', accountId: 'itau', amount: 8_690, description: '  Feira  ',
    }), 'BRL');

    expect(request).toEqual({
      kind: 'pix_payment',
      date: '2026-09-14',
      amount: 8_690,
      currency: 'BRL',
      accountId: 'itau',
      description: 'Feira',
    });
  });

  it('sends a category and subcategory when chosen, and no blank description', () => {
    const request = createRequestOf(formOf({
      kind: 'deposit',
      accountId: 'itau',
      amount: 1,
      categoryId: 'groceries',
      subcategoryId: 'market',
      description: '   ',
    }), 'BRL');

    expect(request).toMatchObject({ categoryId: 'groceries', subcategoryId: 'market' });
    expect(request).not.toHaveProperty('description');
  });

  it('sends a card kind on its card alone', () => {
    const request = createRequestOf(formOf({
      kind: 'charge', creditCardId: 'visa1', accountId: 'itau', amount: 100,
    }), 'BRL');

    expect(request).toMatchObject({ creditCardId: 'visa1' });
    expect(request).not.toHaveProperty('accountId');
  });

  it('sends a bill payment with its paying account and its card (OQ-219)', () => {
    const request = createRequestOf(formOf({
      kind: 'credit_card_bill_payment', creditCardId: 'nu1', accountId: 'itau', amount: 100,
    }), 'BRL');

    expect(request).toMatchObject({ accountId: 'itau', creditCardId: 'nu1' });
  });

  it('sends nothing for a missing amount or target as 0 or absent', () => {
    const request = createRequestOf(formOf({ kind: 'charge' }), 'BRL');

    expect(request.amount).toBe(0);
    expect(request).not.toHaveProperty('creditCardId');
  });

  it('sends a market buy\'s asset, ticker, units and split', () => {
    const request = createRequestOf(formOf({
      kind: 'investment_buy',
      accountId: 'itau',
      amount: 100,
      assetType: 'stock',
      ticker: ' BBAS3 ',
      quantity: 5,
      allocations: SPLIT,
      terms: CDB_TERMS,
    }), 'BRL');

    expect(request).toEqual({
      kind: 'investment_buy',
      date: '2026-09-14',
      amount: 100,
      currency: 'BRL',
      accountId: 'itau',
      assetType: 'stock',
      ticker: 'BBAS3',
      quantity: 5,
      allocations: [{ goalId: 'house', percentage: 60 }],
    });
  });

  it('sends a fixed-term buy\'s contract, its spread on CDI, no units when left empty', () => {
    const request = createRequestOf(formOf({
      kind: 'investment_buy',
      accountId: 'itau',
      amount: 100,
      assetType: 'cdb',
      ticker: 'CDB',
      terms: CDB_TERMS,
    }), 'BRL');

    expect(request).toMatchObject({
      rate: { type: 'cdi', value: 1_100_000, spread: 500 },
      dueDate: '2028-03-15',
      interestPayment: 'monthly',
    });
    expect(request).not.toHaveProperty('quantity');
    expect(request).not.toHaveProperty('incentivised');
    expect(request).not.toHaveProperty('allocations');
  });

  it('leaves the spread off where unused or untyped, and sends 0 for no value', () => {
    const fixed = createRequestOf(formOf({
      kind: 'investment_buy', assetType: 'cdb', terms: { ...CDB_TERMS, rateType: 'fixed' },
    }), 'BRL');
    const noSpread = createRequestOf(formOf({
      kind: 'investment_buy', assetType: 'cdb', terms: { ...EMPTY_TERMS, rateType: 'selic' },
    }), 'BRL');

    expect(fixed.rate).toEqual({ type: 'fixed', value: 1_100_000 });
    expect(noSpread.rate).toEqual({ type: 'selic', value: 0 });
  });

  it('sends a debenture\'s incentivised flag', () => {
    const request = createRequestOf(formOf({
      kind: 'investment_buy', assetType: 'debenture', ticker: 'D', terms: CDB_TERMS,
    }), 'BRL');

    expect(request.incentivised).toBe(true);
  });

  it('sends a sell\'s Holding and units, and its split only once changed (OQ-206)', () => {
    const sell = formOf({
      kind: 'investment_sell',
      accountId: 'itau',
      holdingId: 'bbas3',
      quantity: 5,
      allocations: SPLIT,
    });

    expect(createRequestOf(sell, 'BRL')).toMatchObject({ holdingId: 'bbas3', quantity: 5 });
    expect(createRequestOf(sell, 'BRL')).not.toHaveProperty('allocations');
    expect(createRequestOf({ ...sell, allocationsEdited: true }, 'BRL').allocations)
      .toEqual([{ goalId: 'house', percentage: 60 }]);
    const cleared = { ...sell, allocations: [], allocationsEdited: true };
    expect(createRequestOf(cleared, 'BRL').allocations)
      .toEqual([]);
  });

  it('sends a cash event\'s Holding without units, and an unfilled share as 0', () => {
    const dividend = createRequestOf(formOf({
      kind: 'investment_dividend', accountId: 'itau', holdingId: 'bbas3', quantity: 5,
    }), 'BRL');
    const unfilled = createRequestOf(formOf({
      kind: 'investment_buy', allocations: [{ goalId: 'house', name: 'House', percent: null }],
    }), 'BRL');
    const unsold = createRequestOf(formOf({ kind: 'investment_sell', holdingId: 'bbas3' }), 'BRL');

    expect(dividend).toMatchObject({ holdingId: 'bbas3' });
    expect(dividend).not.toHaveProperty('quantity');
    expect(unfilled.allocations).toEqual([{ goalId: 'house', percentage: 0 }]);
    expect(unsold).not.toHaveProperty('quantity');
  });
});

describe('editFormOf', () => {
  it('opens an account row with its values', () => {
    const form = editFormOf(accountRowOf(), undefined);

    expect(form).toMatchObject({
      kind: 'pix_payment',
      accountId: 'itau',
      amount: 8_690,
      date: '2026-09-14',
      categoryId: 'groceries',
      subcategoryId: undefined,
      description: 'Feira',
      holdingId: undefined,
      quantity: null,
      creditCardId: undefined,
      ticker: '',
      terms: EMPTY_TERMS,
    });
  });

  it('opens a fixed-term buy with its Holding\'s terms', () => {
    const form = editFormOf(accountRowOf({
      kind: 'investment_buy',
      holdingId: 'cdb1',
      quantity: 100,
      holding: { ticker: 'CDB', assetType: 'cdb' },
    }), CDB);

    expect(form).toMatchObject({
      holdingId: 'cdb1',
      quantity: 100,
      ticker: 'CDB',
      assetType: 'cdb',
      terms: {
        rateType: 'cdi',
        rateValue: 1_100_000,
        spread: null,
        dueDate: '2028-03-15',
        interestPayment: 'at_maturity',
        incentivised: false,
      },
    });
  });

  it('fills what a Holding leaves out with the empty terms', () => {
    expect(editFormOf(accountRowOf(), { id: 'h', rate: { value: 5 } }).terms)
      .toEqual({ ...EMPTY_TERMS, rateValue: 5 });
    expect(editFormOf(accountRowOf(), { id: 'h', rate: null }).terms).toEqual(EMPTY_TERMS);
  });

  it('opens a card row on its card, and a bare row with empty values', () => {
    const card = editFormOf({
      ledger: 'card',
      id: 'c1',
      creditCardId: 'visa1',
      kind: 'charge',
      date: '2026-09-14',
      amount: 5,
      currency: 'BRL',
      categoryId: null,
      subcategoryId: null,
      description: 'x',
    }, undefined);
    const bare = editFormOf({ ledger: 'account' }, undefined);

    expect(card).toMatchObject({ creditCardId: 'visa1', kind: 'charge', quantity: null });
    expect(card.accountId).toBeUndefined();
    expect(bare).toMatchObject({
      kind: '', amount: null, date: '', description: '',
    });
  });
});

describe('editableOf (OQ-201 D6, D8)', () => {
  it('opens amount and date, a trade\'s units and a fixed-term buy\'s terms', () => {
    expect(editableOf(formOf({ kind: 'investment_buy', assetType: 'cdb' }), false))
      .toEqual({ amountAndDate: true, quantity: true, terms: true });
    expect(editableOf(formOf({ kind: 'deposit' }), false))
      .toEqual({ amountAndDate: true, quantity: false, terms: false });
  });

  it('locks them once the schedule has started', () => {
    expect(editableOf(formOf({ kind: 'investment_buy', assetType: 'cdb' }), true))
      .toEqual({ amountAndDate: false, quantity: false, terms: false });
  });
});

describe('changesOf', () => {
  const OPEN = { amountAndDate: true, quantity: true, terms: true };
  const before = formOf({
    kind: 'investment_buy',
    assetType: 'debenture',
    amount: 100,
    categoryId: 'groceries',
    subcategoryId: 'market',
    description: 'Note',
    quantity: 5,
    terms: CDB_TERMS,
  });

  it('sends nothing when nothing changed', () => {
    expect(changesOf(before, before, OPEN)).toEqual({});
    const blank = formOf();
    expect(changesOf(blank, { ...blank, description: '  ' }, OPEN)).toEqual({});
  });

  it('sends each changed value', () => {
    const after = {
      ...before,
      date: '2026-09-15',
      amount: 200,
      quantity: 6,
      description: ' Other ',
      categoryId: 'housing',
      subcategoryId: undefined,
      terms: {
        ...CDB_TERMS, dueDate: '2029-01-01', interestPayment: 'semiannual', incentivised: false,
      },
    } as const;

    expect(changesOf(before, after, OPEN)).toEqual({
      date: '2026-09-15',
      amount: 200,
      quantity: 6,
      description: 'Other',
      categoryId: 'housing',
      subcategoryId: null,
      dueDate: '2029-01-01',
      interestPayment: 'semiannual',
      incentivised: false,
    });
  });

  it('clears the category and description with null', () => {
    expect(changesOf(before, { ...before, categoryId: undefined, description: '' }, OPEN))
      .toEqual({ categoryId: null, description: null });
  });

  it('sends the rate as a whole when its type, value or a CDI spread changed', () => {
    const rate = (terms: Partial<typeof CDB_TERMS>) => changesOf(
      before,
      { ...before, terms: { ...CDB_TERMS, ...terms } },
      OPEN,
    ).rate;

    expect(rate({ rateType: 'fixed' } as never)).toEqual({ type: 'fixed', value: 1_100_000 });
    expect(rate({ rateValue: 1 } as never)).toEqual({ type: 'cdi', value: 1, spread: 500 });
    expect(rate({ spread: 600 } as never)).toEqual({ type: 'cdi', value: 1_100_000, spread: 600 });
  });

  it('ignores a spread on a rate without one, and the flag off a debenture', () => {
    const ipca = { ...before, terms: { ...CDB_TERMS, rateType: 'ipca' } } as const;
    const cdb = { ...before, assetType: 'cdb' };

    expect(changesOf(ipca, { ...ipca, terms: { ...ipca.terms, spread: 1 } }, OPEN)).toEqual({});
    expect(changesOf(cdb, { ...cdb, terms: { ...CDB_TERMS, incentivised: false } }, OPEN))
      .toEqual({});
  });

  it('sends only what may change, and never an emptied amount or quantity', () => {
    const after = {
      ...before,
      date: '2026-09-15',
      amount: 200,
      quantity: 6,
      terms: { ...CDB_TERMS, dueDate: '2030-01-01' },
    };
    const locked = { amountAndDate: false, quantity: false, terms: false };

    expect(changesOf(before, after, locked)).toEqual({});
    expect(changesOf(before, { ...before, amount: null, quantity: null }, OPEN)).toEqual({});
  });
});
