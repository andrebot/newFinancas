import { describe, expect, it } from 'vitest';
import {
  budgetStatusOf, cashFlowOf, flowsOf, monthOverview, movedInside, openAtMonthEnd,
  overBudgetFirst, type BudgetStatus,
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

describe('movedInside (OQ-222)', () => {
  const sum = { month: '2026-03', currency: 'BRL', total: 100 };

  it('leaves out a transfer whose other side the viewer sees, and a bill payment', () => {
    expect(movedInside({
      ...sum, kind: 'transfer_sent', effect: 'transfer', pairInView: true,
    })).toBe(true);
    expect(movedInside({
      ...sum, kind: 'credit_card_bill_payment', effect: 'bill_payment', pairInView: false,
    })).toBe(true);
  });

  it('counts a transfer whose other side is out of view, and money to or from others', () => {
    expect(movedInside({
      ...sum, kind: 'transfer_received', effect: 'transfer', pairInView: false,
    })).toBe(false);
    expect(movedInside({
      ...sum, kind: 'transfer_received', effect: 'movement', pairInView: false,
    })).toBe(false);
  });
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

  it('lists the currencies in order, whichever moved first (review B17)', () => {
    const { summary } = flowsOf([
      aSum('deposit', 70, '2026-03', 'USD'),
      aSum('deposit', 1_000),
    ], MARCH);
    expect(summary.map(({ currency }) => currency)).toEqual(['BRL', 'USD']);
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

  it('shows no currency only a kind it doesn\'t know moved in', () => {
    expect(flowsOf([aSum('not_a_kind', 9, '2026-03', 'EUR')], MARCH))
      .toEqual({ summary: [], yearStrip: [] });
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

describe('openAtMonthEnd (F10, OQ-206)', () => {
  it('keeps an Account archived after the month\'s end, in the app\'s time zone', () => {
    expect(openAtMonthEnd(anAccount(), MARCH)).toBe(true);
    expect(openAtMonthEnd(anAccount({ archivedAt: new Date('2026-04-01T03:00:00Z') }), MARCH))
      .toBe(true);
    // 23:00 on March 31st in São Paulo.
    expect(openAtMonthEnd(anAccount({ archivedAt: new Date('2026-04-01T02:00:00Z') }), MARCH))
      .toBe(false);
  });
});

describe('budgetStatusOf', () => {
  it('reads that month\'s period, an earlier one\'s target with zero spend, or none', () => {
    const budget = aBudget();

    expect(budgetStatusOf(budget, aPeriod('groceries', MARCH, 60_000, 70_000), MARCH))
      .toEqual([expect.objectContaining({ targetAmount: 60_000, spendAmount: 70_000 })]);
    expect(budgetStatusOf(budget, aPeriod('groceries', { year: 2026, month: 1 }, 30_000, 9), MARCH))
      .toEqual([expect.objectContaining({ targetAmount: 30_000, spendAmount: 0 })]);
    expect(budgetStatusOf(budget, undefined, MARCH)).toEqual([]);
  });

  it('counts no spend from the same month a year earlier (review B17)', () => {
    const lastYear = aPeriod('groceries', { year: 2025, month: 3 }, 30_000, 9_000);
    expect(budgetStatusOf(aBudget(), lastYear, MARCH))
      .toEqual([expect.objectContaining({ targetAmount: 30_000, spendAmount: 0 })]);
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
      { ...aSum('deposit', 1_000), effect: 'movement', pairInView: false },
      // Between two of the viewer's Accounts: left out (OQ-222).
      { ...aSum('transfer_received', 400), effect: 'transfer', pairInView: true },
      { ...aSum('deposit', 99), effect: 'transfer', pairInView: true },
      { ...aSum('credit_card_bill_payment', 800), effect: 'bill_payment', pairInView: false },
      { ...aSum('investment_buy', 300), effect: 'investment_trade', pairInView: false },
      { ...aSum('investment_sell', 200), effect: 'investment_trade', pairInView: false },
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

  it('lists Accounts open at the month\'s end, each followed by its cards (F10, D16)', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([
      anAccount(),
      anAccount({ id: 'new', currency: 'USD' }),
      anAccount({ id: 'later', archivedAt: NOW }),
      anAccount({ id: 'gone', archivedAt: new Date('2026-03-15T12:00:00Z') }),
    ]);
    deps.listCreditCards.mockResolvedValue([
      aCard('visa', 'checking'),
      aCard('master', 'checking'),
      aCard('gone-card', 'gone'),
    ]);
    deps.accountBalancesAsOf.mockResolvedValue([
      {
        accountId: 'checking', ...MARCH, openingBalance: 0, endingBalance: 5_000, updatedAt: NOW,
      },
      {
        accountId: 'later', ...MARCH, openingBalance: 0, endingBalance: 700, updatedAt: NOW,
      },
    ]);
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
      {
        accountId: 'later', creditCardId: null, currency: 'BRL', amount: 700,
      },
    ]);
    expect(deps.accountBalancesAsOf).toHaveBeenCalledWith(['checking', 'new', 'later'], MARCH);
    expect(deps.cardBalancesAsOf).toHaveBeenCalledWith(['visa', 'master'], MARCH);
  });

  it('shows a card issued by the month\'s end with no charges as owing 0 (OQ-222)', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.listCreditCards.mockResolvedValue([
      // April in UTC, still 31 March in São Paulo: issued by the month's end.
      { ...aCard('visa', 'checking'), createdAt: new Date('2026-04-01T02:00:00Z') },
      // 1 April in São Paulo: not yet.
      { ...aCard('master', 'checking'), createdAt: new Date('2026-04-01T03:00:00Z') },
    ]);
    deps.accountBalancesAsOf.mockResolvedValue([{
      accountId: 'checking', ...MARCH, openingBalance: 0, endingBalance: 5_000, updatedAt: NOW,
    }]);
    deps.cardBalancesAsOf.mockResolvedValue([]);

    const { balances } = await monthOverview(deps, VIEWER, MARCH);

    expect(balances).toEqual([
      {
        accountId: 'checking', creditCardId: null, currency: 'BRL', amount: 5_000,
      },
      {
        accountId: 'checking', creditCardId: 'visa', currency: 'BRL', amount: 0,
      },
    ]);
  });

  it('leaves out an Account with no history by then, and its cards with it', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.listCreditCards.mockResolvedValue([
      { ...aCard('visa', 'checking'), createdAt: new Date('2026-01-01T12:00:00Z') },
    ]);
    deps.accountBalancesAsOf.mockResolvedValue([]);
    deps.cardBalancesAsOf.mockResolvedValue([{
      creditCardId: 'visa',
      ...MARCH,
      openingOutstandingBalance: 0,
      endingOutstandingBalance: 1_200,
      updatedAt: NOW,
    }]);

    const { balances } = await monthOverview(deps, VIEWER, MARCH);

    expect(balances).toEqual([]);
  });

  // With no period that month: the target in effect then and zero spend.
  it('shows the Budgets active that month, over-budget first (F9)', async () => {
    const deps = fakeDeps();
    deps.listBudgets.mockResolvedValue([
      aBudget({ id: 'fun', name: 'Fun' }),
      aBudget({ id: 'groceries', name: 'Groceries', visibility: 'personal' }),
      aBudget({ id: 'later', name: 'Later' }),
    ]);
    deps.budgetPeriodsAsOf.mockResolvedValue([
      aPeriod('groceries', MARCH, 60_000, 70_000),
      aPeriod('fun', { year: 2026, month: 1 }, 30_000, 99_000),
    ]);

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
    expect(deps.budgetPeriodsAsOf)
      .toHaveBeenCalledWith(HOUSEHOLD_ID, ['fun', 'groceries', 'later'], MARCH);
  });

  it('reads the active Goals\' progress at the month\'s end', async () => {
    const deps = fakeDeps();
    const trip = aGoal();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.listGoals.mockResolvedValue([trip]);

    const { goals } = await monthOverview(deps, VIEWER, { year: 2026, month: 2 });

    expect(goals).toEqual([{ goal: trip, fundedBy: [] }]);
    expect(deps.listGoals).toHaveBeenCalledWith(HOUSEHOLD_ID, 'ana', 'active');
    expect(deps.listAllocations).toHaveBeenCalledWith({ goalIds: ['trip'] }, '2026-02-28');
    expect(deps.latestSnapshots).toHaveBeenCalledWith([], '2026-02-28');
  });

  it('is empty for a new household', async () => {
    expect(await monthOverview(fakeDeps(), VIEWER, MARCH)).toEqual({
      summary: [], yearStrip: [], balances: [], budgets: [], goals: [],
    });
  });
});
