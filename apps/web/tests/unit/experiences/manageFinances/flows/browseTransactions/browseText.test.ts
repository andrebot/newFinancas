import { describe, expect, it } from 'vitest';
import { browseText } from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/browseText';
import { createTranslator } from '../../../../../../src/utilities/i18n';

// The Flow's texts (BDT: Utility-like helper → unit, the real catalog).

describe('browseText', () => {
  it('writes a key with its params in the interface language', () => {
    expect(browseText(createTranslator('en-US'), 'monthCount', { count: 7 }))
      .toBe('7 transactions');
    expect(browseText(createTranslator('pt-BR'), 'monthCount', { count: 1 })).toBe('1 transação');
  });
});
