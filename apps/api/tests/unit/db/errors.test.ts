import { describe, expect, it } from 'vitest';
import { pgErrorCode } from '../../../src/db/errors';

describe('pgErrorCode', () => {
  it('reads a driver error code directly', () => {
    expect(pgErrorCode({ code: '23505' })).toBe('23505');
  });

  it('finds the code on a wrapped cause (Drizzle query errors)', () => {
    const wrapped = new Error('Failed query', { cause: { code: '23503' } });

    expect(pgErrorCode(new Error('outer', { cause: wrapped }))).toBe('23503');
  });

  it.each([
    ['no code anywhere', new Error('plain')],
    ['a non-SQLSTATE code', { code: 'ECONNREFUSED' }],
    ['a non-object', 'boom'],
    ['null', null],
  ])('returns undefined for %s', (_case, error) => {
    expect(pgErrorCode(error)).toBeUndefined();
  });
});
