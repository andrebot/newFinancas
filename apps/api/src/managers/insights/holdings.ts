import { isFixedTerm } from '@financas/reference';
import type { AccountTransaction } from '../../accessors/accountTransactionAccessor';
import type { InvestmentHolding } from '../../accessors/investmentHoldingAccessor';
import type { ContractTerms, IndexMissing } from '../../engines/investmentProduct';
import { accessToOwned, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import { engineRateOf } from '../transaction/effects';
import type { InsightsDeps } from './context';
import { accountNotFound, holdingNotFound } from './errors';

// The Holding reads with projections (OQ-178): a Holding takes its Account's
// access — personal, the owner's alone; shared, any member (`data.view` is
// everyone's on shared data, so no creator exception applies — OQ-111,
// OQ-208). A fixed-term Holding carries what its contract is expected to pay,
// computed on read by InvestmentProductEngine.project from the Holding's own
// rate and due date plus its buy's date and amount (FR-11.2, OQ-205) — the
// buys of a whole list read at once; an index with no value yet leaves it
// unprojected, named why.

/** A Holding as the contract shows it: its row plus its expected payout. */
export interface ProjectedHolding extends InvestmentHolding {
  /** Fixed-term only — principal plus all gross interest; null when not projected. */
  readonly expectedPayout: number | null;
  /** Fixed-term only — `estimated: false` for US instruments (OQ-79); null when not projected. */
  readonly expectedTaxes: { readonly estimated: true; readonly amount: number }
    | { readonly estimated: false }
    | null;
  /** Why the projection is unavailable (OQ-205) — null when projected or market-priced. */
  readonly projectionUnavailable: Pick<IndexMissing, 'reason' | 'indexCode'> | null;
}

/** What a read answers with for a Holding that carries no projection. */
const NO_PROJECTION = {
  expectedPayout: null,
  expectedTaxes: null,
  projectionUnavailable: null,
} as const;

/**
 * The contract terms the Engine projects from (OQ-205): the Holding's own rate
 * and due date, its buy's date and amount. A fixed-term row always carries its
 * terms — TransactionManager sets them when it opens the Holding, and the
 * schema refuses one without them (OQ-224).
 *
 * @param holding - The fixed-term Holding.
 * @param buy - The buy that opened it.
 * @returns The terms.
 */
const termsOf = (holding: InvestmentHolding, buy: AccountTransaction): ContractTerms => ({
  assetType: holding.assetType,
  incentivised: holding.incentivised,
  date: buy.date,
  amount: buy.amount,
  dueDate: holding.dueDate!,
  rate: engineRateOf({
    type: holding.rateType!, value: holding.rateValue!, spread: holding.rateSpread,
  }),
  interestPayment: holding.interestPayment ?? 'at_maturity',
});

/**
 * The opening buy of each fixed-term Holding, in one read (OQ-205).
 *
 * @param deps - The tier below.
 * @param householdId - The household.
 * @param holdings - The Holdings; market-priced ones need no buy.
 * @returns Each fixed-term Holding's opening buy, by Holding id.
 */
const buysOf = async (
  deps: InsightsDeps,
  householdId: string,
  holdings: readonly InvestmentHolding[],
): Promise<Map<string, AccountTransaction>> => {
  const fixedTermIds = holdings
    .filter((holding) => isFixedTerm(holding.assetType))
    .map((holding) => holding.id);
  const buys = await deps.accountTransactions.findBuys(householdId, fixedTermIds);
  const byHolding = new Map<string, AccountTransaction>();
  for (const buy of buys) {
    if (!byHolding.has(buy.holdingId!)) byHolding.set(buy.holdingId!, buy);
  }
  return byHolding;
};

/**
 * Projects one Holding — a fixed-term one through the Engine, a market-priced
 * one (or one with no buy on record) left unprojected: a market-priced value is
 * its latest snapshot's, not a projection.
 *
 * @param deps - The tier below.
 * @param householdId - The household whose index rates apply.
 * @param holding - The Holding.
 * @param buy - Its opening buy, when fixed-term and on record.
 * @returns The Holding with its expected payout, or why it has none.
 */
const projectOne = async (
  deps: InsightsDeps,
  householdId: string,
  holding: InvestmentHolding,
  buy: AccountTransaction | undefined,
): Promise<ProjectedHolding> => {
  if (!buy) return { ...holding, ...NO_PROJECTION };
  const result = await deps.investmentProducts.project(householdId, termsOf(holding, buy));
  if ('reason' in result) {
    return {
      ...holding,
      expectedPayout: null,
      expectedTaxes: null,
      projectionUnavailable: { reason: result.reason, indexCode: result.indexCode },
    };
  }
  return {
    ...holding,
    expectedPayout: result.expectedPayout,
    expectedTaxes: result.expectedTaxes,
    projectionUnavailable: null,
  };
};

/**
 * Projects Holdings, reading their buys once for the lot.
 *
 * @param deps - The tier below.
 * @param householdId - The household.
 * @param holdings - The Holdings.
 * @returns Each with its expected payout, in the same order.
 */
const projectAll = async (
  deps: InsightsDeps,
  householdId: string,
  holdings: readonly InvestmentHolding[],
): Promise<ProjectedHolding[]> => {
  const buys = await buysOf(deps, householdId, holdings);
  return Promise.all(holdings.map((holding) => (
    projectOne(deps, householdId, holding, buys.get(holding.id))
  )));
};

/**
 * Builds the Holding read use cases.
 *
 * @param deps - The tier below.
 * @returns `listHoldings` and `getHolding`.
 */
export const createHoldings = (deps: InsightsDeps) => ({
  /**
   * An Account's Holdings, each with its expected payout (FR-5.3).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param accountId - The Account.
   * @param includeArchived - Archived Holdings too.
   * @returns The Holdings, in the order opened.
   * @throws {DomainError} `household.not_found` / `account.not_found`; `auth.forbidden`.
   */
  listHoldings: async (
    context: SignedInContext,
    householdId: string,
    accountId: string,
    includeArchived: boolean,
  ): Promise<ProjectedHolding[]> => {
    const account = await deps.accounts.findById(householdId, accountId);
    await requireAccess(
      deps.authorization,
      context.actor.userId,
      householdId,
      accessToOwned(account, 'data.view'),
      accountNotFound,
    );
    if (!account) throw accountNotFound();
    const holdings = await deps.holdings.listByAccounts([accountId], { includeArchived });
    return projectAll(deps, householdId, holdings);
  },

  /**
   * One Holding with its expected payout (FR-5.4).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @returns The Holding.
   * @throws {DomainError} `household.not_found` / `holding.not_found`; `auth.forbidden`.
   */
  getHolding: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
  ): Promise<ProjectedHolding> => {
    const holding = await deps.holdings.findById(householdId, holdingId);
    const account = holding && await deps.accounts.findById(householdId, holding.accountId);
    await requireAccess(
      deps.authorization,
      context.actor.userId,
      householdId,
      accessToOwned(account, 'data.view'),
      holdingNotFound,
    );
    if (!holding || !account) throw holdingNotFound();
    const [projected] = await projectAll(deps, householdId, [holding]);
    return projected!;
  },
});

export type Holdings = ReturnType<typeof createHoldings>;
