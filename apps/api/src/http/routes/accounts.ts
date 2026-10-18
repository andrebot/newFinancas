import {
  zArchiveAccountPath, zCreateAccountBody, zCreateAccountPath, zEditAccountBody,
  zEditAccountPath, zGetAccountBalancesPath, zGetAccountBalancesQuery, zGetAccountPath,
  zGetCreditCardBalancesPath, zGetCreditCardBalancesQuery, zListAccountsPath, zListAccountsQuery,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import type { AccountManager, MonthRange } from '../../managers/account';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import {
  toAccountBalanceJson, toAccountJson, toCreditCardBalanceJson,
} from './accountJson';
import { signedInContextOf } from './requestContext';

// A household's Financial Accounts, their Credit Cards and balance histories
// (M2, FR-2). Every path sits under `/households/:householdId` (OQ-174), so the
// `/households/*` guard admits only signed-in USERs; the household role checks
// are AccountManager's (OQ-111). Cards change only through the Account's edit (OQ-35).

const ACCOUNTS_PATH = '/households/:householdId/accounts';
const ACCOUNT_PATH = `${ACCOUNTS_PATH}/:accountId`;
const CARD_BALANCES_PATH = '/households/:householdId/credit-cards/:creditCardId/balances';

/**
 * Reads a `YYYY-MM` query value (the contract checked its shape).
 *
 * @param value - The value, if sent.
 * @returns Its year and month, or `undefined`.
 */
const monthOf = (value: string | undefined) => (
  value === undefined
    ? undefined
    : { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) }
);

/**
 * Turns the `from` / `to` query into the months a balance history covers.
 *
 * @param query - The validated query.
 * @returns The range; a side not sent stays open.
 */
export const monthRangeOf = (query: { from?: string | undefined; to?: string | undefined }) => {
  const from = monthOf(query.from);
  const to = monthOf(query.to);
  return { ...(from && { from }), ...(to && { to }) } satisfies MonthRange;
};

/**
 * Builds the Account routes.
 *
 * @param account - The Manager.
 * @returns The routes, relative to `/api/v1`.
 */
const createAccountRoutes = (account: AccountManager) => new Hono<AppEnv>()
  .get(
    ACCOUNTS_PATH,
    validate('param', zListAccountsPath),
    validate('query', zListAccountsQuery),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const filter = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const accounts = await account.listAccounts(context, householdId, filter);
      return httpContext.json({ data: accounts.map(toAccountJson) });
    },
  )
  .post(
    ACCOUNTS_PATH,
    validate('param', zCreateAccountPath),
    validate('json', zCreateAccountBody),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const request = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const created = await account.createAccount(context, householdId, request);
      return httpContext.json(toAccountJson(created), 201);
    },
  )
  .get(ACCOUNT_PATH, validate('param', zGetAccountPath), async (httpContext) => {
    const { householdId, accountId } = httpContext.req.valid('param');
    const context = signedInContextOf(httpContext);
    return httpContext.json(toAccountJson(
      await account.getAccount(context, householdId, accountId),
    ));
  })
  .patch(
    ACCOUNT_PATH,
    validate('param', zEditAccountPath),
    validate('json', zEditAccountBody),
    async (httpContext) => {
      const { householdId, accountId } = httpContext.req.valid('param');
      const edit = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const edited = await account.editAccount(context, householdId, accountId, edit);
      return httpContext.json(toAccountJson(edited));
    },
  )
  .post(`${ACCOUNT_PATH}/archive`, validate('param', zArchiveAccountPath), async (httpContext) => {
    const { householdId, accountId } = httpContext.req.valid('param');
    await account.archiveAccount(signedInContextOf(httpContext), householdId, accountId);
    return httpContext.body(null, 204);
  })
  .get(
    `${ACCOUNT_PATH}/balances`,
    validate('param', zGetAccountBalancesPath),
    validate('query', zGetAccountBalancesQuery),
    async (httpContext) => {
      const { householdId, accountId } = httpContext.req.valid('param');
      const range = monthRangeOf(httpContext.req.valid('query'));
      const context = signedInContextOf(httpContext);
      const balances = await account.getAccountBalances(context, householdId, accountId, range);
      return httpContext.json({ data: balances.map(toAccountBalanceJson) });
    },
  )
  .get(
    CARD_BALANCES_PATH,
    validate('param', zGetCreditCardBalancesPath),
    validate('query', zGetCreditCardBalancesQuery),
    async (httpContext) => {
      const { householdId, creditCardId } = httpContext.req.valid('param');
      const range = monthRangeOf(httpContext.req.valid('query'));
      const context = signedInContextOf(httpContext);
      const balances = await account.getCreditCardBalances(
        context,
        householdId,
        creditCardId,
        range,
      );
      return httpContext.json({ data: balances.map(toCreditCardBalanceJson) });
    },
  );

export default createAccountRoutes;
