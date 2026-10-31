import { vi } from 'vitest';
import type {
  AccountTransaction, DayKindTotal,
  MonthCount,
} from '../../../../src/accessors/accountTransactionAccessor';
import type { ValuationSnapshot } from '../../../../src/accessors/valuationSnapshotAccessor';
import type { CardTransaction } from '../../../../src/accessors/cardTransactionAccessor';
import type { Account } from '../../../../src/accessors/accountAccessor';
import type { CreditCard } from '../../../../src/accessors/creditCardAccessor';
import type {
  InvestmentHolding, ApplyScheduleResult,
  UpdateHoldingTermsResult,
} from '../../../../src/accessors/investmentHoldingAccessor';
import type {
  Goal, GoalAllocation,
  ReplaceAllocationsResult,
} from '../../../../src/accessors/goalAccessor';
import type { InterestPayment } from '../../../../src/db/schema/values';
import type { ScheduleResult, ContractTerms } from '../../../../src/engines/investmentProduct';
import type { BudgetAccrual } from '../../../../src/managers/transaction/effects';
import type { TransactionDeps } from '../../../../src/managers/transaction';
import type { Authorization } from '../../../../src/utilities/authorization';

// The tier below TransactionManager, mocked (BDT: Managers are tested at the seam,
// with their Accessors and Utilities mocked). Each test programs what it needs;
// the defaults answer "everything succeeds" so a test only sets its own stakes.

export const NOW = new Date('2026-10-13T12:00:00Z');
export const ANA_ID = '0199c5a0-0000-7000-8000-000000000001';
export const HOUSEHOLD_ID = '0199c5a0-0000-7000-8000-0000000000bb';

/** A shared investment Account — the default target. */
export const ACCOUNT = {
  id: '0199c5a0-0000-7000-8000-0000000000a1',
  householdId: HOUSEHOLD_ID,
  ownerUserId: null as string | null,
  name: 'Investments',
  type: 'investment' as const,
  currency: 'BRL',
  visibility: 'shared' as const,
  startingBalanceDate: '2026-09-01',
  archivedAt: null as Date | null,
  createdAt: NOW,
};

/** A shared checking Account — the card's home. */
export const CHECKING = {
  ...ACCOUNT, id: '0199c5a0-0000-7000-8000-0000000000a2', name: 'Nubank', type: 'checking' as const,
};

/** The card on the checking Account. */
export const CARD = {
  id: '0199c5a0-0000-7000-8000-0000000000c1',
  accountId: CHECKING.id,
  network: 'visa',
  last4: '1234',
  closingDay: 15,
  dueDay: 10,
  expirationMonth: 12,
  expirationYear: 2030,
  createdAt: NOW,
} as CreditCard;

/** A market-priced Holding with a position — the default trade target. */
export const MARKET_HOLDING: InvestmentHolding = {
  id: '0199c5a0-0000-7000-8000-0000000000h1',
  accountId: ACCOUNT.id,
  assetType: 'stock' as const,
  ticker: 'PETR4',
  quantity: 10,
  costBasis: 10_000,
  rateType: null as string | null,
  rateValue: null as number | null,
  rateSpread: null as number | null,
  dueDate: null as string | null,
  interestPayment: null as InterestPayment | null,
  incentivised: null as boolean | null,
  archivedAt: null as Date | null,
  archivedBy: null as 'user' | 'system' | null,
  maturedNotifiedAt: null as Date | null,
  createdAt: NOW,
};

/** A fixed-term Holding — the default for term tests. */
export const FIXED_HOLDING: InvestmentHolding = {
  ...MARKET_HOLDING,
  id: '0199c5a0-0000-7000-8000-0000000000h2',
  assetType: 'cdb',
  ticker: 'CDB1',
  quantity: 1,
  costBasis: 50_000,
  rateType: 'ipca',
  rateValue: 2.5,
  dueDate: '2026-12-01',
  interestPayment: 'semiannual',
};

/** A cash row on the Account ledger — the default for edit/delete tests. */
export const ROW: AccountTransaction = {
  id: '0199c5a0-0000-7000-8000-0000000000t1',
  accountId: ACCOUNT.id,
  kind: 'withdrawal',
  effect: 'movement',
  date: '2026-10-13',
  amount: 5_000,
  currency: 'BRL',
  categoryId: null,
  subcategoryId: null,
  description: null,
  holdingId: null,
  holding: null,
  trade: null,
  creditCardId: null,
  transferId: null,
  pair: null,
  source: 'manual',
  createdByUserId: ANA_ID,
  createdAt: NOW,
};

/** A charge on the card ledger. */
export const CARD_ROW: CardTransaction = {
  id: '0199c5a0-0000-7000-8000-0000000000t2',
  creditCardId: CARD.id,
  kind: 'charge',
  date: '2026-10-13',
  amount: 5_000,
  currency: 'BRL',
  categoryId: null,
  subcategoryId: null,
  description: null,
  createdByUserId: ANA_ID,
  createdAt: NOW,
};

/** A buy into the market-priced Holding — the default trade row. */
export const BUY_ROW: AccountTransaction = {
  ...ROW,
  id: '0199c5a0-0000-7000-8000-0000000000t3',
  kind: 'investment_buy',
  effect: 'investment_trade',
  amount: 2_000,
  holdingId: MARKET_HOLDING.id,
  holding: { ticker: 'PETR4', assetType: 'stock' },
  trade: { quantityDelta: 2, costBasisDelta: 2_000 },
};

/** A sell out of the market-priced Holding. */
export const SELL_ROW: AccountTransaction = {
  ...ROW,
  id: '0199c5a0-0000-7000-8000-0000000000t4',
  kind: 'investment_sell',
  effect: 'investment_trade',
  amount: 3_000,
  holdingId: MARKET_HOLDING.id,
  holding: { ticker: 'PETR4', assetType: 'stock' },
  trade: { quantityDelta: -3, costBasisDelta: -1_500 },
};

/**
 * A trade in a Holding's history (OQ-222).
 *
 * @param id - The transaction.
 * @param kind - Buy, sell or redemption.
 * @param amount - Its money.
 * @param quantityDelta - Its signed units.
 * @param date - Its date.
 * @returns The row as `listTrades` reads it.
 */
export const tradeOf = (
  id: string,
  kind: string,
  amount: number,
  quantityDelta: number,
  date: string,
): AccountTransaction => ({
  ...ROW,
  id,
  kind,
  effect: 'investment_trade',
  amount,
  date,
  holdingId: MARKET_HOLDING.id,
  trade: { quantityDelta, costBasisDelta: amount },
});

/**
 * A snapshot in a Holding's history: a trade's, or a market value typed in.
 *
 * @param valuation - The value stored.
 * @param asOfDate - Its date.
 * @param accountTransactionId - Its trade; none for a typed value.
 * @returns The snapshot as `list` reads it.
 */
export const snapshotOf = (
  valuation: number,
  asOfDate: string,
  accountTransactionId: string | null = null,
): ValuationSnapshot => ({
  id: `snap-${accountTransactionId ?? asOfDate}`,
  holdingId: MARKET_HOLDING.id,
  valuation,
  asOfDate,
  source: accountTransactionId === null ? 'manual' : 'transaction',
  accountTransactionId,
  createdAt: NOW,
});

/** The Category the tests name, with two Subcategories (review B7). */
export const CATEGORY = {
  id: 'c1',
  archivedAt: null as Date | null,
  subcategories: [{ id: 's1' }, { id: 's2' }],
};

/** A Goal the split tests name — shared by default. */
export const GOAL: Goal = {
  id: '0199c5a0-0000-7000-8000-0000000000g1',
  householdId: HOUSEHOLD_ID,
  ownerUserId: null as string | null,
  name: 'Car',
  targetAmount: 100_000,
  targetCurrency: 'BRL',
  dueDate: '2027-06-30',
  visibility: 'shared' as const,
  completedAt: null as Date | null,
  createdAt: NOW,
};

export const fakeDeps = () => {
  const accounts = {
    findById: vi.fn(async (..._call: string[]): Promise<Account | undefined> => ACCOUNT),
    list: vi.fn(async (): Promise<Account[]> => [ACCOUNT]),
    applyMovement: vi.fn(async () => ({ ok: true })),
  };
  const accountTransactions = {
    insert: vi.fn(
      async (row: unknown): Promise<{ ok: boolean; transaction: AccountTransaction }> => ({
        ok: true,
        transaction: { ...ROW, ...(row as object) },
      }),
    ),
    findById: vi.fn(async (..._call: string[]): Promise<AccountTransaction | undefined> => ROW),
    update: vi.fn(
      async (
        _id: string,
        _expected: unknown,
        changes: Record<string, unknown>,
      ): Promise<
        | { status: 'updated'; transaction: AccountTransaction }
        | { status: 'stale' }
      > => ({
        status: 'updated',
        transaction: { ...ROW, ...changes },
      }),
    ),
    // Both sides of a transfer between own accounts, linked (OQ-222).
    insertTransfer: vi.fn(async (
      transfer: { sent: object; received: object },
    ): Promise<
      | { ok: true; sent: AccountTransaction; received: AccountTransaction }
      | { ok: false; reason: string }
    > => ({
      ok: true,
      sent: { ...ROW, ...transfer.sent },
      received: { ...ROW, id: 'received', ...transfer.received },
    })),
    delete: vi.fn(async (): Promise<'deleted' | 'stale'> => 'deleted'),
    list: vi.fn(async (): Promise<AccountTransaction[]> => []),
    listTrades: vi.fn(async (..._call: unknown[]): Promise<AccountTransaction[]> => []),
    dayTotals: vi.fn(async (): Promise<DayKindTotal[]> => []),
    monthCounts: vi.fn(async (): Promise<MonthCount[]> => []),
    countForHolding: vi.fn(async () => 0),
  };
  const cardTransactions = {
    insert: vi.fn(
      async (row: unknown): Promise<{ ok: boolean; transaction: CardTransaction }> => ({
        ok: true,
        transaction: { ...CARD_ROW, ...(row as object) },
      }),
    ),
    findById: vi.fn(async (): Promise<CardTransaction | undefined> => CARD_ROW),
    update: vi.fn(
      async (
        _id: string,
        _expected: unknown,
        changes: Record<string, unknown>,
      ): Promise<
        | { status: 'updated'; transaction: CardTransaction }
        | { status: 'stale' }
      > => ({
        status: 'updated',
        transaction: { ...CARD_ROW, ...changes },
      }),
    ),
    delete: vi.fn(async (): Promise<'deleted' | 'stale'> => 'deleted'),
    list: vi.fn(async (): Promise<CardTransaction[]> => []),
    dayTotals: vi.fn(async (): Promise<DayKindTotal[]> => []),
    monthCounts: vi.fn(async (): Promise<MonthCount[]> => []),
  };
  const creditCards = {
    findById: vi.fn(async (): Promise<typeof CARD | undefined> => CARD),
    listByAccounts: vi.fn(async (): Promise<typeof CARD[]> => [CARD]),
    applyMovement: vi.fn(async () => ({ ok: true })),
  };
  // Finders answer only the ids a test set up — an id the Manager made up, or
  // none at all, finds nothing (review B7).
  const categories = {
    findById: vi.fn(async (_householdId: string, id: string): Promise<unknown> => (
      id === CATEGORY.id ? CATEGORY : undefined
    )),
  };
  const budgets = {
    accrueIfClaimed: vi.fn(
      async (_accrual?: BudgetAccrual | null): Promise<'untracked'> => 'untracked',
    ),

  };
  const goals = {
    findByIds: vi.fn(async (_householdId: string, ids: readonly string[]): Promise<Goal[]> => (
      ids.map((id) => ({ ...GOAL, id }))
    )),
    listAllocations: vi.fn(async (): Promise<GoalAllocation[]> => []),
    replaceAllocations: vi.fn(async (): Promise<ReplaceAllocationsResult> => ({ ok: true })),
    deleteFrom: vi.fn(async () => true),
    reopenClosedAt: vi.fn(async () => true),
  };
  const holdings = {
    findById: vi.fn(async (_householdId: string, id: string): Promise<
      InvestmentHolding | undefined
    > => [MARKET_HOLDING, FIXED_HOLDING].find((holding) => holding.id === id)),
    findByTicker: vi.fn(async (): Promise<InvestmentHolding | undefined> => MARKET_HOLDING),
    insert: vi.fn(
      async (row: unknown): Promise<{ ok: boolean; holding: typeof MARKET_HOLDING }> => ({
        ok: true,
        holding: { ...MARKET_HOLDING, ...(row as object) },
      }),
    ),
    applyTrade: vi.fn(
      async (): Promise<
        | { ok: true; quantity: number; costBasis: number }
        | { ok: false; reason: string }
      > => ({
        ok: true,
        quantity: 12,
        costBasis: 12_000,
      }),
    ),
    archive: vi.fn(async () => true),
    unarchiveIfSystemArchived: vi.fn(async () => true),
    listSchedule: vi.fn(async (): Promise<{ postedAt: Date | null }[]> => []),
    markEntryPosted: vi.fn(async () => true),
    delete: vi.fn(async () => true),
    updateTerms: vi.fn(async (): Promise<UpdateHoldingTermsResult> => ({ status: 'updated' })),
    applySchedule: vi.fn(async (): Promise<ApplyScheduleResult> => ({ ok: true })),
  };
  const valuations = {
    insertAutomatic: vi.fn(async () => ({})),
    updateAutomatic: vi.fn(async () => ({})),
    // The Holding's value before a trade: R$ 100,00 unless a test says otherwise (PR #145).
    latestAsOf: vi.fn(async (..._call: unknown[]): Promise<{ valuation: number }[]> => [
      { valuation: 10_000 },
    ]),
    // Its history, which the values are restated from (OQ-222): none unless a test says so.
    list: vi.fn(async (..._call: unknown[]): Promise<ValuationSnapshot[]> => []),
  };
  const stores = {
    accounts,
    accountTransactions,
    cardTransactions,
    creditCards,
    categories,
    budgets,
    goals,
    holdings,
    valuations,
  };
  // The work runs against the same mocks, so a test sees its writes; a throw
  // inside it is what the real unit of work would roll back.
  const inTransaction = vi.fn(
    async (work: (over: typeof stores) => Promise<unknown>) => work(stores),
  );
  const investmentProducts = {
    schedule: vi.fn(async (
      _householdId: string,
      _terms: ContractTerms,
    ): Promise<ScheduleResult> => ({
      ok: true,

      entries: [],
    })),
  };
  const authorization = {
    authorize: vi.fn(
      async (): Promise<Authorization> => ({ outcome: 'allowed', role: 'Owner' }),
    ),
  };
  const deps = {
    ...stores, investmentProducts, authorization, inTransaction, now: () => NOW,
  } as unknown as TransactionDeps;
  return {
    deps,
    accounts,
    accountTransactions,
    cardTransactions,
    creditCards,
    categories,
    budgets,
    goals,
    holdings,
    valuations,
    investmentProducts,
    authorization,
    inTransaction,
  };
};
