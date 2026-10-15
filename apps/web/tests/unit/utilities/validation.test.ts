import { describe, expect, it } from 'vitest';
import {
  email,
  firstError,
  isoDate,
  matchesPassword,
  money,
  nonBlank,
  password,
  required,
  validateFields,
  wholePercent,
} from '../../../src/utilities/validation';

describe('required', () => {
  it.each([undefined, null, ''])('fails %j', (value) => {
    expect(required(value)).toEqual({ code: 'field.required' });
  });

  it.each([0, false, ' ', 'text', []])('passes %j', (value) => {
    expect(required(value)).toBeUndefined();
  });
});

describe('nonBlank', () => {
  it.each([undefined, '', '   \t'])('fails %j', (value) => {
    expect(nonBlank(value)).toEqual({ code: 'field.required' });
  });

  it('passes text with surrounding spaces', () => {
    expect(nonBlank('  Ana ')).toBeUndefined();
  });
});

describe('email', () => {
  it.each(['ana@example.com', '  ana.silva+bank@mail.example.com.br  ', "o'neil@example.org"])(
    'passes %j',
    (value) => {
      expect(email(value)).toBeUndefined();
    },
  );

  it.each([undefined, ''])('lets an empty value through (%j)', (value) => {
    expect(email(value)).toBeUndefined();
  });

  it.each([
    'ana', 'ana@', '@example.com', 'ana@example', 'ana@@example.com', 'a b@example.com',
    '.ana@example.com',
  ])(
    'fails %j',
    (value) => {
      expect(email(value)).toEqual({ code: 'string.format', params: { format: 'email' } });
    },
  );
});

describe('password', () => {
  it('fails 11 characters with the minimum as a param', () => {
    expect(password('a'.repeat(11))).toEqual({ code: 'string.min', params: { min: 12 } });
  });

  it('passes exactly 12 characters', () => {
    expect(password('a'.repeat(12))).toBeUndefined();
  });

  it('counts spaces — passwords are never trimmed', () => {
    expect(password('          ab')).toBeUndefined();
  });

  it.each([undefined, ''])('lets an empty value through (%j)', (value) => {
    expect(password(value)).toBeUndefined();
  });
});

describe('matchesPassword', () => {
  const rule = matchesPassword('correct horse battery');

  it('passes an exact repeat', () => {
    expect(rule('correct horse battery')).toBeUndefined();
  });

  it('fails anything else with password.mismatch — nothing is trimmed', () => {
    expect(rule('correct horse battery ')).toEqual({ code: 'password.mismatch' });
    expect(rule('Correct horse battery')).toEqual({ code: 'password.mismatch' });
  });

  it.each([undefined, ''])('lets an empty value through (%j)', (value) => {
    expect(rule(value)).toBeUndefined();
  });
});

describe('money', () => {
  it('passes any whole number of minor units without bounds', () => {
    expect(money()(-123456)).toBeUndefined();
  });

  it('lets an empty value through', () => {
    expect(money({ min: 1 })(undefined)).toBeUndefined();
  });

  it.each([12.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('fails the non-integer %j', (value) => {
    expect(money()(value)).toEqual({ code: 'field.invalid_type', params: { expected: 'int' } });
  });

  it('fails below the minimum', () => {
    expect(money({ min: 1 })(0)).toEqual({ code: 'number.min', params: { min: 1 } });
  });

  it('fails above the maximum', () => {
    expect(money({ max: 100 })(101)).toEqual({ code: 'number.max', params: { max: 100 } });
  });

  it('passes both bounds inclusively', () => {
    const rule = money({ min: 1, max: 100 });

    expect(rule(1)).toBeUndefined();
    expect(rule(100)).toBeUndefined();
  });
});

describe('wholePercent', () => {
  it.each([1, 60, 100])('passes %d', (value) => {
    expect(wholePercent(value)).toBeUndefined();
  });

  it('fails 0', () => {
    expect(wholePercent(0)).toEqual({ code: 'number.min', params: { min: 1 } });
  });

  it('fails 101', () => {
    expect(wholePercent(101)).toEqual({ code: 'number.max', params: { max: 100 } });
  });

  it('fails a fraction', () => {
    expect(wholePercent(10.5)).toEqual({ code: 'field.invalid_type', params: { expected: 'int' } });
  });

  it('lets an empty value through', () => {
    expect(wholePercent(undefined)).toBeUndefined();
  });
});

describe('isoDate', () => {
  it.each(['2026-10-13', '2024-02-29', '2026-12-31'])('passes %j', (value) => {
    expect(isoDate()(value)).toBeUndefined();
  });

  it.each([
    '2026-02-29', '2026-13-01', '2026-04-31', '2026-00-10', '13/10/2026', '2026-1-5',
    '2026-10-13T00:00',
  ])(
    'fails %j',
    (value) => {
      expect(isoDate()(value)).toEqual({ code: 'string.format', params: { format: 'date' } });
    },
  );

  it.each([undefined, ''])('lets an empty value through (%j)', (value) => {
    expect(isoDate()(value)).toBeUndefined();
  });

  it('fails before the minimum', () => {
    expect(isoDate({ min: '2026-01-01' })('2025-12-31'))
      .toEqual({ code: 'date.min', params: { min: '2026-01-01' } });
  });

  it('fails after the maximum', () => {
    expect(isoDate({ max: '2026-10-13' })('2026-10-14'))
      .toEqual({ code: 'date.max', params: { max: '2026-10-13' } });
  });

  it('passes both bounds inclusively', () => {
    const rule = isoDate({ min: '2026-01-01', max: '2026-12-31' });

    expect(rule('2026-01-01')).toBeUndefined();
    expect(rule('2026-12-31')).toBeUndefined();
  });
});

describe('firstError', () => {
  const rule = firstError(required, email);

  it('reports the first failing rule', () => {
    expect(rule('')).toEqual({ code: 'field.required' });
  });

  it('reaches later rules once earlier ones pass', () => {
    expect(rule('ana')).toEqual({ code: 'string.format', params: { format: 'email' } });
  });

  it('passes when every rule passes', () => {
    expect(rule('ana@example.com')).toBeUndefined();
  });

  it('passes with no rules', () => {
    expect(firstError<string>()('anything')).toBeUndefined();
  });
});

describe('validateFields', () => {
  interface Registration {
    email: string;
    password: string;
    firstName: string;
    note?: string;
  }

  const rules = {
    email: firstError(required, email),
    password: firstError(required, password),
    firstName: nonBlank,
  };

  it('returns only the failing fields', () => {
    const values: Registration = { email: 'ana', password: 'a'.repeat(12), firstName: ' ' };

    expect(validateFields(values, rules)).toEqual({
      email: { code: 'string.format', params: { format: 'email' } },
      firstName: { code: 'field.required' },
    });
  });

  it('returns an empty object for a valid form', () => {
    const values: Registration = {
      email: 'ana@example.com', password: 'a'.repeat(12), firstName: 'Ana', note: 'x',
    };

    expect(validateFields(values, rules)).toEqual({});
  });

  it('ignores fields without a rule', () => {
    expect(validateFields({ email: '', other: '' }, { email: required })).toEqual({
      email: { code: 'field.required' },
    });
  });
});
