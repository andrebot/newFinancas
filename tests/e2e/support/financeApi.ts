import type { APIRequestContext } from '@playwright/test';
import type {
  Account, AccountMonthBalance, AccountTransaction, InvestmentHolding, InvestmentScheduleEntry,
  MonthOverviewReport, TransactionCreateRequest, TransactionUpdateRequest, ValuationSnapshot,
} from '@financas/api-types';
import { listAccounts } from './accountApi';
import { send, type TestUser } from './identityApi';

// Arranging and reading a household's transactions, Holdings and month
// figures through the API (I9): what a finances journey starts from, and the
// end state it checks where the page does not show it.

/** One unit of a Holding as the API counts quantities: 1e-8 units each (OQ-86). */
export const UNIT = 100_000_000;

/** Who acts: a member's access token. */
type Member = Pick<TestUser, 'accessToken'>;

/**
 * A date as the API takes it, in the browser's own calendar — the local day,
 * never UTC's, so a journey run near midnight lands where the page does.
 *
 * @param date - The date.
 * @returns It as `YYYY-MM-DD`.
 */
export const isoDay = (date: Date): string => [
  String(date.getFullYear()),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

/**
 * The first day of the month some months away from this one, local time.
 *
 * @param offset - How many months away: negative for earlier ones.
 * @returns That month's first day.
 */
export const monthStart = (offset: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
};

/**
 * A month as the balance history names it.
 *
 * @param date - Any day in the month.
 * @returns It as `YYYY-MM`.
 */
export const isoMonth = (date: Date): string => isoDay(date).slice(0, 7);

/**
 * Finds the household's first Account by name, as a member sees it.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @param name - The Account's name, e.g. `Main Checking` (`createHousehold`'s).
 * @returns The Account.
 */
export const accountNamed = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  name: string,
): Promise<Account> => {
  const found = (await listAccounts(request, member, householdId))
    .find((account) => account.name === name);
  if (found === undefined) throw new Error(`No account named ${name}`);
  return found;
};

/**
 * Reads one Account, its current balance included.
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees it.
 * @param householdId - The household.
 * @param accountId - The Account.
 * @returns The Account.
 */
export const getAccount = (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  accountId: string,
): Promise<Account> => send<Account>(
  request,
  'GET',
  `/households/${householdId}/accounts/${accountId}`,
  { accessToken: member.accessToken },
);

/**
 * Records a transaction through the API — what Record Transaction would send.
 *
 * @param request - Playwright's API client.
 * @param member - A member who may record it.
 * @param householdId - The household.
 * @param transaction - The request.
 * @returns The recorded Account transaction.
 */
export const recordTransaction = (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  transaction: TransactionCreateRequest,
): Promise<AccountTransaction> => send<AccountTransaction>(
  request,
  'POST',
  `/households/${householdId}/transactions`,
  { data: transaction, accessToken: member.accessToken },
);

/**
 * Edits a transaction through the API.
 *
 * @param request - Playwright's API client.
 * @param member - A member who may edit it.
 * @param householdId - The household.
 * @param transactionId - The transaction.
 * @param changes - The values that change.
 * @returns The edited transaction.
 */
export const editTransaction = (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  transactionId: string,
  changes: TransactionUpdateRequest,
): Promise<AccountTransaction> => send<AccountTransaction>(
  request,
  'PATCH',
  `/households/${householdId}/transactions/${transactionId}`,
  { data: changes, accessToken: member.accessToken },
);

/**
 * Lists an Account's transactions — the first page of the ledger it filters.
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees it.
 * @param householdId - The household.
 * @param accountId - The Account.
 * @returns Its newest transactions, up to the API's page.
 */
export const listAccountTransactions = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  accountId: string,
): Promise<readonly AccountTransaction[]> => {
  const page = await send<{ data?: AccountTransaction[] }>(
    request,
    'GET',
    `/households/${householdId}/transactions?accountIds=${accountId}&limit=100`,
    { accessToken: member.accessToken },
  );
  return page.data ?? [];
};

/**
 * Reads an Account's balance history, month by month.
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees it.
 * @param householdId - The household.
 * @param accountId - The Account.
 * @param range - The first and last month, as `YYYY-MM`.
 * @returns One row per month in the range that has one.
 */
export const accountBalances = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  accountId: string,
  range: { readonly from: string; readonly to: string },
): Promise<readonly AccountMonthBalance[]> => {
  const history = await send<{ data?: AccountMonthBalance[] }>(
    request,
    'GET',
    `/households/${householdId}/accounts/${accountId}/balances?from=${range.from}&to=${range.to}`,
    { accessToken: member.accessToken },
  );
  return history.data ?? [];
};

/**
 * Reads the Month Overview report for one month.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @param month - Any day in the month.
 * @returns The report.
 */
export const monthOverview = (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  month: Date,
): Promise<MonthOverviewReport> => send<MonthOverviewReport>(
  request,
  'GET',
  `/households/${householdId}/reports/month-overview`
    + `?year=${month.getFullYear()}&month=${month.getMonth() + 1}`,
  { accessToken: member.accessToken },
);

/**
 * Lists an Account's Holdings.
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees the Account.
 * @param householdId - The household.
 * @param accountId - The Account.
 * @returns Every Holding, archived ones included.
 */
export const listHoldings = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  accountId: string,
): Promise<readonly InvestmentHolding[]> => {
  const list = await send<{ data?: InvestmentHolding[] }>(
    request,
    'GET',
    `/households/${householdId}/accounts/${accountId}/holdings?includeArchived=true`,
    { accessToken: member.accessToken },
  );
  return list.data ?? [];
};

/**
 * Reads one Holding.
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees its Account.
 * @param householdId - The household.
 * @param holdingId - The Holding.
 * @returns The Holding.
 */
export const getHolding = (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  holdingId: string,
): Promise<InvestmentHolding> => send<InvestmentHolding>(
  request,
  'GET',
  `/households/${householdId}/holdings/${holdingId}`,
  { accessToken: member.accessToken },
);

/**
 * Archives a Holding as its user would (`archivedBy: user`).
 *
 * @param request - Playwright's API client.
 * @param member - A member who may edit its Account.
 * @param householdId - The household.
 * @param holdingId - The Holding.
 * @returns Resolves once it is archived.
 */
export const archiveHolding = (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  holdingId: string,
): Promise<void> => send<void>(
  request,
  'POST',
  `/households/${householdId}/holdings/${holdingId}/archive`,
  { accessToken: member.accessToken },
);

/**
 * Lists a fixed-term Holding's schedule: its interest payments, redemption and taxes.
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees its Account.
 * @param householdId - The household.
 * @param holdingId - The Holding.
 * @returns Its schedule entries.
 */
export const scheduleEntries = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  holdingId: string,
): Promise<readonly InvestmentScheduleEntry[]> => {
  const list = await send<{ data?: InvestmentScheduleEntry[] }>(
    request,
    'GET',
    `/households/${householdId}/holdings/${holdingId}/schedule-entries`,
    { accessToken: member.accessToken },
  );
  return list.data ?? [];
};

/**
 * Lists a Holding's Valuation Snapshots.
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees its Account.
 * @param householdId - The household.
 * @param holdingId - The Holding.
 * @returns Every snapshot it has.
 */
export const valuationSnapshots = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  holdingId: string,
): Promise<readonly ValuationSnapshot[]> => {
  const list = await send<{ data?: ValuationSnapshot[] }>(
    request,
    'GET',
    `/households/${householdId}/holdings/${holdingId}/valuation-snapshots`,
    { accessToken: member.accessToken },
  );
  return list.data ?? [];
};
