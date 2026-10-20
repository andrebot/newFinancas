import { describe, expect, it } from 'vitest';
import {
  amountToClean, exceedsMaxDigits, formatMoneyDigits, groupThousands, moneyMask, parseMoneyText,
  readAmount,
} from '../../../../src/kit/moneyInput/money';
import type { MoneyConventions } from '../../../../src/utilities/formatting';

// Kit mask (BDT: Interaction tier → unit, pure — nothing to mock). The
// conventions are written out, so the mask is tested apart from `Intl`.

const BRL: MoneyConventions = {
  symbol: 'R$', decimal: ',', group: '.', minorDigits: 2,
};
const USD: MoneyConventions = {
  symbol: '$', decimal: '.', group: ',', minorDigits: 2,
};
const WHOLE: MoneyConventions = {
  symbol: '¥', decimal: '.', group: ',', minorDigits: 0,
};

describe('groupThousands', () => {
  it('separates groups of three from the right', () => {
    expect(groupThousands('1234567', '.')).toBe('1.234.567');
    expect(groupThousands('123', ',')).toBe('123');
  });
});

describe('formatMoneyDigits', () => {
  it('writes minor units in the currency’s separators', () => {
    expect(formatMoneyDigits('123456', BRL)).toBe('1.234,56');
    expect(formatMoneyDigits('123456', USD)).toBe('1,234.56');
  });

  it('pads the cents while fewer digits are typed', () => {
    expect(formatMoneyDigits('5', BRL)).toBe('0,05');
    expect(formatMoneyDigits('0', USD)).toBe('0.00');
  });

  it('writes a negative amount with the true minus sign', () => {
    expect(formatMoneyDigits('-4599', USD)).toBe('−45.99');
  });

  it('writes nothing for no amount', () => {
    expect(formatMoneyDigits('', BRL)).toBe('');
  });

  it('writes no decimal separator for a currency without minor units', () => {
    expect(formatMoneyDigits('1500', WHOLE)).toBe('1,500');
  });
});

describe('parseMoneyText', () => {
  it('keeps only the digits of pasted or typed text', () => {
    expect(parseMoneyText('R$ 1.234,56', false)).toBe('123456');
  });

  it('drops minus signs when the amount may not be negative', () => {
    expect(parseMoneyText('−12,34-', false)).toBe('1234');
  });

  it('keeps each minus sign as `-` when it may', () => {
    expect(parseMoneyText('−12,34-', true)).toBe('-1234-');
  });
});

describe('moneyMask', () => {
  it('fills from the right, so the caret is counted from the end', () => {
    const mask = moneyMask(BRL, true);

    expect(mask.anchor).toBe('end');
    expect(mask.format('-123')).toBe('−1,23');
    expect(mask.parse('−1,23')).toBe('-123');
  });

  it('turns the clean value it formats back into itself', () => {
    const mask = moneyMask(USD, true);

    expect(mask.parse(mask.format('-123456'))).toBe('-123456');
  });

  it('applies the sign rule it was built with', () => {
    expect(moneyMask(BRL, false).parse('-1')).toBe('1');
  });
});

describe('amountToClean', () => {
  it('writes minor units as text, signed', () => {
    expect(amountToClean(-123456)).toBe('-123456');
    expect(amountToClean(0)).toBe('0');
  });

  it('is empty for no amount', () => {
    expect(amountToClean(null)).toBe('');
  });
});

describe('exceedsMaxDigits', () => {
  it('counts only significant digits against the cap', () => {
    expect(exceedsMaxDigits('-00123', 3)).toBe(false);
    expect(exceedsMaxDigits('1234', 3)).toBe(true);
  });
});

describe('readAmount', () => {
  it('reads the digits as minor units, padding zeros dropped', () => {
    expect(readAmount('0012')).toBe(12);
  });

  it('is null when no digit but zeros is left', () => {
    expect(readAmount('')).toBeNull();
    expect(readAmount('-')).toBeNull();
    expect(readAmount('-000')).toBeNull();
  });

  it('flips the sign once per minus typed', () => {
    expect(readAmount('-1234')).toBe(-1234);
    expect(readAmount('-1234-')).toBe(1234);
    expect(readAmount('12-34')).toBe(-1234);
  });
});
