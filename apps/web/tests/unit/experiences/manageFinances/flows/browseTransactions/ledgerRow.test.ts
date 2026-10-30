import { describe, expect, it } from 'vitest';
import {
  categoryNameOf, ledgerLookupOf, rowAccessOf, rowDetailsOf, rowIconOf, rowMetaOf, rowTitleOf,
  signedAmountOf, sourceOf,
} from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerRow';
import { createFormatter } from '../../../../../../src/utilities/formatting';
import { createTranslator } from '../../../../../../src/utilities/i18n';
import {
  ACCOUNTS, BILL_PAYMENT, CATEGORIES, ITAU, LOOKUP, OLD, accountOf, accountRowOf, cardOf,
  cardRowOf, omit,
} from './fixtures';

// What a ledger row shows and offers (BDT: Flow rules, unit — pure, the real catalog).

const translator = createTranslator('en-US');
const formatter = createFormatter('en-US');

const TRADE = accountRowOf({
  kind: 'investment_buy',
  effect: 'investment_trade',
  description: '',
  holdingId: 'bbas3',
  holding: { ticker: 'BBAS3', assetType: 'stock' },
  quantity: 150_000_000,
  amount: 100_000,
});

describe('ledgerLookupOf', () => {
  it('indexes the accounts, their cards with their account, and the categories', () => {
    expect(LOOKUP.accounts.get('old')).toBe(OLD);
    expect(LOOKUP.cards.get('visa1')?.account).toBe(ITAU);
    expect(LOOKUP.categories.get('housing')?.name).toBe('Housing');
    expect(ledgerLookupOf([omit(accountOf('bare'), 'cards')], []).cards.size).toBe(0);
  });
});

describe('signedAmountOf', () => {
  it("signs by the kind's direction", () => {
    expect(signedAmountOf(cardRowOf())).toBe(-3_990);
    expect(signedAmountOf(cardRowOf({ kind: 'refund' }))).toBe(3_990);
    expect(signedAmountOf(accountRowOf({ kind: 'mystery' }))).toBe(8_690);
    expect(signedAmountOf(omit(accountRowOf(), 'amount'))).toBe(0);
    expect(signedAmountOf(omit(accountRowOf(), 'kind', 'amount'))).toBe(0);
  });
});

describe('rowTitleOf', () => {
  it("is the description, else the kind's name — a trade's with its ticker", () => {
    expect(rowTitleOf(cardRowOf(), translator)).toBe('Netflix');
    expect(rowTitleOf(cardRowOf({ description: '  ' }), translator)).toBe('Charge');
    expect(rowTitleOf(TRADE, translator)).toBe('Buy · BBAS3');
  });

  it('is "Transaction" for a row with neither a description nor a known kind', () => {
    expect(rowTitleOf(omit(cardRowOf(), 'description', 'kind'), translator)).toBe('Transaction');
    expect(rowTitleOf(accountRowOf({ description: '', kind: 'mystery' }), translator))
      .toBe('Transaction');
    expect(rowTitleOf(omit(cardRowOf({ description: 'x' }), 'description'), translator))
      .toBe('Charge');
  });
});

describe('sourceOf', () => {
  it('names the card, the account, or the bill payment\'s payer and card', () => {
    expect(sourceOf(cardRowOf(), LOOKUP, translator)).toBe('Visa •••• 1111');
    expect(sourceOf(accountRowOf(), LOOKUP, translator)).toBe('Itaú Conta');
    expect(sourceOf(BILL_PAYMENT, LOOKUP, translator)).toBe('Itaú Conta → Visa •••• 2222');
  });

  it("leaves out what the user can't see", () => {
    expect(sourceOf(omit(cardRowOf(), 'creditCardId'), LOOKUP, translator)).toBe('');
    expect(sourceOf(omit(accountRowOf(), 'accountId'), LOOKUP, translator)).toBe('');
    expect(sourceOf({ ...BILL_PAYMENT, creditCardId: 'gone' }, LOOKUP, translator))
      .toBe('Itaú Conta');
  });
});

describe('categoryNameOf', () => {
  it('names the category, with its subcategory', () => {
    expect(categoryNameOf(accountRowOf(), LOOKUP, translator)).toBe('Groceries');
    expect(categoryNameOf(accountRowOf({ subcategoryId: 'market' }), LOOKUP, translator))
      .toBe('Groceries › Market');
    expect(categoryNameOf(accountRowOf({ subcategoryId: 'unknown' }), LOOKUP, translator))
      .toBe('Groceries');
  });

  it('is nothing when uncategorized or unknown', () => {
    expect(categoryNameOf(accountRowOf({ categoryId: null }), LOOKUP, translator)).toBeUndefined();
    expect(categoryNameOf(accountRowOf({ categoryId: 'gone' }), LOOKUP, translator))
      .toBeUndefined();
  });
});

describe('rowMetaOf', () => {
  it('writes source · category · kind, leaving out what is missing', () => {
    expect(rowMetaOf(cardRowOf(), LOOKUP, translator)).toBe('Visa •••• 1111 · Housing · Charge');
    expect(rowMetaOf(accountRowOf({ kind: 'deposit', categoryId: null }), LOOKUP, translator))
      .toBe('Itaú Conta · Deposit');
  });

  it('leaves out a kind it has no name for', () => {
    expect(rowMetaOf(omit(cardRowOf(), 'kind'), LOOKUP, translator))
      .toBe('Visa •••• 1111 · Housing');
    expect(rowMetaOf(accountRowOf({ kind: 'mystery' }), LOOKUP, translator))
      .toBe('Itaú Conta · Groceries');
  });

  it("puts a described trade's ticker in the category's place", () => {
    expect(rowMetaOf({ ...TRADE, description: 'Dividends' }, LOOKUP, translator))
      .toBe('Itaú Conta · BBAS3 · Buy');
  });

  it('leaves out the kind and ticker the title already says', () => {
    expect(rowMetaOf(TRADE, LOOKUP, translator)).toBe('Itaú Conta · Groceries');
    expect(rowMetaOf(cardRowOf({ description: '' }), LOOKUP, translator))
      .toBe('Visa •••• 1111 · Housing');
  });
});

describe('rowIconOf', () => {
  it("is the category's disc, else the kind's glyph", () => {
    expect(rowIconOf(cardRowOf(), LOOKUP)).toEqual({ category: CATEGORIES[1] });
    expect(rowIconOf(accountRowOf({ categoryId: null }), LOOKUP)).toEqual({ kind: 'bolt' });
    expect(rowIconOf(omit(accountRowOf({ categoryId: null }), 'kind'), LOOKUP))
      .toEqual({ kind: 'payments-outline' });
  });
});

describe('rowDetailsOf', () => {
  it('lists kind, date, account and category', () => {
    expect(rowDetailsOf(accountRowOf({ subcategoryId: 'market' }), LOOKUP, translator, formatter))
      .toEqual([
        { label: 'Kind', value: 'Pix payment' },
        { label: 'Date', value: '09/14/2026', numeric: true },
        { label: 'Account', value: 'Itaú Conta' },
        { label: 'Category', value: 'Groceries › Market' },
      ]);
  });

  it("captions a card's and a bill payment's source", () => {
    expect(rowDetailsOf(cardRowOf(), LOOKUP, translator, formatter)[2])
      .toEqual({ label: 'Card', value: 'Visa •••• 1111' });
    expect(rowDetailsOf(BILL_PAYMENT, LOOKUP, translator, formatter)[2])
      .toEqual({ label: 'Payment', value: 'Itaú Conta → Visa •••• 2222' });
  });

  it("adds a trade's Holding and units — none when unknown", () => {
    expect(rowDetailsOf(TRADE, LOOKUP, translator, formatter).slice(4)).toEqual([
      { label: 'Holding', value: 'BBAS3' },
      { label: 'Units', value: '1.5', numeric: true },
    ]);
    expect(rowDetailsOf(omit(TRADE, 'quantity'), LOOKUP, translator, formatter)[5])
      .toEqual({ label: 'Units', value: undefined, numeric: true });
  });

  it('reads a row with no kind or date', () => {
    const details = rowDetailsOf(
      omit(cardRowOf(), 'kind', 'date'),
      LOOKUP,
      translator,
      createFormatter('en-US'),
    );
    expect(details[0]?.value).toBeUndefined();
  });
});

describe('rowAccessOf', () => {
  const owner = { selfUserId: 'me', role: 'Owner' };

  it('offers Edit and Delete to whoever may manage every account it touches', () => {
    expect(rowAccessOf(accountRowOf(), LOOKUP, owner)).toBe('manage');
    expect(rowAccessOf(cardRowOf(), LOOKUP, owner)).toBe('manage');
    expect(rowAccessOf(BILL_PAYMENT, LOOKUP, owner)).toBe('manage');
  });

  it("offers nothing when the user may not, or can't see an account", () => {
    expect(rowAccessOf(accountRowOf(), LOOKUP, { selfUserId: 'me', role: 'Viewer' })).toBe('none');
    expect(rowAccessOf(accountRowOf(), LOOKUP, { selfUserId: 'me', role: undefined })).toBe('none');
    expect(rowAccessOf(accountRowOf({ accountId: 'gone' }), LOOKUP, owner)).toBe('none');
    expect(rowAccessOf(omit(accountRowOf(), 'accountId'), LOOKUP, owner)).toBe('none');
    expect(rowAccessOf(omit(cardRowOf(), 'creditCardId'), LOOKUP, owner)).toBe('none');
    expect(rowAccessOf({ ...BILL_PAYMENT, creditCardId: 'gone' }, LOOKUP, owner)).toBe('none');
  });

  it('notes an archived account — a bill payment\'s card account too', () => {
    expect(rowAccessOf(accountRowOf({ accountId: 'old' }), LOOKUP, owner)).toBe('archived');
    const archivedCardAccount = ledgerLookupOf([
      ...ACCOUNTS,
      accountOf('gone', {
        archivedAt: '2026-09-01T00:00:00Z', cards: [cardOf('oldcard', 'gone', '9999')],
      }),
    ], CATEGORIES);
    expect(rowAccessOf({ ...BILL_PAYMENT, creditCardId: 'oldcard' }, archivedCardAccount, owner))
      .toBe('archived');
  });

  it("lets a Member manage a shared account's rows only when they created it", () => {
    const lookup = ledgerLookupOf([accountOf('mine', { ownerUserId: 'me' })], CATEGORIES);
    const row = accountRowOf({ accountId: 'mine' });

    expect(rowAccessOf(row, lookup, { selfUserId: 'me', role: 'Member' })).toBe('manage');
    expect(rowAccessOf(row, lookup, { selfUserId: 'you', role: 'Member' })).toBe('none');
  });
});
