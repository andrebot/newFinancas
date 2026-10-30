import { vi } from 'vitest';
import type { Account } from '../../../../src/accessors/accountAccessor';
import type { AccountTransaction } from '../../../../src/accessors/accountTransactionAccessor';
import type { Goal, GoalStatus } from '../../../../src/accessors/goalAccessor';
import type { InvestmentHolding } from '../../../../src/accessors/investmentHoldingAccessor';
import type { ProjectResult } from '../../../../src/engines/investmentProduct';
import type { GoalWithProgress, MonthOverview } from '../../../../src/engines/reporting';
import type { InsightsDeps } from '../../../../src/managers/insights';
import type { Authorization } from '../../../../src/utilities/authorization';

// The tier below InsightsManager, mocked (BDT: Managers are tested at the seam,
// with their Engines and Accessors mocked). Each test programs what it needs;
// the defaults answer "everything succeeds" so a test only sets its own stakes.

export const NOW = new Date('2026-10-13T12:00:00Z');
export const ANA_ID = '0199c5a0-0000-7000-8000-000000000001';
export const HOUSEHOLD_ID = '0199c5a0-0000-7000-8000-0000000000bb';

/** A shared investment Account — the default target. */
export const ACCOUNT: Account = {
  id: '0199c5a0-0000-7000-8000-0000000000a1',
  householdId: HOUSEHOLD_ID,
  ownerUserId: null,
  name: 'Investments',
  type: 'investment',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-09-01',
  archivedAt: null,
  createdAt: NOW,
};

/** A shared Goal — the default one a progress read covers. */
export const GOAL: Goal = {
  id: '0199c5a0-0000-7000-8000-0000000000f1',
  householdId: HOUSEHOLD_ID,
  ownerUserId: null,
  name: 'House',
  targetAmount: 2000000,
  targetCurrency: 'BRL',
  dueDate: '2028-01-01',
  visibility: 'shared',
  completedAt: null,
  createdAt: NOW,
};

/** A fixed-term CDB with its terms — the default Holding. */
export const HOLDING: InvestmentHolding = {
  id: '0199c5a0-0000-7000-8000-0000000000b1',
  accountId: ACCOUNT.id,
  assetType: 'cdb',
  ticker: null,
  quantity: 1,
  costBasis: 1000000,
  rateType: 'fixed',
  rateValue: 105000,
  rateSpread: null,
  incentivised: null,
  interestPayment: 'at_maturity',
  dueDate: '2027-10-01',
  archivedAt: null,
  archivedBy: null,
  maturedNotifiedAt: null,
  createdAt: NOW,
};

/** A market-priced stock — no terms, no projection. */
export const STOCK: InvestmentHolding = {
  ...HOLDING,
  id: '0199c5a0-0000-7000-8000-0000000000b2',
  assetType: 'stock',
  ticker: 'PETR4',
  quantity: 10,
  costBasis: 320000,
  rateType: null,
  rateValue: null,
  interestPayment: null,
  dueDate: null,
};

/** The buy that opened the CDB — its date and amount are the contract's. */
export const BUY: AccountTransaction = {
  id: '0199c5a0-0000-7000-8000-0000000000e1',
  accountId: ACCOUNT.id,
  kind: 'investment_buy',
  effect: 'investment_trade',
  date: '2026-10-01',
  amount: 1000000,
  currency: 'BRL',
  categoryId: null,
  subcategoryId: null,
  description: null,
  holdingId: HOLDING.id,
  holding: { ticker: null, assetType: 'cdb' },
  trade: { quantityDelta: 1, costBasisDelta: 1000000 },
  creditCardId: null,
  transferId: null,
  pair: null,
  createdByUserId: ANA_ID,
  source: 'manual',
  createdAt: NOW,
};

/** The Month Overview the Engine answers with by default. */
export const OVERVIEW: MonthOverview = {
  summary: [], yearStrip: [], balances: [], budgets: [], goals: [],
};

/**
 * InsightsManager's tier below, mocked; `deps` is what createInsightsManager takes.
 *
 * @returns The deps and each mock, for a test to program and assert on.
 */
export const fakeDeps = () => {
  const reporting = {
    monthOverview: vi.fn(async (): Promise<MonthOverview> => OVERVIEW),
    goalProgress: vi.fn(
      async (_viewer: unknown, goals: readonly Goal[]): Promise<GoalWithProgress[]> => (
        goals.map((goal) => ({ goal, fundedBy: [] }))
      ),
    ),
    auditLogCsv: vi.fn(),
  };
  const investmentProducts = {
    project: vi.fn(async (): Promise<ProjectResult> => ({
      ok: true, expectedPayout: 1105000, expectedTaxes: { estimated: true, amount: 26112 },
    })),
  };
  const goals = {
    list: vi.fn(
      async (_householdId: string, _viewerUserId: string, _status: GoalStatus) => ([GOAL]),
    ),
    findById: vi.fn(async (): Promise<Goal | undefined> => GOAL),
  };
  const accounts = {
    findById: vi.fn(async (): Promise<Account | undefined> => ACCOUNT),
  };
  const holdings = {
    findById: vi.fn(async (): Promise<InvestmentHolding | undefined> => HOLDING),
    listByAccounts: vi.fn(async (): Promise<InvestmentHolding[]> => [HOLDING, STOCK]),
  };
  const accountTransactions = {
    findBuys: vi.fn(async (): Promise<AccountTransaction[]> => [BUY]),
  };
  const authorization = {
    authorize: vi.fn(
      async (): Promise<Authorization> => ({ outcome: 'allowed', role: 'Owner' }),
    ),
  };
  const deps = {
    reporting,
    investmentProducts,
    goals,
    accounts,
    holdings,
    accountTransactions,
    authorization,
    now: () => NOW,
  } as unknown as InsightsDeps;
  return {
    deps,
    reporting,
    investmentProducts,
    goals,
    accounts,
    holdings,
    accountTransactions,
    authorization,
  };
};
