import { describe, expect, it } from 'vitest';
import {
  accountChoicesOf, assetTypesFor, cardEntriesOf, cardEntryOf, currencyOf, directionOf, groupOf,
  isBillPayment, isBuy, isCardKind, isDebentureBuy, isFixedTermBuy, isTrade, kindsOfGroup,
  namesCard, namesHolding, newFormOf, takesHoldingSplit, takesSpread, withAccount, withAllocations,
  withCard, withCategory, withFittedTargets, withGroup, withHolding, withHoldingSplit, withKind,
} from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/transactionForm';
import {
  ACCOUNTS, CDB, ITAU, NUBANK_CARD_ONLY, STOCK, accountOf, formOf,
} from './fixtures';

// The Record Transaction form (BDT: Flow tier, pure → unit): which fields a
// kind takes, which targets it offers and how the form moves between kinds,
// targets and Holdings — no mocks.

const SPLIT = [{ goalId: 'house', name: 'House', percent: 60 }];

describe('kind shape (FR-3.1, OQ-201)', () => {
  it('groups kinds and lists a group in picker order', () => {
    expect(groupOf('pix_payment')).toBe('cash');
    expect(kindsOfGroup('cash').map((kind) => kind.code)).toEqual([
      'deposit', 'withdrawal', 'boleto_payment', 'pix_payment', 'pix_receipt',
    ]);
    expect(kindsOfGroup('credit_card').map((kind) => kind.code)).toEqual([
      'credit_card_bill_payment', 'charge', 'refund',
    ]);
  });

  it('acts on an unknown code as a plain movement', () => {
    expect(groupOf('teleport')).toBe('cash');
    expect(isCardKind('teleport')).toBe(false);
  });

  it('tells cards, bills, buys, trades and Holding kinds apart', () => {
    expect([isCardKind('charge'), isCardKind('credit_card_bill_payment')]).toEqual([true, false]);
    expect([isBillPayment('credit_card_bill_payment'), isBillPayment('charge')])
      .toEqual([true, false]);
    expect([namesCard('refund'), namesCard('credit_card_bill_payment'), namesCard('deposit')])
      .toEqual([true, true, false]);
    expect([isBuy('investment_buy'), isBuy('investment_sell')]).toEqual([true, false]);
    expect(['investment_buy', 'investment_sell', 'investment_redemption', 'investment_dividend']
      .map(isTrade)).toEqual([true, true, true, false]);
    expect(['investment_buy', 'investment_sell', 'investment_tax', 'deposit'].map(namesHolding))
      .toEqual([false, true, true, false]);
    expect(['investment_buy', 'investment_sell', 'investment_redemption', 'investment_dividend']
      .map(takesHoldingSplit)).toEqual([false, true, true, false]);
  });

  it('reads the direction and which rates take a spread (OQ-205)', () => {
    expect([directionOf('deposit'), directionOf('investment_tax')]).toEqual(['in', 'out']);
    expect(['fixed', 'cdi', 'ipca', 'igpm', 'selic'].map((type) => takesSpread(type as never)))
      .toEqual([false, true, false, false, true]);
  });
});

describe('targets (OQ-201 D5, OQ-219)', () => {
  it('lists the cards on open accounts with their account', () => {
    const withArchivedCard = [...ACCOUNTS, accountOf('gone', {
      archivedAt: 'x', cards: [{ ...ITAU.cards[0]!, id: 'gonecard' }],
    })];

    expect(cardEntriesOf(withArchivedCard).map((entry) => [entry.card.id, entry.account.id]))
      .toEqual([['visa1', 'itau'], ['nu1', 'nucard']]);
    expect(cardEntryOf(ACCOUNTS, 'nu1')?.account).toBe(NUBANK_CARD_ONLY);
    expect(cardEntryOf(ACCOUNTS, undefined)).toBeUndefined();
  });

  it('still finds a card on an archived account, for an edit', () => {
    const archived = accountOf('gone', {
      archivedAt: 'x', currency: 'USD', cards: [{ ...ITAU.cards[0]!, id: 'gonecard' }],
    });
    const charge = formOf({ kind: 'charge', creditCardId: 'gonecard' });

    expect(cardEntryOf([...ACCOUNTS, archived], 'gonecard')?.account).toBe(archived);
    expect(currencyOf(charge, [...ACCOUNTS, archived])).toBe('USD');
  });

  it('offers open accounts that are not credit-card-only', () => {
    expect(accountChoicesOf(formOf({ kind: 'deposit' }), ACCOUNTS).map((account) => account.id))
      .toEqual(['itau', 'chase']);
  });

  it('offers no account to a card kind', () => {
    expect(accountChoicesOf(formOf({ kind: 'charge' }), ACCOUNTS)).toEqual([]);
  });

  it('narrows a bill payment\'s payers to its card\'s currency once the card is chosen', () => {
    const bill = formOf({ kind: 'credit_card_bill_payment' });

    expect(accountChoicesOf(bill, ACCOUNTS).map((account) => account.id))
      .toEqual(['itau', 'chase']);
    const onCard = { ...bill, creditCardId: 'nu1' };
    expect(accountChoicesOf(onCard, ACCOUNTS).map((account) => account.id))
      .toEqual(['itau']);
  });

  it('takes the currency from the account, the card, or a bill\'s card before its payer', () => {
    expect(currencyOf(formOf({ kind: 'deposit', accountId: 'chase' }), ACCOUNTS)).toBe('USD');
    const charge = formOf({ kind: 'charge', creditCardId: 'nu1', accountId: 'chase' });
    expect(currencyOf(charge, ACCOUNTS))
      .toBe('BRL');
    expect(currencyOf(formOf({ kind: 'credit_card_bill_payment', creditCardId: 'nu1' }), ACCOUNTS))
      .toBe('BRL');
    expect(currencyOf(formOf({ kind: 'deposit' }), ACCOUNTS)).toBeUndefined();
  });
});

describe('asset types (OQ-219)', () => {
  it('offers every type before an account is chosen', () => {
    expect(assetTypesFor(undefined)).toContain('cd');
    expect(assetTypesFor(undefined)).toContain('cdb');
  });

  it('offers each currency its market\'s fixed-term types, market types to both', () => {
    expect(assetTypesFor('BRL'))
      .toEqual(expect.arrayContaining(['stock', 'cdb', 'tesouro_direto']));
    expect(assetTypesFor('BRL')).not.toContain('treasury');
    expect(assetTypesFor('USD')).toEqual(expect.arrayContaining(['stock', 'cd', 'treasury']));
    expect(assetTypesFor('USD')).not.toContain('cdb');
  });

  it('tells a fixed-term and a debenture buy', () => {
    const buy = formOf({ kind: 'investment_buy' });

    expect(isFixedTermBuy({ ...buy, assetType: 'cdb' })).toBe(true);
    expect(isFixedTermBuy({ ...buy, assetType: 'stock' })).toBe(false);
    expect(isFixedTermBuy(buy)).toBe(false);
    expect(isFixedTermBuy({ ...buy, kind: 'investment_sell', assetType: 'cdb' })).toBe(false);
    expect(isDebentureBuy({ ...buy, assetType: 'debenture' })).toBe(true);
    expect(isDebentureBuy({ ...buy, assetType: 'cdb' })).toBe(false);
    expect(isDebentureBuy(buy)).toBe(false);
    expect(isDebentureBuy({ ...buy, kind: 'deposit', assetType: 'debenture' })).toBe(false);
  });
});

describe('newFormOf', () => {
  it('opens on the Cash group\'s first kind, today, with no target among several', () => {
    const form = newFormOf(ACCOUNTS, '2026-09-14');

    expect(form).toMatchObject({
      kind: 'deposit', date: '2026-09-14', amount: null, accountId: undefined, allocations: [],
    });
  });

  it('picks the only account there is', () => {
    expect(newFormOf([ITAU], '2026-09-14').accountId).toBe('itau');
  });
});

describe('withFittedTargets', () => {
  it('keeps an offered account and its Holding', () => {
    const form = formOf({ kind: 'investment_sell', accountId: 'itau', holdingId: 'bbas3' });

    expect(withFittedTargets(form, ACCOUNTS))
      .toMatchObject({ accountId: 'itau', holdingId: 'bbas3' });
  });

  it('drops a target no longer offered, and the Holding with it', () => {
    const form = formOf({ kind: 'investment_sell', accountId: 'nucard', holdingId: 'x' });

    expect(withFittedTargets(form, ACCOUNTS)).toMatchObject({
      accountId: undefined, holdingId: undefined,
    });
  });

  it('drops the card on a kind without one, and picks a lone card', () => {
    const deposit = formOf({ kind: 'deposit', creditCardId: 'nu1' });
    expect(withFittedTargets(deposit, ACCOUNTS).creditCardId)
      .toBeUndefined();
    expect(withFittedTargets(formOf({ kind: 'charge' }), [ITAU]).creditCardId).toBe('visa1');
  });
});

describe('withKind and withGroup', () => {
  it('keeps the amount, date, description and category', () => {
    const form = formOf({
      amount: 500, description: 'Feira', categoryId: 'groceries', accountId: 'itau',
    });

    expect(withKind(form, 'pix_payment', ACCOUNTS)).toMatchObject({
      kind: 'pix_payment',
      amount: 500,
      description: 'Feira',
      categoryId: 'groceries',
      accountId: 'itau',
    });
  });

  it('keeps the Holding, units and a same-source split between kinds that take them', () => {
    const sell = formOf({
      kind: 'investment_sell',
      accountId: 'itau',
      holdingId: 'bbas3',
      quantity: 5,
      allocations: SPLIT,
      allocationsEdited: true,
    });

    expect(withKind(sell, 'investment_redemption', ACCOUNTS)).toMatchObject({
      holdingId: 'bbas3', quantity: 5, allocations: SPLIT, allocationsEdited: true,
    });
  });

  it('drops the Holding, units and split where the new kind has no use for them', () => {
    const sell = formOf({
      kind: 'investment_sell',
      accountId: 'itau',
      holdingId: 'bbas3',
      quantity: 5,
      allocations: SPLIT,
      allocationsEdited: true,
    });

    expect(withKind(sell, 'investment_dividend', ACCOUNTS)).toMatchObject({
      holdingId: 'bbas3', quantity: null, allocations: [], allocationsEdited: false,
    });
    expect(withKind(sell, 'investment_buy', ACCOUNTS)).toMatchObject({
      holdingId: undefined, quantity: 5, allocations: [],
    });
    expect(withKind(sell, 'deposit', ACCOUNTS))
      .toMatchObject({ holdingId: undefined, quantity: null });
  });

  it('moves to a group\'s first kind, and stays put on its own group', () => {
    const form = formOf({ kind: 'pix_payment' });

    expect(withGroup(form, 'investment', ACCOUNTS).kind).toBe('investment_buy');
    expect(withGroup(form, 'cash', ACCOUNTS)).toBe(form);
  });
});

describe('withAccount', () => {
  it('changes nothing for the account already chosen', () => {
    const form = formOf({ accountId: 'itau' });

    expect(withAccount(form, 'itau', ACCOUNTS)).toBe(form);
  });

  it('drops a sell\'s Holding, units and pre-filled split with the previous account', () => {
    const sell = formOf({
      kind: 'investment_sell',
      accountId: 'itau',
      holdingId: 'bbas3',
      quantity: 5,
      allocations: SPLIT,
      allocationsEdited: true,
    });

    expect(withAccount(sell, 'chase', ACCOUNTS)).toMatchObject({
      accountId: 'chase',
      holdingId: undefined,
      quantity: null,
      allocations: [],
      allocationsEdited: false,
    });
  });

  it('keeps a buy\'s units and split, and its asset type where the new currency offers it', () => {
    const buy = formOf({
      kind: 'investment_buy',
      accountId: 'itau',
      assetType: 'stock',
      quantity: 5,
      allocations: SPLIT,
      allocationsEdited: true,
    });

    expect(withAccount(buy, 'chase', ACCOUNTS)).toMatchObject({
      assetType: 'stock', quantity: 5, allocations: SPLIT, allocationsEdited: true,
    });
    expect(withAccount({ ...buy, assetType: 'cdb' }, 'chase', ACCOUNTS).assetType).toBeUndefined();
    expect(withAccount({ ...buy, assetType: undefined }, 'chase', ACCOUNTS).assetType)
      .toBeUndefined();
    expect(withAccount({ ...buy, assetType: 'cdb' }, 'unlisted', ACCOUNTS).assetType).toBe('cdb');
  });
});

describe('withCard', () => {
  it('fits a bill payment\'s payer to the card\'s currency', () => {
    const bill = formOf({ kind: 'credit_card_bill_payment', accountId: 'chase' });

    expect(withCard(bill, 'nu1', ACCOUNTS))
      .toMatchObject({ creditCardId: 'nu1', accountId: 'itau' });
  });
});

describe('withCategory', () => {
  it('drops the subcategory with a new category, and keeps the form for the same one', () => {
    const form = formOf({ categoryId: 'groceries', subcategoryId: 'market' });

    expect(withCategory(form, 'housing')).toMatchObject({
      categoryId: 'housing', subcategoryId: undefined,
    });
    expect(withCategory(form, undefined).categoryId).toBeUndefined();
    expect(withCategory(form, 'groceries')).toBe(form);
  });
});

describe('withHolding', () => {
  it('starts a redemption with the whole position, a sell with none, the split empty', () => {
    const redemption = formOf({ kind: 'investment_redemption', allocations: SPLIT });
    const sell = formOf({ kind: 'investment_sell', quantity: 7 });

    expect(withHolding(redemption, CDB)).toMatchObject({
      holdingId: 'cdb1', quantity: 100_000_000, allocations: [], allocationsEdited: false,
    });
    expect(withHolding(sell, STOCK)).toMatchObject({ holdingId: 'bbas3', quantity: null });
    expect(withHolding(redemption, { ...CDB, quantity: undefined } as never).quantity).toBeNull();
  });

  it('changes nothing for the Holding already picked', () => {
    const form = formOf({ kind: 'investment_sell', holdingId: 'bbas3', quantity: 3 });

    expect(withHolding(form, STOCK)).toBe(form);
  });
});

describe('the split (OQ-206)', () => {
  it('pre-fills a sell\'s split with its Holding\'s', () => {
    const sell = formOf({ kind: 'investment_sell', holdingId: 'bbas3' });

    expect(withHoldingSplit(sell, 'bbas3', SPLIT).allocations).toBe(SPLIT);
  });

  it('keeps what the user changed, another Holding\'s pick, and a kind without a split', () => {
    const sell = formOf({ kind: 'investment_sell', holdingId: 'bbas3' });
    const edited = { ...sell, allocationsEdited: true };

    expect(withHoldingSplit(edited, 'bbas3', SPLIT)).toBe(edited);
    expect(withHoldingSplit(sell, 'other', SPLIT)).toBe(sell);
    const dividend = { ...sell, kind: 'investment_dividend' };
    expect(withHoldingSplit(dividend, 'bbas3', SPLIT)).toBe(dividend);
  });

  it('marks a split the user set as edited', () => {
    expect(withAllocations(formOf(), SPLIT))
      .toMatchObject({ allocations: SPLIT, allocationsEdited: true });
  });
});
