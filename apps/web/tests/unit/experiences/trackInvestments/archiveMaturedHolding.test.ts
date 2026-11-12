import {
  describe, expect, it, vi,
} from 'vitest';
import { investmentsApi } from '../../../../src/api/investmentsApi';
import {
  archiveMaturedHolding, maturedHoldingName, maturedHoldingOf, maturedHoldingRoute,
  type MaturedHolding,
} from '../../../../src/experiences/trackInvestments/archiveMaturedHolding';
import type { NotificationAction } from '../../../../src/shell/notificationRouting';
import { householdChosen } from '../../../../src/shell/shellState';
import type { Alerts } from '../../../../src/utilities/AlertProvider';
import { createTranslator } from '../../../../src/utilities/i18n';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeStore } from '../../shell/shellFakes';

// Archive Matured Holding's thunk (BDT: over the real store and API client;
// only `fetch` and the toasts — the page's sink — are fakes).

const translator = createTranslator('en-US');

/** The Holding a notice from the Rivera household names. */
const CDB: MaturedHolding = {
  holdingId: 'cdb-1', householdId: 'rivera', ticker: 'CDB Inter 2026', assetType: 'cdb',
};

/** Its archive's path, after `/api/v1`. */
const RIVERA_ARCHIVE = '/households/rivera/holdings/cdb-1/archive';

/**
 * Toasts that only record what they were asked to show.
 *
 * @returns The fake.
 */
const fakeAlerts = (): Alerts => ({
  success: vi.fn(() => 1),
  info: vi.fn(() => 1),
  warning: vi.fn(() => 1),
  error: vi.fn(() => 1),
  dismiss: vi.fn(),
});

/**
 * Builds the real store, the `home` household active, whose `fetch` answers
 * each path from a table.
 *
 * @param answers - The answer per path (after `/api/v1`).
 * @returns The store, the fake `fetch` and the feedback the thunk gets.
 */
const setUp = (answers: Readonly<Record<string, () => Response>>) => {
  const fetchFn = vi.fn<typeof fetch>(async (input) => {
    const path = new URL((input as Request).url).pathname.replace('/api/v1', '');
    const answer = answers[path];
    if (!answer) throw new Error(`No answer for ${path}`);
    return answer();
  });
  const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
  store.dispatch(householdChosen('home'));
  return {
    store, fetchFn, feedback: { alerts: fakeAlerts(), translator },
  };
};

/**
 * Lists which paths were called, in order.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each call's method and path.
 */
const calls = (fetchFn: ReturnType<typeof vi.fn<typeof fetch>>) => fetchFn.mock.calls.map(
  ([input]) => `${(input as Request).method} ${new URL((input as Request).url).pathname}`,
);

describe('maturedHoldingOf', () => {
  it('reads the Holding, its household, ticker and type', () => {
    expect(maturedHoldingOf({
      holdingId: 'cdb-1', householdId: 'rivera', ticker: 'CDB Inter 2026', assetType: 'cdb',
    })).toEqual(CDB);
  });

  it('reads a notice without a household, ticker or type', () => {
    expect(maturedHoldingOf({ holdingId: 'cdb-1', ticker: 7 })).toEqual({
      holdingId: 'cdb-1', householdId: undefined, ticker: null, assetType: undefined,
    });
  });

  it('reads nothing from a notice that names no Holding', () => {
    expect(maturedHoldingOf({ holdingId: 42 })).toBeUndefined();
  });
});

describe('maturedHoldingName', () => {
  it('names the Holding by its ticker, else its asset type', () => {
    expect(maturedHoldingName(CDB, translator)).toBe('CDB Inter 2026');
    expect(maturedHoldingName({ ...CDB, ticker: null }, translator)).toBe('CDB');
  });
});

describe('archiveMaturedHolding', () => {
  it('archives in the notice\'s household, toasts it and reads the Holdings again', async () => {
    const { store, fetchFn, feedback } = setUp({
      '/households/home/holdings': () => jsonResponse(200, { data: [] }),
      [RIVERA_ARCHIVE]: () => jsonResponse(204),
    });
    const subscription = store.dispatch(
      investmentsApi.endpoints.listHouseholdHoldings.initiate('home'),
    );
    await subscription;

    const outcome = await store.dispatch(archiveMaturedHolding(CDB, feedback));

    expect(outcome).toBe('done');
    expect(feedback.alerts.success).toHaveBeenCalledWith('CDB Inter 2026 archived.');
    await vi.waitFor(() => expect(calls(fetchFn)).toEqual([
      'GET /api/v1/households/home/holdings',
      `POST /api/v1${RIVERA_ARCHIVE}`,
      'GET /api/v1/households/home/holdings',
    ]));
    subscription.unsubscribe();
  });

  it('archives in the active household when the notice names none', async () => {
    const { store, fetchFn, feedback } = setUp({
      '/households/home/holdings/cdb-1/archive': () => jsonResponse(204),
    });

    const outcome = await store.dispatch(
      archiveMaturedHolding({ ...CDB, householdId: undefined, ticker: null }, feedback),
    );

    expect(outcome).toBe('done');
    expect(feedback.alerts.success).toHaveBeenCalledWith('CDB archived.');
    expect(calls(fetchFn)).toEqual(['POST /api/v1/households/home/holdings/cdb-1/archive']);
  });

  it('fails without a request when there is no household to archive in', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const feedback = { alerts: fakeAlerts(), translator };

    const outcome = await store.dispatch(
      archiveMaturedHolding({ ...CDB, householdId: undefined }, feedback),
    );

    expect(outcome).toBe('failed');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    [
      409, 'holding.not_matured',
      'Only a matured holding that still has a position can be archived.',
    ],
    [404, 'holding.not_found', 'Holding not found.'],
  ])('toasts a %i (%s) and fails', async (status, code, text) => {
    const { store, feedback } = setUp({
      [RIVERA_ARCHIVE]: () => jsonResponse(status, envelope(code)),
    });

    const outcome = await store.dispatch(archiveMaturedHolding(CDB, feedback));

    expect(outcome).toBe('failed');
    expect(feedback.alerts.error).toHaveBeenCalledWith(text);
    expect(feedback.alerts.success).not.toHaveBeenCalled();
  });
});

describe('maturedHoldingRoute', () => {
  /** The bell's Archive holding on the Rivera CDB's notice. */
  const ARCHIVE: NotificationAction = {
    notificationId: 'n-matured',
    type: 'holding.matured',
    action: 'archive',
    params: { ...CDB },
  };

  it('archives the Holding the notice names', async () => {
    const { store, fetchFn, feedback } = setUp({
      [RIVERA_ARCHIVE]: () => jsonResponse(204),
    });

    const outcome = await maturedHoldingRoute(store.dispatch, feedback)(ARCHIVE);

    expect(outcome).toBe('done');
    expect(calls(fetchFn)).toEqual([`POST /api/v1${RIVERA_ARCHIVE}`]);
  });

  it.each([
    ['an action other than archive', { ...ARCHIVE, action: 'view' }],
    ['a notice naming no Holding', { ...ARCHIVE, params: {} }],
  ])('fails %s without a request', async (_case, action) => {
    const { store, fetchFn, feedback } = setUp({});

    expect(await maturedHoldingRoute(store.dispatch, feedback)(action)).toBe('failed');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
