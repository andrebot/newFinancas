import type { Goal, GoalWithProgress } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import { goalsApi } from '../../../src/api/goalsApi';
import { envelope, jsonResponse } from './fakes';
import { fakeFetch, sent, settle } from '../experiences/experienceFakes';
import { fakeStore } from '../shell/shellFakes';

// The shared goals endpoints (BDT: unit): the real
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
  fundedBy: [{
    holdingId: 'aapl',
    name: 'AAPL',
    percentage: 10,
    contribution: { currency: 'USD', amount: 48200 },
  }],
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
    const list = store.dispatch(goalsApi.endpoints[endpoint].initiate({
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
    const list = store.dispatch(goalsApi.endpoints[endpoint].initiate({
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
    const created = store.dispatch(goalsApi.endpoints.createGoal.initiate({
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
    const edited = store.dispatch(goalsApi.endpoints.editGoal.initiate({
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
    const done = store.dispatch(goalsApi.endpoints[endpoint].initiate({
      householdId: 'doe', goalId: 'trip',
    }));

    expect((await done).data).toBeNull();
    expect((await sent(fetchFn))[0]).toEqual({
      route: `${method} /api/v1/households/doe/goals/trip${suffix}`, body: undefined,
    });
  });
});

describe('the Goals tag (PR #145)', () => {
  /**
   * Reads the active goals and their progress, sends a goal write that
   * answers as told, and counts each read once the store settles.
   *
   * @param progressStatus - How the progress read answers.
   * @param writeStatus - How the write answers.
   * @param code - The write's error code, when it fails.
   * @returns How many times each read was sent.
   */
  const readsAfter = async (progressStatus: number, writeStatus: number, code = '') => {
    const fetchFn = fakeFetch({
      'GET /households/doe/goals': () => jsonResponse(200, { data: [GOAL] }),
      'GET /households/doe/goal-progress': () => jsonResponse(progressStatus, { data: [] }),
      'DELETE /households/doe/goals/trip': () => (
        writeStatus === 204 ? jsonResponse(204) : jsonResponse(writeStatus, envelope(code))
      ),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const arg = { householdId: 'doe', status: 'active' } as const;
    const reads = [
      store.dispatch(goalsApi.endpoints.listGoals.initiate(arg)),
      store.dispatch(goalsApi.endpoints.listGoalProgress.initiate(arg)),
    ];
    await Promise.all(reads);
    await store.dispatch(goalsApi.endpoints.deleteGoal.initiate({
      householdId: 'doe', goalId: 'trip',
    }));
    await settle();
    /**
     * Counts one read's requests.
     *
     * @param path - The read's path.
     * @returns How many were sent.
     */
    const count = async (path: string) => (await sent(fetchFn))
      .filter(({ route }) => route === `GET /api/v1/households/doe/${path}`).length;
    const counts = { goals: await count('goals'), progress: await count('goal-progress') };
    reads.forEach((read) => read.unsubscribe());
    return counts;
  };

  it('reads the goals and their progress again after a write, or one already gone', async () => {
    expect(await readsAfter(200, 204)).toEqual({ goals: 2, progress: 2 });
    expect(await readsAfter(200, 404, 'goal.not_found')).toEqual({ goals: 2, progress: 2 });
  });

  it('reads nothing again after a write that failed', async () => {
    expect(await readsAfter(200, 403, 'auth.forbidden')).toEqual({ goals: 1, progress: 1 });
  });

  it('leaves a progress read that failed to its Retry (OQ-195)', async () => {
    expect(await readsAfter(500, 204)).toEqual({ goals: 2, progress: 1 });
  });
});
