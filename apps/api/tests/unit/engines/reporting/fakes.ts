import { vi } from 'vitest';
import type { Account } from '../../../../src/accessors/accountAccessor';
import type { Budget, BudgetPeriodOf } from '../../../../src/accessors/budgetAccessor';
import type { CreditCard } from '../../../../src/accessors/creditCardAccessor';
import type { Goal, GoalAllocation } from '../../../../src/accessors/goalAccessor';
import type { PricedHolding } from '../../../../src/accessors/investmentHoldingAccessor';
import type { ReportingEngineDeps } from '../../../../src/engines/reporting';

// The tier below ReportingEngine — its Accessor reads — faked (BDT: an Engine
// is unit-tested with only the Resource Accessors beneath it mocked). Every
// read answers nothing until a test programs it.

export const NOW = new Date('2026-10-13T12:00:00Z');
export const HOUSEHOLD_ID = 'h1';
export const ANA_ID = 'ana';
export const VIEWER = { householdId: HOUSEHOLD_ID, viewerUserId: ANA_ID };

/**
 * Builds an Account (a shared BRL checking Account by default).
 *
 * @param overrides - The fields to change.
 * @returns The Account.
 */
export const anAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'checking',
  householdId: HOUSEHOLD_ID,
  ownerUserId: ANA_ID,
  name: 'Checking',
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-01-01',
  archivedAt: null,
  createdAt: NOW,
  ...overrides,
});

/**
 * Builds a credit card of an Account.
 *
 * @param id - The card id.
 * @param accountId - Its Account.
 * @returns The card.
 */
export const aCard = (id: string, accountId: string): CreditCard => ({
  id,
  accountId,
  network: 'visa',
  last4: '1234',
  closingDay: 5,
  dueDay: 15,
  expirationMonth: 1,
  expirationYear: 2030,
  createdAt: NOW,
});

/**
 * Builds a Budget (a shared BRL one by default).
 *
 * @param overrides - The fields to change.
 * @returns The Budget.
 */
export const aBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'groceries',
  householdId: HOUSEHOLD_ID,
  visibility: 'shared',
  ownerUserId: ANA_ID,
  name: 'Groceries',
  targetAmount: 100_000,
  currency: 'BRL',
  targets: [],
  createdAt: NOW,
  ...overrides,
});

/**
 * Builds a Budget's period.
 *
 * @param budgetId - The Budget.
 * @param month - `{ year, month }`.
 * @param month.year - The year.
 * @param month.month - The month.
 * @param targetAmount - The target in effect.
 * @param spendAmount - The spend accrued.
 * @returns The period.
 */
export const aPeriod = (
  budgetId: string,
  month: { year: number; month: number },
  targetAmount: number,
  spendAmount: number,
): BudgetPeriodOf => ({
  budgetId, ...month, targetAmount, spendAmount, createdAt: NOW,
});

/**
 * Builds a Goal (a shared BRL one by default).
 *
 * @param overrides - The fields to change.
 * @returns The Goal.
 */
export const aGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'trip',
  householdId: HOUSEHOLD_ID,
  ownerUserId: ANA_ID,
  name: 'Trip',
  targetAmount: 1_000_000,
  targetCurrency: 'BRL',
  dueDate: '2027-06-30',
  visibility: 'shared',
  completedAt: null,
  createdAt: NOW,
  ...overrides,
});

/**
 * Builds a Goal allocation.
 *
 * @param goalId - The Goal.
 * @param holdingId - The Holding funding it.
 * @param percentage - Whole percent.
 * @returns The allocation.
 */
export const anAllocation = (
  goalId: string,
  holdingId: string,
  percentage: number,
): GoalAllocation => ({
  id: `${goalId}-${holdingId}`,
  goalId,
  holdingId,
  percentage,
  validFrom: '2026-01-01',
  createdAt: NOW,
});

/**
 * Builds a Holding with its currency (a PETR4 stock in `checking` by default).
 *
 * @param overrides - The fields to change.
 * @returns The Holding.
 */
export const aHolding = (overrides: Partial<PricedHolding> = {}): PricedHolding => ({
  id: 'petr4',
  accountId: 'checking',
  assetType: 'stock',
  ticker: 'PETR4',
  quantity: 100_000_000,
  costBasis: 0,
  rateType: null,
  rateValue: null,
  rateSpread: null,
  incentivised: null,
  interestPayment: null,
  dueDate: null,
  archivedAt: null,
  archivedBy: null,
  maturedNotifiedAt: null,
  createdAt: NOW,
  currency: 'BRL',
  ...overrides,
});

/**
 * Fakes every read the Engine makes, each answering nothing.
 *
 * @returns The fakes, for tests to program and inspect.
 */
export const fakeDeps = () => ({
  listAccounts: vi.fn<ReportingEngineDeps['listAccounts']>(async () => []),
  accountBalancesAsOf: vi.fn<ReportingEngineDeps['accountBalancesAsOf']>(async () => []),
  listCreditCards: vi.fn<ReportingEngineDeps['listCreditCards']>(async () => []),
  cardBalancesAsOf: vi.fn<ReportingEngineDeps['cardBalancesAsOf']>(async () => []),
  accountMonthlySums: vi.fn<ReportingEngineDeps['accountMonthlySums']>(async () => []),
  cardMonthlySums: vi.fn<ReportingEngineDeps['cardMonthlySums']>(async () => []),
  listBudgets: vi.fn<ReportingEngineDeps['listBudgets']>(async () => []),
  budgetPeriodsAsOf: vi.fn<ReportingEngineDeps['budgetPeriodsAsOf']>(async () => []),
  listGoals: vi.fn<ReportingEngineDeps['listGoals']>(async () => []),
  listAllocations: vi.fn<ReportingEngineDeps['listAllocations']>(async () => []),
  findHoldings: vi.fn<ReportingEngineDeps['findHoldings']>(async () => []),
  latestSnapshots: vi.fn<ReportingEngineDeps['latestSnapshots']>(async () => []),
  costBasisAsOf: vi.fn<ReportingEngineDeps['costBasisAsOf']>(async () => []),
});

/**
 * A snapshot of a Holding's value on a date.
 *
 * @param holdingId - The Holding.
 * @param valuation - Its value, minor units.
 * @returns The snapshot as `latestAsOf` answers it.
 */
export const aSnapshot = (holdingId: string, valuation: number) => ({
  id: `${holdingId}-snapshot`,
  holdingId,
  valuation,
  asOfDate: '2026-01-31',
  source: 'manual' as const,
  accountTransactionId: null,
  createdAt: NOW,
});
