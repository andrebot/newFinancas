import { describe, expect, it } from 'vitest';
import {
  CARD_NETWORK_RULES, CARD_NETWORKS, CARD_NUMBER_FORMATS, detectCardNetwork, inBinRange,
  isCardNetwork, isValidCardNumber, maxCardNumberLength, passesLuhn,
} from '../../src/cards';

describe('card networks', () => {
  it('includes the networks named in the API contract, plus other', () => {
    expect(CARD_NETWORKS)
      .toEqual(expect.arrayContaining(['visa', 'mastercard', 'elo', 'amex', 'other']));
  });

  it.each([['visa', true], ['elo', true], ['jcb', true], ['Visa', false], ['maestro', false]])(
    'isCardNetwork(%s) → %s',
    (code, ok) => {
      expect(isCardNetwork(code)).toBe(ok);
    },
  );
});

describe('CARD_NETWORK_RULES', () => {
  it('has one rule for every network except other', () => {
    const ruled = CARD_NETWORK_RULES.map(({ network }) => network).sort();

    expect(ruled).toEqual(CARD_NETWORKS.filter((network) => network !== 'other').sort());
  });

  it('writes each range with prefixes of the same length, the first not after the last', () => {
    const ranges = CARD_NETWORK_RULES.flatMap(({ ranges: own }) => own);

    ranges.forEach(([first, last]) => {
      expect(first).toHaveLength(last.length);
      expect(first <= last).toBe(true);
    });
  });
});

describe('inBinRange', () => {
  it('matches a number whose leading digits sit in the range', () => {
    expect(inBinRange('5066991234', ['506699', '506778'])).toBe(true);
    expect(inBinRange('506778', ['506699', '506778'])).toBe(true);
  });

  it('misses a number outside the range', () => {
    expect(inBinRange('506779', ['506699', '506778'])).toBe(false);
  });

  it('waits for as many digits as the range has', () => {
    expect(inBinRange('50669', ['506699', '506778'])).toBe(false);
  });
});

describe('detectCardNetwork', () => {
  it.each([
    ['4111111111111111', 'visa'],
    ['5502094242424242', 'mastercard'],
    ['2221000000000009', 'mastercard'],
    ['2720990000000000', 'mastercard'],
    ['378282246310005', 'amex'],
    ['30569309025904', 'diners'],
    ['36000000000008', 'diners'],
    ['6011111111111117', 'discover'],
    ['6445000000000000', 'discover'],
    ['3530111333300000', 'jcb'],
    ['6200000000000005', 'unionpay'],
    ['8171999927660000', 'unionpay'],
    ['6062825624254001', 'hipercard'],
    ['3841001111222233334', 'hipercard'],
    ['6370950000000005', 'hipercard'],
    ['6373742300000000', 'hipercard'],
    ['5067000000000000', 'elo'],
    ['6362970000457013', 'elo'],
    ['6516800000000000', 'elo'],
    ['9999999999999999', 'other'],
  ])('reads %s as %s', (digits, network) => {
    expect(detectCardNetwork(digits)).toBe(network);
  });

  it('puts Elo and Hipercard ahead of the networks they overlap', () => {
    expect(detectCardNetwork('401178')).toBe('elo');
    expect(detectCardNetwork('650031')).toBe('elo');
    expect(detectCardNetwork('384140')).toBe('hipercard');
  });

  it('reads a partial number as it is typed', () => {
    expect(detectCardNetwork('')).toBe('other');
    expect(detectCardNetwork('4')).toBe('visa');
    expect(detectCardNetwork('40117')).toBe('visa');
    expect(detectCardNetwork('401178')).toBe('elo');
    expect(detectCardNetwork('5')).toBe('other');
    expect(detectCardNetwork('55')).toBe('mastercard');
  });
});

describe('CARD_NUMBER_FORMATS', () => {
  it('has a format for every network', () => {
    expect(Object.keys(CARD_NUMBER_FORMATS).sort()).toEqual([...CARD_NETWORKS].sort());
  });

  it('groups Amex and Diners 4-6, the rest in fours', () => {
    expect(CARD_NUMBER_FORMATS.amex.gaps).toEqual([4, 10]);
    expect(CARD_NUMBER_FORMATS.diners.gaps).toEqual([4, 10]);
    expect(CARD_NUMBER_FORMATS.visa.gaps).toEqual([4, 8, 12, 16]);
  });
});

describe('maxCardNumberLength', () => {
  it.each([['amex', 15], ['diners', 14], ['mastercard', 16], ['visa', 19], ['other', 19]] as const)(
    '%s holds at most %i digits',
    (network, length) => {
      expect(maxCardNumberLength(network)).toBe(length);
    },
  );
});

describe('passesLuhn', () => {
  it('accepts a number whose checksum holds', () => {
    expect(passesLuhn('4111111111111111')).toBe(true);
    expect(passesLuhn('378282246310005')).toBe(true);
  });

  it('rejects a number with a typo', () => {
    expect(passesLuhn('4111111111111112')).toBe(false);
    expect(passesLuhn('4111111111111121')).toBe(false);
  });
});

describe('isValidCardNumber', () => {
  it('accepts a whole number of a length its network allows', () => {
    expect(isValidCardNumber('4111111111111111')).toBe(true);
    expect(isValidCardNumber('378282246310005')).toBe(true);
  });

  it('rejects a checksum that fails', () => {
    expect(isValidCardNumber('4111111111111112')).toBe(false);
  });

  it('rejects a length the network does not allow', () => {
    expect(isValidCardNumber('41111111111111')).toBe(false);
    expect(isValidCardNumber('3782822463100005')).toBe(false);
  });

  it('rejects anything but digits', () => {
    expect(isValidCardNumber('')).toBe(false);
    expect(isValidCardNumber('4111 1111 1111 1111')).toBe(false);
  });
});
