import type {
  Account, Currency, InvestmentHolding, InvestmentsOverviewReport,
} from '@financas/api-types';
import { money } from '../../../../config/constants';
import { assetFamilyOf, type AssetFamily } from '../../../holdingNames';
import { holdingNameOf, type PayoutThisMonthEntry } from '../../../payoutPanel';

// What the Portfolio Overview Flow (FL18; mockup 50; FR-5.3, FR-5.9, OQ-233)
// reads from the investments overview: this month's payouts as rows and
// per-currency totals, and the allocation slices as the Stocks, FIIs, By type
// and By account panels draw them — per currency, never summed across
// currencies. Pure, so it tests without React.

/** One allocation slice, as the report sends it. */
export type AllocationSlice = InvestmentsOverviewReport['allocations'][number];

/** One payout of this month, as its row reads it. */
export interface PayoutRow {
  readonly entry: PayoutThisMonthEntry;
  readonly ticker: string;
  readonly family: AssetFamily;
}

/** An amount in one currency. */
export interface CurrencyAmount {
  readonly currency: Currency;
  readonly amount: number;
}

/** One share of a currency's whole. */
export interface Share {
  readonly key: string;
  readonly label: string;
  readonly amount: number;
  /** Its share of the currency's total, in whole percent. */
  readonly percent: number;
}

/** One currency's whole, in shares, largest first. */
export interface CurrencyShares {
  readonly currency: Currency;
  readonly total: number;
  readonly shares: readonly Share[];
}

/** One Account's Holdings in one currency (By account). */
export interface AccountRow {
  readonly key: string;
  readonly name: string;
  readonly currency: Currency;
  readonly amount: number;
  /** How many of its Holdings are still open. */
  readonly holdings: number;
}

/**
 * Orders currencies as every money list does: R$ first.
 *
 * @param currency - The currency.
 * @returns Its place.
 */
const currencyRank = (currency: Currency) => money.currencies.indexOf(currency);

/**
 * Builds this month's payout rows: R$ first, then by amount, largest first.
 *
 * @param entries - This month's dividend and interest transactions.
 * @param holdings - The household's Holdings, to name each one.
 * @param unknown - The name for a Holding the list lacks (review round 1).
 * @returns The rows.
 */
export const payoutRowsOf = (
  entries: readonly PayoutThisMonthEntry[],
  holdings: readonly InvestmentHolding[],
  unknown: string,
): PayoutRow[] => {
  const byId = new Map(holdings.map((holding) => [holding.id, holding]));
  return [...entries]
    .sort((first, second) => (
      currencyRank(first.currency) - currencyRank(second.currency) || second.amount - first.amount
    ))
    .map((entry) => {
      const holding = byId.get(entry.holdingId);
      return {
        entry, ticker: holdingNameOf(holding, unknown), family: assetFamilyOf(holding?.assetType),
      };
    });
};

/**
 * Adds up amounts per currency.
 *
 * @param items - Anything with a currency and an amount.
 * @returns One total per currency present, R$ first.
 */
export const totalsByCurrency = (items: readonly CurrencyAmount[]): CurrencyAmount[] => (
  money.currencies.flatMap((currency) => {
    const own = items.filter((item) => item.currency === currency);
    return own.length > 0
      ? [{ currency, amount: own.reduce((sum, item) => sum + item.amount, 0) }]
      : [];
  })
);

/**
 * Splits slices into each currency's shares, largest first.
 *
 * @param slices - The slices to share out, of one kind.
 * @param labelOf - Names a slice by its key.
 * @returns One whole per currency present, R$ first; a whole worth nothing is left out.
 */
const sharesByCurrency = (
  slices: readonly AllocationSlice[],
  labelOf: (key: string) => string,
): CurrencyShares[] => totalsByCurrency(slices)
  .filter(({ amount }) => amount > 0)
  .map(({ currency, amount: total }) => ({
    currency,
    total,
    shares: slices
      .filter((slice) => slice.currency === currency)
      .sort((first, second) => second.amount - first.amount)
      .map((slice) => ({
        key: slice.key,
        label: labelOf(slice.key),
        amount: slice.amount,
        percent: Math.round((slice.amount / total) * 100),
      })),
  }));

/**
 * Shares out one family's Holdings (the Stocks and FIIs panels).
 *
 * @param slices - The report's allocation slices.
 * @param holdings - The household's Holdings, for each one's family and ticker.
 * @param family - The family the panel shows.
 * @returns Each currency's Holdings of that family.
 */
export const familySharesOf = (
  slices: readonly AllocationSlice[],
  holdings: readonly InvestmentHolding[],
  family: AssetFamily,
): CurrencyShares[] => {
  const byId = new Map(holdings.map((holding) => [holding.id, holding]));
  return sharesByCurrency(
    slices.filter((slice) => (
      slice.kind === 'holding' && assetFamilyOf(byId.get(slice.key)?.assetType) === family
    )),
    (key) => holdingNameOf(byId.get(key)),
  );
};

/**
 * Shares out the Holdings by asset type (By type).
 *
 * @param slices - The report's allocation slices.
 * @param nameOf - Names an asset type.
 * @returns Each currency's asset types.
 */
export const typeSharesOf = (
  slices: readonly AllocationSlice[],
  nameOf: (assetType: string) => string,
): CurrencyShares[] => sharesByCurrency(
  slices.filter((slice) => slice.kind === 'assetType'),
  nameOf,
);

/**
 * Builds the By account rows: R$ first, then the largest first.
 *
 * @param slices - The report's allocation slices.
 * @param accounts - The accounts, to name each one.
 * @param holdings - The household's Holdings, to count each account's open ones.
 * @returns One row per account and currency.
 */
export const accountRowsOf = (
  slices: readonly AllocationSlice[],
  accounts: readonly Account[],
  holdings: readonly InvestmentHolding[],
): AccountRow[] => {
  const names = new Map(accounts.map((account) => [account.id, account.name]));
  return slices
    .filter((slice) => slice.kind === 'account')
    .sort((first, second) => (
      currencyRank(first.currency) - currencyRank(second.currency) || second.amount - first.amount
    ))
    .map((slice) => ({
      key: `${slice.key}:${slice.currency}`,
      name: names.get(slice.key) ?? '',
      currency: slice.currency,
      amount: slice.amount,
      holdings: holdings.filter((holding) => (
        holding.accountId === slice.key && !holding.archivedAt
      )).length,
    }));
};
