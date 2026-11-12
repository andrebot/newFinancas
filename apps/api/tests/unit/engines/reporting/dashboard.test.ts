import { describe, expect, it } from 'vitest';
import { dashboard } from '../../../../src/engines/reporting/dashboard';
import {
  aBudget, aHolding, anAccount, aPeriod, fakeDeps, HOUSEHOLD_ID, NOW, VIEWER,
} from './fakes';

// ReportingEngine's Dashboard (task 139, OQ-242, OQ-243), with only the
// Accessor reads beneath it faked (BDT).

const TODAY = '2026-10-13';
const OCTOBER = { year: 2026, month: 10 };

describe('dashboard (FR-6.0)', () => {
  it('gathers today\'s month: the overview\'s panels and the investment ones', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.accountBalancesAsOf.mockResolvedValue([{
      accountId: 'checking', ...OCTOBER, openingBalance: 0, endingBalance: 5_000, updatedAt: NOW,
    }]);
    deps.listBudgets.mockResolvedValue([
      aBudget({ id: 'fun', name: 'Fun' }),
      aBudget({ id: 'groceries', name: 'Groceries' }),
    ]);
    deps.budgetPeriodsAsOf.mockResolvedValue([
      aPeriod('fun', OCTOBER, 30_000, 10_000),
      aPeriod('groceries', OCTOBER, 60_000, 70_000),
    ]);
    deps.listHoldings.mockResolvedValue([aHolding({
      id: 'cdb', assetType: 'cdb', ticker: 'CDB Banco X', dueDate: '2027-03-15',
    })]);
    deps.costBasisAsOf.mockResolvedValue([{ holdingId: 'cdb', costBasis: 1_000 }]);

    const panels = await dashboard(deps, VIEWER, { today: TODAY, netWorthMonths: 1 });

    expect(panels).toEqual({
      month: '2026-10',
      netWorth: [{
        currency: 'BRL', amount: 1_000, series: [{ month: '2026-10', amount: 1_000 }],
      }],
      comingDue: [{
        holdingId: 'cdb',
        name: 'CDB Banco X',
        dueDate: '2027-03-15',
        currency: 'BRL',
        amount: 1_000,
      }],
      balances: [{
        accountId: 'checking', creditCardId: null, currency: 'BRL', amount: 5_000,
      }],
      budgets: [
        {
          budgetId: 'groceries',
          name: 'Groceries',
          currency: 'BRL',
          visibility: 'shared',
          targetAmount: 60_000,
          spendAmount: 70_000,
        },
        {
          budgetId: 'fun',
          name: 'Fun',
          currency: 'BRL',
          visibility: 'shared',
          targetAmount: 30_000,
          spendAmount: 10_000,
        },
      ],
      goals: [],
    });
    expect(deps.budgetPeriodsAsOf)
      .toHaveBeenCalledWith(HOUSEHOLD_ID, ['fun', 'groceries'], OCTOBER);
  });

  it('reads no payouts: the chart asks for its own (OQ-243)', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.listHoldings.mockResolvedValue([aHolding()]);

    await dashboard(deps, VIEWER, { today: TODAY, netWorthMonths: 6 });

    expect(deps.listPayouts).not.toHaveBeenCalled();
  });
});
