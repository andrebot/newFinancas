import { describe, expect, it } from 'vitest';
import {
  checkFields, checkItems, dateWithin, firstProblem, minLength, moneyWithin, nonBlank,
  type Rule,
} from '../../../src/utilities/validation';

// ValidationUtility is pure: nothing is mocked (BDT plan, Utilities).

describe('minLength', () => {
  const atLeastThree = minLength(3);

  it.each(['abc', 'abcd'])('accepts %j', (value) => {
    expect(atLeastThree(value)).toBeUndefined();
  });

  it('fails shorter text with string.min and the minimum', () => {
    expect(atLeastThree('ab')).toEqual({ code: 'string.min', params: { min: 3 } });
  });

  it('counts whitespace, since the text is checked as sent', () => {
    expect(atLeastThree('a  ')).toBeUndefined();
  });

  it('lets a field that was not sent through', () => {
    expect(atLeastThree(undefined)).toBeUndefined();
  });
});

describe('nonBlank', () => {
  it.each(['Casa', ' Casa ', 'x'])('accepts %j', (value) => {
    expect(nonBlank(value)).toBeUndefined();
  });

  it.each(['', '   ', '\t\n'])('fails %j as string.min 1', (value) => {
    expect(nonBlank(value)).toEqual({ code: 'string.min', params: { min: 1 } });
  });

  it('lets a field that was not sent through', () => {
    expect(nonBlank(undefined)).toBeUndefined();
  });
});

describe('moneyWithin', () => {
  it.each([1, 100, 123456])('accepts %d within {min: 1}', (value) => {
    expect(moneyWithin({ min: 1 })(value)).toBeUndefined();
  });

  it('fails an amount below the minimum with number.min', () => {
    expect(moneyWithin({ min: 1 })(0)).toEqual({ code: 'number.min', params: { min: 1 } });
  });

  it('fails an amount above the maximum with number.max', () => {
    expect(moneyWithin({ max: 500 })(501)).toEqual({ code: 'number.max', params: { max: 500 } });
  });

  it('accepts both bounds themselves', () => {
    const within = moneyWithin({ min: 10, max: 20 });

    expect([within(10), within(20)]).toEqual([undefined, undefined]);
  });

  it('treats a missing side as open', () => {
    expect(moneyWithin({})(-5)).toBeUndefined();
  });

  it('lets a field that was not sent through', () => {
    expect(moneyWithin({ min: 1 })(undefined)).toBeUndefined();
  });
});

describe('dateWithin', () => {
  const october = dateWithin({ min: '2026-10-01', max: '2026-10-31' });

  it.each(['2026-10-01', '2026-10-16', '2026-10-31'])('accepts %s', (value) => {
    expect(october(value)).toBeUndefined();
  });

  it('fails an earlier date with date.min', () => {
    expect(october('2026-09-30')).toEqual({ code: 'date.min', params: { min: '2026-10-01' } });
  });

  it('fails a later date with date.max', () => {
    expect(october('2026-11-01')).toEqual({ code: 'date.max', params: { max: '2026-10-31' } });
  });

  it('orders across years and months, not just days', () => {
    expect(dateWithin({ min: '2026-01-15' })('2025-12-31')).toEqual({
      code: 'date.min', params: { min: '2026-01-15' },
    });
  });

  it('treats an undefined bound as open, e.g. a range whose start was not sent', () => {
    expect(dateWithin({ min: undefined })('1999-01-01')).toBeUndefined();
  });

  it('lets a field that was not sent through', () => {
    expect(october(undefined)).toBeUndefined();
  });
});

describe('firstProblem', () => {
  const BLANK = { code: 'string.min', params: { min: 1 } };
  const TOO_LONG = { code: 'string.max', params: { max: 2 } } as const;
  const tooLong: Rule<string | undefined> = () => TOO_LONG;

  it('reports the first rule that fails', () => {
    expect(firstProblem(nonBlank, tooLong)(' ')).toEqual(BLANK);
  });

  it('checks the next rule once the first passes', () => {
    expect(firstProblem(nonBlank, tooLong)('abc')).toEqual(TOO_LONG);
  });

  it('passes when every rule passes', () => {
    expect(firstProblem(nonBlank, minLength(2))('ab')).toBeUndefined();
  });

  it('passes with no rules', () => {
    expect(firstProblem<string>()('anything')).toBeUndefined();
  });
});

describe('checkFields', () => {
  interface Range {
    readonly name?: string;
    readonly from?: string;
    readonly to?: string;
    readonly note?: string;
  }
  const rulesFor = (range: Range) => ({
    name: nonBlank,
    to: dateWithin({ min: range.from }),
  });

  it('returns nothing when every field passes', () => {
    const range = { name: 'Q4', from: '2026-10-01', to: '2026-12-31' };

    expect(checkFields(range, rulesFor(range))).toEqual([]);
  });

  it('returns one detail per failing field, named, in the order of the rules', () => {
    const range = { to: '2026-09-30', name: ' ', from: '2026-10-01' };

    expect(checkFields(range, rulesFor(range))).toEqual([
      { field: 'name', code: 'string.min', params: { min: 1 } },
      { field: 'to', code: 'date.min', params: { min: '2026-10-01' } },
    ]);
  });

  it('ignores fields without a rule', () => {
    const range = { name: 'Q4', note: '' };

    expect(checkFields(range, { name: nonBlank })).toEqual([]);
  });
});

describe('checkItems', () => {
  it('names each failing item field by its path, in item order', () => {
    const subcategories = [{ name: 'Rent' }, { name: ' ' }, { name: '' }];

    expect(checkItems('subcategories', subcategories, { name: nonBlank })).toEqual([
      { field: 'subcategories[1].name', code: 'string.min', params: { min: 1 } },
      { field: 'subcategories[2].name', code: 'string.min', params: { min: 1 } },
    ]);
  });

  it('reports nothing for an empty list or passing items', () => {
    expect(checkItems('subcategories', [] as { name: string }[], { name: nonBlank })).toEqual([]);
    expect(checkItems('subcategories', [{ name: 'Rent' }], { name: nonBlank })).toEqual([]);
  });
});
