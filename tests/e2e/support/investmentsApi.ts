import type { APIRequestContext } from '@playwright/test';
import type {
  HoldingAllocations, IndexCode, IndexRateSeries, IndexRateValue, InvestmentHolding,
} from '@financas/api-types';
import { send, type TestUser } from './identityApi';

// Arranging and reading what the Investments page works on through the API
// (I10): index values, the household's Holdings with their projections, and
// a Holding's Goal split — what an investments journey starts from, and the
// end state it checks where the page does not show it.

/** Who acts: a member's access token. */
type Member = Pick<TestUser, 'accessToken'>;

/**
 * Records an index value, as Rates Maintenance would.
 *
 * @param request - Playwright's API client.
 * @param member - Any member but a Viewer.
 * @param householdId - The household.
 * @param rate - The index, its value (percent × 10,000) and its day, `YYYY-MM-DD`.
 * @returns The recorded value.
 */
export const recordIndexRate = (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  rate: { readonly index: IndexCode; readonly value: number; readonly asOf: string },
): Promise<IndexRateValue> => send<IndexRateValue>(
  request,
  'POST',
  `/households/${householdId}/index-rates/${rate.index}/values`,
  { data: { value: rate.value, asOf: rate.asOf }, accessToken: member.accessToken },
);

/**
 * Reads one index's values.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @param index - The index.
 * @returns Its values, newest first.
 */
export const indexRateValues = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  index: IndexCode,
): Promise<readonly IndexRateValue[]> => {
  const list = await send<{ data?: IndexRateSeries[] }>(
    request,
    'GET',
    `/households/${householdId}/index-rates`,
    { accessToken: member.accessToken },
  );
  return list.data?.find((series) => series.index === index)?.values ?? [];
};

/**
 * Reads the Holdings a member sees across the household, projected — what the
 * Investments page reads (OQ-233).
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @returns Every Holding the member sees, archived ones included.
 */
export const householdHoldings = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
): Promise<readonly InvestmentHolding[]> => {
  const list = await send<{ data?: InvestmentHolding[] }>(
    request,
    'GET',
    `/households/${householdId}/holdings?includeArchived=true`,
    { accessToken: member.accessToken },
  );
  return list.data ?? [];
};

/**
 * Reads one Holding as the household list projects it — expected payout and
 * taxes from the index's latest value included.
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees its Account.
 * @param householdId - The household.
 * @param holdingId - The Holding.
 * @returns The Holding.
 */
export const projectedHolding = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  holdingId: string,
): Promise<InvestmentHolding> => {
  const found = (await householdHoldings(request, member, householdId))
    .find((holding) => holding.id === holdingId);
  if (found === undefined) throw new Error(`No holding ${holdingId}`);
  return found;
};

/**
 * Reads a Holding's Goal split as a member sees it — a share funding another
 * member's personal Goal is left out (OQ-178).
 *
 * @param request - Playwright's API client.
 * @param member - A member who sees its Account.
 * @param householdId - The household.
 * @param holdingId - The Holding.
 * @returns Each visible share as its Goal and percentage, in the server's order — a
 *   split saved together shares its `createdAt`, so compare them as a set.
 */
export const holdingSplit = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  holdingId: string,
): Promise<readonly { readonly goalId: string; readonly percentage: number }[]> => {
  const split = await send<HoldingAllocations>(
    request,
    'GET',
    `/households/${householdId}/holdings/${holdingId}/allocations`,
    { accessToken: member.accessToken },
  );
  return split.data.map(({ goalId, percentage }) => ({ goalId, percentage }));
};
