import { describe, expect, it } from 'vitest';
import { setupApi } from '../../../../src/api/setupApi';
import { manageFinancesApi } from '../../../../src/experiences/manageFinances/api';
import {
  attachmentNameOf, auditExportPathOf, reviewInsightsApi,
} from '../../../../src/experiences/reviewInsights/api';
import { trackInvestmentsApi } from '../../../../src/experiences/trackInvestments/api';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  fakeFetch, sent, settle, type Answers,
} from '../experienceFakes';
import { fakeStore } from '../../shell/shellFakes';
import { DASHBOARD, INBOX } from './dashboardFixtures';

// The Review Insights Experience's own endpoints (BDT: unit): the export's
// address and file name, then each read and write through the real store and
// API client — only `fetch` is fake — for its route, what it hands back and
// what it makes stale (OQ-243).

type Store = ReturnType<typeof fakeStore>['store'];

const RANGE = { householdId: 'd o', startDate: '2026-09-01', endDate: '2026-09-30' };

describe('auditExportPathOf', () => {
  it('asks for the household\'s log over both days', () => {
    expect(auditExportPathOf(RANGE))
      .toBe('/households/d%20o/audit-log/export?startDate=2026-09-01&endDate=2026-09-30');
  });
});

describe('attachmentNameOf', () => {
  it('reads the name the header gives, else takes the fallback', () => {
    expect(attachmentNameOf('attachment; filename="audit-log-a-b.csv"', 'x.csv'))
      .toBe('audit-log-a-b.csv');
    expect(attachmentNameOf('attachment', 'x.csv')).toBe('x.csv');
    expect(attachmentNameOf(null, 'x.csv')).toBe('x.csv');
    expect(attachmentNameOf(undefined, 'x.csv')).toBe('x.csv');
  });
});

/**
 * Builds a store over a fake `fetch`, signed in.
 *
 * @param answers - The API's answers.
 * @returns The store and the fake.
 */
const storeWith = (answers: Answers) => {
  const fetchFn = fakeFetch(answers);
  const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
  return { store, fetchFn };
};

/**
 * Counts the reads of one path a fake `fetch` got.
 *
 * @param fetchFn - The fake.
 * @param path - The path, under `/api/v1`.
 * @returns How many.
 */
const readsOf = async (fetchFn: ReturnType<typeof fakeFetch>, path: string) => (
  (await sent(fetchFn)).filter(({ route }) => route === `GET /api/v1${path}`).length
);

describe('the reads', () => {
  it('reads the Dashboard as the report itself', async () => {
    const { store } = storeWith({
      'GET /households/doe/dashboard': () => jsonResponse(200, DASHBOARD),
    });
    const running = store.dispatch(reviewInsightsApi.endpoints.getDashboard.initiate('doe'));
    expect((await running).data).toEqual(DASHBOARD);
    running.unsubscribe();
  });

  it('reads the inbox out of its envelope, none when it has none', async () => {
    const answers = [{ data: INBOX }, {}];
    const { store } = storeWith({
      'GET /notifications': () => jsonResponse(200, answers.shift()),
    });
    const first = store.dispatch(reviewInsightsApi.endpoints.listNotifications.initiate());
    expect((await first).data).toEqual(INBOX);
    const again = await first.refetch();
    expect(again.data).toEqual([]);
    first.unsubscribe();
  });
});

/**
 * Reads the inbox, makes a write, and counts the inbox's reads.
 *
 * @param write - The write.
 * @param answer - How the API answers it.
 * @param route - The write's `METHOD path`.
 * @returns How many times the inbox was read, and the fake `fetch`.
 */
const inboxReadsAfter = async (
  write: (store: Store) => PromiseLike<unknown>,
  answer: () => Response,
  route: string,
) => {
  const { store, fetchFn } = storeWith({
    'GET /notifications': () => jsonResponse(200, { data: INBOX }),
    [route]: answer,
  });
  const reading = store.dispatch(reviewInsightsApi.endpoints.listNotifications.initiate());
  await reading;
  await write(store);
  await settle();
  reading.unsubscribe();
  return { reads: await readsOf(fetchFn, '/notifications'), fetchFn };
};

describe('the inbox\'s writes (OQ-105)', () => {
  it('marks the ids seen and reads the inbox again', async () => {
    const { reads, fetchFn } = await inboxReadsAfter(
      (store) => store.dispatch(reviewInsightsApi.endpoints.markNotificationsSeen
        .initiate(['n-1', 'n-2'])),
      () => jsonResponse(204),
      'POST /notifications/seen',
    );
    expect(reads).toBe(2);
    expect((await sent(fetchFn)).find(({ route }) => route.startsWith('POST'))?.body)
      .toEqual({ notificationIds: ['n-1', 'n-2'] });
  });

  it.each([
    ['done', () => jsonResponse(204), 2],
    ['already gone', () => jsonResponse(404, envelope('notification.not_found')), 2],
    ['failed', () => jsonResponse(500, envelope('internal.unexpected')), 1],
  ] as const)('deletes one, reading the inbox again when %s', async (_how, answer, expected) => {
    const { reads } = await inboxReadsAfter(
      (store) => store.dispatch(reviewInsightsApi.endpoints.deleteNotification.initiate('n 1')),
      answer,
      'DELETE /notifications/n%201',
    );
    expect(reads).toBe(expected);
  });
});

describe('the audit-log export (FR-7.2)', () => {
  const ROUTE = 'GET /households/doe/audit-log/export';
  const DOE_RANGE = { ...RANGE, householdId: 'doe' };

  it('hands back the CSV under the name the API gave it', async () => {
    const { store, fetchFn } = storeWith({
      [ROUTE]: () => new Response('timestamp,actor_id\r\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="audit-log-2026-09-01-2026-09-30.csv"',
        },
      }),
    });

    const result = await store.dispatch(reviewInsightsApi.endpoints.exportAuditLog
      .initiate(DOE_RANGE));

    expect(result.data).toEqual({
      csv: 'timestamp,actor_id\r\n', filename: 'audit-log-2026-09-01-2026-09-30.csv',
    });
    const [input] = fetchFn.mock.calls[0]!;
    expect(new URL((input as Request).url).search).toBe('?startDate=2026-09-01&endDate=2026-09-30');
  });

  it('names the file by its days when the API gives no name', async () => {
    const { store } = storeWith({
      [ROUTE]: () => new Response('a\r\n', {
        status: 200, headers: { 'Content-Type': 'text/csv' },
      }),
    });

    const result = await store.dispatch(reviewInsightsApi.endpoints.exportAuditLog
      .initiate(DOE_RANGE));

    expect(result.data?.filename).toBe('audit-log-2026-09-01-2026-09-30.csv');
  });

  it('reads a refusal as the envelope it is', async () => {
    const { store } = storeWith({ [ROUTE]: () => jsonResponse(403, envelope('auth.forbidden')) });

    const result = await store.dispatch(reviewInsightsApi.endpoints.exportAuditLog
      .initiate(DOE_RANGE));

    expect(result.error).toEqual(expect.objectContaining({ code: 'auth.forbidden', status: 403 }));
  });
});

describe('a transaction recorded in Manage Finances', () => {
  it('reads the Dashboard again (PR #145)', async () => {
    const { store, fetchFn } = storeWith({
      'GET /households/doe/dashboard': () => jsonResponse(200, DASHBOARD),
      'DELETE /households/doe/transactions/t-1': () => jsonResponse(204),
    });
    const reading = store.dispatch(reviewInsightsApi.endpoints.getDashboard.initiate('doe'));
    await reading;

    await store.dispatch(manageFinancesApi.endpoints.deleteTransaction
      .initiate({ householdId: 'doe', transactionId: 't-1' }));
    await settle();
    reading.unsubscribe();

    expect(await readsOf(fetchFn, '/households/doe/dashboard')).toBe(2);
  });
});

describe('a write elsewhere that changes what the Dashboard shows', () => {
  // Each write invalidates one of the Dashboard's tags alone (R5 V3).
  it.each([
    {
      tag: 'Accounts',
      route: 'PATCH /households/doe/accounts/a-1',
      write: (store: Store) => store.dispatch(setupApi.endpoints.editAccount
        .initiate({ householdId: 'doe', accountId: 'a-1', name: 'Checking' })),
    },
    {
      tag: 'Budgets',
      route: 'DELETE /households/doe/budgets/b-1',
      write: (store: Store) => store.dispatch(setupApi.endpoints.deleteBudget
        .initiate({ householdId: 'doe', budgetId: 'b-1' })),
    },
    {
      tag: 'Goals',
      route: 'PATCH /households/doe/holdings/h-1',
      write: (store: Store) => store.dispatch(trackInvestmentsApi.endpoints.saveHoldingAllocations
        .initiate({ householdId: 'doe', holdingId: 'h-1', allocations: [] })),
    },
    {
      tag: 'Holdings',
      route: 'POST /households/doe/index-rates/cdi/values',
      write: (store: Store) => store.dispatch(trackInvestmentsApi.endpoints.recordIndexRate
        .initiate({
          householdId: 'doe', index: 'cdi', value: 104_000, asOf: '2026-10-01',
        })),
    },
  ])('reads the Dashboard again through $tag', async ({ route, write }) => {
    const { store, fetchFn } = storeWith({
      'GET /households/doe/dashboard': () => jsonResponse(200, DASHBOARD),
      [route]: () => jsonResponse(200, {}),
    });
    const reading = store.dispatch(reviewInsightsApi.endpoints.getDashboard.initiate('doe'));
    await reading;

    await write(store);
    await settle();
    reading.unsubscribe();

    expect(await readsOf(fetchFn, '/households/doe/dashboard')).toBe(2);
  });
});
