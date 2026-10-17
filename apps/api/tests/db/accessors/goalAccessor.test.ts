import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createGoalAccessor, {
  type AllocationShare, type NewGoal,
} from '../../../src/accessors/goalAccessor';
import type { Database } from '../../../src/db/database';
import {
  accounts, goals, households, investmentHoldings, users,
} from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const UNKNOWN_ID = '00000000-0000-7000-8000-000000000000';

type Goals = ReturnType<typeof createGoalAccessor>;

/** One test's data: household Casa with two members and a Holding, plus helpers. */
interface Setup {
  readonly accessor: Goals;
  readonly db: Database;
  readonly casa: string;
  readonly ana: string;
  readonly bruno: string;
  /** A stock Holding in Casa's shared investment Account. */
  readonly stock: string;
  /** Another household's Goal. */
  readonly foreignGoal: string;
  /** Creates a Casa Goal (Ana's, shared, 10,000 BRL by default); returns its id. */
  readonly create: (overrides?: Partial<NewGoal>) => Promise<string>;
  /** `stock`'s allocations as `[goalId, percentage]`, oldest first. */
  readonly splitOf: (holdingId: string) => Promise<unknown[]>;
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
 * Inserts a household.
 *
 * @param db - The test database.
 * @param name - Its name.
 * @returns The household id.
 */
const addHousehold = (db: Database, name: string) => idOf(
  db.insert(households).values({ name }).returning({ id: households.id }),
);

/**
 * Inserts a stock Holding in a new shared investment Account of a household.
 *
 * @param db - The test database.
 * @param householdId - The household.
 * @returns The Holding id.
 */
const addHolding = async (db: Database, householdId: string) => {
  const accountId = await idOf(db.insert(accounts).values({
    householdId,
    name: 'Broker',
    type: 'investment',
    currency: 'BRL',
    visibility: 'shared',
    startingBalanceDate: '2026-01-01',
  }).returning({ id: accounts.id }));
  return idOf(db.insert(investmentHoldings).values({
    accountId, assetType: 'stock', ticker: 'PETR4', quantity: 100_000_000, costBasis: 5_000,
  }).returning({ id: investmentHoldings.id }));
};

/**
 * The Goal fields every test starts from.
 *
 * @param householdId - Its household.
 * @param ownerUserId - Its creator.
 * @returns A shared 10,000 BRL Goal due at the end of 2027.
 */
const goalOf = (householdId: string, ownerUserId: string): NewGoal => ({
  householdId,
  ownerUserId,
  name: 'New car',
  targetAmount: 10_000,
  targetCurrency: 'BRL',
  dueDate: '2027-12-31',
  visibility: 'shared',
});

/**
 * Runs a test against fresh data, rolled back afterwards.
 *
 * @param test - The test, given its setup.
 * @returns Resolves when the test is done.
 */
const scenario = (test: (setup: Setup) => Promise<void>) => () => withRollback(
  pglite,
  async (db) => {
    const casa = await addHousehold(db, 'Casa');
    const ana = await addUser(db, 'ana');
    const accessor = createGoalAccessor(db);
    const other = await addHousehold(db, 'Other');
    await test({
      accessor,
      db,
      casa,
      ana,
      bruno: await addUser(db, 'bruno'),
      stock: await addHolding(db, casa),
      foreignGoal: (await accessor.insert(goalOf(other, ana))).id,
      create: async (overrides = {}) => (
        await accessor.insert({ ...goalOf(casa, ana), ...overrides })
      ).id,
      splitOf: async (holdingId) => (await accessor.listAllocations({ holdingId }))
        .map((allocation) => [allocation.goalId, allocation.percentage]),
    });
  },
);

/**
 * Builds a split in the order given.
 *
 * @param pairs - `[goalId, percentage]` pairs.
 * @returns The shares.
 */
const split = (...pairs: readonly [string, number][]): AllocationShare[] => pairs
  .map(([goalId, percentage]) => ({ goalId, percentage }));

describe('insert', () => {
  it('creates an open Goal owned by its creator', scenario(async ({ accessor, casa, ana }) => {
    const goal = await accessor.insert(goalOf(casa, ana));

    expect(goal).toMatchObject({
      householdId: casa,
      ownerUserId: ana,
      name: 'New car',
      targetAmount: 10_000,
      targetCurrency: 'BRL',
      dueDate: '2027-12-31',
      visibility: 'shared',
      completedAt: null,
    });
    expect(goal.createdAt).toBeInstanceOf(Date);
  }));
});

describe('findById', () => {
  it('reads a Goal of the household', scenario(async ({ accessor, casa, create }) => {
    const goalId = await create({ name: 'Trip' });

    expect(await accessor.findById(casa, goalId)).toMatchObject({ id: goalId, name: 'Trip' });
  }));

  it('never reads another household\'s Goal', scenario(async ({ accessor, casa, foreignGoal }) => {
    expect(await accessor.findById(casa, foreignGoal)).toBeUndefined();
    expect(await accessor.findById(casa, UNKNOWN_ID)).toBeUndefined();
  }));
});

describe('findByIds', () => {
  it('reads only the household\'s Goals among the ids', scenario(async ({
    accessor, casa, create, foreignGoal,
  }) => {
    const car = await create();
    const trip = await create({ name: 'Trip' });

    const found = await accessor.findByIds(casa, [car, trip, foreignGoal, UNKNOWN_ID]);

    expect(found.map((goal) => goal.id).sort()).toEqual([car, trip].sort());
  }));

  it('reads nothing for no ids', scenario(async ({ accessor, casa }) => {
    expect(await accessor.findByIds(casa, [])).toEqual([]);
  }));
});

describe('list', () => {
  it('lists shared Goals and the viewer\'s own personal ones, soonest due first', scenario(async ({
    accessor, casa, ana, bruno, create,
  }) => {
    const later = await create({ name: 'House', dueDate: '2030-01-01' });
    const anaOwn = await create({ name: 'Ana own', visibility: 'personal', dueDate: '2028-01-01' });
    await create({
      name: 'Bruno own', visibility: 'personal', ownerUserId: bruno, dueDate: '2026-01-01',
    });
    const sooner = await create({ name: 'Car', dueDate: '2027-01-01' });

    const listed = await accessor.list(casa, ana, 'active');

    expect(listed.map((goal) => goal.id)).toEqual([sooner, anaOwn, later]);
  }));

  it('breaks a due-date tie by name', scenario(async ({
    accessor, casa, ana, create,
  }) => {
    const zoo = await create({ name: 'Zoo' });
    const art = await create({ name: 'Art' });

    expect((await accessor.list(casa, ana, 'active')).map((goal) => goal.id)).toEqual([art, zoo]);
  }));

  it('splits active from completed Goals', scenario(async ({
    accessor, casa, ana, create,
  }) => {
    const open = await create({ name: 'Open' });
    const done = await create({ name: 'Done' });
    await accessor.complete(casa, done);

    expect((await accessor.list(casa, ana, 'active')).map((goal) => goal.id)).toEqual([open]);
    expect((await accessor.list(casa, ana, 'completed')).map((goal) => goal.id)).toEqual([done]);
  }));

  it('never lists another household\'s Goals', scenario(async ({ accessor, casa, ana }) => {
    expect(await accessor.list(casa, ana, 'active')).toEqual([]);
  }));
});

describe('update', () => {
  it('changes the given fields only, target currency included', scenario(async ({
    accessor, casa, create,
  }) => {
    const goalId = await create();

    const updated = await accessor.update(casa, goalId, {
      targetAmount: 20_000, targetCurrency: 'USD',
    });

    expect(updated).toMatchObject({
      name: 'New car', targetAmount: 20_000, targetCurrency: 'USD', dueDate: '2027-12-31',
    });
  }));

  it('changes the name and due date', scenario(async ({ accessor, casa, create }) => {
    const goalId = await create();

    await accessor.update(casa, goalId, { name: 'Bike', dueDate: '2026-12-31' });

    expect(await accessor.findById(casa, goalId)).toMatchObject({
      name: 'Bike', dueDate: '2026-12-31',
    });
  }));

  it('returns the Goal unchanged when nothing is given', scenario(async ({
    accessor, casa, create,
  }) => {
    const goalId = await create();

    expect(await accessor.update(casa, goalId, {})).toMatchObject({ id: goalId, name: 'New car' });
  }));

  it('never edits another household\'s Goal', scenario(async ({
    accessor, casa, foreignGoal, db,
  }) => {
    expect(await accessor.update(casa, foreignGoal, { name: 'Hacked' })).toBeUndefined();
    expect(await accessor.update(casa, UNKNOWN_ID, {})).toBeUndefined();
    const [row] = await db.select({ name: goals.name }).from(goals)
      .where(eq(goals.id, foreignGoal));
    expect(row!.name).toBe('New car');
  }));
});

describe('complete and reopen', () => {
  it('completes a Goal, keeping the first time when completed again', scenario(async ({
    accessor, casa, create,
  }) => {
    const goalId = await create();

    expect(await accessor.complete(casa, goalId)).toBe(true);
    const { completedAt } = (await accessor.findById(casa, goalId))!;
    expect(completedAt).toBeInstanceOf(Date);
    expect(await accessor.complete(casa, goalId)).toBe(true);
    expect((await accessor.findById(casa, goalId))!.completedAt).toEqual(completedAt);
  }));

  it('reopens a completed Goal; reopening an active one is a no-op', scenario(async ({
    accessor, casa, create,
  }) => {
    const goalId = await create();
    await accessor.complete(casa, goalId);

    expect(await accessor.reopen(casa, goalId)).toBe(true);
    expect((await accessor.findById(casa, goalId))!.completedAt).toBeNull();
    expect(await accessor.reopen(casa, goalId)).toBe(true);
  }));

  it('keeps the allocations through complete and reopen', scenario(async ({
    accessor, casa, stock, create, splitOf,
  }) => {
    const goalId = await create();
    await accessor.replaceAllocations(casa, stock, split([goalId, 40]));

    await accessor.complete(casa, goalId);
    expect(await splitOf(stock)).toEqual([[goalId, 40]]);
    await accessor.reopen(casa, goalId);
    expect(await splitOf(stock)).toEqual([[goalId, 40]]);
  }));

  it('never touches another household\'s Goal', scenario(async ({
    accessor, casa, foreignGoal, db,
  }) => {
    expect(await accessor.complete(casa, foreignGoal)).toBe(false);
    expect(await accessor.reopen(casa, UNKNOWN_ID)).toBe(false);
    const [row] = await db.select({ completedAt: goals.completedAt }).from(goals)
      .where(eq(goals.id, foreignGoal));
    expect(row!.completedAt).toBeNull();
  }));
});

describe('delete', () => {
  it('hard-deletes a Goal; its allocations go, the Holding stays', scenario(async ({
    accessor, casa, stock, create, splitOf, db,
  }) => {
    const car = await create();
    const trip = await create({ name: 'Trip' });
    await accessor.replaceAllocations(casa, stock, split([car, 60], [trip, 20]));

    expect(await accessor.delete(casa, car)).toBe(true);

    expect(await accessor.findById(casa, car)).toBeUndefined();
    expect(await splitOf(stock)).toEqual([[trip, 20]]);
    expect(await db.$count(investmentHoldings, eq(investmentHoldings.id, stock))).toBe(1);
  }));

  it('never deletes another household\'s Goal', scenario(async ({
    accessor, casa, foreignGoal, db,
  }) => {
    expect(await accessor.delete(casa, foreignGoal)).toBe(false);
    expect(await db.$count(goals, eq(goals.id, foreignGoal))).toBe(1);
  }));
});

describe('replaceAllocations', () => {
  it('writes a split of exactly 100%', scenario(async ({
    accessor, casa, stock, create, splitOf,
  }) => {
    const car = await create();
    const trip = await create({ name: 'Trip' });

    expect(await accessor.replaceAllocations(casa, stock, split([car, 60], [trip, 40])))
      .toEqual({ ok: true });
    expect(await splitOf(stock)).toEqual([[car, 60], [trip, 40]]);
  }));

  it('replaces the whole split: pairs left out are removed, kept ones re-set', scenario(async ({
    accessor, casa, stock, create, splitOf,
  }) => {
    const car = await create();
    const trip = await create({ name: 'Trip' });
    const house = await create({ name: 'House' });
    await accessor.replaceAllocations(casa, stock, split([car, 60], [trip, 20]));

    await accessor.replaceAllocations(casa, stock, split([car, 70], [house, 30]));

    expect(await splitOf(stock)).toEqual([[car, 70], [house, 30]]);
  }));

  it('removes every allocation with an empty split', scenario(async ({
    accessor, casa, stock, create, splitOf,
  }) => {
    await accessor.replaceAllocations(casa, stock, split([await create(), 50]));

    expect(await accessor.replaceAllocations(casa, stock, [])).toEqual({ ok: true });
    expect(await splitOf(stock)).toEqual([]);
  }));

  it('refuses a split past 100%, reporting the current and requested totals', scenario(async ({
    accessor, casa, stock, create, splitOf,
  }) => {
    const car = await create();
    const trip = await create({ name: 'Trip' });
    const house = await create({ name: 'House' });
    await accessor.replaceAllocations(casa, stock, split([car, 60], [trip, 20]));

    const result = await accessor.replaceAllocations(
      casa,
      stock,
      split([car, 60], [trip, 20], [house, 21]),
    );

    expect(result).toEqual({
      ok: false, reason: 'allocation_exceeds_100', current: 80, requested: 101,
    });
    expect(await splitOf(stock)).toEqual([[car, 60], [trip, 20]]);
  }));

  it('refuses a Goal of another household, keeping the split', scenario(async ({
    accessor, casa, stock, create, foreignGoal, splitOf,
  }) => {
    const car = await create();
    await accessor.replaceAllocations(casa, stock, split([car, 50]));

    expect(await accessor.replaceAllocations(casa, stock, split([car, 50], [foreignGoal, 10])))
      .toEqual({ ok: false, reason: 'goal_not_found', goalId: foreignGoal });
    expect(await accessor.replaceAllocations(casa, stock, split([UNKNOWN_ID, 10])))
      .toEqual({ ok: false, reason: 'goal_not_found', goalId: UNKNOWN_ID });
    expect(await splitOf(stock)).toEqual([[car, 50]]);
  }));

  it('leaves visibility and completion to the Manager', scenario(async ({
    accessor, casa, bruno, stock, create, splitOf,
  }) => {
    const brunoOwn = await create({ visibility: 'personal', ownerUserId: bruno });
    const done = await create({ name: 'Done' });
    await accessor.complete(casa, done);

    expect(await accessor.replaceAllocations(casa, stock, split([brunoOwn, 30], [done, 30])))
      .toEqual({ ok: true });
    expect(await splitOf(stock)).toEqual([[brunoOwn, 30], [done, 30]]);
  }));

  it('refuses an unknown Holding', scenario(async ({ accessor, casa, create }) => {
    expect(await accessor.replaceAllocations(casa, UNKNOWN_ID, split([await create(), 10])))
      .toEqual({ ok: false, reason: 'holding_not_found' });
  }));

  it('rejects a percentage outside 1–100 at the database', scenario(async ({
    accessor, casa, stock, create,
  }) => {
    const car = await create();

    await expect(accessor.replaceAllocations(casa, stock, split([car, 0]))).rejects.toThrow();
  }));
});

describe('listAllocations', () => {
  it('lists who funds some Goals, across Holdings', scenario(async ({
    accessor, casa, stock, create, db,
  }) => {
    const car = await create();
    const trip = await create({ name: 'Trip' });
    const other = await create({ name: 'Other' });
    const fund = await addHolding(db, casa);
    await accessor.replaceAllocations(casa, stock, split([car, 60], [other, 10]));
    await accessor.replaceAllocations(casa, fund, split([trip, 25]));

    const listed = await accessor.listAllocations({ goalIds: [car, trip] });

    expect(listed.map((row) => [row.holdingId, row.goalId, row.percentage])).toEqual([
      [stock, car, 60], [fund, trip, 25],
    ]);
    expect(listed[0]!.createdAt).toBeInstanceOf(Date);
  }));

  it('lists nothing for no Goals', scenario(async ({ accessor }) => {
    expect(await accessor.listAllocations({ goalIds: [] })).toEqual([]);
  }));
});
