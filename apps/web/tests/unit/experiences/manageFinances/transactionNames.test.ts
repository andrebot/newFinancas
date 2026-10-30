import { describe, expect, it } from 'vitest';
import {
  groupName, kindIcon, kindName,
} from '../../../../src/experiences/manageFinances/transactionNames';
import { createTranslator } from '../../../../src/utilities/i18n';

// The names Manage Finances' Flows share (BDT: Utility-like helper → unit, the real catalog).

describe('transactionNames', () => {
  const english = createTranslator('en-US');
  const portuguese = createTranslator('pt-BR');

  it('names a kind and a group in the interface language', () => {
    expect(kindName(english, 'pix_payment')).toBe('Pix payment');
    expect(kindName(portuguese, 'investment_buy')).toBe('Aplicação');
    expect(groupName(english, 'credit_card')).toBe('Credit card');
  });

  it("picks a kind's icon, the generic one for an unknown kind", () => {
    expect(kindIcon('pix_payment')).toBe('bolt');
    expect(kindIcon('mystery')).toBe('payments-outline');
  });
});
