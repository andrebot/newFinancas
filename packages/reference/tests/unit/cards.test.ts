import { describe, expect, it } from 'vitest';
import { CARD_NETWORKS, isCardNetwork } from '../../src/cards';

describe('card networks', () => {
  it('includes the networks named in the API contract, plus other', () => {
    expect(CARD_NETWORKS)
      .toEqual(expect.arrayContaining(['visa', 'mastercard', 'elo', 'amex', 'other']));
  });

  it.each([['visa', true], ['elo', true], ['Visa', false], ['jcb', false]])(
    'isCardNetwork(%s) → %s',
    (code, ok) => {
      expect(isCardNetwork(code)).toBe(ok);
    },
  );
});
