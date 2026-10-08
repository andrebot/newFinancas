import { describe, expect, it } from 'vitest';
import { createApiError, isApiError } from '../../../src/http/apiError';

describe('createApiError', () => {
  it('creates an Error carrying the envelope description', () => {
    const init = {
      status: 409,
      code: 'goal.allocation_exceeds_100',
      message: 'Over 100%',
      params: { current: 85 },
    } as const;

    const error = createApiError(init);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Over 100%');
    expect(error.apiError).toEqual(init);
  });
});

describe('isApiError', () => {
  it('recognizes errors made by createApiError', () => {
    expect(isApiError(createApiError({ status: 404, code: 'x.y', message: 'm' }))).toBe(true);
  });

  it.each([
    ['a plain Error', new Error('boom')],
    ['a non-error object', { apiError: {} }],
    ['a string', 'boom'],
    ['null', null],
  ])('rejects %s', (_case, value) => {
    expect(isApiError(value)).toBe(false);
  });
});
