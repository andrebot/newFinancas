import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { coerceQuery, coerceValue, fieldKind } from '../../../src/http/queryCoercion';

describe('fieldKind', () => {
  it.each([
    [z.int(), 'number'],
    [z.number().optional(), 'number'],
    [z.int().optional().default(20), 'number'],
    [z.boolean().nullable(), 'boolean'],
    [z.array(z.string()).prefault([]), 'array'],
    [z.string(), 'other'],
    [z.iso.date().optional(), 'other'],
  ])('classifies schema %# as %s', (schema, kind) => {
    expect(fieldKind(schema)).toBe(kind);
  });
});

describe('coerceValue', () => {
  it.each([
    ['number', '20', 20],
    ['number', '-1.5', -1.5],
    ['number', 'abc', 'abc'],
    ['number', '  ', '  '],
    ['boolean', 'true', true],
    ['boolean', 'false', false],
    ['boolean', 'yes', 'yes'],
    ['array', 'a', ['a']],
    ['other', '2026-10-01', '2026-10-01'],
  ] as const)('converts %s %j to %j', (kind, value, expected) => {
    expect(coerceValue(kind, value)).toEqual(expected);
  });

  it('leaves repeated (array) and missing values unchanged', () => {
    expect(coerceValue('array', ['a', 'b'])).toEqual(['a', 'b']);
    expect(coerceValue('number', undefined)).toBeUndefined();
  });
});

describe('coerceQuery', () => {
  const schema = z.object({
    limit: z.int().optional(),
    archived: z.boolean().optional(),
    kinds: z.array(z.string()).optional(),
    search: z.string().optional(),
  });

  it('converts each field by its schema type and leaves unknown keys as text', () => {
    expect(coerceQuery(schema, {
      limit: '20', archived: 'true', kinds: 'buy', search: '123', extra: '1',
    })).toEqual({
      limit: 20, archived: true, kinds: ['buy'], search: '123', extra: '1',
    });
  });

  it('returns non-objects and non-object schemas unchanged', () => {
    expect(coerceQuery(schema, null)).toBeNull();
    expect(coerceQuery(schema, 'x')).toBe('x');
    expect(coerceQuery(z.string(), { a: '1' })).toEqual({ a: '1' });
  });
});
