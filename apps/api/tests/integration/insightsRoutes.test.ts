import {
  describe, expect, it, vi,
} from 'vitest';
import { createDomainError } from '../../src/utilities/domainError';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
const GOAL_ID = '0199c5a0-0000-7000-8000-0000000000f1';
const ACCOUNT_ID = '0199c5a0-0000-7000-8000-0000000000a1';
const HOLDING_ID = '0199c5a0-0000-7000-8000-0000000000b1';
const ACTOR = { userId: USER_ID, sessionId: 's1', systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');

const GOAL = {
  id: GOAL_ID,
  householdId: HOME,
  ownerUserId: null,
  name: 'House',
  targetAmount: 2000000,
  targetCurrency: 'BRL',
  dueDate: '2028-01-01',
  visibility: 'shared' as const,
  completedAt: null as Date | null,
  createdAt: NOW,
};
const GOAL_JSON = { ...GOAL, createdAt: NOW.toISOString(), completedAt: null };
const FUNDING = {
  holdingId: HOLDING_ID, name: 'PETR4', percentage: 50, contribution: null,
};
const WITH_PROGRESS = { goal: GOAL, fundedBy: [FUNDING] };
const GOAL_WITH_PROGRESS_JSON = { ...GOAL_JSON, fundedBy: [FUNDING] };
const PROGRESS_JSON = {
  goalId: GOAL_ID, targetAmount: 2000000, targetCurrency: 'BRL', fundedBy: [FUNDING],
};

const HOLDING = {
  id: HOLDING_ID,
  accountId: ACCOUNT_ID,
  assetType: 'cdb' as const,
  ticker: null,
  quantity: 1,
  costBasis: 1000000,
  rateType: 'fixed' as const,
  rateValue: 105000,
  rateSpread: null,
  incentivised: null,
  interestPayment: 'at_maturity' as const,
  dueDate: '2027-10-01',
  archivedAt: null as Date | null,
  archivedBy: null,
  maturedNotifiedAt: null as Date | null,
  createdAt: NOW,
  expectedPayout: 1105000,
  expectedTaxes: { estimated: true, amount: 26112 },
  projectionUnavailable: null,
};
const HOLDING_JSON = {
  id: HOLDING_ID,
  accountId: ACCOUNT_ID,
  assetType: 'cdb',
  ticker: null,
  quantity: 1,
  costBasis: 1000000,
  rate: { type: 'fixed', value: 105000, spread: null },
  archivedAt: null,
  createdAt: NOW.toISOString(),
  incentivised: null,
  interestPayment: 'at_maturity',
  dueDate: '2027-10-01',
  archivedBy: null,
  expectedPayout: 1105000,
  expectedTaxes: { estimated: true, amount: 26112 },
  projectionUnavailable: null,
};

/** A market-priced Holding — no rate, no projection (the mapper's other branch). */
const STOCK = {
  ...HOLDING,
  id: '0199c5a0-0000-7000-8000-0000000000b2',
  assetType: 'stock' as const,
  ticker: 'PETR4',
  quantity: 10,
  costBasis: 320000,
  rateType: null,
  rateValue: null,
  interestPayment: null,
  dueDate: null,
  expectedPayout: null,
  expectedTaxes: null,
};
const STOCK_JSON = {
  ...HOLDING_JSON,
  id: '0199c5a0-0000-7000-8000-0000000000b2',
  assetType: 'stock',
  ticker: 'PETR4',
  quantity: 10,
  costBasis: 320000,
  rate: null,
  interestPayment: null,
  dueDate: null,
  expectedPayout: null,
  expectedTaxes: null,
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
 * Sends a signed-in request under /api/v1.
 *
 * @param app - The app.
 * @param method - HTTP method.
 * @param path - Path under /api/v1.
 * @returns The response.
 */
const send = (app: ReturnType<typeof setup>['app'], method: string, path: string) => (
  app.request(`/api/v1${path}`, {
    method,
    headers: { Authorization: 'Bearer good-token' },
  })
);

/**
 * The context the Manager receives: a correlation ID and the actor.
 *
 * @returns A matcher.
 */
const signedIn = () => expect.objectContaining({ actor: ACTOR });

/** The Month Overview the mock answers with — one Goal in its goals. */
const WITH_PROGRESS_OVERVIEW = () => ({
  summary: [], yearStrip: [], balances: [], budgets: [], goals: [WITH_PROGRESS],
});

describe('insights routes (OQ-201, under /households/:householdId — OQ-174)', () => {
  it('need a signed-in user', async () => {
    const { app, insights } = setup();

    const response = await app.request(`/api/v1/households/${HOME}/reports/month-overview`);

    expect(response.status).toBe(401);
    expect(insights.monthOverview).not.toHaveBeenCalled();
  });

  it('GET …/reports/month-overview → 200, the report tagged with its type', async () => {
    const { app, insights } = setup();
    insights.monthOverview.mockResolvedValue(WITH_PROGRESS_OVERVIEW());

    const response = await send(app, 'GET', `/households/${HOME}/reports/month-overview`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reportType: 'month-overview',
      summary: [],
      yearStrip: [],
      balances: [],
      budgets: [],
      goals: [GOAL_WITH_PROGRESS_JSON],
    });
    expect(insights.monthOverview)
      .toHaveBeenCalledWith(signedIn(), HOME, { year: undefined, month: undefined });
  });

  it('passes the asked year and month through', async () => {
    const { app, insights } = setup();
    insights.monthOverview.mockResolvedValue(WITH_PROGRESS_OVERVIEW());

    await send(app, 'GET', `/households/${HOME}/reports/month-overview?year=2025&month=3`);

    expect(insights.monthOverview).toHaveBeenCalledWith(signedIn(), HOME, { year: 2025, month: 3 });
  });

  it('refuses a report query that is not a year and/or month before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', `/households/${HOME}/reports/month-overview?year=abc`);

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({ code: 'validation.failed' });
    expect(insights.monthOverview).not.toHaveBeenCalled();
  });

  it('refuses a report type that is not one of the v1 types before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', `/households/${HOME}/reports/spending`);

    expect(response.status).toBe(422);
    expect(insights.monthOverview).not.toHaveBeenCalled();
  });

  it('answers the v1 types not served yet as 400 (task 133)', async () => {
    const { app, insights } = setup();

    const investments = await send(app, 'GET', `/households/${HOME}/reports/investments-overview`);
    const payouts = await send(app, 'GET', `/households/${HOME}/reports/payouts`);

    expect(investments.status).toBe(400);
    expect(await errorOf(investments)).toMatchObject({ code: 'report.unknown_type_or_range' });
    expect(payouts.status).toBe(400);
    expect(insights.monthOverview).not.toHaveBeenCalled();
  });

  it('GET …/goal-progress → 200, the active Goals with what funds them', async () => {
    const { app, insights } = setup();
    insights.goalProgressList.mockResolvedValue([WITH_PROGRESS]);

    const response = await send(app, 'GET', `/households/${HOME}/goal-progress`);
    await send(app, 'GET', `/households/${HOME}/goal-progress?status=completed`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [GOAL_WITH_PROGRESS_JSON] });
    expect(insights.goalProgressList)
      .toHaveBeenNthCalledWith(1, signedIn(), HOME, 'active');
    expect(insights.goalProgressList)
      .toHaveBeenNthCalledWith(2, signedIn(), HOME, 'completed');
  });

  it('refuses a Goal status that is not active or completed before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', `/households/${HOME}/goal-progress?status=archived`);

    expect(response.status).toBe(422);
    expect(insights.goalProgressList).not.toHaveBeenCalled();
  });

  it('GET …/goals/:goalId/progress → 200, the Goal\'s funding on that day', async () => {
    const { app, insights } = setup();
    insights.goalProgressFor.mockResolvedValue(WITH_PROGRESS);

    const response = await send(app, 'GET', `/households/${HOME}/goals/${GOAL_ID}/progress`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PROGRESS_JSON);
    expect(insights.goalProgressFor)
      .toHaveBeenCalledWith(signedIn(), HOME, GOAL_ID, { year: undefined, month: undefined });
  });

  it('answers by the asked month when one is given', async () => {
    const { app, insights } = setup();
    insights.goalProgressFor.mockResolvedValue(WITH_PROGRESS);

    await send(app, 'GET', `/households/${HOME}/goals/${GOAL_ID}/progress?year=2026&month=10`);

    expect(insights.goalProgressFor)
      .toHaveBeenCalledWith(signedIn(), HOME, GOAL_ID, { year: 2026, month: 10 });
  });

  it('refuses a Goal id that is not a UUID before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', `/households/${HOME}/goals/nope/progress`);

    expect(response.status).toBe(422);
    expect(insights.goalProgressFor).not.toHaveBeenCalled();
  });

  it('GET …/accounts/:accountId/holdings → 200, each with its expected payout', async () => {
    const { app, insights } = setup();
    insights.listHoldings.mockResolvedValue([HOLDING, STOCK]);

    const response = await send(app, 'GET', `/households/${HOME}/accounts/${ACCOUNT_ID}/holdings`);
    const archivedPath = `/households/${HOME}/accounts/${ACCOUNT_ID}/holdings?includeArchived=true`;
    await send(app, 'GET', archivedPath);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [HOLDING_JSON, STOCK_JSON] });
    expect(insights.listHoldings)
      .toHaveBeenNthCalledWith(1, signedIn(), HOME, ACCOUNT_ID, false);
    expect(insights.listHoldings)
      .toHaveBeenNthCalledWith(2, signedIn(), HOME, ACCOUNT_ID, true);
  });

  it('GET …/holdings/:holdingId → 200, the Holding with its projection', async () => {
    const { app, insights } = setup();
    insights.getHolding.mockResolvedValue(HOLDING);

    const response = await send(app, 'GET', `/households/${HOME}/holdings/${HOLDING_ID}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(HOLDING_JSON);
    expect(insights.getHolding).toHaveBeenCalledWith(signedIn(), HOME, HOLDING_ID);
  });

  it('answers the Manager\'s not-found refusals as 404', async () => {
    const { app, insights } = setup();
    insights.monthOverview.mockRejectedValueOnce(
      createDomainError({ code: 'household.not_found', message: 'Household not found' }),
    );
    insights.goalProgressFor.mockRejectedValueOnce(
      createDomainError({ code: 'goal.not_found', message: 'Goal not found' }),
    );
    insights.getHolding.mockRejectedValueOnce(
      createDomainError({ code: 'holding.not_found', message: 'Holding not found' }),
    );

    const overview = await send(app, 'GET', `/households/${HOME}/reports/month-overview`);
    const progress = await send(app, 'GET', `/households/${HOME}/goals/${GOAL_ID}/progress`);
    const holding = await send(app, 'GET', `/households/${HOME}/holdings/${HOLDING_ID}`);

    expect(overview.status).toBe(404);
    expect(await errorOf(overview)).toMatchObject({ code: 'household.not_found' });
    expect(progress.status).toBe(404);
    expect(await errorOf(progress)).toMatchObject({ code: 'goal.not_found' });
    expect(holding.status).toBe(404);
    expect(await errorOf(holding)).toMatchObject({ code: 'holding.not_found' });
  });
});
