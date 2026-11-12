import type { PGlite } from '@electric-sql/pglite';
import { eq, inArray } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createAccountAccessor from '../../../src/accessors/accountAccessor';
import createAccountTransactionAccessor from '../../../src/accessors/accountTransactionAccessor';
import createBudgetAccessor from '../../../src/accessors/budgetAccessor';
import createCardTransactionAccessor from '../../../src/accessors/cardTransactionAccessor';
import type { ErasureScope } from '../../../src/accessors/erasureScope';
import createGoalAccessor from '../../../src/accessors/goalAccessor';
import createIndexRateAccessor from '../../../src/accessors/indexRateAccessor';
import createInvitationAccessor from '../../../src/accessors/invitationAccessor';
import createUserAccessor from '../../../src/accessors/userAccessor';
import type { Database } from '../../../src/db/database';
import {
  accountTransactions, accounts, budgetPeriods, budgetTargets, budgets, cardTransactions,
  categories, creditCards, goalAllocations, goals, households, indexRateValues,
  investmentHoldings, invitations, users,
} from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

// Every Accessor's `forgetUser` (FR-1.17/FR-1.11, OQ-240), against one household
// full of Ana's rows — personal and shared — next to Bia's, and the same again in
// a second household. Each erases in one household or everywhere; run in
// IdentityManager's order, together they leave nothing that stops Ana's user row
// from being deleted.

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

/** Ana's and Bia's rows in one household. */
interface HouseholdRows {
  readonly household: string;
  /** Ana's personal checking account, with a card, a Holding and a transfer to `joint`. */
  readonly mine: string;
  /** A shared account Ana added. */
  readonly joint: string;
  /** Bia's personal account, with a transfer from `joint`. */
  readonly hers: string;
  /** `joint`'s side of the transfer with `mine`. */
  readonly jointFromMine: string;
  /** `joint`'s side of the transfer with `hers`. */
  readonly jointToHers: string;
  /** A deposit Ana recorded on `joint`. */
  readonly jointDeposit: string;
  /** A charge Ana recorded on `joint`'s card. */
  readonly jointCharge: string;
  /** The Holding in `mine`, funding `sharedGoal`. */
  readonly holding: string;
  readonly personalBudget: string;
  readonly sharedBudget: string;
  readonly personalGoal: string;
  readonly sharedGoal: string;
  /** A CDI value Ana recorded. */
  readonly rate: string;
  /** An invitation Ana sent. */
  readonly invitation: string;
}

/** One test's data. */
interface Setup {
  readonly db: Database;
  readonly ana: string;
  readonly bia: string;
  /** Where the erasure in household scope runs. */
  readonly casa: HouseholdRows;
  /** Another household with the same rows — out of a household-scoped erasure's reach. */
  readonly other: HouseholdRows;
}

/**
 * Inserts one row and returns its id.
 *
 * @param query - An insert returning `{ id }`.
 * @returns The id.
 */
const idOf = async (query: Promise<{ id: string }[]>) => (await query)[0]!.id;

/**
 * Inserts a user.
 *
 * @param db - The test database.
 * @param name - First name; also the email's local part.
 * @returns The user id.
 */
const addUser = (db: Database, name: string) => idOf(db.insert(users).values({
  email: `${name}@example.com`,
  passwordHash: 'x',
  firstName: name,
  lastName: 'Silva',
  mfaSecret: 'x',
}).returning({ id: users.id }));

/**
 * Inserts a BRL checking account.
 *
 * @param db - The test database.
 * @param householdId - Its household.
 * @param ownerUserId - Its owner (personal) or creator (shared).
 * @param visibility - Personal or shared.
 * @returns The account id.
 */
const addAccount = (
  db: Database,
  householdId: string,
  ownerUserId: string,
  visibility: 'personal' | 'shared',
) => idOf(db.insert(accounts).values({
  householdId,
  ownerUserId,
  name: `${visibility} checking`,
  type: 'checking',
  currency: 'BRL',
  visibility,
  startingBalanceDate: '2026-01-01',
}).returning({ id: accounts.id }));

/**
 * Inserts a card on an account and one charge on it.
 *
 * @param db - The test database.
 * @param accountId - The card's account.
 * @param createdByUserId - Who recorded the charge.
 * @returns The charge's id.
 */
const addCharge = async (db: Database, accountId: string, createdByUserId: string) => {
  const creditCardId = await idOf(db.insert(creditCards).values({
    accountId,
    network: 'visa',
    last4: '1234',
    closingDay: 5,
    dueDay: 12,
    expirationMonth: 12,
    expirationYear: 2030,
  }).returning({ id: creditCards.id }));
  return idOf(db.insert(cardTransactions).values({
    creditCardId, kind: 'charge', date: '2026-10-01', amount: 100, currency: 'BRL', createdByUserId,
  }).returning({ id: cardTransactions.id }));
};

/**
 * Inserts an account transaction.
 *
 * @param db - The test database.
 * @param accountId - Its account.
 * @param createdByUserId - Who recorded it.
 * @param transfer - The pair and side, for one side of a transfer.
 * @returns The transaction id.
 */
const addTransaction = (
  db: Database,
  accountId: string,
  createdByUserId: string,
  transfer?: { readonly transferId: string; readonly kind: string },
) => idOf(db.insert(accountTransactions).values({
  accountId,
  kind: transfer?.kind ?? 'deposit',
  effect: transfer ? 'transfer' : 'movement',
  transferId: transfer?.transferId,
  date: '2026-10-01',
  amount: 100,
  currency: 'BRL',
  createdByUserId,
}).returning({ id: accountTransactions.id }));

/**
 * Inserts a transfer pair.
 *
 * @param db - The test database.
 * @param from - The sending account.
 * @param to - The receiving account.
 * @param createdByUserId - Who recorded it.
 * @returns The sent and received sides' ids.
 */
const addTransfer = async (db: Database, from: string, to: string, createdByUserId: string) => {
  const transferId = crypto.randomUUID();
  return {
    sent: await addTransaction(db, from, createdByUserId, { transferId, kind: 'transfer_sent' }),
    received: await addTransaction(db, to, createdByUserId, {
      transferId, kind: 'transfer_received',
    }),
  };
};

/**
 * Inserts a BRL Budget claiming a new category, with one period.
 *
 * @param db - The test database.
 * @param householdId - Its household.
 * @param ownerUserId - Its owner (personal) or creator (shared).
 * @param visibility - Personal or shared.
 * @returns The Budget id.
 */
const addBudget = async (
  db: Database,
  householdId: string,
  ownerUserId: string,
  visibility: 'personal' | 'shared',
) => {
  const budgetId = await idOf(db.insert(budgets).values({
    householdId, ownerUserId, name: visibility, targetAmount: 500, currency: 'BRL', visibility,
  }).returning({ id: budgets.id }));
  const categoryId = await idOf(db.insert(categories).values({
    householdId, name: visibility, icon: 'cart', color: 'mint',
  }).returning({ id: categories.id }));
  await db.insert(budgetTargets).values({
    budgetId, categoryId, householdId, visibility, ownerUserId,
  });
  await db.insert(budgetPeriods).values({
    budgetId, householdId, currency: 'BRL', year: 2026, month: 10, targetAmount: 500,
  });
  return budgetId;
};

/**
 * Inserts a BRL Goal.
 *
 * @param db - The test database.
 * @param householdId - Its household.
 * @param ownerUserId - Its owner (personal) or creator (shared).
 * @param visibility - Personal or shared.
 * @returns The Goal id.
 */
const addGoal = (
  db: Database,
  householdId: string,
  ownerUserId: string,
  visibility: 'personal' | 'shared',
) => idOf(db.insert(goals).values({
  householdId,
  ownerUserId,
  name: visibility,
  targetAmount: 10_000,
  targetCurrency: 'BRL',
  dueDate: '2027-12-31',
  visibility,
}).returning({ id: goals.id }));

/**
 * Inserts Ana's and Bia's rows in a new household.
 *
 * @param db - The test database.
 * @param ana - The user erased.
 * @param bia - The user who stays.
 * @returns The rows' ids.
 */
const addHouseholdRows = async (db: Database, ana: string, bia: string): Promise<HouseholdRows> => {
  const household = await idOf(
    db.insert(households).values({ name: 'Casa' }).returning({ id: households.id }),
  );
  const mine = await addAccount(db, household, ana, 'personal');
  const joint = await addAccount(db, household, ana, 'shared');
  const hers = await addAccount(db, household, bia, 'personal');
  await addCharge(db, mine, ana);
  const holding = await idOf(db.insert(investmentHoldings).values({
    accountId: mine, assetType: 'stock', ticker: 'PETR4', quantity: 1, costBasis: 1,
  }).returning({ id: investmentHoldings.id }));
  const sharedGoal = await addGoal(db, household, ana, 'shared');
  await db.insert(goalAllocations).values({
    holdingId: holding, goalId: sharedGoal, percentage: 100, validFrom: '2026-10-01',
  });
  return {
    household,
    mine,
    joint,
    hers,
    jointFromMine: (await addTransfer(db, mine, joint, ana)).received,
    jointToHers: (await addTransfer(db, joint, hers, ana)).sent,
    jointDeposit: await addTransaction(db, joint, ana),
    jointCharge: await addCharge(db, joint, ana),
    holding,
    personalBudget: await addBudget(db, household, ana, 'personal'),
    sharedBudget: await addBudget(db, household, ana, 'shared'),
    personalGoal: await addGoal(db, household, ana, 'personal'),
    sharedGoal,
    rate: await idOf(db.insert(indexRateValues).values({
      householdId: household,
      indexCode: 'CDI',
      value: 1_000,
      asOfDate: '2026-10-01',
      createdByUserId: ana,
    }).returning({ id: indexRateValues.id })),
    invitation: await idOf(db.insert(invitations).values({
      householdId: household, invitedUserId: bia, invitedByUserId: ana, role: 'Member',
    }).returning({ id: invitations.id })),
  };
};

/**
 * Runs a test against fresh data, rolled back afterwards.
 *
 * @param test - The test, given its setup.
 * @returns Resolves when the test is done.
 */
const scenario = (test: (setup: Setup) => Promise<void>) => () => withRollback(
  pglite,
  async (db) => {
    const ana = await addUser(db, 'ana');
    const bia = await addUser(db, 'bia');
    await test({
      db,
      ana,
      bia,
      casa: await addHouseholdRows(db, ana, bia),
      other: await addHouseholdRows(db, ana, bia),
    });
  },
);

/**
 * Reads a table's rows by id, as `id → column value`.
 *
 * @param db - The test database.
 * @param table - The table.
 * @param column - The column read.
 * @param ids - The rows.
 * @returns The values found; a missing row is missing from the map.
 */
const valuesOf = async (
  db: Database,
  table: typeof accounts | typeof goals | typeof budgets,
  column: 'ownerUserId',
  ids: readonly string[],
) => new Map((await db.select({ id: table.id, value: table[column] }).from(table)
  .where(inArray(table.id, [...ids]))).map((row) => [row.id, row.value]));

/**
 * The erasure of Ana in Casa only.
 *
 * @param setup - The test's data.
 * @returns The scope.
 */
const inCasa = ({ ana, casa }: Setup): ErasureScope => ({
  userId: ana, householdId: casa.household,
});

describe('AccountTransactionAccessor.forgetUser', () => {
  it('makes the side a personal account leaves behind a lone movement', scenario(async (setup) => {
    const { db, casa, other } = setup;

    await createAccountTransactionAccessor(db).forgetUser(inCasa(setup));

    const rows = await db.select().from(accountTransactions).where(inArray(
      accountTransactions.id,
      [casa.jointFromMine, casa.jointToHers, other.jointFromMine],
    ));
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(casa.jointFromMine)).toMatchObject({ transferId: null, effect: 'movement' });
    expect(byId.get(casa.jointToHers)).toMatchObject({ effect: 'transfer' });
    expect(byId.get(casa.jointToHers)!.transferId).not.toBeNull();
    expect(byId.get(other.jointFromMine)).toMatchObject({ effect: 'transfer' });
  }));

  it('stops naming the user on the household\'s rows only', scenario(async (setup) => {
    const { db, ana, casa } = setup;

    await createAccountTransactionAccessor(db).forgetUser(inCasa(setup));

    const named = await db.select({ accountId: accountTransactions.accountId })
      .from(accountTransactions).where(eq(accountTransactions.createdByUserId, ana));
    const casaAccounts = [casa.mine, casa.joint, casa.hers];
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((row) => casaAccounts.includes(row.accountId))).toEqual([]);
  }));

  it('stops naming the user everywhere without a household', scenario(async ({ db, ana }) => {
    await createAccountTransactionAccessor(db).forgetUser({ userId: ana });

    expect(await db.$count(accountTransactions, eq(accountTransactions.createdByUserId, ana)))
      .toBe(0);
  }));
});

describe('CardTransactionAccessor.forgetUser', () => {
  it('stops naming the user on the household\'s charges only', scenario(async (setup) => {
    const { db, ana, casa } = setup;

    await createCardTransactionAccessor(db).forgetUser(inCasa(setup));

    const [charge] = await db.select().from(cardTransactions)
      .where(eq(cardTransactions.id, casa.jointCharge));
    expect(charge!.createdByUserId).toBeNull();
    // Casa's two charges anonymized; the other household's two still Ana's.
    expect(await db.$count(cardTransactions, eq(cardTransactions.createdByUserId, ana))).toBe(2);
  }));

  it('stops naming the user everywhere without a household', scenario(async ({ db, ana }) => {
    await createCardTransactionAccessor(db).forgetUser({ userId: ana });

    expect(await db.$count(cardTransactions, eq(cardTransactions.createdByUserId, ana))).toBe(0);
  }));
});

describe('GoalAccessor.forgetUser', () => {
  it('deletes the personal Goal, anonymizes the shared one, here only', scenario(async (setup) => {
    const {
      db, ana, casa, other,
    } = setup;

    await createGoalAccessor(db).forgetUser(inCasa(setup));

    const owners = await valuesOf(db, goals, 'ownerUserId', [
      casa.personalGoal, casa.sharedGoal, other.personalGoal, other.sharedGoal,
    ]);
    expect(owners.has(casa.personalGoal)).toBe(false);
    expect(owners.get(casa.sharedGoal)).toBeNull();
    expect(owners.get(other.personalGoal)).toBe(ana);
    expect(owners.get(other.sharedGoal)).toBe(ana);
  }));
});

describe('BudgetAccessor.forgetUser', () => {
  it('deletes the personal Budget and periods; anonymizes the shared', scenario(async (setup) => {
    const {
      db, ana, casa, other,
    } = setup;

    await createBudgetAccessor(db).forgetUser(inCasa(setup));

    const owners = await valuesOf(db, budgets, 'ownerUserId', [
      casa.personalBudget, casa.sharedBudget, other.personalBudget,
    ]);
    expect(owners.has(casa.personalBudget)).toBe(false);
    expect(owners.get(casa.sharedBudget)).toBeNull();
    expect(owners.get(other.personalBudget)).toBe(ana);
    expect(await db.$count(budgetPeriods, eq(budgetPeriods.householdId, casa.household))).toBe(1);
    const [sharedClaim] = await db.select().from(budgetTargets)
      .where(eq(budgetTargets.budgetId, casa.sharedBudget));
    expect(sharedClaim!.ownerUserId).toBeNull();
    expect(await db.$count(budgetTargets, eq(budgetTargets.ownerUserId, ana))).toBe(2);
  }));
});

describe('AccountAccessor.forgetUser', () => {
  it('deletes the personal account whole; anonymizes the shared', scenario(async (setup) => {
    const {
      db, ana, bia, casa, other,
    } = setup;
    await createAccountTransactionAccessor(db).forgetUser(inCasa(setup));

    await createAccountAccessor(db).forgetUser(inCasa(setup));

    const owners = await valuesOf(db, accounts, 'ownerUserId', [
      casa.mine, casa.joint, casa.hers, other.mine,
    ]);
    expect(owners.has(casa.mine)).toBe(false);
    expect(owners.get(casa.joint)).toBeNull();
    expect(owners.get(casa.hers)).toBe(bia);
    expect(owners.get(other.mine)).toBe(ana);
    expect(await db.$count(investmentHoldings, eq(investmentHoldings.id, casa.holding))).toBe(0);
    expect(await db.$count(goalAllocations, eq(goalAllocations.goalId, casa.sharedGoal))).toBe(0);
    expect(await db.$count(goals, eq(goals.id, casa.sharedGoal))).toBe(1);
  }));
});

describe('IndexRateAccessor.forgetUser', () => {
  it('stops naming the user on the household\'s values only', scenario(async (setup) => {
    const { db, ana, casa } = setup;

    await createIndexRateAccessor(db).forgetUser(inCasa(setup));

    const [rate] = await db.select().from(indexRateValues).where(eq(indexRateValues.id, casa.rate));
    expect(rate!.createdByUserId).toBeNull();
    expect(await db.$count(indexRateValues, eq(indexRateValues.createdByUserId, ana))).toBe(1);
  }));
});

describe('InvitationAccessor.forgetUser', () => {
  it('keeps the invitation pending, no longer naming its sender', scenario(async (setup) => {
    const { db, ana, casa } = setup;

    await createInvitationAccessor(db).forgetUser(inCasa(setup));

    const [invitation] = await db.select().from(invitations)
      .where(eq(invitations.id, casa.invitation));
    expect(invitation).toMatchObject({ invitedByUserId: null, status: 'pending' });
    expect(await db.$count(invitations, eq(invitations.invitedByUserId, ana))).toBe(1);
  }));
});

describe('the erasure together (IdentityManager\'s order)', () => {
  /**
   * Runs every `forgetUser` in IdentityManager's order.
   *
   * @param db - The test database.
   * @param scope - The erasure.
   * @returns Resolves when all ran.
   */
  const forgetAll = async (db: Database, scope: ErasureScope) => {
    await createAccountTransactionAccessor(db).forgetUser(scope);
    await createCardTransactionAccessor(db).forgetUser(scope);
    await createGoalAccessor(db).forgetUser(scope);
    await createBudgetAccessor(db).forgetUser(scope);
    await createAccountAccessor(db).forgetUser(scope);
    await createIndexRateAccessor(db).forgetUser(scope);
    await createInvitationAccessor(db).forgetUser(scope);
  };

  it('leaves nothing that stops the user row\'s delete', scenario(async ({ db, ana, bia }) => {
    const usersAccessor = createUserAccessor(db);
    expect(await usersAccessor.delete(ana)).toBe('still_referenced');

    await forgetAll(db, { userId: ana });

    expect(await usersAccessor.delete(ana)).toBe('deleted');
    expect(await db.$count(accounts, eq(accounts.ownerUserId, bia))).toBe(2);
  }));

  it('can run again with nothing left to erase', scenario(async ({ db, ana }) => {
    await forgetAll(db, { userId: ana });
    await forgetAll(db, { userId: ana });

    expect(await createUserAccessor(db).delete(ana)).toBe('deleted');
  }));
});
