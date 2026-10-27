import { describe, expect, it } from 'vitest';
import {
  cashFlowOf, flowsOf, monthOverview, overBudgetFirst, type BudgetStatus,
} from '../../../../src/engines/reporting/monthOverview';
import {
  aBudget, aCard, aGoal, anAccount, aPeriod, fakeDeps, HOUSEHOLD_ID, NOW, VIEWER,
} from './fakes';

const MARCH = { year: 2026, month: 3 };

/**
 * One month's sum of a kind, as the ledgers' `monthlySums` answer it.
 *
 * @param kind - The kind.
 * @param total - Minor units.
 * @param month - `YYYY-MM`.
 * @param currency - The currency.
 * @returns The sum.
 */
const aSum = (kind: string, total: number, month = '2026-03', currency = 'BRL') => ({
  month, currency, kind, total,
});

/**
 * A Budget's month, as the overview lists it.
 *
 * @param name - Its name.
 * @param targetAmount - The target.
 * @param spendAmount - The spend.
 * @returns The status.
 */
const aStatus = (name: string, targetAmount: number, spendAmount: number): BudgetStatus => ({
  budgetId: name, name, currency: 'BRL', visibility: 'shared', targetAmount, spendAmount,
});

describe('cashFlowOf', () => {
  it('adds each kind by its direction, ignoring a kind it doesn\'t know', () => {
    const totals = cashFlowOf([
      aSum('deposit', 1_000),
      aSum('pix_receipt', 500),
      aSum('pix_payment', 300),
      aSum('not_a_kind', 9_999),
    ]);

    expect(totals.get('2026-03 BRL')).toEqual({ in: 1_500, out: 300 });
    expect(totals.size).toBe(1);
  });
});

describe('flowsOf (FR-6.11)', () => {
  it('sums the month per currency, never across currencies, with its net', () => {
    const { summary } = flowsOf([
      aSum('deposit', 1_000),
      aSum('withdrawal', 1_500),
      aSum('deposit', 70, '2026-03', 'USD'),
      aSum('deposit', 5, '2026-02'),
    ], MARCH);

    expect(summary).toEqual([
      {
        currency: 'BRL', in: 1_000, out: 1_500, net: -500,
      },
      {
        currency: 'USD', in: 70, out: 0, net: 70,
      },
    ]);
  });

  it('strips January to December for every currency of the year, zero where nothing moved', () => {
    const { summary, yearStrip } = flowsOf([
      aSum('deposit', 5, '2026-02'),
      aSum('withdrawal', 7, '2026-12', 'USD'),
    ], MARCH);

    expect(yearStrip).toHaveLength(24);
    expect(yearStrip.slice(0, 4)).toEqual([
      {
        month: '2026-01', currency: 'BRL', in: 0, out: 0,
      },
      {
        month: '2026-01', currency: 'USD', in: 0, out: 0,
      },
      {
        month: '2026-02', currency: 'BRL', in: 5, out: 0,
      },
      {
        month: '2026-02', currency: 'USD', in: 0, out: 0,
      },
    ]);
    expect(yearStrip.at(-1)).toEqual({
      month: '2026-12', currency: 'USD', in: 0, out: 7,
    });
    expect(summary.map((row) => row.net)).toEqual([0, 0]);
  });

  it('is empty when nothing moved all year', () => {
    expect(flowsOf([], MARCH)).toEqual({ summary: [], yearStrip: [] });
  });
});

describe('overBudgetFirst', () => {
  it('moves over-budget ones first, each group keeping its order', () => {
    const ordered = overBudgetFirst([
      aStatus('a', 100, 50),
      aStatus('b', 100, 150),
      aStatus('c', 100, 100),
      aStatus('d', 100, 101),
    ]);

    expect(ordered.map((status) => status.name)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('monthOverview', () => {
  // Own transfers and bill payments are left out by their stored effect, never by kind.
  it('sums the year of every visible Account and card, by stored effect', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([
      anAccount(),
      anAccount({ id: 'old', archivedAt: NOW }),
    ]);
    deps.listCreditCards.mockResolvedValue([aCard('visa', 'checking')]);
    deps.accountMonthlySums.mockResolvedValue([
      { ...aSum('deposit', 1_000), effect: 'movement' },
      { ...aSum('transfer_received', 400), effect: 'transfer' },
      { ...aSum('deposit', 99), effect: 'transfer' },
      { ...aSum('credit_card_bill_payment', 800), effect: 'bill_payment' },
      { ...aSum('investment_buy', 300), effect: 'investment_trade' },
      { ...aSum('investment_sell', 200), effect: 'investment_trade' },
    ]);
    deps.cardMonthlySums.mockResolvedValue([aSum('charge', 250), aSum('refund', 50)]);

    const overview = await monthOverview(deps, VIEWER, MARCH);

    expect(overview.summary).toEqual([{
      currency: 'BRL', in: 1_250, out: 550, net: 700,
    }]);
    expect(deps.accountMonthlySums)
      .toHaveBeenCalledWith(['checking', 'old'], '2026-01-01', '2026-12-31');
    expect(deps.cardMonthlySums).toHaveBeenCalledWith(['visa'], '2026-01-01', '2026-12-31');
    expect(deps.listCreditCards).toHaveBeenCalledWith(['checking', 'old']);
    expect(deps.listAccounts).toHaveBeenCalledWith(HOUSEHOLD_ID, 'ana');
  });

  it('lists unarchived Accounts\' month-end balances, then their cards\' (F10, D16)', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([
      anAccount(),
      anAccount({ id: 'new', currency: 'USD' }),
      anAccount({ id: 'old', archivedAt: NOW }),
    ]);
    deps.listCreditCards.mockResolvedValue([
      aCard('visa', 'checking'),
      aCard('master', 'checking'),
      aCard('old-card', 'old'),
    ]);
    deps.accountBalancesAsOf.mockResolvedValue([{
      accountId: 'checking', ...MARCH, openingBalance: 0, endingBalance: 5_000, updatedAt: NOW,
    }]);
    deps.cardBalancesAsOf.mockResolvedValue([{
      creditCardId: 'visa',
      ...MARCH,
      openingOutstandingBalance: 0,
      endingOutstandingBalance: 1_200,
      updatedAt: NOW,
    }]);

    const { balances } = await monthOverview(deps, VIEWER, MARCH);

    expect(balances).toEqual([
      {
        accountId: 'checking', creditCardId: null, currency: 'BRL', amount: 5_000,
      },
      {
        accountId: 'checking', creditCardId: 'visa', currency: 'BRL', amount: 1_200,
      },
    ]);
    expect(deps.accountBalancesAsOf).toHaveBeenCalledWith(['checking', 'new'], MARCH);
    expect(deps.cardBalancesAsOf).toHaveBeenCalledWith(['visa', 'master'], MARCH);
  });

  // With no period that month: the target in effect then and zero spend.
  it('shows the Budgets active that month, over-budget first (F9)', async () => {
    const deps = fakeDeps();
    deps.listBudgets.mockResolvedValue([
      aBudget({ id: 'fun', name: 'Fun' }),
      aBudget({ id: 'groceries', name: 'Groceries', visibility: 'personal' }),
      aBudget({ id: 'later', name: 'Later' }),
    ]);
    deps.listBudgetPeriods.mockImplementation(async (_, budgetId) => ({
      fun: [aPeriod({ year: 2026, month: 1 }, 30_000, 99_000)],
      groceries: [aPeriod({ year: 2026, month: 2 }, 50_000, 0), aPeriod(MARCH, 60_000, 70_000)],
      later: [],
    })[budgetId] ?? []);

    const { budgets } = await monthOverview(deps, VIEWER, MARCH);

    expect(budgets).toEqual([
      {
        budgetId: 'groceries',
        name: 'Groceries',
        currency: 'BRL',
        visibility: 'personal',
        targetAmount: 60_000,
        spendAmount: 70_000,
      },
      {
        budgetId: 'fun',
        name: 'Fun',
        currency: 'BRL',
        visibility: 'shared',
        targetAmount: 30_000,
        spendAmount: 0,
      },
    ]);
    expect(deps.listBudgetPeriods).toHaveBeenCalledWith(HOUSEHOLD_ID, 'fun', { to: MARCH });
  });

  it('reads the active Goals\' progress at the month\'s end', async () => {
    const deps = fakeDeps();
    const trip = aGoal();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.listGoals.mockResolvedValue([trip]);

    const { goals } = await monthOverview(deps, VIEWER, { year: 2026, month: 2 });

    expect(goals).toEqual([{ goal: trip, contributions: [], fundedBy: [] }]);
    expect(deps.listGoals).toHaveBeenCalledWith(HOUSEHOLD_ID, 'ana', 'active');
    expect(deps.listAllocations).toHaveBeenCalledWith({ goalIds: ['trip'] });
    expect(deps.latestSnapshots).toHaveBeenCalledWith([], '2026-02-28');
  });

  it('is empty for a new household', async () => {
    expect(await monthOverview(fakeDeps(), VIEWER, MARCH)).toEqual({
      summary: [], yearStrip: [], balances: [], budgets: [], goals: [],
    });
  });
});
