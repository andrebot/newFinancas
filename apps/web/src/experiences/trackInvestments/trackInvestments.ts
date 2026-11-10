import type {
  Account, InvestmentHolding, InvestmentsOverviewReport, PayoutsReport,
} from '@financas/api-types';
import { isFixedTerm } from '@financas/reference';
import type { PayoutsRead } from '../payoutPanel';
import type { OverviewRead } from './overviewRead';
import type { MarketValue } from './flows/holdingMaintenance/HoldingPanel';

// What the Track Investments Experience reads its queries into for its Flows
// (X7; OQ-233..236). Pure: the page's hooks hand these RTK Query's state and
// pass the results down as display state.

/** The page's tabs, in order (mockups 50, 51, 53). */
export const TABS = ['overview', 'holdings', 'rates'] as const;

/** One of the page's tabs. */
export type InvestmentsTab = (typeof TABS)[number];

/**
 * Reads the open tab from the address's search parameter: the one it names,
 * or Overview.
 *
 * @param value - The parameter's value, if any.
 * @returns The tab.
 */
export const tabOf = (value: string | null): InvestmentsTab => (
  TABS.find((tab) => tab === value) ?? 'overview'
);

/** The part of an RTK Query hook's result a read is built from. */
export interface ReadState<Data> {
  readonly data?: Data | undefined;
  readonly isError: boolean;
}

/** The three reads the overview waits for. */
export interface OverviewQueries {
  readonly report: ReadState<InvestmentsOverviewReport>;
  readonly holdings: ReadState<readonly InvestmentHolding[]>;
  /** The accounts, which name By account's rows and Holding Maintenance's picker. */
  readonly accounts: ReadState<readonly Account[]>;
}

/**
 * Reads the overview as the Flows take it: loaded once the report, the
 * Holdings that name its ids and the accounts are in; failed when any failed
 * (OQ-233: one banner in place of every panel).
 *
 * @param queries - The three reads.
 * @returns The overview's read.
 */
export const overviewReadOf = ({ report, holdings, accounts }: OverviewQueries): OverviewRead => {
  if (report.data !== undefined && holdings.data !== undefined && accounts.data !== undefined) {
    return { status: 'loaded', report: report.data, holdings: holdings.data };
  }
  return [report, holdings, accounts].some((query) => query.isError)
    ? { status: 'failed' }
    : { status: 'loading' };
};

/**
 * Reads the payouts report for the panel: the answer for the current choice
 * only, never a previous choice's (`currentData`).
 *
 * @param query - The report query's state.
 * @returns The panel's read.
 */
export const payoutsReadOf = (query: {
  readonly currentData?: PayoutsReport | undefined;
  readonly isError: boolean;
}): PayoutsRead => {
  if (query.currentData !== undefined) return { status: 'loaded', report: query.currentData };
  return query.isError ? { status: 'failed' } : { status: 'loading' };
};

/**
 * Turns a market value as Holding Maintenance gives it into the contract's body.
 *
 * @param value - The date and the value.
 * @returns `{ value, asOf }`.
 */
export const marketValueBodyOf = (value: MarketValue) => ({
  value: value.valuation,
  asOf: value.asOfDate,
});

/**
 * Tells whether an open Holding has a value history and activity to read:
 * a market-priced one does; a fixed-term one has neither (OQ-234).
 *
 * @param holding - The Holding.
 * @returns Whether to read them.
 */
export const readsMarketDetails = (holding: InvestmentHolding): boolean => (
  !isFixedTerm(holding.assetType ?? '')
);
