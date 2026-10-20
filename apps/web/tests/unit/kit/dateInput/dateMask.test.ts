import { describe, expect, it } from 'vitest';
import {
  cleanToShow, cleanToValue, dateLayout, dateMask, datePlaceholder, formatDateDigits,
  readDateCharacter, valueToClean,
} from '../../../../src/kit/dateInput/dateMask';

// Pure mask helpers (BDT: unit, nothing to mock).

const DAY_FIRST = dateLayout({ order: ['day', 'month', 'year'], separator: '/' });
const MONTH_FIRST = dateLayout({ order: ['month', 'day', 'year'], separator: '/' });

describe('dateLayout', () => {
  it('starts each piece after the digits of those before it', () => {
    expect(DAY_FIRST).toEqual({
      pieces: [
        { part: 'day', start: 0 },
        { part: 'month', start: 2 },
        { part: 'year', start: 4 },
      ],
      separator: '/',
    });
  });
});

describe('readDateCharacter', () => {
  it('adds a digit while the date has room, up to eight', () => {
    expect(readDateCharacter('1409', '2', DAY_FIRST)).toBe('14092');
    expect(readDateCharacter('14092026', '1', DAY_FIRST)).toBe('14092026');
  });

  it('pads a day’s or month’s single digit when a piece closer is typed', () => {
    expect(readDateCharacter('1', '/', DAY_FIRST)).toBe('01');
    expect(readDateCharacter('019', '.', DAY_FIRST)).toBe('0109');
    expect(readDateCharacter('019', '-', DAY_FIRST)).toBe('0109');
  });

  it('drops a piece closer anywhere else, and any other character', () => {
    expect(readDateCharacter('', '/', DAY_FIRST)).toBe('');
    expect(readDateCharacter('14', '/', DAY_FIRST)).toBe('14');
    expect(readDateCharacter('01092', '/', DAY_FIRST)).toBe('01092');
    expect(readDateCharacter('1', 'a', DAY_FIRST)).toBe('1');
  });
});

describe('formatDateDigits', () => {
  it('puts the separator before each begun piece, none trailing', () => {
    expect(formatDateDigits('', DAY_FIRST)).toBe('');
    expect(formatDateDigits('14', DAY_FIRST)).toBe('14');
    expect(formatDateDigits('140', DAY_FIRST)).toBe('14/0');
    expect(formatDateDigits('14092026', DAY_FIRST)).toBe('14/09/2026');
  });
});

describe('dateMask', () => {
  it('parses typed text to digits and formats them back', () => {
    const mask = dateMask(DAY_FIRST);

    expect(mask.parse('1/9/2026')).toBe('01092026');
    expect(mask.parse('14/09/2026')).toBe('14092026');
    expect(mask.format('01092026')).toBe('01/09/2026');
  });
});

describe('cleanToValue', () => {
  it('gives the contract’s date once complete, in either order', () => {
    expect(cleanToValue('14092026', DAY_FIRST)).toBe('2026-09-14');
    expect(cleanToValue('09142026', MONTH_FIRST)).toBe('2026-09-14');
  });

  it('gives the pieces typed so far before then, and nothing when empty', () => {
    expect(cleanToValue('1', DAY_FIRST)).toBe('--1');
    expect(cleanToValue('140920', DAY_FIRST)).toBe('20-09-14');
    expect(cleanToValue('', DAY_FIRST)).toBe('');
  });
});

describe('valueToClean', () => {
  it('reads a `YYYY-MM-DD` date into the layout’s order', () => {
    expect(valueToClean('2026-09-14', DAY_FIRST)).toBe('14092026');
    expect(valueToClean('2026-09-14', MONTH_FIRST)).toBe('09142026');
  });

  it('reads anything else as empty', () => {
    expect(valueToClean('', DAY_FIRST)).toBe('');
    expect(valueToClean('20-09-14', DAY_FIRST)).toBe('');
  });
});

describe('cleanToShow', () => {
  it('keeps the draft while it reads as the value', () => {
    expect(cleanToShow('140', '-0-14', DAY_FIRST)).toBe('140');
  });

  it('shows the value’s own digits once it changed from outside', () => {
    expect(cleanToShow('140', '2027-01-02', DAY_FIRST)).toBe('02012027');
  });
});

describe('datePlaceholder', () => {
  it('writes the letters in the layout’s order', () => {
    const letters = { day: 'dd', month: 'mm', year: 'yyyy' };

    expect(datePlaceholder(DAY_FIRST, letters)).toBe('dd/mm/yyyy');
    expect(datePlaceholder(MONTH_FIRST, letters)).toBe('mm/dd/yyyy');
  });
});
