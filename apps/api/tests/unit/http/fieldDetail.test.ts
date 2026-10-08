import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { catalogs } from '@financas/i18n';
import { formatFieldPath, toFieldDetail, valueAt } from '../../../src/http/fieldDetail';

/**
 * Parses `input` with `schema` and returns the first issue's detail.
 *
 * @param schema - Schema expected to reject `input`.
 * @param input - The value to validate.
 * @returns The field detail for the first issue.
 */
const detailFor = (schema: z.ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected a validation failure');
  return toFieldDetail(result.error.issues[0]!, input);
};

describe('formatFieldPath', () => {
  it.each([
    [[], ''],
    [['name'], 'name'],
    [['allocations', 1, 'percentage'], 'allocations[1].percentage'],
    [[0, 'id'], '[0].id'],
    [[Symbol.for('s')], 'Symbol(s)'],
  ])('formats %j as %j', (path, expected) => {
    expect(formatFieldPath(path)).toBe(expected);
  });
});

describe('valueAt', () => {
  const input = { a: { list: [{ b: 1 }] }, n: null };

  it('reads nested values', () => {
    expect(valueAt(input, ['a', 'list', 0, 'b'])).toBe(1);
  });

  it.each([
    [['missing']],
    [['n', 'x']],
    [['a', 'list', 0, 'b', 'deeper']],
  ])('returns undefined for %j', (path) => {
    expect(valueAt(input, path)).toBeUndefined();
  });
});

describe('toFieldDetail', () => {
  it('reports a missing field as field.required', () => {
    expect(detailFor(z.object({ name: z.string() }), {}))
      .toEqual({ field: 'name', code: 'field.required' });
  });

  it('reports a wrong type as field.invalid_type with the expected type', () => {
    expect(detailFor(z.object({ name: z.string() }), { name: 1 }))
      .toEqual({ field: 'name', code: 'field.invalid_type', params: { expected: 'string' } });
  });

  it.each([
    [z.int().max(1500), 1600, 'number.max', { max: 1500 }],
    [z.number().min(1), 0, 'number.min', { min: 1 }],
    [z.string().min(12), 'short', 'string.min', { min: 12 }],
    [z.string().max(2), 'long', 'string.max', { max: 2 }],
    [z.array(z.int()).min(1), [], 'array.min', { min: 1 }],
    [z.array(z.int()).max(1), [1, 2], 'array.max', { max: 1 }],
    [z.date().min(new Date(1000)), new Date(0), 'date.min', { min: 1000 }],
    [z.bigint().max(5n), 6n, 'number.max', { max: 5 }],
    [z.file().max(1), new File(['ab'], 'f'), 'value.max', { max: 1 }],
  ])('maps size limits to <kind>.<min|max> (%#)', (schema, input, code, params) => {
    expect(detailFor(schema, input)).toEqual({ field: '', code, params });
  });

  it('maps a format failure to string.format', () => {
    expect(detailFor(z.uuid(), 'nope'))
      .toEqual({ field: '', code: 'string.format', params: { format: 'uuid' } });
  });

  it('maps a multiple-of failure to number.multiple_of', () => {
    expect(detailFor(z.int().multipleOf(5), 7))
      .toEqual({ field: '', code: 'number.multiple_of', params: { divisor: 5 } });
  });

  it('maps an enum failure to field.invalid_option with the options', () => {
    expect(detailFor(z.object({ v: z.enum(['personal', 'shared']) }), { v: 'x' }))
      .toEqual({
        field: 'v', code: 'field.invalid_option', params: { options: ['personal', 'shared'] },
      });
  });

  it('maps unknown keys to object.unknown_keys', () => {
    expect(detailFor(z.strictObject({}), { extra: 1 }))
      .toEqual({ field: '', code: 'object.unknown_keys', params: { keys: ['extra'] } });
  });

  it('maps any other issue to field.invalid', () => {
    expect(detailFor(z.union([z.string(), z.int()]), true))
      .toEqual({ field: '', code: 'field.invalid' });
  });

  it('only emits codes the i18n catalog translates', () => {
    const codes = new Set(Object.keys(catalogs['pt-BR'].fields));
    const samples = [
      detailFor(z.object({ a: z.string() }), {}),
      detailFor(z.string().min(2), 'a'),
      detailFor(z.uuid(), 'x'),
      detailFor(z.union([z.string(), z.int()]), true),
    ];

    samples.forEach((detail) => expect(codes.has(detail.code)).toBe(true));
  });
});
