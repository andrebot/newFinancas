import {
  describe, expect, it, vi,
} from 'vitest';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
const GROCERIES = '0199c5a0-0000-7000-8000-0000000000e1';
const FOOD = '0199c5a0-0000-7000-8000-0000000000c1';
const ACTOR = { userId: USER_ID, sessionId: 's1', systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');
const BUDGETS = `/households/${HOME}/budgets`;
const BUDGET = {
  id: GROCERIES,
  householdId: HOME,
  ownerUserId: USER_ID,
  name: 'Groceries',
  targetAmount: 150000,
  currency: 'BRL',
  visibility: 'shared' as const,
  targets: [{ categoryId: FOOD }],
  createdAt: NOW,
};
const BUDGET_JSON = { ...BUDGET, createdAt: NOW.toISOString() };
const PERIOD = {
  year: 2026, month: 10, targetAmount: 150000, spendAmount: 4200, createdAt: NOW,
};
const NEW_BUDGET = {
  name: 'Groceries',
  targetAmount: 150000,
  currency: 'BRL',
  visibility: 'shared',
  targets: [{ categoryId: FOOD }],
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

describe('budget routes (OQ-174: under /households/:householdId)', () => {
  it('need a signed-in user', async () => {
    const { app, account } = setup();

    const response = await app.request(`/api/v1${BUDGETS}`);

    expect(response.status).toBe(401);
    expect(account.listBudgets).not.toHaveBeenCalled();
  });

  it('GET …/budgets → 200, every Budget, unpaginated (OQ-176)', async () => {
    const { app, account } = setup();
    account.listBudgets.mockResolvedValue([BUDGET]);

    const response = await send(app, 'GET', BUDGETS);
    await send(app, 'GET', `${BUDGETS}?visibility=personal`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [BUDGET_JSON] });
    expect(account.listBudgets).toHaveBeenNthCalledWith(1, signedIn(), HOME, {});
    expect(account.listBudgets).toHaveBeenNthCalledWith(2, signedIn(), HOME, {
      visibility: 'personal',
    });
  });

  it('POST …/budgets → 201', async () => {
    const { app, account } = setup();
    account.createBudget.mockResolvedValueOnce(BUDGET);

    const response = await send(app, 'POST', BUDGETS, NEW_BUDGET);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(BUDGET_JSON);
    expect(account.createBudget).toHaveBeenCalledWith(signedIn(), HOME, NEW_BUDGET);
  });

  it.each([
    ['a zero target', { targetAmount: 0 }, 'targetAmount'],
    ['no targets', { targets: [] }, 'targets'],
    ['an unknown currency', { currency: 'EUR' }, 'currency'],
    ['a target id that is not a UUID', { targets: [{ categoryId: 'food' }] },
      'targets[0].categoryId'],
  ])('POST …/budgets refuses %s before the Manager', async (_, change, field) => {
    const { app, account } = setup();

    const response = await send(app, 'POST', BUDGETS, { ...NEW_BUDGET, ...change });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual([field]);
    expect(account.createBudget).not.toHaveBeenCalled();
  });

  it('GET …/budgets/:budgetId → 200', async () => {
    const { app, account } = setup();
    account.getBudget.mockResolvedValueOnce(BUDGET);

    const response = await send(app, 'GET', `${BUDGETS}/${GROCERIES}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(BUDGET_JSON);
    expect(account.getBudget).toHaveBeenCalledWith(signedIn(), HOME, GROCERIES);
  });

  it('PATCH …/budgets/:budgetId → 200', async () => {
    const { app, account } = setup();
    account.editBudget.mockResolvedValueOnce(BUDGET);
    const body = { name: 'Food', targetAmount: 90000, targets: [{ subcategoryId: FOOD }] };

    const response = await send(app, 'PATCH', `${BUDGETS}/${GROCERIES}`, body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(BUDGET_JSON);
    expect(account.editBudget).toHaveBeenCalledWith(signedIn(), HOME, GROCERIES, body);
  });

  it('PATCH …/budgets/:budgetId refuses an empty target list (FR-4.1)', async () => {
    const { app, account } = setup();

    const response = await send(app, 'PATCH', `${BUDGETS}/${GROCERIES}`, { targets: [] });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['targets']);
    expect(account.editBudget).not.toHaveBeenCalled();
  });

  it('DELETE …/budgets/:budgetId → 204', async () => {
    const { app, account } = setup();
    account.deleteBudget.mockResolvedValueOnce(undefined);

    const response = await send(app, 'DELETE', `${BUDGETS}/${GROCERIES}`);

    expect(response.status).toBe(204);
    expect(account.deleteBudget).toHaveBeenCalledWith(signedIn(), HOME, GROCERIES);
  });

  it('GET …/budgets/:budgetId/periods → 200, the months as a range', async () => {
    const { app, account } = setup();
    account.listBudgetPeriods.mockResolvedValue([PERIOD]);

    const periods = `${BUDGETS}/${GROCERIES}/periods`;
    const response = await send(app, 'GET', `${periods}?from=2026-01&to=2026-10`);
    await send(app, 'GET', periods);

    expect(response.status).toBe(200);
    expect(await response.json())
      .toEqual({ data: [{ ...PERIOD, createdAt: NOW.toISOString() }] });
    expect(account.listBudgetPeriods).toHaveBeenNthCalledWith(1, signedIn(), HOME, GROCERIES, {
      from: { year: 2026, month: 1 }, to: { year: 2026, month: 10 },
    });
    expect(account.listBudgetPeriods).toHaveBeenNthCalledWith(2, signedIn(), HOME, GROCERIES, {});
  });

  it('GET …/periods refuses a month that is not YYYY-MM', async () => {
    const { app, account } = setup();

    const response = await send(app, 'GET', `${BUDGETS}/${GROCERIES}/periods?from=2026-1`);

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['from']);
    expect(account.listBudgetPeriods).not.toHaveBeenCalled();
  });
});
