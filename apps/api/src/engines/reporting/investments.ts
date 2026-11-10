import { isFixedTerm } from '@financas/reference';
import type { AccountAccessor } from '../../accessors/accountAccessor';
import type {
  AccountTransaction, AccountTransactionAccessor,
} from '../../accessors/accountTransactionAccessor';
import type {
  InvestmentHoldingAccessor, PricedHolding,
} from '../../accessors/investmentHoldingAccessor';
import { calendar } from '../../config/constants';
import calendarDate from '../../utilities/calendar';
import {
  monthEnd, monthKey, monthOf, monthOrdinal, monthsBetween, type CalendarMonth,
} from '../../utilities/calendarMonth';
import { valuesOn, type GoalProgressDeps } from './goalProgress';
import type { Viewer } from './monthOverview';

// ReportingEngine — the investments reports (FR-5.3, FR-5.4, FR-5.9; OQ-201,
// OQ-233, OQ-236). Net worth here is the visible Holdings' value — a
// market-priced one's latest snapshot, a fixed-term one's cost basis (OQ-51) —
// per currency, never summed (FR-5.3). Each month reads as it was: a Holding
// counts until the day it was archived, never after — a matured contract
// archived by hand, its redemption never recorded, still holds its principal,
// and the slices leave it out too (OQ-236, review round 1). Today's slices,
// Coming Due and this month's payouts read the active Holdings. A payout is a
// dividend or interest transaction linked to its Holding (FR-5.9). What the
// viewer sees is the Accounts AccountAccessor lists for them.

/** What the investments reports read. */
export interface InvestmentsDeps
  extends Pick<GoalProgressDeps, 'latestSnapshots' | 'costBasisAsOf'> {
  readonly listAccounts: AccountAccessor['list'];
  readonly listHoldings: InvestmentHoldingAccessor['listByAccounts'];
  readonly listPayouts: AccountTransactionAccessor['listPayouts'];
}

/** An amount in one currency, minor units. */
interface Money {
  readonly currency: string;
  readonly amount: number;
}

/** One month of a series: `YYYY-MM` and its amount, minor units. */
export interface MonthAmount {
  readonly month: string;
  readonly amount: number;
}

/** One currency's net worth, with its trend (FR-5.3, OQ-231). */
export interface NetWorth extends Money {
  /** Against the month before; absent when the series holds only this month (OQ-236). */
  readonly changeVsPreviousMonth?: number;
  /** Oldest first, ending this month, from the first month with value (OQ-236). */
  readonly series: readonly MonthAmount[];
}

/** A dividend or interest received this month (FR-5.9). */
export interface PayoutEntry extends Money {
  readonly holdingId: string;
  readonly transactionId: string;
  readonly kind: 'investment_dividend' | 'investment_interest';
  readonly date: string;
}

/** Today's value of one slice of the active Holdings, in one currency (OQ-233). */
export interface AllocationSlice extends Money {
  readonly kind: 'holding' | 'assetType' | 'account';
  readonly key: string;
}

/** An open fixed-term Holding, worth its principal (OQ-51, OQ-236). */
export interface ComingDueEntry extends Money {
  readonly holdingId: string;
  /** The identifier the buy typed (its ticker); empty when none. */
  readonly name: string;
  readonly dueDate: string;
}

/** The Investments overview (FR-5.3, FR-5.9). */
export interface InvestmentsOverview {
  readonly netWorth: readonly NetWorth[];
  readonly payoutThisMonth: readonly PayoutEntry[];
  readonly allocations: readonly AllocationSlice[];
  readonly comingDue: readonly ComingDueEntry[];
}

/** One Holding's payouts in one currency, month by month (FR-5.9). */
export interface PayoutSeries {
  readonly holdingId: string;
  readonly currency: string;
  /** Every month of the window, oldest first; 0 when nothing was paid. */
  readonly months: readonly MonthAmount[];
}

/** What the payouts report is asked for. */
export interface PayoutsQuery {
  /** The Holdings to include; every visible one when absent. */
  readonly holdingIds?: readonly string[] | undefined;
  /** How many months back, this month included. */
  readonly months: number;
  /** Today, `YYYY-MM-DD`. */
  readonly today: string;
}

/**
 * The visible Holdings, archived ones included, each with its Account's
 * currency (FR-2.2).
 *
 * @param deps - The Account and Holding reads.
 * @param viewer - The household and member.
 * @returns The Holdings, in the Accessor's order.
 */
export const visibleHoldingsOf = async (
  deps: Pick<InvestmentsDeps, 'listAccounts' | 'listHoldings'>,
  viewer: Viewer,
): Promise<PricedHolding[]> => {
  const accounts = await deps.listAccounts(viewer.householdId, viewer.viewerUserId);
  const currencyOf = new Map(accounts.map((account) => [account.id, account.currency]));
  const holdings = await deps.listHoldings([...currencyOf.keys()], { includeArchived: true });
  return holdings.map((holding) => ({ ...holding, currency: currencyOf.get(holding.accountId)! }));
};

/**
 * The months a window covers, ending with today's.
 *
 * @param today - `YYYY-MM-DD`.
 * @param count - How many months, this one included.
 * @returns The months, oldest first.
 */
export const windowOf = (today: string, count: number): CalendarMonth[] => {
  const current = monthOf(today);
  const first = monthOrdinal(current) - count + 1;
  return monthsBetween({ year: Math.floor(first / 12), month: (first % 12) + 1 }, current);
};

/**
 * Adds up Holdings' values per currency.
 *
 * @param holdings - The Holdings.
 * @param values - Their values by id; one absent is worth nothing.
 * @returns The totals by currency.
 */
const totalsByCurrency = (
  holdings: readonly PricedHolding[],
  values: ReadonlyMap<string, number>,
): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const holding of holdings) {
    const value = values.get(holding.id) ?? 0;
    totals.set(holding.currency, (totals.get(holding.currency) ?? 0) + value);
  }
  return totals;
};

/**
 * Shapes one currency's series into its net worth: from the first month with
 * value, the change against the month before when there is one (OQ-236).
 *
 * @param currency - The currency.
 * @param series - Every month of the window, oldest first.
 * @returns The net worth, or none when the currency held no value at all.
 */
export const netWorthOf = (currency: string, series: readonly MonthAmount[]): NetWorth[] => {
  const first = series.findIndex((entry) => entry.amount !== 0);
  if (first === -1) return [];
  const kept = series.slice(first);
  const current = kept[kept.length - 1]!;
  const previous = kept[kept.length - 2];
  return [{
    currency,
    amount: current.amount,
    ...(previous ? { changeVsPreviousMonth: current.amount - previous.amount } : {}),
    series: kept,
  }];
};

/**
 * Tells whether a Holding counts on a day: it does until the day it was
 * archived, in the app's time zone (OQ-236).
 *
 * @param holding - The Holding.
 * @param date - The day, `YYYY-MM-DD`.
 * @returns Whether it was still active then.
 */
export const activeOn = (holding: PricedHolding, date: string): boolean => (
  holding.archivedAt === null || calendarDate(holding.archivedAt, calendar.timeZone) > date
);

/**
 * Net worth per currency over a window (FR-5.3, FR-5.4): each past month on its
 * last day, this month today — each day counting the Holdings active then.
 *
 * @param deps - The value reads.
 * @param holdings - The visible Holdings, archived ones included.
 * @param window - The months, oldest first, ending this month.
 * @param today - `YYYY-MM-DD`.
 * @returns One entry per currency that held value, in code order.
 */
const netWorthsOf = async (
  deps: InvestmentsDeps,
  holdings: readonly PricedHolding[],
  window: readonly CalendarMonth[],
  today: string,
): Promise<NetWorth[]> => {
  const last = window.length - 1;
  const totals = await Promise.all(window.map(async (month, index) => {
    const date = index === last ? today : monthEnd(month);
    const active = holdings.filter((holding) => activeOn(holding, date));
    return totalsByCurrency(active, await valuesOn(deps, active, date));
  }));
  const currencies = [...new Set(holdings.map((holding) => holding.currency))].sort();
  return currencies.flatMap((currency) => netWorthOf(currency, window.map((month, index) => ({
    // A currency none of that day's active Holdings is in has no total: nothing.
    month: monthKey(month), amount: totals[index]!.get(currency) ?? 0,
  }))));
};

/**
 * Adds a value to a slice, keyed by kind, key and currency.
 *
 * @param slices - The slices so far.
 * @param slice - The slice to add to.
 * @param amount - What to add, minor units.
 */
const addTo = (
  slices: Map<string, AllocationSlice>,
  slice: Omit<AllocationSlice, 'amount'>,
  amount: number,
) => {
  const id = `${slice.kind}\u0000${slice.key}\u0000${slice.currency}`;
  slices.set(id, { ...slice, amount: (slices.get(id)?.amount ?? 0) + amount });
};

/**
 * Today's value sliced three ways (OQ-233): by Holding, by asset type and by
 * Account, per currency; a slice worth nothing is left out.
 *
 * @param active - The active Holdings.
 * @param values - Their values today, by id.
 * @returns The slices: Holdings, then types, then Accounts, each as first met.
 */
export const allocationsOf = (
  active: readonly PricedHolding[],
  values: ReadonlyMap<string, number>,
): AllocationSlice[] => {
  const slices = new Map<string, AllocationSlice>();
  const kinds = [
    ['holding', (holding: PricedHolding) => holding.id],
    ['assetType', (holding: PricedHolding) => holding.assetType],
    ['account', (holding: PricedHolding) => holding.accountId],
  ] as const;
  for (const [kind, keyOf] of kinds) {
    for (const holding of active) {
      const slice = { kind, key: keyOf(holding), currency: holding.currency };
      addTo(slices, slice, values.get(holding.id) ?? 0);
    }
  }
  return [...slices.values()].filter((slice) => slice.amount !== 0);
};

/**
 * The fixed-term Holdings still open — active, with principal left — soonest
 * due first, each worth its principal (OQ-236).
 *
 * @param active - The active Holdings.
 * @param values - Their values today, by id.
 * @returns The entries, ties by id.
 */
export const comingDueOf = (
  active: readonly PricedHolding[],
  values: ReadonlyMap<string, number>,
): ComingDueEntry[] => active
  .filter((holding) => isFixedTerm(holding.assetType) && (values.get(holding.id) ?? 0) > 0)
  .map((holding) => ({
    holdingId: holding.id,
    name: holding.ticker ?? '',
    dueDate: holding.dueDate!,
    currency: holding.currency,
    amount: values.get(holding.id)!,
  }))
  .sort((left, right) => (
    left.dueDate.localeCompare(right.dueDate) || left.holdingId.localeCompare(right.holdingId)
  ));

/**
 * Shapes a payout transaction as the overview lists it.
 *
 * @param payout - A dividend or interest transaction linked to a Holding.
 * @returns The entry.
 */
const payoutEntryOf = (payout: AccountTransaction): PayoutEntry => ({
  holdingId: payout.holdingId!,
  transactionId: payout.id,
  kind: payout.kind as PayoutEntry['kind'],
  date: payout.date,
  currency: payout.currency,
  amount: payout.amount,
});

/**
 * The Investments overview as a member sees it (FR-5.3, FR-5.9, OQ-233).
 *
 * @param deps - The Account, Holding, value and payout reads.
 * @param viewer - The household and member.
 * @param query - Today and how many months the net worth series covers.
 * @param query.today - `YYYY-MM-DD`.
 * @param query.months - The series' length at most.
 * @returns The overview.
 */
export const investmentsOverview = async (
  deps: InvestmentsDeps,
  viewer: Viewer,
  query: { readonly today: string; readonly months: number },
): Promise<InvestmentsOverview> => {
  const holdings = await visibleHoldingsOf(deps, viewer);
  const active = holdings.filter((holding) => holding.archivedAt === null);
  const thisMonth = monthOf(query.today);
  const holdingIds = holdings.map((holding) => holding.id);
  const [netWorth, today, payouts] = await Promise.all([
    netWorthsOf(deps, holdings, windowOf(query.today, query.months), query.today),
    valuesOn(deps, active, query.today),
    deps.listPayouts(holdingIds, `${monthKey(thisMonth)}-01`, monthEnd(thisMonth)),
  ]);
  return {
    netWorth,
    payoutThisMonth: payouts.map(payoutEntryOf),
    allocations: allocationsOf(active, today),
    comingDue: comingDueOf(active, today),
  };
};

/** One Holding's payouts in one currency, summed by `YYYY-MM`. */
interface PayoutSums {
  readonly holdingId: string;
  readonly currency: string;
  readonly byMonth: Map<string, number>;
}

/**
 * Sums payouts per Holding and currency, every month of the window filled.
 *
 * @param payouts - The payouts, inside the window.
 * @param window - The months, oldest first.
 * @returns One series per Holding and currency paid, as first met.
 */
export const payoutSeriesOf = (
  payouts: readonly AccountTransaction[],
  window: readonly CalendarMonth[],
): PayoutSeries[] => {
  const keys = window.map(monthKey);
  const sums = new Map<string, PayoutSums>();
  for (const payout of payouts) {
    const id = `${payout.holdingId}\u0000${payout.currency}`;
    const series = sums.get(id)
      ?? { holdingId: payout.holdingId!, currency: payout.currency, byMonth: new Map() };
    const month = payout.date.slice(0, 7);
    series.byMonth.set(month, (series.byMonth.get(month) ?? 0) + payout.amount);
    sums.set(id, series);
  }
  return [...sums.values()].map(({ holdingId, currency, byMonth }) => ({
    holdingId,
    currency,
    months: keys.map((month) => ({ month, amount: byMonth.get(month) ?? 0 })),
  }));
};

/**
 * The payouts report (FR-5.9, OQ-233): each chosen Holding's monthly payouts.
 * An id the viewer can't see, or that no longer exists, is ignored.
 *
 * @param deps - The Account, Holding and payout reads.
 * @param viewer - The household and member.
 * @param query - The Holdings, the window and today.
 * @returns One series per Holding and currency that paid within the window.
 */
export const payoutsReport = async (
  deps: Pick<InvestmentsDeps, 'listAccounts' | 'listHoldings' | 'listPayouts'>,
  viewer: Viewer,
  query: PayoutsQuery,
): Promise<PayoutSeries[]> => {
  const visible = (await visibleHoldingsOf(deps, viewer)).map((holding) => holding.id);
  const asked = query.holdingIds ? new Set(query.holdingIds) : undefined;
  const chosen = asked ? visible.filter((holdingId) => asked.has(holdingId)) : visible;
  const window = windowOf(query.today, query.months);
  const from = `${monthKey(window[0]!)}-01`;
  const payouts = await deps.listPayouts(chosen, from, monthEnd(monthOf(query.today)));
  return payoutSeriesOf(payouts, window);
};
