import type { Goal, GoalWithProgress } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import { accountSetupApi } from '../../../../src/experiences/accountSetup/api';
import { jsonResponse } from '../../api/fakes';
import { fakeFetch, sent } from '../experienceFakes';
import { fakeStore } from '../../shell/shellFakes';

// The Account Setup Experience's own endpoints, the goals (BDT: unit): the real
// store and API client; only `fetch` is fake. Each endpoint is exercised for
// its route, its body — the address stripped out — and what it hands back.

const GOAL: Goal = {
  id: 'trip',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Trip',
  targetAmount: 600000,
  targetCurrency: 'USD',
  dueDate: '2028-04-01',
  visibility: 'shared',
  createdAt: '2026-10-01T00:00:00Z',
  completedAt: null,
};

const GOAL_PROGRESS: GoalWithProgress = {
  ...GOAL,
  contributions: [{ holdingId: 'aapl', currency: 'USD', amount: 48200 }],
  fundedBy: [{ holdingId: 'aapl', name: 'AAPL', percentage: 10 }],
};

describe.each([
  ['listGoals', 'goals', GOAL],
  ['listGoalProgress', 'goal-progress', GOAL_PROGRESS],
] as const)('%s', (endpoint, path, item) => {
  it('asks for one status and reads the list out of its envelope', async () => {
    const fetchFn = fakeFetch({
      [`GET /households/doe/${path}`]: () => jsonResponse(200, { data: [item] }),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints[endpoint].initiate({
      householdId: 'doe', status: 'completed',
    }));

    expect((await list).data).toEqual([item]);
    const [input] = fetchFn.mock.calls[0] ?? [];
    expect(new URL((input as Request).url).search).toBe('?status=completed');
    list.unsubscribe();
  });

  it('reads an answer with no list as none', async () => {
    const fetchFn = fakeFetch({ [`GET /households/doe/${path}`]: () => jsonResponse(200, {}) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints[endpoint].initiate({
      householdId: 'doe', status: 'active',
    }));

    expect((await list).data).toEqual([]);
    list.unsubscribe();
  });
});

describe('createGoal', () => {
  it('posts the request without its address and returns what was written', async () => {
    const fetchFn = fakeFetch({ 'POST /households/doe/goals': () => jsonResponse(201, GOAL) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const created = store.dispatch(accountSetupApi.endpoints.createGoal.initiate({
      householdId: 'doe',
      name: 'Trip',
      targetAmount: 600000,
      targetCurrency: 'USD',
      dueDate: '2028-04-01',
      visibility: 'shared',
    }));

    expect((await created).data).toEqual(GOAL);
    expect((await sent(fetchFn))[0]).toEqual({
      route: 'POST /api/v1/households/doe/goals',
      body: {
        name: 'Trip',
        targetAmount: 600000,
        targetCurrency: 'USD',
        dueDate: '2028-04-01',
        visibility: 'shared',
      },
    });
  });
});

describe('editGoal', () => {
  it('patches the goal with only its changes, address stripped out', async () => {
    const fetchFn = fakeFetch({
      'PATCH /households/doe/goals/trip': () => jsonResponse(200, GOAL),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const edited = store.dispatch(accountSetupApi.endpoints.editGoal.initiate({
      householdId: 'doe', goalId: 'trip', name: 'Japan',
    }));

    expect((await edited).data).toEqual(GOAL);
    expect((await sent(fetchFn))[0]).toEqual({
      route: 'PATCH /api/v1/households/doe/goals/trip', body: { name: 'Japan' },
    });
  });
});

describe.each([
  ['deleteGoal', 'DELETE', ''],
  ['completeGoal', 'POST', '/complete'],
  ['reopenGoal', 'POST', '/reopen'],
] as const)('%s', (endpoint, method, suffix) => {
  it('goes to its route with no body and returns nothing', async () => {
    const fetchFn = fakeFetch({
      [`${method} /households/doe/goals/trip${suffix}`]: () => jsonResponse(204),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const done = store.dispatch(accountSetupApi.endpoints[endpoint].initiate({
      householdId: 'doe', goalId: 'trip',
    }));

    expect((await done).data).toBeNull();
    expect((await sent(fetchFn))[0]).toEqual({
      route: `${method} /api/v1/households/doe/goals/trip${suffix}`, body: undefined,
    });
  });
});
