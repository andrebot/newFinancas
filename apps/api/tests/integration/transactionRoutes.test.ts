import {
  describe, expect, it, vi,
} from 'vitest';
import { appWithMocks, errorOf } from '../support/app';
import { transactionChanged } from '../../src/managers/transaction/errors';
import {
  ANA_ID, BUY_ROW, CARD_ROW, HOUSEHOLD_ID, NOW, ROW,
} from './managers/transaction/fakes';

// The transaction routes over a mocked TransactionManager (BDT: the one boundary below).
// They validate against the contract's schemas and answer in its JSON shapes — flat
// `LedgerItem` rows tagged with their ledger, times as ISO strings.

const ACTOR = { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' as const };
const TRANSACTIONS = `/households/${HOUSEHOLD_ID}/transactions`;
// A real UUID — the contract's path schema checks the format (the fakes' ids don't).
const ITEM = `${TRANSACTIONS}/0199c5a0-0000-7000-8000-0000000000ab`;
const ISO = NOW.toISOString();

/** The app with a token check that accepts only `good-token`. */
const setup = () => (
  appWithMocks(vi.fn(async (token: string) => (token === 'good-token' ? ACTOR : undefined)))
);

/** The app under test (the routes over mocked Managers). */
type TestApp = ReturnType<typeof setup>['app'];

/** Sends one request to the app under /api/v1. */
const send = (app: TestApp, method: string, path: string, body?: unknown) => (
  app.request(`/api/v1${path}`, {
    method,
    headers: {
      authorization: 'Bearer good-token',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
);

describe('transaction routes', () => {
  it('requires a signed-in user', async () => {
    const { app } = setup();
    const response = await app.request(`/api/v1${TRANSACTIONS}`, { method: 'GET' });
    expect(response.status).toBe(401);
  });

  it('records and answers the contract LedgerItem — quantity from the trade delta', async () => {
    const { app, transaction } = setup();
    transaction.recordTransaction.mockResolvedValueOnce(BUY_ROW);
    const response = await send(app, 'POST', TRANSACTIONS, {
      kind: 'investment_buy', date: '2026-10-13', amount: 2_000, currency: 'BRL',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: BUY_ROW.id,
      accountId: BUY_ROW.accountId,
      kind: 'investment_buy',
      effect: 'investment_trade',
      date: '2026-10-13',
      amount: 2_000,
      currency: 'BRL',
      categoryId: null,
      subcategoryId: null,
      description: null,
      holdingId: BUY_ROW.holdingId,
      holding: { ticker: 'PETR4', assetType: 'stock' },
      quantity: 2,
      creditCardId: null,
      createdByUserId: ANA_ID,
      source: 'manual',
      createdAt: ISO,
      ledger: 'account',
    });
    expect(transaction.recordTransaction).toHaveBeenCalledTimes(1);
  });

  it('hands the Manager only the fields sent — validation adds none (OQ-222)', async () => {
    const { app, transaction } = setup();
    transaction.recordTransaction.mockResolvedValueOnce(ROW);
    const body = {
      kind: 'withdrawal',
      accountId: ROW.accountId,
      date: '2026-10-13',
      amount: 2_000,
      currency: 'BRL',
    };
    const response = await send(app, 'POST', TRANSACTIONS, body);
    expect(response.status).toBe(201);
    const [, , request] = transaction.recordTransaction.mock.calls[0] ?? [];
    expect(request).toEqual(body);
  });

  it('rejects a body the contract does not name before reaching the Manager', async () => {
    const { app, transaction } = setup();
    const response = await send(app, 'POST', TRANSACTIONS, {
      kind: 'withdrawal', date: '2026-10-13', currency: 'BRL',
    });
    expect(response.status).toBe(422);
    expect((await errorOf(response)).code).toBe('validation.failed');
    expect(transaction.recordTransaction).not.toHaveBeenCalled();
  });

  it('lists a page of flat LedgerItems with its totals', async () => {
    const { app, transaction } = setup();
    transaction.listTransactions.mockResolvedValueOnce({
      items: [{ ledger: 'account', transaction: ROW }, { ledger: 'card', transaction: CARD_ROW }],
      nextCursor: null,
      dayTotals: [],
      monthCounts: [],
    });
    const response = await send(app, 'GET', `${TRANSACTIONS}?from=2026-10-01&to=2026-10-31`);
    expect(response.status).toBe(200);
    const page = (await response.json()) as {
      items: { id: string; ledger: string }[]; nextCursor: null;
    };
    expect(page.items.map((item) => [item.id, item.ledger]))
      .toEqual([[ROW.id, 'account'], [CARD_ROW.id, 'card']]);
    expect(page.nextCursor).toBeNull();
  });

  it('answers one row by id', async () => {
    const { app, transaction } = setup();
    transaction.getTransaction.mockResolvedValueOnce({ ledger: 'card', transaction: CARD_ROW });
    const response = await send(app, 'GET', ITEM);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...CARD_ROW, createdAt: ISO, ledger: 'card' });
  });

  it('edits and answers the updated row', async () => {
    const { app, transaction } = setup();
    transaction.editTransaction.mockResolvedValueOnce({
      ledger: 'account', transaction: { ...ROW, description: 'Rent' },
    });
    const response = await send(app, 'PATCH', ITEM, { description: 'Rent' });
    expect(response.status).toBe(200);
    expect((await response.json() as { description: string }).description).toBe('Rent');
  });

  it('deletes with no body', async () => {
    const { app, transaction } = setup();
    transaction.deleteTransaction.mockResolvedValueOnce(undefined);
    const response = await send(app, 'DELETE', ITEM);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('maps a Manager domain error to its status and code', async () => {
    const { app, transaction } = setup();
    transaction.editTransaction.mockRejectedValueOnce(transactionChanged());
    const response = await send(app, 'PATCH', ITEM, { description: 'Rent' });
    expect(response.status).toBe(409);
    expect((await errorOf(response)).code).toBe('transaction.changed');
  });
});
