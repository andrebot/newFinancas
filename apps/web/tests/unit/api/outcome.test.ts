import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../../src/api/errors';
import { failureOf, toDataOutcome, toRequestOutcome } from '../../../src/api/outcome';

// Endpoint result → RequestOutcome (BDT: utility-like translation → unit,
// nothing mocked).

const API_ERROR: ApiError = {
  status: 429,
  code: 'auth.too_many_attempts',
  params: { retryAfterMinutes: 15 },
  details: [],
  correlationId: 'cid-1',
};

describe('failureOf', () => {
  it('keeps an API error’s code and params, nothing else', () => {
    expect(failureOf(API_ERROR)).toEqual({
      code: 'auth.too_many_attempts', params: { retryAfterMinutes: 15 },
    });
  });

  it('turns an exception into internal.unexpected', () => {
    expect(failureOf({ name: 'TypeError', message: 'boom' }))
      .toEqual({ code: 'internal.unexpected' });
  });
});

describe('toRequestOutcome', () => {
  it('answers ok for data, even none', () => {
    expect(toRequestOutcome({ data: { id: 'x' } })).toEqual({ ok: true });
    expect(toRequestOutcome({ data: null })).toEqual({ ok: true });
  });

  it('answers the failure for an error', () => {
    expect(toRequestOutcome({ error: API_ERROR })).toEqual({
      ok: false, error: { code: 'auth.too_many_attempts', params: { retryAfterMinutes: 15 } },
    });
  });
});

describe('toDataOutcome', () => {
  it('keeps the data on a success', () => {
    expect(toDataOutcome({ data: { id: 'x' } })).toEqual({ ok: true, data: { id: 'x' } });
  });

  it('answers the failure for an error, without data', () => {
    expect(toDataOutcome({ error: API_ERROR })).toEqual({
      ok: false, error: { code: 'auth.too_many_attempts', params: { retryAfterMinutes: 15 } },
    });
  });
});
