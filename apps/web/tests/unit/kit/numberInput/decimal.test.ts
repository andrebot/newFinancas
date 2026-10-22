import { describe, expect, it } from 'vitest';
import {
  KIND_SCALE, cleanToShow, decimalMask, exceedsDigits, formatDecimalText, normalizeDecimal,
  parseDecimalText, readCharacter, readScaled, scaledToClean,
} from '../../../../src/kit/numberInput/decimal';

// Kit mask (BDT: Interaction tier → unit, pure — nothing to mock).

describe('KIND_SCALE', () => {
  it('matches the wire: Quantity × 10⁸, rate × 10,000, whole percent', () => {
    expect(KIND_SCALE).toEqual({
      quantity: 8, rate: 4, percent: 0, exchange: 4,
    });
  });
});

describe('readCharacter', () => {
  it('keeps a digit', () => {
    expect(readCharacter('7', true, false)).toEqual({ kept: '7', point: false });
  });

  it('keeps either minus sign only when negatives are allowed', () => {
    expect(readCharacter('−', true, true)).toEqual({ kept: '-', point: false });
    expect(readCharacter('-', true, true)).toEqual({ kept: '-', point: false });
    expect(readCharacter('-', true, false)).toEqual({ kept: '', point: false });
  });

  it('turns `,` or `.` into the point while one may be placed', () => {
    expect(readCharacter(',', true, false)).toEqual({ kept: '.', point: true });
    expect(readCharacter('.', true, false)).toEqual({ kept: '.', point: true });
    expect(readCharacter(',', false, false)).toEqual({ kept: '', point: false });
  });

  it('drops anything else', () => {
    expect(readCharacter('a', true, true)).toEqual({ kept: '', point: false });
  });
});

describe('parseDecimalText', () => {
  it('keeps only the first separator, as the point', () => {
    expect(parseDecimalText('1.234,56', 4, false)).toBe('1.23456');
    expect(parseDecimalText('10,25', 4, false)).toBe('10.25');
  });

  it('takes no point when the kind has no decimals', () => {
    expect(parseDecimalText('60,5', 0, false)).toBe('605');
  });

  it('keeps minus signs where they were typed when negatives are allowed', () => {
    expect(parseDecimalText('−3,1-', 4, true)).toBe('-3.1-');
    expect(parseDecimalText('−3,1', 4, false)).toBe('3.1');
  });

  it('drops letters and the % sign', () => {
    expect(parseDecimalText('12a%', 4, false)).toBe('12');
  });
});

describe('formatDecimalText', () => {
  it('writes the point in the interface language and the true minus sign', () => {
    expect(formatDecimalText('-10.5', ',')).toBe('−10,5');
    expect(formatDecimalText('10.5', '.')).toBe('10.5');
    expect(formatDecimalText('', ',')).toBe('');
  });
});

describe('normalizeDecimal', () => {
  it('leads with the sign when an odd number of minus signs was typed', () => {
    expect(normalizeDecimal('10.5-')).toBe('-10.5');
    expect(normalizeDecimal('-10.5-')).toBe('10.5');
  });

  it('drops leading zeros but keeps one before the point', () => {
    expect(normalizeDecimal('007')).toBe('7');
    expect(normalizeDecimal('00.5')).toBe('0.5');
    expect(normalizeDecimal('-0')).toBe('-0');
    expect(normalizeDecimal('.5')).toBe('.5');
  });
});

describe('exceedsDigits', () => {
  it('refuses more significant whole digits than the kind takes', () => {
    expect(exceedsDigits('1000', 0, 3)).toBe(true);
    expect(exceedsDigits('0100', 0, 3)).toBe(false);
  });

  it('refuses more decimals than the scale', () => {
    expect(exceedsDigits('-1.23456', 4, 4)).toBe(true);
    expect(exceedsDigits('-1.2345', 4, 4)).toBe(false);
  });
});

describe('readScaled', () => {
  it('reads the fixed-point integer at the kind’s scale', () => {
    expect(readScaled('10.5', 4)).toBe(105000);
    expect(readScaled('110', 4)).toBe(1100000);
    expect(readScaled('0.01', 8)).toBe(1000000);
    expect(readScaled('60', 0)).toBe(60);
  });

  it('reads a point with no digit after it', () => {
    expect(readScaled('10.', 4)).toBe(100000);
    expect(readScaled('.5', 4)).toBe(5000);
  });

  it('reads a negative number, but never a negative zero', () => {
    expect(readScaled('-0.5', 4)).toBe(-5000);
    expect(Object.is(readScaled('-0', 4), 0)).toBe(true);
  });

  it('is null without a digit', () => {
    expect(readScaled('', 4)).toBeNull();
    expect(readScaled('-', 4)).toBeNull();
    expect(readScaled('.', 4)).toBeNull();
  });
});

describe('scaledToClean', () => {
  it('writes the integer without trailing zeros', () => {
    expect(scaledToClean(105000, 4)).toBe('10.5');
    expect(scaledToClean(1100000, 4)).toBe('110');
    expect(scaledToClean(5, 4)).toBe('0.0005');
    expect(scaledToClean(60, 0)).toBe('60');
    expect(scaledToClean(0, 8)).toBe('0');
  });

  it('writes a negative integer with a leading `-`', () => {
    expect(scaledToClean(-31000, 4)).toBe('-3.1');
  });

  it('is empty for no number', () => {
    expect(scaledToClean(null, 4)).toBe('');
  });
});

describe('cleanToShow', () => {
  it('keeps what was typed while it reads as the caller’s number', () => {
    expect(cleanToShow('10.', 100000, 4)).toBe('10.');
    expect(cleanToShow('-', null, 4)).toBe('-');
  });

  it('shows the caller’s number once it differs', () => {
    expect(cleanToShow('10.', 250000, 4)).toBe('25');
    expect(cleanToShow('10.', null, 4)).toBe('');
  });
});

describe('decimalMask', () => {
  it('formats and parses in the interface language’s decimal sign', () => {
    const mask = decimalMask(',', 4, true);

    expect(mask.format('-10.25')).toBe('−10,25');
    expect(mask.parse('−10,25')).toBe('-10.25');
    expect(mask.anchor).toBeUndefined();
  });
});
