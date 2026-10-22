import {
  describe, expect, it, vi,
} from 'vitest';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
const HOUSE = '0199c5a0-0000-7000-8000-0000000000f1';
const ACTOR = { userId: USER_ID, sessionId: 's1', systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');
const GOALS = `/households/${HOME}/goals`;
const GOAL = {
  id: HOUSE,
  householdId: HOME,
  ownerUserId: USER_ID,
  name: 'House',
  targetAmount: 15000000,
  targetCurrency: 'BRL',
  dueDate: '2030-12-31',
  visibility: 'shared' as const,
  completedAt: null as Date | null,
  createdAt: NOW,
};
const GOAL_JSON = { ...GOAL, createdAt: NOW.toISOString(), completedAt: null };
const NEW_GOAL = {
  name: 'House',
  targetAmount: 15000000,
  targetCurrency: 'BRL',
  dueDate: '2030-12-31',
  visibility: 'shared',
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

describe('goal routes (OQ-174: under /households/:householdId)', () => {
  it('need a signed-in user', async () => {
    const { app, account } = setup();

    const response = await app.request(`/api/v1${GOALS}`);

    expect(response.status).toBe(401);
    expect(account.listGoals).not.toHaveBeenCalled();
  });

  it('GET …/goals → 200, the active Goals unless asked for the completed (OQ-177)', async () => {
    const { app, account } = setup();
    account.listGoals.mockResolvedValue([GOAL]);

    const response = await send(app, 'GET', GOALS);
    await send(app, 'GET', `${GOALS}?status=completed`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [GOAL_JSON] });
    expect(account.listGoals).toHaveBeenNthCalledWith(1, signedIn(), HOME, 'active');
    expect(account.listGoals).toHaveBeenNthCalledWith(2, signedIn(), HOME, 'completed');
  });

  it('GET …/goals refuses an unknown status', async () => {
    const { app, account } = setup();

    const response = await send(app, 'GET', `${GOALS}?status=archived`);

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['status']);
    expect(account.listGoals).not.toHaveBeenCalled();
  });

  it('POST …/goals → 201', async () => {
    const { app, account } = setup();
    account.createGoal.mockResolvedValueOnce(GOAL);

    const response = await send(app, 'POST', GOALS, NEW_GOAL);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(GOAL_JSON);
    expect(account.createGoal).toHaveBeenCalledWith(signedIn(), HOME, NEW_GOAL);
  });

  it.each([
    ['a zero target', { targetAmount: 0 }, 'targetAmount'],
    ['an unknown currency', { targetCurrency: 'EUR' }, 'targetCurrency'],
    ['a due date that is not a date', { dueDate: '31/12/2030' }, 'dueDate'],
    ['an unknown visibility', { visibility: 'public' }, 'visibility'],
  ])('POST …/goals refuses %s before the Manager', async (_, change, field) => {
    const { app, account } = setup();

    const response = await send(app, 'POST', GOALS, { ...NEW_GOAL, ...change });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual([field]);
    expect(account.createGoal).not.toHaveBeenCalled();
  });

  it('GET …/goals/:goalId → 200, a completed one with its time', async () => {
    const { app, account } = setup();
    account.getGoal.mockResolvedValueOnce({ ...GOAL, completedAt: NOW });

    const response = await send(app, 'GET', `${GOALS}/${HOUSE}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...GOAL_JSON, completedAt: NOW.toISOString() });
    expect(account.getGoal).toHaveBeenCalledWith(signedIn(), HOME, HOUSE);
  });

  it('PATCH …/goals/:goalId → 200', async () => {
    const { app, account } = setup();
    account.editGoal.mockResolvedValueOnce(GOAL);
    const body = {
      name: 'Home', targetAmount: 9000000, targetCurrency: 'USD', dueDate: '2031-06-30',
    };

    const response = await send(app, 'PATCH', `${GOALS}/${HOUSE}`, body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(GOAL_JSON);
    expect(account.editGoal).toHaveBeenCalledWith(signedIn(), HOME, HOUSE, body);
  });

  it('PATCH …/goals/:goalId refuses a zero target', async () => {
    const { app, account } = setup();

    const response = await send(app, 'PATCH', `${GOALS}/${HOUSE}`, { targetAmount: 0 });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['targetAmount']);
    expect(account.editGoal).not.toHaveBeenCalled();
  });

  it('POST …/goals refuses a name over 40 characters (OQ-195)', async () => {
    const { app, account } = setup();

    const response = await send(app, 'POST', GOALS, { ...NEW_GOAL, name: 'x'.repeat(41) });

    expect(response.status).toBe(422);
    const { error } = await response.json() as { error: { details: unknown[] } };
    expect(error.details).toEqual([{ field: 'name', code: 'string.max', params: { max: 40 } }]);
    expect(account.createGoal).not.toHaveBeenCalled();
  });

  it('PATCH …/goals/:goalId refuses a name over 40 characters (OQ-195)', async () => {
    const { app, account } = setup();

    const response = await send(app, 'PATCH', `${GOALS}/${HOUSE}`, { name: 'y'.repeat(41) });

    expect(response.status).toBe(422);
    const { error } = await response.json() as { error: { details: unknown[] } };
    expect(error.details).toEqual([{ field: 'name', code: 'string.max', params: { max: 40 } }]);
    expect(account.editGoal).not.toHaveBeenCalled();
  });

  it('DELETE …/goals/:goalId → 204', async () => {
    const { app, account } = setup();
    account.deleteGoal.mockResolvedValueOnce(undefined);

    const response = await send(app, 'DELETE', `${GOALS}/${HOUSE}`);

    expect(response.status).toBe(204);
    expect(account.deleteGoal).toHaveBeenCalledWith(signedIn(), HOME, HOUSE);
  });

  it('POST …/goals/:goalId/complete → 204', async () => {
    const { app, account } = setup();
    account.completeGoal.mockResolvedValueOnce(undefined);

    const response = await send(app, 'POST', `${GOALS}/${HOUSE}/complete`);

    expect(response.status).toBe(204);
    expect(account.completeGoal).toHaveBeenCalledWith(signedIn(), HOME, HOUSE);
  });

  it('POST …/goals/:goalId/reopen → 204', async () => {
    const { app, account } = setup();
    account.reopenGoal.mockResolvedValueOnce(undefined);

    const response = await send(app, 'POST', `${GOALS}/${HOUSE}/reopen`);

    expect(response.status).toBe(204);
    expect(account.reopenGoal).toHaveBeenCalledWith(signedIn(), HOME, HOUSE);
  });

  it('refuses a Goal id that is not a UUID before the Manager', async () => {
    const { app, account } = setup();

    const response = await send(app, 'POST', `${GOALS}/house/complete`);

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['goalId']);
    expect(account.completeGoal).not.toHaveBeenCalled();
  });
});
