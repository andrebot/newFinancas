import { describe, expect, it } from 'vitest';
import {
  isClear, problemsOf, problemText,
} from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/transactionChecks';
import { createTranslator } from '../../../../../../src/utilities/i18n';
import { CDB, STOCK, formOf } from './fixtures';

// The Record Transaction form's checks (BDT: Flow tier, pure → unit): what
// each kind needs before it is sent, and what an edit may still change — no mocks.

const NONE = { holdings: [] };
const OPEN = { amountAndDate: true, quantity: true, terms: true };
const FULL_SHARE = [{ goalId: 'house', name: 'House', percent: 60 }];

describe('problemsOf — a new transaction', () => {
  it('refuses a missing account, amount and a malformed date', () => {
    expect(problemsOf(formOf({ kind: 'deposit', date: '--1' }), NONE)).toEqual({
      account: { code: 'account' },
      amount: { code: 'amount' },
      date: { rule: { code: 'string.format', params: { format: 'date' } } },
    });
  });

  it('passes a filled cash kind', () => {
    expect(problemsOf(formOf({ kind: 'deposit', accountId: 'itau', amount: 1 }), NONE)).toEqual({});
  });

  it('refuses a card kind with no card, never asking for an account', () => {
    expect(problemsOf(formOf({ kind: 'charge', amount: 1 }), NONE))
      .toEqual({ card: { code: 'card' } });
  });

  it('asks a bill payment for its card and its payer', () => {
    expect(Object.keys(problemsOf(formOf({ kind: 'credit_card_bill_payment', amount: 1 }), NONE)))
      .toEqual(['card', 'account']);
  });

  it('asks a market buy for its asset type, ticker and units', () => {
    expect(problemsOf(formOf({ kind: 'investment_buy', accountId: 'itau', amount: 1 }), NONE))
      .toEqual({
        assetType: { code: 'assetType' },
        ticker: { code: 'ticker' },
        quantity: { code: 'quantity' },
      });
  });

  it('lets a fixed-term buy leave its units empty, not zero, and asks for its contract', () => {
    const cdb = formOf({
      kind: 'investment_buy', accountId: 'itau', amount: 1, assetType: 'cdb', ticker: 'CDB',
    });

    expect(problemsOf(cdb, NONE)).toEqual({
      rateValue: { code: 'rate' },
      dueDate: { rule: { code: 'field.required' } },
    });
    expect(problemsOf({ ...cdb, quantity: 0 }, NONE).quantity).toEqual({ code: 'quantity' });
  });

  it('wants a due date after the buy\'s date', () => {
    const cdb = formOf({
      kind: 'investment_buy',
      accountId: 'itau',
      amount: 1,
      assetType: 'cdb',
      ticker: 'CDB',
      quantity: 1,
      terms: { ...formOf().terms, rateValue: 1, dueDate: '2026-09-14' },
    });

    expect(problemsOf(cdb, NONE)).toEqual({ dueDate: { code: 'dueDate' } });
    expect(problemsOf({ ...cdb, terms: { ...cdb.terms, dueDate: '2027-01-01' } }, NONE))
      .toEqual({});
  });

  it('asks a sell for its Holding and units, no more than held', () => {
    const sell = formOf({ kind: 'investment_sell', accountId: 'itau', amount: 1 });
    const holdings = { holdings: [STOCK] };

    expect(problemsOf(sell, holdings)).toEqual({
      holding: { code: 'holding' }, quantity: { code: 'quantity' },
    });
    expect(problemsOf({ ...sell, holdingId: 'bbas3', quantity: 301 * 100_000_000 }, holdings))
      .toEqual({ quantity: { code: 'quantityHeld', params: { held: 300 } } });
    expect(problemsOf({ ...sell, holdingId: 'bbas3', quantity: 300 * 100_000_000 }, holdings))
      .toEqual({});
    expect(problemsOf({ ...sell, holdingId: 'unknown', quantity: 1 }, holdings)).toEqual({});
  });

  it('asks a cash event only for its Holding', () => {
    const dividend = formOf({ kind: 'investment_dividend', accountId: 'itau', amount: 1 });

    expect(problemsOf(dividend, NONE)).toEqual({ holding: { code: 'holding' } });
  });

  it('refuses a split over 100% or with an empty share (OQ-218)', () => {
    const buy = formOf({
      kind: 'investment_buy',
      accountId: 'itau',
      amount: 1,
      assetType: 'stock',
      ticker: 'X',
      quantity: 1,
    });

    expect(problemsOf({ ...buy, allocations: FULL_SHARE }, NONE)).toEqual({});
    expect(problemsOf({
      ...buy, allocations: [...FULL_SHARE, { goalId: 'laptop', name: 'Laptop', percent: 50 }],
    }, NONE)).toEqual({ allocations: { code: 'allocations' } });
  });
});

describe('problemsOf — an edit', () => {
  it('checks only what may change, never the identity', () => {
    const edit = formOf({ kind: 'investment_sell', amount: null, quantity: 0 });

    expect(problemsOf(edit, { holdings: [], editable: OPEN })).toEqual({
      amount: { code: 'amount' }, quantity: { code: 'quantity' },
    });
  });

  it('leaves what is locked unchecked', () => {
    const cdb = formOf({
      kind: 'investment_buy', assetType: 'cdb', amount: null, date: '',
    });
    const locked = { amountAndDate: false, quantity: false, terms: false };

    expect(problemsOf(cdb, { holdings: [CDB], editable: locked })).toEqual({});
    expect(problemsOf(cdb, { holdings: [CDB], editable: OPEN })).toMatchObject({
      amount: { code: 'amount' }, rateValue: { code: 'rate' },
    });
  });
});

describe('problemsOf — an edit\'s units', () => {
  it('refuses clearing a fixed-term buy\'s units, optional only when it is new', () => {
    const cdb = formOf({
      kind: 'investment_buy', assetType: 'cdb', quantity: null, ticker: 'CDB',
    });

    expect(problemsOf(cdb, { holdings: [CDB], editable: OPEN }).quantity)
      .toEqual({ code: 'quantity' });
    expect(problemsOf(cdb, NONE).quantity).toBeUndefined();
  });
});

describe('isClear and problemText', () => {
  const translator = createTranslator('en-US');

  it('tells an empty set of refusals', () => {
    expect(isClear({})).toBe(true);
    expect(isClear({ amount: { code: 'amount' } })).toBe(false);
  });

  it('writes a shared rule\'s refusal and the drawer\'s own', () => {
    expect(problemText(undefined, translator)).toBeUndefined();
    expect(problemText({ rule: { code: 'field.required' } }, translator)).toBe('Required.');
    expect(problemText({ code: 'quantityHeld', params: { held: 300 } }, translator))
      .toBe('Only 300 held.');
    expect(problemText({ code: 'quantityHeld', params: { held: 0.00012345 } }, translator))
      .toBe('Only 0.00012345 held.');
  });
});

describe('problemsOf — a transfer between own accounts (OQ-222)', () => {
  const own = formOf({
    kind: 'transfer_sent', ownTransfer: true, accountId: 'itau', amount: 5_000,
  });

  it('asks where it goes, and what arrived across currencies', () => {
    expect(problemsOf(own, { holdings: [], receivesOtherCurrency: true })).toEqual({
      toAccount: { code: 'toAccount' }, receivedAmount: { code: 'receivedAmount' },
    });
    expect(problemsOf({ ...own, toAccountId: 'chase', receivedAmount: 0 }, {
      holdings: [], receivesOtherCurrency: true,
    })).toEqual({ receivedAmount: { code: 'receivedAmount' } });
  });

  it('asks nothing received within one currency', () => {
    expect(problemsOf({ ...own, toAccountId: 'savings' }, NONE)).toEqual({});
  });

  it('checks what arrived on an edit too, while amounts may change', () => {
    const edit = { holdings: [], editable: OPEN, receivesOtherCurrency: true };
    expect(problemsOf({ ...own, toAccountId: 'chase' }, edit))
      .toEqual({ receivedAmount: { code: 'receivedAmount' } });
    expect(problemsOf({ ...own, toAccountId: 'chase' }, {
      ...edit, editable: { ...OPEN, amountAndDate: false },
    })).toEqual({});
  });
});
