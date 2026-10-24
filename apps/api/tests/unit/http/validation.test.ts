import { zError, zGoalCreateRequest, zListTransactionsQuery } from '@financas/api-types/zod';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { isDomainError } from '../../../src/utilities/domainError';
import { createErrorHandler, type AppEnv } from '../../../src/http/errorHandler';
import { throwOnInvalid, validate, validationError } from '../../../src/http/validation';

const VALID_GOAL = {
  name: 'Trip',
  targetAmount: 500000,
  targetCurrency: 'BRL',
  dueDate: '2027-01-31',
  visibility: 'shared',
};

/**
 * Builds a tiny app with one route of each validated kind, using generated schemas.
 *
 * @returns The app.
 */
const buildApp = () => {
  const app = new Hono<AppEnv>();
  app.onError(createErrorHandler(() => {}));
  app.post('/goals', validate('json', zGoalCreateRequest), (httpContext) => (
    httpContext.json(httpContext.req.valid('json'))
  ));
  app.get('/transactions', validate('query', zListTransactionsQuery), (httpContext) => (
    httpContext.json(httpContext.req.valid('query'))
  ));
  return app;
};

describe('validationError', () => {
  it('is a 422 validation.failed error with one detail per issue', () => {
    const result = zGoalCreateRequest.safeParse({});
    if (result.success) throw new Error('expected failure');

    const error = validationError(result.error.issues, {});

    expect(error.domainError.code).toBe('validation.failed');
    expect(error.domainError.details).toHaveLength(5);
  });
});

describe('throwOnInvalid', () => {
  it('does nothing on success', () => {
    expect(() => throwOnInvalid({ success: true, data: {} })).not.toThrow();
  });

  it('throws the validation error on failure', () => {
    const result = zGoalCreateRequest.safeParse({});

    try {
      throwOnInvalid({ ...result, data: {} });
      expect.unreachable();
    } catch (error) {
      expect(isDomainError(error) && error.domainError.code).toBe('validation.failed');
    }
  });
});

describe('validate', () => {
  it('passes a valid JSON body through, typed', async () => {
    const response = await buildApp().request('/goals', {
      method: 'POST',
      body: JSON.stringify(VALID_GOAL),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(VALID_GOAL);
  });

  it('never coerces a JSON body the way it coerces a query string', async () => {
    const response = await buildApp().request('/goals', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_GOAL, targetAmount: '500000' }),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { details: [{ field: 'targetAmount', code: 'field.invalid_type' }] },
    });
  });

  it('rejects an invalid JSON body with the contract error envelope', async () => {
    const response = await buildApp().request('/goals', {
      method: 'POST',
      body: JSON.stringify({
        ...VALID_GOAL, targetAmount: 1.5, visibility: 'public', name: undefined,
      }),
      headers: { 'content-type': 'application/json' },
    });
    const body = zError.parse(await response.json());

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('validation.failed');
    expect(body.error.details).toEqual(expect.arrayContaining([
      { field: 'name', code: 'field.required' },
      { field: 'targetAmount', code: 'field.invalid_type', params: { expected: 'int' } },
      {
        field: 'visibility',
        code: 'field.invalid_option',
        params: { options: ['personal', 'shared'] },
      },
    ]));
  });

  it('converts query values using the schema before validating', async () => {
    const response = await buildApp().request('/transactions?limit=50&from=2026-01-01');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ limit: 50, from: '2026-01-01' });
  });

  it('rejects an out-of-range query value with a field detail', async () => {
    const response = await buildApp().request('/transactions?limit=500');
    const body = zError.parse(await response.json());

    expect(response.status).toBe(422);
    expect(body.error.details)
      .toEqual([{ field: 'limit', code: 'number.max', params: { max: 100 } }]);
  });
});
