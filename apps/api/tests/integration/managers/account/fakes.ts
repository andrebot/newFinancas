import { vi } from 'vitest';
import type { AccountDeps } from '../../../../src/managers/account';
import type { InterestPayment } from '../../../../src/db/schema/values';

// The tier below AccountManager, mocked (BDT: Managers are tested at the seam,
// with their Accessors and Utilities mocked). Each test programs what it needs.

export const NOW = new Date('2026-10-13T12:00:00Z');
export const ANA_ID = '0199c5a0-0000-7000-8000-000000000001';
export const HOUSEHOLD_ID = '0199c5a0-0000-7000-8000-0000000000bb';
export const CORRELATION_ID = '0199c5a0-0000-7000-8000-0000000000cc';
export const ACTOR = { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' as const };
export const CONTEXT = { correlationId: CORRELATION_ID, actor: ACTOR };

export const SUBCATEGORY = {
  id: '0199c5a0-0000-7000-8000-0000000000c2',
  categoryId: '0199c5a0-0000-7000-8000-0000000000c1',
  name: 'Market',
  archivedAt: null,
  createdAt: NOW,
};

export const CATEGORY = {
  id: '0199c5a0-0000-7000-8000-0000000000c1',
  householdId: HOUSEHOLD_ID,
  name: 'Food',
  icon: 'restaurant' as const,
  color: 'coral' as const,
  archivedAt: null,
  createdAt: NOW,
  subcategories: [SUBCATEGORY],
};

export const BEA_ID = '0199c5a0-0000-7000-8000-000000000002';
/** Today in the app's time zone at NOW (OQ-104). */
export const TODAY = '2026-10-13';

export const ACCOUNT = {
  id: '0199c5a0-0000-7000-8000-0000000000a1',
  householdId: HOUSEHOLD_ID,
  ownerUserId: ANA_ID as string | null,
  name: 'Main',
  type: 'checking' as 'checking' | 'savings' | 'credit_card_only' | 'investment',
  currency: 'BRL',
  visibility: 'shared' as 'shared' | 'personal',
  startingBalanceDate: '2026-09-01',
  archivedAt: null as Date | null,
  createdAt: NOW,
};

export const CARD = {
  id: '0199c5a0-0000-7000-8000-0000000000d1',
  accountId: ACCOUNT.id,
  network: 'visa',
  last4: '4242',
  closingDay: 5,
  dueDay: 12,
  expirationMonth: 9,
  expirationYear: 2030,
  createdAt: NOW,
};

export const BUDGET = {
  id: '0199c5a0-0000-7000-8000-0000000000e1',
  householdId: HOUSEHOLD_ID,
  ownerUserId: ANA_ID as string | null,
  name: 'Groceries',
  targetAmount: 150000,
  currency: 'BRL',
  visibility: 'shared' as 'shared' | 'personal',
  targets: [{ categoryId: CATEGORY.id }] as readonly (
    { categoryId: string } | { subcategoryId: string })[],
  createdAt: NOW,
};

/** A Budget Period row as BudgetAccessor returns it (October 2026). */
export const PERIOD = {
  year: 2026, month: 10, targetAmount: 150000, spendAmount: 4200, createdAt: NOW,
};

export const GOAL = {
  id: '0199c5a0-0000-7000-8000-0000000000f1',
  householdId: HOUSEHOLD_ID,
  ownerUserId: ANA_ID as string | null,
  name: 'House',
  targetAmount: 15000000,
  targetCurrency: 'BRL',
  dueDate: '2030-12-31',
  visibility: 'shared' as 'shared' | 'personal',
  completedAt: null as Date | null,
  createdAt: NOW,
};

/** A market-priced Holding in ACCOUNT, as InvestmentHoldingAccessor returns it. */
export const HOLDING = {
  id: '0199c5a0-0000-7000-8000-0000000000b1',
  accountId: ACCOUNT.id,
  assetType: 'stock',
  ticker: 'PETR4' as string | null,
  quantity: 100,
  costBasis: 300000,
  rateType: null as string | null,
  rateValue: null as number | null,
  rateSpread: null as number | null,
  incentivised: null as boolean | null,
  interestPayment: null as InterestPayment | null,
  dueDate: null as string | null,
  archivedAt: null as Date | null,
  archivedBy: null as 'system' | 'user' | null,
  maturedNotifiedAt: null as Date | null,
  createdAt: NOW,
};

/** A manual market value of HOLDING. */
export const SNAPSHOT = {
  id: '0199c5a0-0000-7000-8000-0000000000b2',
  holdingId: HOLDING.id,
  valuation: 320000,
  asOfDate: '2026-10-01',
  source: 'manual' as 'manual' | 'transaction',
  accountTransactionId: null as string | null,
  createdAt: NOW,
};

/** A Selic value Ana recorded. */
export const RATE = {
  id: '0199c5a0-0000-7000-8000-0000000000b3',
  householdId: HOUSEHOLD_ID,
  indexCode: 'selic' as const,
  value: 105000,
  asOfDate: '2026-10-01',
  createdByUserId: ANA_ID as string | null,
  createdAt: NOW,
};

/** What BudgetAccessor answers a target set it refused or took. */
type TargetResult = { ok: true } | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'target_claimed'; target: object; claimedByBudgetId: string }
  | { ok: false; reason: 'target_not_found'; target: object };

/**
 * An Account balance row as AccountAccessor returns it (October 2026).
 *
 * @param accountId - The Account.
 * @param endingBalance - Its ending balance.
 * @returns The row.
 */
export const accountBalance = (accountId: string, endingBalance: number) => ({
  accountId, year: 2026, month: 10, openingBalance: 0, endingBalance, updatedAt: NOW,
});

/**
 * A card cycle row as CreditCardAccessor returns it (the cycle closing November 2026).
 *
 * @param creditCardId - The card.
 * @param endingOutstandingBalance - Its ending outstanding balance.
 * @returns The row.
 */
export const cardBalance = (creditCardId: string, endingOutstandingBalance: number) => ({
  creditCardId,
  year: 2026,
  month: 11,
  openingOutstandingBalance: 0,
  endingOutstandingBalance,
  updatedAt: NOW,
});

/** An Authorization outcome, as AuthorizationUtility returns it. */
type Outcome = { outcome: 'allowed'; role: string }
  | { outcome: 'not_member' | 'forbidden' | 'not_visible' };

/**
 * Builds mocked dependencies with sensible defaults: the actor is the
 * household's Owner, every Accessor call succeeds, the clock reads NOW.
 *
 * @returns The mocks, typed as AccountDeps for the Manager.
 */
export const fakeDeps = () => {
  const categories = {
    list: vi.fn(async () => [CATEGORY]),
    findById: vi.fn(async (): Promise<typeof CATEGORY | undefined> => CATEGORY),
    insert: vi.fn(async (): Promise<typeof CATEGORY | string> => CATEGORY),
    update: vi.fn(async (): Promise<typeof CATEGORY | string> => CATEGORY),
    archive: vi.fn(async () => true),
    archiveSubcategory: vi.fn(async () => true),
    seedDefaults: vi.fn(async () => true),
  };
  const accounts = {
    insert: vi.fn(async () => ACCOUNT),
    findById: vi.fn(async (): Promise<typeof ACCOUNT | undefined> => ACCOUNT),
    list: vi.fn(async () => [ACCOUNT]),
    hasAccountInUse: vi.fn(async () => true),
    update: vi.fn(async (): Promise<typeof ACCOUNT | undefined> => ACCOUNT),
    archive: vi.fn(async () => true),
    listBalances: vi.fn(async () => [accountBalance(ACCOUNT.id, 5000)]),
    balancesAsOf: vi.fn(async () => [accountBalance(ACCOUNT.id, 5000)]),
  };
  const creditCards = {
    insert: vi.fn(async () => CARD),
    findById: vi.fn(async (): Promise<typeof CARD | undefined> => CARD),
    listByAccounts: vi.fn(async () => [CARD]),
    update: vi.fn(async (): Promise<typeof CARD | undefined> => CARD),
    remove: vi.fn(async () => true),
    listBalances: vi.fn(async () => [cardBalance(CARD.id, 900)]),
    balancesAsOf: vi.fn(async () => [cardBalance(CARD.id, 900)]),
  };
  const budgets = {
    insert: vi.fn(async (): Promise<{ ok: true; budget: typeof BUDGET } | TargetResult> => (
      { ok: true, budget: BUDGET })),
    findById: vi.fn(async (): Promise<typeof BUDGET | undefined> => BUDGET),
    list: vi.fn(async () => [BUDGET]),
    update: vi.fn(async (): Promise<'updated' | 'not_found'> => 'updated'),
    replaceTargets: vi.fn(async (): Promise<TargetResult> => ({ ok: true })),
    delete: vi.fn(async () => true),
    listPeriods: vi.fn(async () => [PERIOD]),
    accrueIfClaimed: vi.fn(async () => 'accrued' as const),
    restateSpend: vi.fn(async (..._call: unknown[]) => undefined),
  };
  // The ledgers' sums a Budget's spend is restated from (OQ-166).
  const accountTransactions = {
    claimedSums: vi.fn(async (..._call: unknown[]): Promise<object[]> => []),
    // A Holding's trades, its values restated from (OQ-222): none unless a test says so.
    listTrades: vi.fn(async (..._call: unknown[]): Promise<object[]> => []),
  };
  const cardTransactions = {
    claimedSums: vi.fn(async (..._call: unknown[]): Promise<object[]> => []),
  };
  const goals = {
    insert: vi.fn(async () => GOAL),
    findById: vi.fn(async (): Promise<typeof GOAL | undefined> => GOAL),
    findByIds: vi.fn(async (): Promise<typeof GOAL[]> => [GOAL]),
    list: vi.fn(async () => [GOAL]),
    update: vi.fn(async (): Promise<typeof GOAL | undefined> => GOAL),
    complete: vi.fn(async () => true),
    reopen: vi.fn(async () => true),
    delete: vi.fn(async () => true),
    listAllocations: vi.fn(async (): Promise<object[]> => []),
    replaceAllocations: vi.fn(async (): Promise<object> => ({ ok: true })),
  };
  const holdings = {
    findById: vi.fn(async (): Promise<typeof HOLDING | undefined> => HOLDING),
    listSchedule: vi.fn(async (): Promise<object[]> => []),
    archive: vi.fn(async () => true),
    markMaturedNotified: vi.fn(async () => true),
  };
  const valuations = {
    list: vi.fn(async (): Promise<typeof SNAPSHOT[]> => [SNAPSHOT]),
    insertManual: vi.fn(async () => SNAPSHOT),
    updateManual: vi.fn(async (): Promise<typeof SNAPSHOT | string> => SNAPSHOT),
    deleteManual: vi.fn(async (): Promise<string> => 'deleted'),
  };
  const indexRates = {
    findById: vi.fn(async (): Promise<typeof RATE | undefined> => RATE),
    list: vi.fn(async (): Promise<typeof RATE[]> => [RATE]),
    insert: vi.fn(async (): Promise<typeof RATE | string> => RATE),
    update: vi.fn(async (): Promise<typeof RATE | string> => RATE),
    remove: vi.fn(async (): Promise<string> => 'deleted'),
  };
  const households = {
    listMembers: vi.fn(async (): Promise<{ userId: string }[]> => [{ userId: ANA_ID }]),
  };
  const notifications = { notify: vi.fn(async (..._call: unknown[]) => undefined) };
  const authorization = {
    authorize: vi.fn(async (): Promise<Outcome> => ({ outcome: 'allowed', role: 'Owner' })),
  };
  const stores = {
    categories, accounts, creditCards, budgets, goals, accountTransactions, cardTransactions,
  };
  // The work runs against the same mocks, so a test sees its writes; a throw
  // inside it is what the real unit of work would roll back.
  const inTransaction = vi.fn(async (work: (over: typeof stores) => Promise<unknown>) => (
    work(stores)
  ));
  const deps = {
    ...stores,
    holdings,
    valuations,
    indexRates,
    households,
    notifications,
    authorization,
    inTransaction,
    now: () => NOW,
  } as unknown as AccountDeps;
  return {
    deps,
    categories,
    accounts,
    creditCards,
    budgets,
    goals,
    accountTransactions,
    cardTransactions,
    holdings,
    valuations,
    indexRates,
    households,
    notifications,
    authorization,
    inTransaction,
  };
};
