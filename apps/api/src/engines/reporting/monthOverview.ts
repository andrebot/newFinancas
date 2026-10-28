import { findKind, type TransactionEffect } from '@financas/reference';
import type { Account, AccountAccessor } from '../../accessors/accountAccessor';
import type {
  AccountTransactionAccessor, MonthKindTotal,
} from '../../accessors/accountTransactionAccessor';
import type { Budget, BudgetAccessor, BudgetPeriodOf } from '../../accessors/budgetAccessor';
import { monthEnd, monthKey, type CalendarMonth } from '../../accessors/calendarMonth';
import type { CardTransactionAccessor } from '../../accessors/cardTransactionAccessor';
import type { CreditCard, CreditCardAccessor } from '../../accessors/creditCardAccessor';
import type { GoalAccessor } from '../../accessors/goalAccessor';
import { calendar } from '../../config/constants';
import type { Visibility } from '../../db/schema/values';
import calendarDate from '../../utilities/calendar';
import {
  goalProgress, visibleAccountIdsOf, type GoalProgressDeps, type GoalWithProgress,
} from './goalProgress';
import yearMonths from './months';

// ReportingEngine — the Month Overview (FR-6.11, FR-6.6, FR-4.3, FR-8.7,
// OQ-201): a month's money in and out per currency with the year's strip, the
// month-end balances, the Budgets and the Goals, all as the viewer sees them.
// In and out follow each kind's direction; own-account transfers and bill
// payments are left out by their stored effect (FR-3.6), never by kind, so
// nothing counts twice. Card charges and refunds and investment trades count.
// Past months read as they were: an Account archived later still shows its
// balance for a month it was open (OQ-206).

/** What the Month Overview reads. */
export interface MonthOverviewDeps extends GoalProgressDeps {
  readonly listAccounts: AccountAccessor['list'];
  readonly accountBalancesAsOf: AccountAccessor['balancesAsOf'];
  readonly listCreditCards: CreditCardAccessor['listByAccounts'];
  readonly cardBalancesAsOf: CreditCardAccessor['balancesAsOf'];
  readonly accountMonthlySums: AccountTransactionAccessor['monthlySums'];
  readonly cardMonthlySums: CardTransactionAccessor['monthlySums'];
  readonly listBudgets: BudgetAccessor['list'];
  readonly budgetPeriodsAsOf: BudgetAccessor['periodsAsOf'];
  readonly listGoals: GoalAccessor['list'];
}

/** Whose view a report is: a member of a household. */
export interface Viewer {
  readonly householdId: string;
  readonly viewerUserId: string;
}

/** Money in and out, minor units. */
interface InOut {
  readonly in: number;
  readonly out: number;
}

/** One currency's month: in, out and net (never summed across currencies). */
export interface CurrencySummary extends InOut {
  readonly currency: string;
  readonly net: number;
}

/** One month of the year's strip in one currency. */
export interface StripMonth extends InOut {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly currency: string;
}

/** An Account's balance, or one of its cards' outstanding balance, at the month's end. */
export interface MonthEndBalance {
  readonly accountId: string;
  readonly creditCardId: string | null;
  readonly currency: string;
  readonly amount: number;
}

/** A Budget's month: the target in effect and the spend (out − in, OQ-201). */
export interface BudgetStatus {
  readonly budgetId: string;
  readonly name: string;
  readonly currency: string;
  readonly visibility: Visibility;
  readonly targetAmount: number;
  readonly spendAmount: number;
}

/** The Month Overview's figures (`MonthOverviewReport`, less its type tag). */
export interface MonthOverview {
  readonly summary: readonly CurrencySummary[];
  readonly yearStrip: readonly StripMonth[];
  readonly balances: readonly MonthEndBalance[];
  readonly budgets: readonly BudgetStatus[];
  readonly goals: readonly GoalWithProgress[];
}

const LEFT_OUT: ReadonlySet<TransactionEffect> = new Set(['transfer', 'bill_payment']);
const NOTHING: InOut = { in: 0, out: 0 };

/**
 * The key one month and currency's totals are kept under.
 *
 * @param month - `YYYY-MM`.
 * @param currency - The currency.
 * @returns The key.
 */
const flowKey = (month: string, currency: string): string => `${month} ${currency}`;

/**
 * Adds up money in and out by month and currency, each kind signed by its
 * direction (FR-3.1).
 *
 * @param rows - Sums by month, currency and kind.
 * @returns In and out by `flowKey`.
 */
export const cashFlowOf = (rows: readonly MonthKindTotal[]): Map<string, InOut> => (
  rows.reduce((totals, row) => {
    const direction = findKind(row.kind)?.direction;
    if (!direction) return totals;
    const key = flowKey(row.month, row.currency);
    const current = totals.get(key) ?? NOTHING;
    return totals.set(key, { ...current, [direction]: current[direction] + row.total });
  }, new Map<string, InOut>())
);

/**
 * Reads the year's money in and out of the viewer's Accounts and cards, own
 * transfers and bill payments left out by their stored effect.
 *
 * @param deps - The ledgers' monthly sums.
 * @param accounts - The viewer's Accounts.
 * @param cards - Their cards.
 * @param year - The year.
 * @returns The sums that count.
 */
const yearSums = async (
  deps: MonthOverviewDeps,
  accounts: readonly Account[],
  cards: readonly CreditCard[],
  year: number,
): Promise<MonthKindTotal[]> => {
  const [from, to] = [`${year}-01-01`, `${year}-12-31`];
  const [accountSums, cardSums] = await Promise.all([
    deps.accountMonthlySums(accounts.map((account) => account.id), from, to),
    deps.cardMonthlySums(cards.map((card) => card.id), from, to),
  ]);
  return [...accountSums.filter((sum) => !LEFT_OUT.has(sum.effect)), ...cardSums];
};

/**
 * Shapes the month's summary and the year's strip, every currency the year
 * moved in shown in every month (zero when nothing moved).
 *
 * @param rows - The year's sums that count.
 * @param month - The selected month.
 * @returns The summary and strip.
 */
export const flowsOf = (
  rows: readonly MonthKindTotal[],
  month: CalendarMonth,
): Pick<MonthOverview, 'summary' | 'yearStrip'> => {
  const totals = cashFlowOf(rows);
  const counted = rows.filter((row) => findKind(row.kind) !== undefined);
  const currencies = [...new Set(counted.map((row) => row.currency))].sort();
  /**
   * Reads one month and currency's totals.
   *
   * @param stripMonth - The month.
   * @param currency - The currency.
   * @returns Its in and out; zero when nothing moved.
   */
  const flowAt = (stripMonth: CalendarMonth, currency: string): InOut => (
    totals.get(flowKey(monthKey(stripMonth), currency)) ?? NOTHING
  );
  return {
    summary: currencies.map((currency) => {
      const flow = flowAt(month, currency);
      return { currency, ...flow, net: flow.in - flow.out };
    }),
    yearStrip: yearMonths(month.year).flatMap((stripMonth) => currencies.map((currency) => ({
      month: monthKey(stripMonth), currency, ...flowAt(stripMonth, currency),
    }))),
  };
};

/**
 * Tells whether an Account was still open at a month's end: never archived, or
 * archived after it (F10, OQ-206) — in the app's time zone (OQ-104).
 *
 * @param account - The Account.
 * @param month - The month.
 * @returns `true` when it belongs on that month's Balance rail.
 */
export const openAtMonthEnd = (account: Account, month: CalendarMonth): boolean => (
  account.archivedAt === null
  || calendarDate(account.archivedAt, calendar.timeZone) > monthEnd(month)
);

/**
 * Reads the balance of each Account open at the month's end and its cards'
 * outstanding then (F10, D16); one with no history by then is left out.
 *
 * @param deps - The balance reads.
 * @param accounts - The viewer's Accounts, in display order.
 * @param cards - Their cards.
 * @param month - The month.
 * @returns Each Account followed by its cards.
 */
const balancesOf = async (
  deps: MonthOverviewDeps,
  accounts: readonly Account[],
  cards: readonly CreditCard[],
  month: CalendarMonth,
): Promise<MonthEndBalance[]> => {
  const open = accounts.filter((account) => openAtMonthEnd(account, month));
  const openCards = cards.filter((card) => open.some((account) => account.id === card.accountId));
  const [accountRows, cardRows] = await Promise.all([
    deps.accountBalancesAsOf(open.map((account) => account.id), month),
    deps.cardBalancesAsOf(openCards.map((card) => card.id), month),
  ]);
  const ending = new Map([
    ...accountRows.map((row) => [row.accountId, row.endingBalance] as const),
    ...cardRows.map((row) => [row.creditCardId, row.endingOutstandingBalance] as const),
  ]);
  return open.flatMap((account) => [
    { id: account.id, creditCardId: null },
    ...openCards.filter((card) => card.accountId === account.id)
      .map((card) => ({ id: card.id, creditCardId: card.id })),
  ].flatMap(({ id, creditCardId }) => {
    const amount = ending.get(id);
    return amount === undefined ? [] : [{
      accountId: account.id, creditCardId, currency: account.currency, amount,
    }];
  }));
};

/**
 * Shapes a Budget's month from its latest period by then: that month's, or —
 * with none opened — the target in effect then (OQ-166) and zero spend.
 *
 * @param budget - The Budget.
 * @param latest - Its latest period at or before the month, if any.
 * @param month - The month.
 * @returns Its status, or none when it had no period by then.
 */
export const budgetStatusOf = (
  budget: Budget,
  latest: BudgetPeriodOf | undefined,
  month: CalendarMonth,
): BudgetStatus[] => {
  if (!latest) return [];
  const opened = latest.year === month.year && latest.month === month.month;
  return [{
    budgetId: budget.id,
    name: budget.name,
    currency: budget.currency,
    visibility: budget.visibility,
    targetAmount: latest.targetAmount,
    spendAmount: opened ? latest.spendAmount : 0,
  }];
};

/**
 * Orders Budgets over-budget first, each group keeping its order (by name).
 *
 * @param statuses - The Budgets' months.
 * @returns The ordered list.
 */
export const overBudgetFirst = (statuses: readonly BudgetStatus[]): BudgetStatus[] => {
  /**
   * Tells whether a Budget spent past its target.
   *
   * @param status - The Budget's month.
   * @returns `true` when over budget.
   */
  const isOver = (status: BudgetStatus) => status.spendAmount > status.targetAmount;
  return [...statuses.filter(isOver), ...statuses.filter((status) => !isOver(status))];
};

/**
 * Reads the Budgets' months in one query (FR-4.3, F9).
 *
 * @param deps - The period read.
 * @param householdId - The household.
 * @param budgets - The viewer's Budgets, by name.
 * @param month - The month.
 * @returns The Budgets active by then, over-budget first.
 */
const budgetsOf = async (
  deps: MonthOverviewDeps,
  householdId: string,
  budgets: readonly Budget[],
  month: CalendarMonth,
): Promise<BudgetStatus[]> => {
  const periods = await deps.budgetPeriodsAsOf(
    householdId,
    budgets.map((budget) => budget.id),
    month,
  );
  const latest = new Map(periods.map((period) => [period.budgetId, period]));
  return overBudgetFirst(budgets.flatMap((budget) => (
    budgetStatusOf(budget, latest.get(budget.id), month))));
};

/**
 * Builds a month's overview as a member sees it (FR-6.11).
 *
 * @param deps - The Accessor reads.
 * @param viewer - The household and member.
 * @param month - The month.
 * @returns The overview.
 */
export const monthOverview = async (
  deps: MonthOverviewDeps,
  viewer: Viewer,
  month: CalendarMonth,
): Promise<MonthOverview> => {
  const { householdId, viewerUserId } = viewer;
  const [accounts, budgets, goals] = await Promise.all([
    deps.listAccounts(householdId, viewerUserId),
    deps.listBudgets(householdId, viewerUserId),
    deps.listGoals(householdId, viewerUserId, 'active'),
  ]);
  const cards = await deps.listCreditCards(accounts.map((account) => account.id));
  const [sums, balances, statuses, progress] = await Promise.all([
    yearSums(deps, accounts, cards, month.year),
    balancesOf(deps, accounts, cards, month),
    budgetsOf(deps, householdId, budgets, month),
    goalProgress(deps, goals, {
      householdId, visibleAccountIds: visibleAccountIdsOf(accounts), date: monthEnd(month),
    }),
  ]);
  return {
    ...flowsOf(sums, month), balances, budgets: statuses, goals: progress,
  };
};
