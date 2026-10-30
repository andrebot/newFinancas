import { describe, expect, it } from 'vitest';
import { accounts as accountSettings } from '../../../src/config/constants';
import { balanceCardsOf } from '../../../src/experiences/balanceCards';
import { createTranslator } from '../../../src/utilities/i18n';
import { pickByHash } from '../../../src/utilities/stableHash';
import { ACCOUNTS, REPORT } from './monthFixtures';

// The Balance rail's cards (BDT: pure logic shared by Experiences, unit;
// nothing mocked — the translator is a Utility).

const translator = createTranslator('en-US');

describe('balanceCardsOf', () => {
  it('names each figure, in the report\'s order', () => {
    const cards = balanceCardsOf(REPORT.balances, ACCOUNTS, translator);
    expect(cards.map((card) => card.name)).toEqual([
      'Itaú Conta', 'Visa •••• 1111', 'Emergency Fund', 'Mastercard •••• 4242',
    ]);
  });

  it('gives an account its type\'s glyph and a card the card glyph, captioned', () => {
    const [itau, visa, savings] = balanceCardsOf(REPORT.balances, ACCOUNTS, translator);
    expect(itau).toMatchObject({
      key: 'itau',
      icon: 'account-balance-outline',
      outstanding: false,
      amount: 218035,
      currency: 'BRL',
    });
    expect(visa).toMatchObject({ key: 'visa', icon: 'credit-card-outline', outstanding: true });
    expect(savings).toMatchObject({ icon: 'savings-outline', currency: 'USD' });
  });

  it('colours each card by its id, so the colour never moves', () => {
    const cards = balanceCardsOf(REPORT.balances, ACCOUNTS, translator);
    cards.forEach((card) => {
      expect(card.color).toBe(pickByHash(card.key, accountSettings.balanceTones));
    });
  });

  it('leaves out a figure whose account or card the page does not know yet', () => {
    const cards = balanceCardsOf([
      {
        accountId: 'new', creditCardId: null, currency: 'BRL', amount: 1,
      },
      {
        accountId: 'itau', creditCardId: 'gone', currency: 'BRL', amount: 2,
      },
    ], ACCOUNTS, translator);
    expect(cards).toEqual([]);
  });
});
