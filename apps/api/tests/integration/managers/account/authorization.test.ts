import { describe, expect, it } from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import {
  ACCOUNT, ANA_ID, BEA_ID, BUDGET, CARD, CATEGORY, CONTEXT, fakeDeps, GOAL, HOLDING,
  HOUSEHOLD_ID, RATE, SNAPSHOT, SUBCATEGORY, TODAY,
} from './fakes';
import {
  answerNothing, refusedLogging, runPastAccess, touchedBeyondAccess, type MockGroups,
} from '../seam';

// The seam between AccountManager and AuthorizationUtility, across every use
// case (I2): each asks for its own action on the facts of the data it acts on,
// and a refused caller stops the use case before anything but the reads that
// decide access — no write, no transaction, no notification, no log.

const NOT_FOUND = { code: 'household.not_found' };
const FORBIDDEN = { code: 'auth.forbidden' };

/** What AccountManager returns besides its use cases: the bus handlers (`events.ts`). */
const EVENT_HANDLERS = ['seedDefaultCategories', 'notifyMaturedHolding'];

type Manager = ReturnType<typeof createAccountManager>;
type Visibility = 'personal' | 'shared';
type Fakes = ReturnType<typeof fakeDeps>;

/** A use case as the matrix runs it. */
interface GuardedUseCase {
  readonly name: string;
  /** The access it asks for, given the visibility of the data it loads. */
  readonly request: (visibility: Visibility) => object;
  readonly run: (manager: Manager) => Promise<unknown>;
  /** The reads that decide its access — all a refused run may make. */
  readonly reads: readonly string[];
  /** Its own 404 for data the caller may not see; none when it loads no such data. */
  readonly hidden: string | null;
}

/**
 * The access request for an action on data Bea owns — every loaded Account,
 * Budget and Goal in this suite, so the request is seen to carry the data's
 * own owner and visibility, never the caller's.
 *
 * @param action - The data action.
 * @returns The request for the data's visibility.
 */
const beas = (action: string) => (visibility: Visibility) => ({
  action, visibility, ownerUserId: BEA_ID,
});

/**
 * The access request for an action on shared data nobody owns: the household's
 * Categories, and the membership check of a list or of data that isn't there.
 *
 * @param action - The data action.
 * @returns The request, whatever the visibility.
 */
const sharedData = (action: string) => () => ({ action, visibility: 'shared', ownerUserId: null });

/**
 * The access request for creating data, owned by its creator (the caller).
 *
 * @param visibility - The visibility the new data is given.
 * @returns The request, whatever the visibility of loaded data.
 */
const creating = (visibility: Visibility) => () => ({
  action: 'data.create', visibility, ownerUserId: ANA_ID,
});

/**
 * The access request for an action on an index value Bea recorded (OQ-172).
 *
 * @param action - The data action.
 * @returns The request, whatever the visibility.
 */
const beasRate = (action: string) => () => ({ action, visibility: 'shared', ownerUserId: BEA_ID });

/** What each kind of use case reads to decide access (a Holding and a card on their Account). */
const READS = {
  none: [],
  account: ['accounts.findById'],
  card: ['creditCards.findById', 'accounts.findById'],
  budget: ['budgets.findById'],
  goal: ['goals.findById'],
  holding: ['holdings.findById', 'accounts.findById'],
  rate: ['indexRates.findById'],
};

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

/** A row as written: name, access request, access reads, own 404, run. */
type Row = [
  GuardedUseCase['name'],
  GuardedUseCase['request'],
  GuardedUseCase['reads'],
  GuardedUseCase['hidden'],
  GuardedUseCase['run'],
];

/**
 * Names a row's fields.
 *
 * @param row - The row as written.
 * @returns The use case.
 */
const useCaseOf = ([name, request, reads, hidden, run]: Row): GuardedUseCase => ({
  name, request, reads, hidden, run,
});

const CATEGORIES: readonly Row[] = [
  ['listCategories', sharedData('data.view'), READS.none, null,
    (manager) => manager.listCategories(CONTEXT, HOUSEHOLD_ID, {})],
  ['getCategory', sharedData('data.view'), READS.none, null,
    (manager) => manager.getCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY.id)],
  ['createCategory', sharedData('data.create'), READS.none, null,
    (manager) => manager.createCategory(CONTEXT, HOUSEHOLD_ID, NEW_CATEGORY)],
  ['editCategory', sharedData('data.edit'), READS.none, null,
    (manager) => manager.editCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY.id, { name: 'Food' })],
  ['archiveCategory', sharedData('data.delete'), READS.none, null,
    (manager) => manager.archiveCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY.id)],
  ['archiveSubcategory', sharedData('data.delete'), READS.none, null,
    (manager) => manager.archiveSubcategory(CONTEXT, HOUSEHOLD_ID, CATEGORY.id, SUBCATEGORY.id)],
];

const ACCOUNTS: readonly Row[] = [
  ['listAccounts', sharedData('data.view'), READS.none, null,
    (manager) => manager.listAccounts(CONTEXT, HOUSEHOLD_ID, {})],
  ['getAccountStatus', sharedData('data.view'), READS.none, null,
    (manager) => manager.getAccountStatus(CONTEXT, HOUSEHOLD_ID)],
  ['getAccount', beas('data.view'), READS.account, 'account.not_found',
    (manager) => manager.getAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id)],
  ['createAccount', creating('personal'), READS.none, null,
    (manager) => manager.createAccount(CONTEXT, HOUSEHOLD_ID, NEW_ACCOUNT)],
  ['editAccount', beas('data.edit'), READS.account, 'account.not_found',
    (manager) => manager.editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id, { name: 'Daily' })],
  ['archiveAccount', beas('data.delete'), READS.account, 'account.not_found',
    (manager) => manager.archiveAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id)],
  ['getAccountBalances', beas('data.view'), READS.account, 'account.not_found',
    (manager) => manager.getAccountBalances(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id, {})],
  ['getCreditCardBalances', beas('data.view'), READS.card, 'credit_card.not_found',
    (manager) => manager.getCreditCardBalances(CONTEXT, HOUSEHOLD_ID, CARD.id, {})],
];

const BUDGETS: readonly Row[] = [
  ['listBudgets', sharedData('data.view'), READS.none, null,
    (manager) => manager.listBudgets(CONTEXT, HOUSEHOLD_ID, {})],
  ['getBudget', beas('data.view'), READS.budget, 'budget.not_found',
    (manager) => manager.getBudget(CONTEXT, HOUSEHOLD_ID, BUDGET.id)],
  ['createBudget', creating('shared'), READS.none, null,
    (manager) => manager.createBudget(CONTEXT, HOUSEHOLD_ID, NEW_BUDGET)],
  ['editBudget', beas('data.edit'), READS.budget, 'budget.not_found',
    (manager) => manager.editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET.id, { name: 'Food' })],
  ['deleteBudget', beas('data.delete'), READS.budget, 'budget.not_found',
    (manager) => manager.deleteBudget(CONTEXT, HOUSEHOLD_ID, BUDGET.id)],
  ['listBudgetPeriods', beas('data.view'), READS.budget, 'budget.not_found',
    (manager) => manager.listBudgetPeriods(CONTEXT, HOUSEHOLD_ID, BUDGET.id, {})],
];

const GOALS: readonly Row[] = [
  ['listGoals', sharedData('data.view'), READS.none, null,
    (manager) => manager.listGoals(CONTEXT, HOUSEHOLD_ID, 'active')],
  ['getGoal', beas('data.view'), READS.goal, 'goal.not_found',
    (manager) => manager.getGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id)],
  ['createGoal', creating('personal'), READS.none, null,
    (manager) => manager.createGoal(CONTEXT, HOUSEHOLD_ID, NEW_GOAL)],
  ['editGoal', beas('data.edit'), READS.goal, 'goal.not_found',
    (manager) => manager.editGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id, { name: 'Flat' })],
  ['completeGoal', beas('data.edit'), READS.goal, 'goal.not_found',
    (manager) => manager.completeGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id)],
  ['reopenGoal', beas('data.edit'), READS.goal, 'goal.not_found',
    (manager) => manager.reopenGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id)],
  ['deleteGoal', beas('data.delete'), READS.goal, 'goal.not_found',
    (manager) => manager.deleteGoal(CONTEXT, HOUSEHOLD_ID, GOAL.id)],
];

// A Holding's access is decided on its Account (OQ-178).
const INVESTMENTS: readonly Row[] = [
  ['listHoldingAllocations', beas('data.view'), READS.holding, 'holding.not_found',
    (manager) => manager.listHoldingAllocations(CONTEXT, HOUSEHOLD_ID, HOLDING.id)],
  ['editHolding', beas('data.edit'), READS.holding, 'holding.not_found',
    (manager) => manager.editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING.id, [])],
  ['archiveHolding', beas('data.delete'), READS.holding, 'holding.not_found',
    (manager) => manager.archiveHolding(CONTEXT, HOUSEHOLD_ID, HOLDING.id)],
  ['listScheduleEntries', beas('data.view'), READS.holding, 'holding.not_found',
    (manager) => manager.listScheduleEntries(CONTEXT, HOUSEHOLD_ID, HOLDING.id)],
  ['listValuationSnapshots', beas('data.view'), READS.holding, 'holding.not_found',
    (manager) => manager.listValuationSnapshots(CONTEXT, HOUSEHOLD_ID, HOLDING.id, {})],
  ['recordMarketValue', beas('data.edit'), READS.holding, 'holding.not_found',
    (manager) => manager.recordMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING.id, VALUE)],
  ['editMarketValue', beas('data.edit'), READS.holding, 'holding.not_found',
    (manager) => manager.editMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING.id, SNAPSHOT.id, VALUE)],
  ['deleteMarketValue', beas('data.edit'), READS.holding, 'holding.not_found',
    (manager) => manager.deleteMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING.id, SNAPSHOT.id)],
  ['listIndexRates', sharedData('data.view'), READS.none, null,
    (manager) => manager.listIndexRates(CONTEXT, HOUSEHOLD_ID)],
  ['recordIndexRate', creating('shared'), READS.none, null,
    (manager) => manager.recordIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', VALUE)],
  ['editIndexRate', beasRate('data.edit'), READS.rate, 'index_rate.not_found',
    (manager) => manager.editIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE.id, VALUE)],
  ['deleteIndexRate', beasRate('data.delete'), READS.rate, 'index_rate.not_found',
    (manager) => manager.deleteIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE.id)],
];

const GUARDED = [...CATEGORIES, ...ACCOUNTS, ...BUDGETS, ...GOALS, ...INVESTMENTS].map(useCaseOf);

/** The use cases that load personal-or-shared data, the only ones `not_visible` can reach. */
const LOADING = GUARDED.filter(({ hidden }) => hidden !== null);

/**
 * Mocked dependencies whose Account, Budget, Goal and index value belong to Bea.
 *
 * @param visibility - The visibility her Account, Budget and Goal have.
 * @returns The mocks from `fakeDeps`, reprogrammed.
 */
const beasData = (visibility: Visibility) => {
  const fakes = fakeDeps();
  fakes.accounts.findById.mockResolvedValue({ ...ACCOUNT, visibility, ownerUserId: BEA_ID });
  fakes.budgets.findById.mockResolvedValue({ ...BUDGET, visibility, ownerUserId: BEA_ID });
  fakes.goals.findById.mockResolvedValue({ ...GOAL, visibility, ownerUserId: BEA_ID });
  fakes.indexRates.findById.mockResolvedValue({ ...RATE, createdByUserId: BEA_ID });
  return fakes;
};

/**
 * Mocked dependencies in which none of the data a use case loads is there.
 *
 * @returns The mocks from `fakeDeps`, every `findById` answering nothing.
 */
const missingData = () => {
  const fakes = fakeDeps();
  answerNothing([
    fakes.accounts, fakes.creditCards, fakes.budgets, fakes.goals, fakes.holdings, fakes.indexRates,
  ]);
  return fakes;
};

/**
 * The mocks of the tier below, by group — what `touchedBeyondAccess` looks at.
 *
 * @param fakes - The mocks from `fakeDeps`.
 * @returns Them, by group.
 */
const belowOf = (fakes: Fakes): MockGroups => ({
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
});

describe('AccountManager ↔ AuthorizationUtility seam (I2, OQ-111)', () => {
  it('covers every use case AccountManager has', () => {
    const useCases = Object.keys(createAccountManager(fakeDeps().deps))
      .filter((name) => !EVENT_HANDLERS.includes(name));

    expect(GUARDED.map(({ name }) => name).sort()).toEqual(useCases.sort());
  });

  describe.each(['personal', 'shared'] as const)('on Bea\'s %s data', (visibility) => {
    it.each(GUARDED)('$name asks once for its own access', async ({ request, run }) => {
      const fakes = beasData(visibility);

      // What follows an allowed check is each use case's own suite's to assert.
      await runPastAccess(() => run(createAccountManager(fakes.deps)));

      expect(fakes.authorization.authorize).toHaveBeenCalledOnce();
      expect(fakes.authorization.authorize)
        .toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, request(visibility));
    });
  });

  it.each(LOADING)('$name asks only the membership check for data that isn\'t there, '
    + 'answering a non-member household.not_found', async ({ run, reads }) => {
    const fakes = missingData();
    fakes.authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    const events = await refusedLogging(() => run(createAccountManager(fakes.deps)), NOT_FOUND);

    expect(fakes.authorization.authorize)
      .toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, sharedData('data.view')());
    expect(touchedBeyondAccess(belowOf(fakes), reads)).toEqual([]);
    expect(events).toEqual([]);
  });

  describe.each([
    ['a non-member', 'not_member', GUARDED, () => NOT_FOUND],
    ['a member without the role', 'forbidden', GUARDED, () => FORBIDDEN],
    ['someone else\'s personal data', 'not_visible', LOADING,
      (hidden: string | null) => ({ code: hidden })],
  ] as const)('refusing %s', (_who, outcome, useCases, answer) => {
    it.each(useCases)('$name answers after only its access reads, logging nothing', async ({
      run,
      reads,
      hidden,
    }) => {
      const fakes = beasData('personal');
      fakes.authorization.authorize.mockResolvedValueOnce({ outcome });

      const events = await refusedLogging(
        () => run(createAccountManager(fakes.deps)),
        answer(hidden),
      );

      expect(touchedBeyondAccess(belowOf(fakes), reads)).toEqual([]);
      expect(events).toEqual([]);
    });
  });
});
