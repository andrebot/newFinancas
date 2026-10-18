import {
  describe, expect, it, vi,
} from 'vitest';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
const STOCK = '0199c5a0-0000-7000-8000-0000000000b1';
const SNAP = '0199c5a0-0000-7000-8000-0000000000b2';
const HOUSE = '0199c5a0-0000-7000-8000-0000000000f1';
const ACTOR = { userId: USER_ID, sessionId: 's1', systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');
const HOLDING = `/households/${HOME}/holdings/${STOCK}`;
const SNAPSHOTS = `${HOLDING}/valuation-snapshots`;
const SNAPSHOT = {
  id: SNAP,
  holdingId: STOCK,
  valuation: 320000,
  asOfDate: '2026-10-01',
  source: 'manual' as const,
  accountTransactionId: null,
  createdAt: NOW,
};
const SNAPSHOT_JSON = { ...SNAPSHOT, createdAt: NOW.toISOString() };
const ENTRY = {
  id: '0199c5a0-0000-7000-8000-0000000000e9',
  holdingId: STOCK,
  kind: 'redemption',
  amount: 110000,
  date: '2027-10-17',
  postedAt: null as Date | null,
  createdAt: NOW,
};
const SPLIT = [{ goalId: HOUSE, percentage: 60 }];
const SHARE_FIELD = 'allocations[0].percentage';

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

describe('holding routes (M2 part 5, OQ-178)', () => {
  it('need a signed-in user', async () => {
    const { app, account } = setup();

    const response = await app.request(`/api/v1${HOLDING}/allocations`);

    expect(response.status).toBe(401);
    expect(account.listHoldingAllocations).not.toHaveBeenCalled();
  });

  it('GET …/holdings/:holdingId/allocations → 200, the visible split', async () => {
    const { app, account } = setup();
    account.listHoldingAllocations.mockResolvedValueOnce(SPLIT);

    const response = await send(app, 'GET', `${HOLDING}/allocations`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: SPLIT });
    expect(account.listHoldingAllocations).toHaveBeenCalledWith(signedIn(), HOME, STOCK);
  });

  it('PATCH …/holdings/:holdingId → 200, the split as written', async () => {
    const { app, account } = setup();
    account.editHolding.mockResolvedValueOnce(SPLIT);

    const response = await send(app, 'PATCH', HOLDING, { allocations: SPLIT });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: SPLIT });
    expect(account.editHolding).toHaveBeenCalledWith(signedIn(), HOME, STOCK, SPLIT);
  });

  it.each([
    ['no allocations field', {}, 'allocations'],
    ['a zero share', { allocations: [{ goalId: HOUSE, percentage: 0 }] }, SHARE_FIELD],
    ['a share past 100', { allocations: [{ goalId: HOUSE, percentage: 101 }] }, SHARE_FIELD],
  ])('PATCH …/holdings/:holdingId refuses %s before the Manager', async (_, body, field) => {
    const { app, account } = setup();

    const response = await send(app, 'PATCH', HOLDING, body);

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual([field]);
    expect(account.editHolding).not.toHaveBeenCalled();
  });

  it('POST …/holdings/:holdingId/archive → 204', async () => {
    const { app, account } = setup();
    account.archiveHolding.mockResolvedValueOnce(undefined);

    const response = await send(app, 'POST', `${HOLDING}/archive`);

    expect(response.status).toBe(204);
    expect(account.archiveHolding).toHaveBeenCalledWith(signedIn(), HOME, STOCK);
  });

  it('GET …/holdings/:holdingId/schedule-entries → 200, posted times as ISO', async () => {
    const { app, account } = setup();
    account.listScheduleEntries.mockResolvedValueOnce([ENTRY, { ...ENTRY, postedAt: NOW }]);

    const response = await send(app, 'GET', `${HOLDING}/schedule-entries`);

    expect(response.status).toBe(200);
    const entryJson = { ...ENTRY, createdAt: NOW.toISOString() };
    expect(await response.json()).toEqual({
      data: [entryJson, { ...entryJson, postedAt: NOW.toISOString() }],
    });
    expect(account.listScheduleEntries).toHaveBeenCalledWith(signedIn(), HOME, STOCK);
  });

  it('GET …/valuation-snapshots → 200, with the date range given', async () => {
    const { app, account } = setup();
    account.listValuationSnapshots.mockResolvedValue([SNAPSHOT]);

    const response = await send(app, 'GET', `${SNAPSHOTS}?startDate=2026-01-01&endDate=2026-10-31`);
    await send(app, 'GET', SNAPSHOTS);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [SNAPSHOT_JSON] });
    expect(account.listValuationSnapshots).toHaveBeenNthCalledWith(1, signedIn(), HOME, STOCK, {
      from: '2026-01-01', to: '2026-10-31',
    });
    expect(account.listValuationSnapshots).toHaveBeenNthCalledWith(2, signedIn(), HOME, STOCK, {});
  });

  it('POST …/valuation-snapshots → 201', async () => {
    const { app, account } = setup();
    account.recordMarketValue.mockResolvedValueOnce(SNAPSHOT);
    const body = { value: 320000, asOf: '2026-10-01' };

    const response = await send(app, 'POST', SNAPSHOTS, body);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(SNAPSHOT_JSON);
    expect(account.recordMarketValue).toHaveBeenCalledWith(signedIn(), HOME, STOCK, body);
  });

  it('POST …/valuation-snapshots refuses a negative value before the Manager', async () => {
    const { app, account } = setup();

    const response = await send(app, 'POST', SNAPSHOTS, { value: -1, asOf: '2026-10-01' });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['value']);
    expect(account.recordMarketValue).not.toHaveBeenCalled();
  });

  it('PATCH …/valuation-snapshots/:snapshotId → 200', async () => {
    const { app, account } = setup();
    account.editMarketValue.mockResolvedValueOnce(SNAPSHOT);

    const response = await send(app, 'PATCH', `${SNAPSHOTS}/${SNAP}`, { asOf: '2026-10-02' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SNAPSHOT_JSON);
    expect(account.editMarketValue).toHaveBeenCalledWith(signedIn(), HOME, STOCK, SNAP, {
      asOf: '2026-10-02',
    });
  });

  it('DELETE …/valuation-snapshots/:snapshotId → 204', async () => {
    const { app, account } = setup();
    account.deleteMarketValue.mockResolvedValueOnce(undefined);

    const response = await send(app, 'DELETE', `${SNAPSHOTS}/${SNAP}`);

    expect(response.status).toBe(204);
    expect(account.deleteMarketValue).toHaveBeenCalledWith(signedIn(), HOME, STOCK, SNAP);
  });

  it('refuses a Holding id that is not a UUID before the Manager', async () => {
    const { app, account } = setup();

    const response = await send(app, 'POST', `/households/${HOME}/holdings/petr4/archive`);

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['holdingId']);
    expect(account.archiveHolding).not.toHaveBeenCalled();
  });
});
