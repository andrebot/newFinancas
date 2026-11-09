import type {
  Currency, InvestmentHolding, InvestmentsOverviewReport, PayoutsReport,
} from '@financas/api-types';
import type { BarSeries } from '../kit/stackedBarChart/StackedBarChart';
import { ASSET_FAMILIES, assetFamilyOf, type AssetFamily } from './holdingNames';

// What the payout panel reads (FL18, FL21; mockups 20, 50; FR-5.9, OQ-230,
// OQ-233): the chart's series in the $ / R$ switch's currency — never summed
// across currencies — each named by its Holding's ticker; the newest month's
// total; the selector's groups by family; and this month's payout per
// Holding, beside its checkbox. Pure, so it tests without React.

/** The payouts report, as the Experience's query holds it. */
export type PayoutsRead = | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'loaded'; readonly report: PayoutsReport };

/** One dividend or interest transaction this month, as the overview sends it. */
export type PayoutThisMonthEntry = InvestmentsOverviewReport['payoutThisMonth'][number];

/** A Holding's payout this month: one Holding is in one currency. */
export interface HoldingPayout {
  readonly currency: Currency;
  readonly amount: number;
}

/** One of the selector's groups. */
export interface HoldingGroup {
  readonly family: AssetFamily;
  readonly holdings: readonly InvestmentHolding[];
}

/**
 * Names a Holding as the panel shows it.
 *
 * @param holding - The Holding, if the list holds it.
 * @returns Its ticker; an empty name when unknown.
 */
export const holdingNameOf = (holding: InvestmentHolding | undefined) => holding?.ticker ?? '';

/**
 * Builds the chart's series in one currency.
 *
 * @param report - The payouts report.
 * @param currency - The switch's currency.
 * @param holdings - The household's Holdings, to name each series.
 * @returns One series per Holding paid in that currency.
 */
export const payoutSeriesOf = (
  report: PayoutsReport,
  currency: Currency,
  holdings: readonly InvestmentHolding[],
): BarSeries[] => {
  const byId = new Map(holdings.map((holding) => [holding.id, holding]));
  return report.series
    .filter((series) => series.currency === currency)
    .map((series) => ({
      key: series.holdingId,
      label: holdingNameOf(byId.get(series.holdingId)),
      amounts: series.months,
    }));
};

/**
 * Adds up one month across the series: what the panel's heading shows.
 *
 * @param series - The chart's series.
 * @param month - `YYYY-MM`.
 * @returns The total in minor units; an amount below zero counts as nothing, as on the chart.
 */
export const monthTotalOf = (series: readonly BarSeries[], month: string) => (
  series.reduce((total, { amounts }) => total + amounts
    .filter((amount) => amount.month === month)
    .reduce((sum, { amount }) => sum + Math.max(0, amount), 0), 0)
);

/**
 * Groups the Holdings by family, as the selector lists them (mockup 50).
 *
 * @param holdings - The household's Holdings.
 * @returns The families that have a Holding, in order, each by ticker.
 */
export const holdingGroupsOf = (holdings: readonly InvestmentHolding[]): HoldingGroup[] => (
  ASSET_FAMILIES
    .map((family) => ({
      family,
      holdings: holdings
        .filter((holding) => assetFamilyOf(holding.assetType) === family)
        .sort((first, second) => holdingNameOf(first).localeCompare(holdingNameOf(second))),
    }))
    .filter((group) => group.holdings.length > 0)
);

/**
 * Adds up this month's payouts per Holding.
 *
 * @param entries - This month's dividend and interest transactions.
 * @returns Each paid Holding's total, by id.
 */
export const payoutsByHolding = (
  entries: readonly PayoutThisMonthEntry[],
): ReadonlyMap<string, HoldingPayout> => entries.reduce((totals, entry) => {
  const amount = (totals.get(entry.holdingId)?.amount ?? 0) + entry.amount;
  return totals.set(entry.holdingId, { currency: entry.currency, amount });
}, new Map<string, HoldingPayout>());
