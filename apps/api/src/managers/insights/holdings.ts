import { isFixedTerm } from '@financas/reference';
import type { AccountTransaction } from '../../accessors/accountTransactionAccessor';
import type { InvestmentHolding } from '../../accessors/investmentHoldingAccessor';
import type { ContractRate, ContractTerms, IndexMissing } from '../../engines/investmentProduct';
import { accessToOwned, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import type { InsightsDeps } from './context';
import { accountNotFound, holdingNotFound } from './errors';

// The Holding reads with projections (OQ-178): a Holding takes its Account's
// access — personal, the owner's alone; shared, the table plus the Member who
// created it (OQ-111). A fixed-term Holding carries what its contract is
// expected to pay, computed on read by InvestmentProductEngine.project from
// the Holding's own rate and due date plus its buy's date and amount (FR-11.2,
// OQ-205); an index with no value yet leaves it unprojected, named why.

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
 * terms — TransactionManager sets them when it opens the Holding.
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
  rate: {
    type: holding.rateType! as ContractRate['type'],
    value: holding.rateValue!,
    ...(holding.rateSpread != null && { spread: holding.rateSpread }),
  },
  interestPayment: holding.interestPayment ?? 'at_maturity',
});

/**
 * Projects one Holding — a fixed-term one through the Engine, a market-priced
 * one left unprojected (its value is its latest snapshot's, not a projection).
 *
 * @param deps - The tier below.
 * @param householdId - The household whose index rates apply.
 * @param holding - The Holding.
 * @returns The Holding with its expected payout, or why it has none.
 */
const projectOne = async (
  deps: InsightsDeps,
  householdId: string,
  holding: InvestmentHolding,
): Promise<ProjectedHolding> => {
  if (!isFixedTerm(holding.assetType)) return { ...holding, ...NO_PROJECTION };
  const buy = await deps.accountTransactions.findBuy(householdId, holding.id);
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
    return Promise.all(holdings.map((holding) => projectOne(deps, householdId, holding)));
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
    return projectOne(deps, householdId, holding);
  },
});

export type Holdings = ReturnType<typeof createHoldings>;
