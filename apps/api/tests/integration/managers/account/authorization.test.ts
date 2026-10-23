import { captureLogs } from '@financas/logging';
import type { Mock } from 'vitest';
import { describe, expect, it } from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import {
  ACCOUNT, ANA_ID, BEA_ID, BUDGET, CARD, CATEGORY, CONTEXT, fakeDeps, GOAL, HOLDING,
  HOUSEHOLD_ID, RATE, SNAPSHOT, SUBCATEGORY, TODAY,
} from './fakes';

// The seam between AccountManager and AuthorizationUtility, across every use
// case (I2): each asks for its own action on the facts of the data it acts on,
// and a refused caller stops the use case before anything but the reads that
// decide access — no write, no transaction, no notification, no log.

const NOT_FOUND = { status: 404, code: 'household.not_found' };
const FORBIDDEN = { status: 403, code: 'auth.forbidden' };

type Manager = ReturnType<typeof createAccountManager>;

/** A use case: its name, its access request, how to run it, and its own 404 if it loads data. */
type GuardedUseCase = [string, object, (manager: Manager) => Promise<unknown>, string | null];

/**
 * The access request for an action on data Bea keeps personal — what every
 * loaded Account, Budget and Goal is in this suite, so the request is seen to
 * carry the data's own facts, never the caller's.
 *
 * @param action - The data action.
 * @returns The request AuthorizationUtility receives.
 */
const beasPersonal = (action: string) => ({ action, visibility: 'personal', ownerUserId: BEA_ID });

/**
 * The access request for an action on shared data nobody owns: the household's
 * Categories, and the membership check of a list.
 *
 * @param action - The data action.
 * @returns The request AuthorizationUtility receives.
 */
const sharedData = (action: string) => ({ action, visibility: 'shared', ownerUserId: null });

/**
 * The access request for creating data, owned by its creator (the caller).
 *
 * @param visibility - The visibility the new data is given.
 * @returns The request AuthorizationUtility receives.
 */
const creating = (visibility: string) => ({
  action: 'data.create', visibility, ownerUserId: ANA_ID,
});

/**
 * The access request for an action on an index value Bea recorded (OQ-172).
 *
 * @param action - The data action.
 * @returns The request AuthorizationUtility receives.
 */
const beasRate = (action: string) => ({ action, visibility: 'shared', ownerUserId: BEA_ID });

const NEW_CATEGORY = { name: 'Pets', icon: 'pets' as const, color: 'sky' as const };
const NEW_ACCOUNT = {
  name: 'Main', type: 'checking' as const, currency: 'BRL', visibility: 'personal' as const,
};
const NEW_BUDGET = {
  name: 'Groceries',
  targetAmount: 150000,
  currency: 'BRL',
  visibility: 'shared' as const,
  targets: [{ categoryId: CATEGORY.id }],
};
const NEW_GOAL = {
  name: 'House',
  targetAmount: 15000000,
  targetCurrency: 'BRL',
  dueDate: '2030-12-31',
  visibility: 'personal' as const,
};
const VALUE = { value: 320000, asOf: TODAY };

const CATEGORIES: readonly GuardedUseCase[] = [
  ['listCategories', sharedData('data.view'),
    (manager) => manager.listCategories(CONTEXT, HOUSEHOLD_ID, {}), null],
  ['getCategory', sharedData('data.view'),
    (manager) => manager.getCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY.id), null],
  ['createCategory', sharedData('data.create'),
    (manager) => manager.createCategory(CONTEXT, HOUSEHOLD_ID, NEW_CATEGORY), null],
  ['editCategory', sharedData('data.edit'),
    (manager) => manager.editCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY.id, { name: 'Groceries' }),
    null],
  ['archiveCategory', sharedData('data.delete'),
    (manager) => manager.archiveCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY.id), null],
  ['archiveSubcategory', sharedData('data.delete'),
    (manager) => manager.archiveSubcategory(CONTEXT, HOUSEHOLD_ID, CATEGORY.id, SUBCATEGORY.id),
    null],
];

const ACCOUNTS: readonly GuardedUseCase[] = [
  ['listAccounts', sharedData('data.view'),
    (manager) => manager.listAccounts(CONTEXT, HOUSEHOLD_ID, {}), null],
  ['getAccountStatus', sharedData('data.view'),
    (manager) => manager.getAccountStatus(CONTEXT, HOUSEHOLD_ID), null],
  ['getAccount', beasPersonal('data.view'),
    (manager) => manager.getAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id), 'account.not_found'],
  ['createAccount', creating('personal'),
    (manager) => manager.createAccount(CONTEXT, HOUSEHOLD_ID, NEW_ACCOUNT), null],
  ['editAccount', beasPersonal('data.edit'),
    (manager) => manager.editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id, { name: 'Daily' }),
    'account.not_found'],
  ['archiveAccount', beasPersonal('data.delete'),
    (manager) => manager.archiveAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id), 'account.not_found'],
  ['getAccountBalances', beasPersonal('data.view'),
    (manager) => manager.getAccountBalances(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id, {}),
    'account.not_found'],
  ['getCreditCardBalances', beasPersonal('data.view'),
    (manager) => manager.getCreditCardBalances(CONTEXT, HOUSEHOLD_ID, CARD.id, {}),
    'credit_card.not_found'],
];

const BUDGETS: readonly GuardedUseCase[] = [
  ['listBudgets', sharedData('data.view'),
    (manager) => manager.listBudgets(CONTEXT, HOUSEHOLD_ID, {}), null],
  ['getBudget', beasPersonal('data.view'),
    (manager) => manager.getBudget(CONTEXT, HOUSEHOLD_ID, BUDGET.id), 'budget.not_found'],
  ['createBudget', creating('shared'),
    (manager) => manager.createBudget(CONTEXT, HOUSEHOLD_ID, NEW_BUDGET), null],
  ['editBudget', beasPersonal('data.edit'),
    (manager) => manager.editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET.id, { name: 'Food' }),
    'budget.not_found'],
  ['deleteBudget', beasPersonal('data.delete'),
    (manager) => manager.deleteBudget(CONTEXT, HOUSEHOLD_ID, BUDGET.id), 'budget.not_found'],
  ['listBudgetPeriods', beasPersonal('data.view'),
    (manager) => manager.listBudgetPeriods(CONTEXT, HOUSEHOLD_ID, BUDGET.id, {}),
    'budget.not_found'],
];

const GOALS: readonly GuardedUseCase[] = [
  ['listGoals', sharedData('data.view'),
    (manager) => manager.listGoals(CONTEXT, HOUSEHOLD_ID, 'active'), null],
  ['getGoal', beasPersonal('data.view'),
    (manager) => manager.getGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id), 'goal.not_found'],
  ['createGoal', creating('personal'),
    (manager) => manager.createGoal(CONTEXT, HOUSEHOLD_ID, NEW_GOAL), null],
  ['editGoal', beasPersonal('data.edit'),
    (manager) => manager.editGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id, { name: 'Flat' }),
    'goal.not_found'],
  ['completeGoal', beasPersonal('data.edit'),
    (manager) => manager.completeGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id), 'goal.not_found'],
  ['reopenGoal', beasPersonal('data.edit'),
    (manager) => manager.reopenGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id), 'goal.not_found'],
  ['deleteGoal', beasPersonal('data.delete'),
    (manager) => manager.deleteGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id), 'goal.not_found'],
];

// A Holding's access is decided on its Account (OQ-178).
const INVESTMENTS: readonly GuardedUseCase[] = [
  ['listHoldingAllocations', beasPersonal('data.view'),
    (manager) => manager.listHoldingAllocations(CONTEXT, HOUSEHOLD_ID, HOLDING.id),
    'holding.not_found'],
  ['editHolding', beasPersonal('data.edit'),
    (manager) => manager.editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING.id, []), 'holding.not_found'],
  ['archiveHolding', beasPersonal('data.delete'),
    (manager) => manager.archiveHolding(CONTEXT, HOUSEHOLD_ID, HOLDING.id), 'holding.not_found'],
  ['listScheduleEntries', beasPersonal('data.view'),
    (manager) => manager.listScheduleEntries(CONTEXT, HOUSEHOLD_ID, HOLDING.id),
    'holding.not_found'],
  ['listValuationSnapshots', beasPersonal('data.view'),
    (manager) => manager.listValuationSnapshots(CONTEXT, HOUSEHOLD_ID, HOLDING.id, {}),
    'holding.not_found'],
  ['recordMarketValue', beasPersonal('data.edit'),
    (manager) => manager.recordMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING.id, VALUE),
    'holding.not_found'],
  ['editMarketValue', beasPersonal('data.edit'),
    (manager) => manager.editMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING.id, SNAPSHOT.id, VALUE),
    'holding.not_found'],
  ['deleteMarketValue', beasPersonal('data.edit'),
    (manager) => manager.deleteMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING.id, SNAPSHOT.id),
    'holding.not_found'],
  ['listIndexRates', sharedData('data.view'),
    (manager) => manager.listIndexRates(CONTEXT, HOUSEHOLD_ID), null],
  ['recordIndexRate', creating('shared'),
    (manager) => manager.recordIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', VALUE), null],
  ['editIndexRate', beasRate('data.edit'),
    (manager) => manager.editIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE.id, VALUE),
    'index_rate.not_found'],
  ['deleteIndexRate', beasRate('data.delete'),
    (manager) => manager.deleteIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE.id),
    'index_rate.not_found'],
];

const GUARDED = [...CATEGORIES, ...ACCOUNTS, ...BUDGETS, ...GOALS, ...INVESTMENTS];

/** The use cases that load personal-or-shared data, the only ones `not_visible` can reach. */
const LOADING = GUARDED.filter(([, , , hidden]) => hidden !== null);

/**
 * Mocked dependencies whose Account, Budget, Goal and index value belong to
 * Bea, the Account and Budget and Goal kept personal.
 *
 * @returns The mocks from `fakeDeps`, reprogrammed.
 */
const beasData = () => {
  const fakes = fakeDeps();
  fakes.accounts.findById.mockResolvedValue({
    ...ACCOUNT, visibility: 'personal', ownerUserId: BEA_ID,
  });
  fakes.budgets.findById.mockResolvedValue({
    ...BUDGET, visibility: 'personal', ownerUserId: BEA_ID,
  });
  fakes.goals.findById.mockResolvedValue({ ...GOAL, visibility: 'personal', ownerUserId: BEA_ID });
  fakes.indexRates.findById.mockResolvedValue({ ...RATE, createdByUserId: BEA_ID });
  return fakes;
};

/**
 * Every mocked call made to the tier below other than the access check and
 * the `findById` reads it decides on — what a refused use case must not reach.
 *
 * @param fakes - The mocks from `fakeDeps`.
 * @returns The names of the mocks that were called.
 */
const touchedBeyondAccess = (fakes: ReturnType<typeof fakeDeps>): string[] => {
  const groups = {
    categories: fakes.categories,
    accounts: fakes.accounts,
    creditCards: fakes.creditCards,
    budgets: fakes.budgets,
    goals: fakes.goals,
    holdings: fakes.holdings,
    valuations: fakes.valuations,
    indexRates: fakes.indexRates,
    households: fakes.households,
    notifications: fakes.notifications,
    unitOfWork: { inTransaction: fakes.inTransaction },
  };
  return Object.entries(groups).flatMap(([group, mocks]) => Object.entries(mocks)
    .filter(([name, mock]) => name !== 'findById' && (mock as Mock).mock.calls.length > 0)
    .map(([name]) => `${group}.${name}`));
};

describe('AccountManager ↔ AuthorizationUtility seam (I2, OQ-111)', () => {
  it.each(GUARDED)('%s asks once for its own access', async (_name, request, run) => {
    const fakes = beasData();
    const logs = captureLogs();

    // What follows an allowed check is each use case's own suite's to assert.
    await run(createAccountManager(fakes.deps)).catch(() => undefined);
    logs.stop();

    expect(fakes.authorization.authorize).toHaveBeenCalledOnce();
    expect(fakes.authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, request);
  });

  describe.each([
    ['a non-member', 'not_member', GUARDED, () => NOT_FOUND],
    ['a member without the role', 'forbidden', GUARDED, () => FORBIDDEN],
    ['someone else\'s personal data', 'not_visible', LOADING,
      (hidden: string | null) => ({ status: 404, code: hidden })],
  ] as const)('refusing %s', (_who, outcome, useCases, answer) => {
    it.each(useCases)('%s answers before any write, logging nothing', async (
      _name,
      _request,
      run,
      hidden,
    ) => {
      const fakes = beasData();
      fakes.authorization.authorize.mockResolvedValueOnce({ outcome });
      const logs = captureLogs();

      await expect(run(createAccountManager(fakes.deps)))
        .rejects.toMatchObject({ apiError: answer(hidden) });
      logs.stop();

      expect(touchedBeyondAccess(fakes)).toEqual([]);
      expect(logs.events).toEqual([]);
    });
  });
});
