import {
  describe, expect, it, vi,
} from 'vitest';
import { monthRangeOf } from '../../src/http/routes/accounts';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
const MAIN = '0199c5a0-0000-7000-8000-0000000000a1';
const VISA = '0199c5a0-0000-7000-8000-0000000000d1';
const ACTOR = { userId: USER_ID, sessionId: 's1', systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');
const ACCOUNTS = `/households/${HOME}/accounts`;
const NEW_CARD = {
  network: 'visa',
  last4: '4242',
  closingDay: 5,
  dueDay: 12,
  expirationMonth: 9,
  expirationYear: 2030,
};
const CARD = {
  ...NEW_CARD, id: VISA, accountId: MAIN, createdAt: NOW, outstandingBalance: 900,
};
const ACCOUNT = {
  id: MAIN,
  householdId: HOME,
  ownerUserId: USER_ID,
  name: 'Main',
  type: 'checking' as const,
  currency: 'BRL',
  visibility: 'shared' as const,
  startingBalanceDate: '2026-09-01',
  archivedAt: NOW as Date | null,
  createdAt: NOW,
  currentBalance: 5000,
  cards: [CARD],
};
const ACCOUNT_JSON = {
  ...ACCOUNT,
  archivedAt: NOW.toISOString(),
  createdAt: NOW.toISOString(),
  cards: [{ ...CARD, createdAt: NOW.toISOString() }],
};
const ACCOUNT_BALANCE = {
  accountId: MAIN, year: 2026, month: 10, openingBalance: 10, endingBalance: 20, updatedAt: NOW,
};
const CARD_BALANCE = {
  creditCardId: VISA,
  year: 2026,
  month: 11,
  openingOutstandingBalance: 0,
  endingOutstandingBalance: 900,
  updatedAt: NOW,
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

describe('account routes (OQ-174: under /households/:householdId)', () => {
  it('need a signed-in user', async () => {
    const { app, account } = setup();

    const response = await app.request(`/api/v1${ACCOUNTS}`);

    expect(response.status).toBe(401);
    expect(account.listAccounts).not.toHaveBeenCalled();
  });

  it('GET …/accounts → 200 with each Account\'s balance and cards (OQ-175)', async () => {
    const { app, account } = setup();
    account.listAccounts.mockResolvedValue([ACCOUNT]);

    const response = await send(app, 'GET', ACCOUNTS);
    await send(app, 'GET', `${ACCOUNTS}?visibility=personal`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [ACCOUNT_JSON] });
    expect(account.listAccounts).toHaveBeenNthCalledWith(1, signedIn(), HOME, {});
    expect(account.listAccounts).toHaveBeenNthCalledWith(2, signedIn(), HOME, {
      visibility: 'personal',
    });
  });

  it('GET …/account-status → 200, whether one is in use (OQ-198)', async () => {
    const { app, account } = setup();
    account.getAccountStatus.mockResolvedValue({ inUse: true });

    const response = await send(app, 'GET', `/households/${HOME}/account-status`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ inUse: true });
    expect(account.getAccountStatus).toHaveBeenCalledWith(signedIn(), HOME);
  });

  it('POST …/accounts → 201, cards inline', async () => {
    const { app, account } = setup();
    account.createAccount.mockResolvedValueOnce({ ...ACCOUNT, archivedAt: null });
    const body = {
      name: 'Main',
      type: 'checking',
      currency: 'BRL',
      visibility: 'shared',
      openingBalance: 5000,
      cards: [NEW_CARD],
    };

    const response = await send(app, 'POST', ACCOUNTS, body);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ...ACCOUNT_JSON, archivedAt: null });
    expect(account.createAccount).toHaveBeenCalledWith(signedIn(), HOME, body);
  });

  it.each([
    ['an unknown network', { network: 'diners-club' }, 'cards[0].network'],
    ['more than four digits', { last4: '42424' }, 'cards[0].last4'],
    ['a closing day past 31', { closingDay: 32 }, 'cards[0].closingDay'],
    ['a 13th month', { expirationMonth: 13 }, 'cards[0].expirationMonth'],
  ])('POST …/accounts refuses a card with %s before the Manager', async (_, change, field) => {
    const { app, account } = setup();

    const response = await send(app, 'POST', ACCOUNTS, {
      name: 'Main',
      type: 'checking',
      currency: 'BRL',
      visibility: 'shared',
      cards: [{ ...NEW_CARD, ...change }],
    });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual([field]);
    expect(account.createAccount).not.toHaveBeenCalled();
  });

  it('POST …/accounts refuses a type outside the four before the Manager (OQ-76)', async () => {
    const { app, account } = setup();

    const response = await send(app, 'POST', ACCOUNTS, {
      name: 'Main', type: 'cash', currency: 'BRL', visibility: 'shared',
    });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['type']);
    expect(account.createAccount).not.toHaveBeenCalled();
  });

  it('GET …/accounts/:accountId → 200', async () => {
    const { app, account } = setup();
    account.getAccount.mockResolvedValueOnce(ACCOUNT);

    const response = await send(app, 'GET', `${ACCOUNTS}/${MAIN}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ACCOUNT_JSON);
    expect(account.getAccount).toHaveBeenCalledWith(signedIn(), HOME, MAIN);
  });

  it('PATCH …/accounts/:accountId → 200, card changes folded in (OQ-35)', async () => {
    const { app, account } = setup();
    account.editAccount.mockResolvedValueOnce(ACCOUNT);
    const body = {
      name: 'Daily',
      visibility: 'personal',
      cards: { add: [NEW_CARD], edit: [{ id: VISA, dueDay: 15 }], remove: [VISA] },
    };

    const response = await send(app, 'PATCH', `${ACCOUNTS}/${MAIN}`, body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ACCOUNT_JSON);
    expect(account.editAccount).toHaveBeenCalledWith(signedIn(), HOME, MAIN, body);
  });

  it('PATCH …/accounts/:accountId needs an id on every card edit', async () => {
    const { app, account } = setup();

    const response = await send(app, 'PATCH', `${ACCOUNTS}/${MAIN}`, {
      cards: { edit: [{ dueDay: 15 }] },
    });

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['cards.edit[0].id']);
    expect(account.editAccount).not.toHaveBeenCalled();
  });

  it('POST …/accounts/:accountId/archive → 204', async () => {
    const { app, account } = setup();
    account.archiveAccount.mockResolvedValueOnce(undefined);

    const response = await send(app, 'POST', `${ACCOUNTS}/${MAIN}/archive`);

    expect(response.status).toBe(204);
    expect(account.archiveAccount).toHaveBeenCalledWith(signedIn(), HOME, MAIN);
  });

  it('GET …/accounts/:accountId/balances → 200, the months as a range', async () => {
    const { app, account } = setup();
    account.getAccountBalances.mockResolvedValueOnce([ACCOUNT_BALANCE]);

    const response = await send(app, 'GET', `${ACCOUNTS}/${MAIN}/balances?from=2026-01&to=2026-10`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{
        year: 2026, month: 10, openingBalance: 10, endingBalance: 20, updatedAt: NOW.toISOString(),
      }],
    });
    expect(account.getAccountBalances).toHaveBeenCalledWith(signedIn(), HOME, MAIN, {
      from: { year: 2026, month: 1 }, to: { year: 2026, month: 10 },
    });
  });

  it('GET …/balances refuses a month that is not YYYY-MM', async () => {
    const { app, account } = setup();

    const response = await send(app, 'GET', `${ACCOUNTS}/${MAIN}/balances?from=2026-13`);

    expect(response.status).toBe(422);
    expect(await failingFields(response)).toEqual(['from']);
    expect(account.getAccountBalances).not.toHaveBeenCalled();
  });

  it('GET …/credit-cards/:creditCardId/balances → 200, the whole history by default', async () => {
    const { app, account } = setup();
    account.getCreditCardBalances.mockResolvedValueOnce([CARD_BALANCE]);

    const response = await send(app, 'GET', `/households/${HOME}/credit-cards/${VISA}/balances`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{
        year: 2026,
        month: 11,
        openingOutstandingBalance: 0,
        endingOutstandingBalance: 900,
        updatedAt: NOW.toISOString(),
      }],
    });
    expect(account.getCreditCardBalances).toHaveBeenCalledWith(signedIn(), HOME, VISA, {});
  });
});

describe('monthRangeOf', () => {
  it('reads each side sent as a month and leaves the others open', () => {
    expect(monthRangeOf({ from: '2025-12' })).toEqual({ from: { year: 2025, month: 12 } });
    expect(monthRangeOf({ to: '2026-02' })).toEqual({ to: { year: 2026, month: 2 } });
    expect(monthRangeOf({})).toEqual({});
  });
});
