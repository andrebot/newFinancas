import { describe, expect, it } from 'vitest';
import { cardName } from '../../../src/experiences/cardNames';
import { createTranslator } from '../../../src/utilities/i18n';

// A credit card's name (BDT: pure helper shared by Experiences, unit; the real catalog).

describe('cardName', () => {
  it('names a card by its network and last four digits', () => {
    expect(cardName(createTranslator('en-US'), { network: 'visa', last4: '1111' }))
      .toBe('Visa •••• 1111');
  });

  it('names the network in the interface language', () => {
    expect(cardName(createTranslator('pt-BR'), { network: 'other', last4: '0001' }))
      .toMatch(/ •••• 0001$/);
  });
});
