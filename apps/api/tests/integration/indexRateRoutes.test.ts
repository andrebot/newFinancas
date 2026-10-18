import {
  describe, expect, it, vi,
} from 'vitest';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
const VALUE = '0199c5a0-0000-7000-8000-0000000000b3';
const ACTOR = { userId: USER_ID, sessionId: 's1', systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');
const RATES = `/households/${HOME}/index-rates`;
const SELIC_VALUES = `${RATES}/selic/values`;
const RATE = {
  id: VALUE,
  householdId: HOME,
  indexCode: 'selic' as const,
  value: 105000,
  asOfDate: '2026-10-01',
  createdByUserId: USER_ID as string | null,
  createdAt: NOW,
};
const RATE_JSON = {
  id: VALUE,
  index: 'selic',
  value: 105000,
  asOf: '2026-10-01',
  createdByUserId: USER_ID,
  createdAt: NOW.toISOString(),
};

/**
 * The app, with a token check accepting only `good-token`.
 *
 * @returns The app and its mocked Managers.
 */
const setup = () => appWithMocks(vi.fn(async (token: string) => (
  token === 'good-token' ? ACTOR : undefined
)));

/**
 * Sends a signed-in JSON request under /api/v1.
 *
 * @param app - The app.
 * @param method - HTTP method.
 * @param path - Path under /api/v1.
 * @param body - JSON body, if any.
 * @returns The response.
 */
const send = (
  app: ReturnType<typeof setup>['app'],
  method: string,
  path: string,
  body?: unknown,
) => app.request(`/api/v1${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/**
 * The context the Manager receives: a correlation ID and the actor.
 *
 * @returns A matcher.
 */
const signedIn = () => expect.objectContaining({ actor: ACTOR });

/**
 * The fields a 422 names.
 *
 * @param response - The response.
 * @returns Each detail's field.
 */
const failingFields = async (response: Response) => (
  (await errorOf(response) as { details?: { field: string }[] }).details?.map(({ field }) => field)
);

describe('index rate routes (M2 part 5, FR-11.6)', () => {
  it('need a signed-in user', async () => {
    const { app, account } = setup();

    const response = await app.request(`/api/v1${RATES}`);

    expect(response.status).toBe(401);
    expect(account.listIndexRates).not.toHaveBeenCalled();
  });

  it('GET …/index-rates → 200, every index with its unit and history', async () => {
    const { app, account } = setup();
    account.listIndexRates.mockResolvedValueOnce([
      { index: 'selic', unit: 'annual_percent', values: [RATE] },
      { index: 'ipca', unit: 'trailing_12m_percent', values: [] },
    ]);

    const response = await send(app, 'GET', RATES);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        { index: 'selic', unit: 'annual_percent', values: [RATE_JSON] },
        { index: 'ipca', unit: 'trailing_12m_percent', values: [] },
      ],
    });
    expect(account.listIndexRates).toHaveBeenCalledWith(signedIn(), HOME);
  });

  it('POST …/index-rates/:index/values → 201', async () => {
    const { app, account } = setup();
    account.recordIndexRate.mockResolvedValueOnce(RATE);
    const body = { value: 105000, asOf: '2026-10-01' };

    const response = await send(app, 'POST', SELIC_VALUES, body);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(RATE_JSON);
    expect(account.recordIndexRate).toHaveBeenCalledWith(signedIn(), HOME, 'selic', body);
  });

  it('POST …/index-rates/:index/values refuses an unknown index before the Manager', async () => {
    const { app, account } = setup();

    const response = await send(app, 'POST', `${RATES}/libor/values`, {
      value: 1, asOf: '2026-10-01',
    });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['index']);
    expect(account.recordIndexRate).not.toHaveBeenCalled();
  });

  it('PATCH …/index-rates/:index/values/:valueId → 200', async () => {
    const { app, account } = setup();
    account.editIndexRate.mockResolvedValueOnce(RATE);

    const response = await send(app, 'PATCH', `${SELIC_VALUES}/${VALUE}`, { value: -2000 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(RATE_JSON);
    expect(account.editIndexRate).toHaveBeenCalledWith(signedIn(), HOME, 'selic', VALUE, {
      value: -2000,
    });
  });

  it('DELETE …/index-rates/:index/values/:valueId → 204', async () => {
    const { app, account } = setup();
    account.deleteIndexRate.mockResolvedValueOnce(undefined);

    const response = await send(app, 'DELETE', `${SELIC_VALUES}/${VALUE}`);

    expect(response.status).toBe(204);
    expect(account.deleteIndexRate).toHaveBeenCalledWith(signedIn(), HOME, 'selic', VALUE);
  });
});
