import { describe, expect, it } from 'vitest';
import {
  findKind, isKindAllowed, KIND_GROUPS, kindsFor, TRANSACTION_KINDS,
} from '../../src/transactionKinds';

const codes = (kinds: readonly { code: string }[]) => kinds.map((k) => k.code);

describe('TRANSACTION_KINDS', () => {
  it('has the 16 FR-3.1 kinds, each code once', () => {
    expect(new Set(codes(TRANSACTION_KINDS)).size).toBe(16);
  });

  it('gives every account kind an effect and no card kind one', () => {
    TRANSACTION_KINDS.forEach((kind) => {
      expect('effect' in kind, kind.code).toBe(kind.target === 'account');
    });
  });

  it('uses only the four picker groups, each of them', () => {
    const groups = [...new Set(TRANSACTION_KINDS.map((k) => k.group))].sort();

    expect(groups).toEqual([...KIND_GROUPS].sort());
  });

  it.each([
    ['transfer_sent', 'transfer'], ['transfer_received', 'transfer'],
    ['credit_card_bill_payment', 'bill_payment'],
    ['investment_buy', 'investment_trade'], ['investment_sell', 'investment_trade'],
    ['investment_redemption', 'investment_trade'],
    ['investment_dividend', 'movement'], ['investment_interest', 'movement'],
    ['investment_tax', 'movement'], ['pix_payment', 'movement'],
  ])('maps %s to the %s effect (EFFECT_BY_KIND)', (code, effect) => {
    expect(findKind(code)?.effect).toBe(effect);
  });

  it.each([
    ['deposit', 'in'], ['withdrawal', 'out'], ['pix_receipt', 'in'], ['charge', 'out'],
    ['refund', 'in'], ['investment_buy', 'out'], ['investment_sell', 'in'],
  ])('%s moves money %s', (code, direction) => {
    expect(findKind(code)?.direction).toBe(direction);
  });
});

describe('findKind', () => {
  it('returns undefined for an unknown code', () => {
    expect(findKind('teleport')).toBeUndefined();
  });
});

describe('kind/target rules (FR-3.1, OQ-76)', () => {
  it('offers only charge and refund on a credit card', () => {
    expect(codes(kindsFor({ target: 'card' }))).toEqual(['charge', 'refund']);
  });

  it('offers every account kind on a checking account', () => {
    expect(kindsFor({ target: 'account', accountType: 'checking' })).toHaveLength(14);
  });

  it('refuses investment kinds on a credit_card_only account', () => {
    const offered = codes(kindsFor({ target: 'account', accountType: 'credit_card_only' }));

    expect(offered).not.toContain('investment_buy');
    expect(offered).toContain('credit_card_bill_payment');
    expect(offered).toHaveLength(8);
  });

  it('never allows a card kind on an account, or an account kind on a card', () => {
    const checking = { target: 'account', accountType: 'checking' } as const;

    expect(isKindAllowed(findKind('charge')!, checking)).toBe(false);
    expect(isKindAllowed(findKind('deposit')!, { target: 'card' })).toBe(false);
  });
});
