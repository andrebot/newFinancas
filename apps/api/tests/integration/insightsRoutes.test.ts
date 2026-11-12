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
  boughtOn: '2026-10-01' as string | null,
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
  boughtOn: '2026-10-01',
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
  boughtOn: null,
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
  boughtOn: null,
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
  reportType: 'month-overview' as const,
  summary: [],
  yearStrip: [],
  balances: [],
  budgets: [],
  goals: [WITH_PROGRESS],
});

describe('insights routes (OQ-201, under /households/:householdId — OQ-174)', () => {
  it('need a signed-in user', async () => {
    const { app, insights } = setup();

    const response = await app.request(`/api/v1/households/${HOME}/reports/month-overview`);

    expect(response.status).toBe(401);
    expect(insights.report).not.toHaveBeenCalled();
  });

  it('GET …/reports/month-overview → 200, the report tagged with its type', async () => {
    const { app, insights } = setup();
    insights.report.mockResolvedValue(WITH_PROGRESS_OVERVIEW());

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
    expect(insights.report).toHaveBeenCalledWith(
      signedIn(),
      HOME,
      'month-overview',
      { months: 12 },
    );
  });

  it('passes the asked year and month through', async () => {
    const { app, insights } = setup();
    insights.report.mockResolvedValue(WITH_PROGRESS_OVERVIEW());

    await send(app, 'GET', `/households/${HOME}/reports/month-overview?year=2025&month=3`);

    expect(insights.report).toHaveBeenCalledWith(
      signedIn(),
      HOME,
      'month-overview',
      { year: 2025, month: 3, months: 12 },
    );
  });

  it('refuses a report query that is not a year and/or month before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', `/households/${HOME}/reports/month-overview?year=abc`);

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({ code: 'validation.failed' });
    expect(insights.report).not.toHaveBeenCalled();
  });

  it('refuses a report type that is not one of the v1 types before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', `/households/${HOME}/reports/spending`);

    expect(response.status).toBe(422);
    expect(insights.report).not.toHaveBeenCalled();
  });

  it('refuses a year outside 1900..9999 before the Manager', async () => {
    const { app, insights } = setup();

    const early = await send(app, 'GET', `/households/${HOME}/reports/month-overview?year=1899`);
    const late = await send(app, 'GET', `/households/${HOME}/goals/${GOAL_ID}/progress?year=10000`);

    expect(early.status).toBe(422);
    expect(late.status).toBe(422);
    expect(insights.report).not.toHaveBeenCalled();
    expect(insights.goalProgressFor).not.toHaveBeenCalled();
  });

  it('GET …/reports/investments-overview → 200, the report as the Manager built it', async () => {
    const { app, insights } = setup();
    const overview = {
      reportType: 'investments-overview' as const,
      netWorth: [{
        currency: 'BRL', amount: 1_500, changeVsPreviousMonth: 500, series: [],
      }],
      payoutThisMonth: [],
      allocations: [{
        kind: 'holding' as const, key: HOLDING_ID, currency: 'BRL', amount: 1_500,
      }],
      comingDue: [],
    };
    insights.report.mockResolvedValue(overview);

    const response = await send(app, 'GET', `/households/${HOME}/reports/investments-overview`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(overview);
  });

  it('GET …/reports/payouts → 200, reading a comma-joined list of Holdings (OQ-236)', async () => {
    const { app, insights } = setup();
    insights.report.mockResolvedValue({ reportType: 'payouts', series: [] });

    const response = await send(
      app,
      'GET',
      `/households/${HOME}/reports/payouts?holdingIds=${HOLDING_ID},${GOAL_ID}&months=3`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reportType: 'payouts', series: [] });
    expect(insights.report).toHaveBeenCalledWith(
      signedIn(),
      HOME,
      'payouts',
      { holdingIds: [HOLDING_ID, GOAL_ID], months: 3 },
    );
  });

  it('refuses a payouts window outside 1..24 months before the Manager (OQ-236)', async () => {
    const { app, insights } = setup();

    const none = await send(app, 'GET', `/households/${HOME}/reports/payouts?months=0`);
    const long = await send(app, 'GET', `/households/${HOME}/reports/payouts?months=25`);

    expect(none.status).toBe(422);
    expect(long.status).toBe(422);
    expect(insights.report).not.toHaveBeenCalled();
  });

  it('GET …/holdings → 200, the household\'s Holdings (OQ-233)', async () => {
    const { app, insights } = setup();
    insights.listHouseholdHoldings.mockResolvedValue([HOLDING]);

    const response = await send(app, 'GET', `/households/${HOME}/holdings?includeArchived=true`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [HOLDING_JSON] });
    expect(insights.listHouseholdHoldings).toHaveBeenCalledWith(signedIn(), HOME, true);
  });

  it('GET …/holdings leaves archived Holdings out unless asked', async () => {
    const { app, insights } = setup();
    insights.listHouseholdHoldings.mockResolvedValue([]);

    await send(app, 'GET', `/households/${HOME}/holdings`);

    expect(insights.listHouseholdHoldings).toHaveBeenCalledWith(signedIn(), HOME, false);
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
    insights.report.mockRejectedValueOnce(
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

const NOTIFICATION_ID = '0199c5a0-0000-7000-8000-0000000000c1';

/**
 * Sends a signed-in JSON request under /api/v1.
 *
 * @param app - The app.
 * @param path - Path under /api/v1.
 * @param body - The JSON body.
 * @returns The response.
 */
const post = (app: ReturnType<typeof setup>['app'], path: string, body: unknown) => (
  app.request(`/api/v1${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
);

describe('the Dashboard route (task 139, OQ-242)', () => {
  it('GET …/dashboard → 200, the panels with each Goal in its JSON form', async () => {
    const { app, insights } = setup();
    insights.getDashboard.mockResolvedValue({
      month: '2026-10',
      netWorth: [],
      comingDue: [],
      balances: [],
      budgets: [],
      goals: [WITH_PROGRESS],
    });

    const response = await send(app, 'GET', `/households/${HOME}/dashboard`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      month: '2026-10',
      netWorth: [],
      comingDue: [],
      balances: [],
      budgets: [],
      goals: [GOAL_WITH_PROGRESS_JSON],
    });
    expect(insights.getDashboard).toHaveBeenCalledWith(signedIn(), HOME);
  });

  it('refuses a household id that is not a UUID before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', '/households/home/dashboard');

    expect(response.status).toBe(422);
    expect(insights.getDashboard).not.toHaveBeenCalled();
  });
});

describe('the Notification Inbox routes (FR-6.10, OQ-105)', () => {
  it('need a signed-in user, each of them (PR #172 review)', async () => {
    const { app, insights } = setup();

    const listed = await app.request('/api/v1/notifications');
    const marked = await app.request('/api/v1/notifications/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: [NOTIFICATION_ID] }),
    });
    const deleted = await app.request(`/api/v1/notifications/${NOTIFICATION_ID}`, {
      method: 'DELETE',
    });

    expect([listed.status, marked.status, deleted.status]).toEqual([401, 401, 401]);
    expect(insights.listNotifications).not.toHaveBeenCalled();
    expect(insights.markNotificationsSeen).not.toHaveBeenCalled();
    expect(insights.deleteNotification).not.toHaveBeenCalled();
  });

  it('GET /notifications → 200, type and params with ISO instants', async () => {
    const { app, insights } = setup();
    insights.listNotifications.mockResolvedValue([{
      id: NOTIFICATION_ID,
      type: 'invitation.received',
      params: { invitationId: 'i1' },
      seenAt: NOW,
      createdAt: NOW,
    }, {
      id: 'n2', type: 'future.type', params: {}, seenAt: null, createdAt: NOW,
    }]);

    const response = await send(app, 'GET', '/notifications');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{
        id: NOTIFICATION_ID,
        type: 'invitation.received',
        params: { invitationId: 'i1' },
        seenAt: NOW.toISOString(),
        createdAt: NOW.toISOString(),
      }, {
        id: 'n2', type: 'future.type', params: {}, seenAt: null, createdAt: NOW.toISOString(),
      }],
    });
    expect(insights.listNotifications).toHaveBeenCalledWith(signedIn());
  });

  it('POST /notifications/seen → 204, the ids handed on', async () => {
    const { app, insights } = setup();
    insights.markNotificationsSeen.mockResolvedValue();

    const response = await post(app, '/notifications/seen', { notificationIds: [NOTIFICATION_ID] });

    expect(response.status).toBe(204);
    expect(insights.markNotificationsSeen).toHaveBeenCalledWith(signedIn(), [NOTIFICATION_ID]);
  });

  it('refuses an empty or non-UUID id list before the Manager', async () => {
    const { app, insights } = setup();

    const empty = await post(app, '/notifications/seen', { notificationIds: [] });
    const notUuid = await post(app, '/notifications/seen', { notificationIds: ['n1'] });

    expect(empty.status).toBe(422);
    expect(notUuid.status).toBe(422);
    expect(insights.markNotificationsSeen).not.toHaveBeenCalled();
  });

  it('DELETE /notifications/:id → 204', async () => {
    const { app, insights } = setup();
    insights.deleteNotification.mockResolvedValue();

    const response = await send(app, 'DELETE', `/notifications/${NOTIFICATION_ID}`);

    expect(response.status).toBe(204);
    expect(insights.deleteNotification).toHaveBeenCalledWith(signedIn(), NOTIFICATION_ID);
  });

  it('answers the Manager\'s notification.not_found as 404', async () => {
    const { app, insights } = setup();
    insights.deleteNotification.mockRejectedValue(
      createDomainError({ code: 'notification.not_found', message: 'Notification not found' }),
    );

    const response = await send(app, 'DELETE', `/notifications/${NOTIFICATION_ID}`);

    expect(response.status).toBe(404);
    expect(await errorOf(response)).toMatchObject({ code: 'notification.not_found' });
  });
});

describe('the audit-log export route (FR-7.2, OQ-243)', () => {
  const EXPORT = `/households/${HOME}/audit-log/export`;

  it('GET …/audit-log/export → 200, the CSV as an attachment named by its days', async () => {
    const { app, insights } = setup();
    insights.exportAuditLog.mockResolvedValue({
      csv: 'timestamp,actor_id\r\n', filename: 'audit-log-2026-09-01-2026-09-30.csv',
    });

    const response = await send(app, 'GET', `${EXPORT}?startDate=2026-09-01&endDate=2026-09-30`);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition'))
      .toBe('attachment; filename="audit-log-2026-09-01-2026-09-30.csv"');
    expect(await response.text()).toBe('timestamp,actor_id\r\n');
    expect(insights.exportAuditLog).toHaveBeenCalledWith(
      signedIn(),
      HOME,
      { startDate: '2026-09-01', endDate: '2026-09-30' },
    );
  });

  it('refuses a missing day, each as field.required, before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', EXPORT);

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: 'validation.failed',
      details: expect.arrayContaining([
        { field: 'startDate', code: 'field.required' },
        { field: 'endDate', code: 'field.required' },
      ]),
    });
    expect(insights.exportAuditLog).not.toHaveBeenCalled();
  });

  it('refuses a day that is not a date before the Manager', async () => {
    const { app, insights } = setup();

    const response = await send(app, 'GET', `${EXPORT}?startDate=yesterday&endDate=2026-09-30`);

    expect(response.status).toBe(422);
    expect(insights.exportAuditLog).not.toHaveBeenCalled();
  });

  it('answers the Manager\'s refusals: 403 below Admin, 422 for an inverted range', async () => {
    const { app, insights } = setup();
    insights.exportAuditLog.mockRejectedValueOnce(
      createDomainError({ code: 'auth.forbidden', message: 'Not permitted' }),
    );
    insights.exportAuditLog.mockRejectedValueOnce(createDomainError({
      code: 'validation.failed',
      message: 'Request validation failed',
      details: [{ field: 'endDate', code: 'date.before_start' }],
    }));
    const query = '?startDate=2026-09-02&endDate=2026-09-01';

    const forbidden = await send(app, 'GET', `${EXPORT}${query}`);
    const inverted = await send(app, 'GET', `${EXPORT}${query}`);

    expect(forbidden.status).toBe(403);
    expect(inverted.status).toBe(422);
    expect(await errorOf(inverted)).toMatchObject({
      details: [{ field: 'endDate', code: 'date.before_start' }],
    });
  });
});
