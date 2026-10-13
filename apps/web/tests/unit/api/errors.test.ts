import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { describe, expect, it } from 'vitest';
import { isErrorEnvelope, toApiError } from '../../../src/api/errors';
import { envelope } from './fakes';

// Error normalisation (BDT: API client → unit, pure). Nothing mocked.

describe('isErrorEnvelope', () => {
  it.each([
    [envelope('auth.forbidden'), true],
    [{ error: { code: 'auth.forbidden' } }, false],
    [{ error: { correlationId: 'cid' } }, false],
    [{ error: null }, false],
    ['<html>Bad Gateway</html>', false],
    [null, false],
    [undefined, false],
  ])('%j → %s', (body, expected) => {
    expect(isErrorEnvelope(body)).toBe(expected);
  });
});

describe('toApiError', () => {
  it('keeps the envelope’s code, params, details and correlation ID — never `message`', () => {
    const failure: FetchBaseQueryError = {
      status: 422,
      data: envelope('validation.failed', {
        params: { count: 1 },
        details: [
          { field: 'name', code: 'string.required' },
          { field: 'amount', code: 'number.max', params: { max: 100 } },
        ],
      }),
    };
    const error = toApiError(failure, 'client-cid');

    expect(error).toEqual({
      status: 422,
      code: 'validation.failed',
      params: { count: 1 },
      details: [
        { field: 'name', code: 'string.required', params: {} },
        { field: 'amount', code: 'number.max', params: { max: 100 } },
      ],
      correlationId: 'server-cid',
    });
    expect(error).not.toHaveProperty('message');
  });

  it('gives missing params and details empty values', () => {
    const error = toApiError({ status: 404, data: envelope('route.not_found') }, 'client-cid');

    expect(error.params).toEqual({});
    expect(error.details).toEqual([]);
  });

  it.each<FetchBaseQueryError>([
    { status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' },
    { status: 'TIMEOUT_ERROR', error: 'AbortError' },
  ])('a request that never reached the API ($status) is network.unavailable', (failure) => {
    expect(toApiError(failure, 'client-cid')).toEqual({
      status: undefined,
      code: 'network.unavailable',
      params: {},
      details: [],
      correlationId: 'client-cid',
    });
  });

  it.each<[FetchBaseQueryError, number | undefined]>([
    [{
      status: 'PARSING_ERROR', originalStatus: 502, data: '<html>', error: 'SyntaxError',
    }, 502],
    [{ status: 500, data: { unexpected: true } }, 500],
    [{ status: 'CUSTOM_ERROR', error: 'custom' }, undefined],
  ])('an answer that isn’t the envelope is internal.unexpected (%j)', (failure, status) => {
    expect(toApiError(failure, 'client-cid')).toEqual({
      status,
      code: 'internal.unexpected',
      params: {},
      details: [],
      correlationId: 'client-cid',
    });
  });
});
