import type { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createBudgetAccessor, {
  type BudgetMonth,
  type BudgetScope,
  type BudgetTarget,
  type InsertBudgetResult,
  type NewBudget,
  type Spend,
} from '../../../src/accessors/budgetAccessor';
import type { Database } from '../../../src/db/database';
import {
  budgetPeriods, categories, households, subcategories, users,
} from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const JANUARY: BudgetMonth = { year: 2026, month: 1 };
const MARCH: BudgetMonth = { year: 2026, month: 3 };
const UNKNOWN_ID = '00000000-0000-7000-8000-000000000000';
const FIRST_PAGE = { limit: 10, offset: 0 };

type Budgets = ReturnType<typeof createBudgetAccessor>;
type Targets = readonly BudgetTarget[];

/**
 * One test's data — household Casa with Ana and Bia, its categories Transport
 * (Fuel, Parking) and Shopping (Clothing), a second household with Garden — and
 * helpers bound to it.
 */
interface Setup {
  readonly budgets: Budgets;
  readonly db: Database;
  readonly home: string;
  readonly elsewhere: string;
  readonly ana: string;
  readonly bia: string;
  readonly transport: string;
  readonly fuel: string;
  readonly parking: string;
  readonly shopping: string;
  readonly clothing: string;
  readonly garden: string;
  /** Inserts a Budget (shared, BRL, Ana's, unless overridden). */
  readonly attempt: (
    overrides: Partial<NewBudget>, targets: Targets, month?: BudgetMonth,
  ) => Promise<InsertBudgetResult>;
  /** Inserts a Budget like `attempt`, failing the test if refused; returns its id. */
  readonly create: (
    overrides: Partial<NewBudget>, targets: Targets, month?: BudgetMonth,
  ) => Promise<string>;
  /** Accrues a spend: shared BRL Account, Transport > Fuel, 1,000 on 2026-01-15 by default. */
  readonly accrue: (overrides?: Partial<Spend>) => Promise<'accrued' | 'untracked'>;
  /** A Budget's periods over 2025–2027 as `[year-month, target, spend]`, oldest first. */
  readonly periods: (budgetId: string) => Promise<unknown[]>;
  /** A Casa Budget's targets. */
  readonly targetsOf: (budgetId: string) => Promise<Targets | undefined>;
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
 * Inserts a category.
 *
 * @param db - The test database.
 * @param householdId - Its household.
 * @param name - Its name.
 * @returns The category id.
 */
const addCategory = (db: Database, householdId: string, name: string) => idOf(
  db.insert(categories).values({
    householdId, name, icon: 'car', color: 'teal',
  }).returning({ id: categories.id }),
);

/**
 * Inserts a subcategory.
 *
 * @param db - The test database.
 * @param categoryId - Its category.
 * @param name - Its name.
 * @returns The subcategory id.
 */
const addSubcategory = (db: Database, categoryId: string, name: string) => idOf(
  db.insert(subcategories).values({ categoryId, name }).returning({ id: subcategories.id }),
);

/**
 * Binds the helpers to one test's data.
 *
 * @param data - The test's accessor, database and ids.
 * @returns The setup.
 */
const withHelpers = (
  data: Omit<Setup, 'attempt' | 'create' | 'accrue' | 'periods' | 'targetsOf'>,
): Setup => {
  const attempt: Setup['attempt'] = (overrides, targets, month = JANUARY) => data.budgets.insert({
    householdId: data.home,
    ownerUserId: data.ana,
    visibility: 'shared',
    name: 'Car',
    targetAmount: 50_000,
    currency: 'BRL',
    ...overrides,
  }, targets, month);
  return {
    ...data,
    attempt,
    create: async (overrides, targets, month) => {
      const result = await attempt(overrides, targets, month);
      if (!result.ok) throw new Error(`setup failed: ${result.reason}`);
      return result.budget.id;
    },
    accrue: (overrides = {}) => data.budgets.accrueIfClaimed({
      scope: { householdId: data.home, visibility: 'shared', ownerUserId: data.ana },
      currency: 'BRL',
      categoryId: data.transport,
      subcategoryId: data.fuel,
      amount: 1_000,
      date: '2026-01-15',
      ...overrides,
    }),
    periods: async (budgetId) => (await data.budgets.listPeriods(
      data.home,
      budgetId,
      { year: 2025, month: 1 },
      { year: 2027, month: 12 },
    )).map((period) => [`${period.year}-${period.month}`, period.targetAmount, period.spendAmount]),
    targetsOf: async (budgetId) => (await data.budgets.findById(data.home, budgetId))?.targets,
  };
};

/**
 * Runs a test with an accessor and the Casa setup, inside a rolled-back transaction.
 *
 * @param work - The test body.
 * @returns A Vitest test function.
 */
const test = (work: (setup: Setup) => Promise<void>) => () => withRollback(pglite, async (db) => {
  const home = await addHousehold(db, 'Casa');
  const elsewhere = await addHousehold(db, 'Other');
  const transport = await addCategory(db, home, 'Transport');
  const shopping = await addCategory(db, home, 'Shopping');
  await work(withHelpers({
    budgets: createBudgetAccessor(db),
    db,
    home,
    elsewhere,
    ana: await addUser(db, 'ana'),
    bia: await addUser(db, 'bia'),
    transport,
    fuel: await addSubcategory(db, transport, 'Fuel'),
    parking: await addSubcategory(db, transport, 'Parking'),
    shopping,
    clothing: await addSubcategory(db, shopping, 'Clothing'),
    garden: await addCategory(db, elsewhere, 'Garden'),
  }));
});

/**
 * Runs SQL as the database owner, then returns to the application role — for a
 * test that needs to change the schema (rolled back with the rest).
 *
 * @param db - The test database.
 * @param statement - The DDL.
 * @returns Resolves once run.
 */
const asOwner = async (db: Database, statement: string) => {
  await db.execute(sql`RESET ROLE`);
  await db.execute(sql.raw(statement));
  await db.execute(sql`SET LOCAL ROLE financas_app`);
};

/**
 * The refusal for a target claimed by another Budget.
 *
 * @param target - The target.
 * @param claimedByBudgetId - The Budget claiming it.
 * @returns The expected result.
 */
const claimed = (target: BudgetTarget, claimedByBudgetId: string) => ({
  ok: false, reason: 'target_claimed', target, claimedByBudgetId,
});

describe('BudgetAccessor.insert', () => {
  it('creates the Budget with its targets and opens the current month', test(async (setup) => {
    const targets = [{ categoryId: setup.transport }, { subcategoryId: setup.clothing }];

    const result = await setup.attempt({}, targets, MARCH);

    expect(result).toEqual({
      ok: true,
      budget: {
        id: expect.any(String),
        householdId: setup.home,
        ownerUserId: setup.ana,
        visibility: 'shared',
        name: 'Car',
        targetAmount: 50_000,
        currency: 'BRL',
        targets,
        createdAt: expect.any(Date),
      },
    });
    const { budget } = result as { budget: { id: string } };
    expect(await setup.budgets.findById(setup.home, budget.id)).toEqual(budget);
    expect(await setup.periods(budget.id)).toEqual([['2026-3', 50_000, 0]]);
  }));

  it('refuses a target another Budget in the scope claims, keeping nothing', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    const result = await setup.attempt(
      { name: 'Trips' },
      [{ categoryId: setup.shopping }, { categoryId: setup.transport }],
    );

    expect(result).toEqual(claimed({ categoryId: setup.transport }, car));
    expect((await setup.budgets.list(setup.home, setup.ana, FIRST_PAGE)).total).toBe(1);
    expect((await setup.attempt({}, [{ categoryId: setup.shopping }])).ok).toBe(true);
  }));

  it('leaves the literal duplicate to the FR-4.7 unique index', test(async (setup) => {
    await setup.create({}, [{ categoryId: setup.transport }]);
    await asOwner(setup.db, 'DROP INDEX budget_targets_shared_category_key');

    expect((await setup.attempt({}, [{ categoryId: setup.transport }])).ok).toBe(true);
  }));

  it('refuses a duplicate Subcategory claim', test(async (setup) => {
    const fuel = await setup.create({}, [{ subcategoryId: setup.fuel }]);

    expect(await setup.attempt({}, [{ subcategoryId: setup.fuel }]))
      .toEqual(claimed({ subcategoryId: setup.fuel }, fuel));
  }));

  it('refuses a Subcategory whose Category another Budget claims (rollup)', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.attempt({}, [{ subcategoryId: setup.parking }]))
      .toEqual(claimed({ subcategoryId: setup.parking }, car));
  }));

  it('refuses a Category one of whose Subcategories another Budget claims', test(async (setup) => {
    const fuel = await setup.create({}, [{ subcategoryId: setup.fuel }]);

    expect(await setup.attempt({}, [{ categoryId: setup.transport }]))
      .toEqual(claimed({ categoryId: setup.transport }, fuel));
  }));

  it('lets one Budget hold a Category and its own Subcategory', test(async (setup) => {
    const result = await setup.attempt(
      {},
      [{ categoryId: setup.transport }, { subcategoryId: setup.fuel }],
    );

    expect(result.ok).toBe(true);
  }));

  it('lets each scope claim the same Category once (OQ-166)', test(async (setup) => {
    const personal = { visibility: 'personal' } as const;
    await setup.create({}, [{ categoryId: setup.transport }]);
    const anas = await setup.create(personal, [{ categoryId: setup.transport }]);
    await setup.create({ ...personal, ownerUserId: setup.bia }, [{ subcategoryId: setup.fuel }]);

    expect(await setup.attempt(personal, [{ subcategoryId: setup.fuel }]))
      .toEqual(claimed({ subcategoryId: setup.fuel }, anas));
  }));

  it('refuses a target that is not this household\'s', test(async (setup) => {
    expect(await setup.attempt({}, [{ categoryId: setup.garden }]))
      .toEqual({ ok: false, reason: 'target_not_found', target: { categoryId: setup.garden } });
    expect(await setup.attempt({}, [{ subcategoryId: UNKNOWN_ID }]))
      .toEqual({ ok: false, reason: 'target_not_found', target: { subcategoryId: UNKNOWN_ID } });
  }));

  it('passes on any other database error', test(async (setup) => {
    await expect(setup.attempt({ currency: 'brl' }, [])).rejects.toThrow();
    await asOwner(
      setup.db,
      'ALTER TABLE budget_targets ADD CONSTRAINT test_refuse CHECK (false) NOT VALID',
    );
    await expect(setup.attempt({}, [{ categoryId: setup.transport }])).rejects.toThrow();
  }));
});

describe('BudgetAccessor.findById', () => {
  it('finds only this household\'s Budgets', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.budgets.findById(setup.elsewhere, car)).toBeUndefined();
    expect(await setup.budgets.findById(setup.home, UNKNOWN_ID)).toBeUndefined();
  }));
});

describe('BudgetAccessor.list', () => {
  it('lists the shared Budgets and the viewer\'s personal ones, by name', test(async (setup) => {
    const personal = { visibility: 'personal' } as const;
    await setup.create({ name: 'Car' }, [{ categoryId: setup.transport }]);
    await setup.create({ ...personal, name: 'Ana' }, [{ categoryId: setup.shopping }]);
    const bias = { ...personal, name: 'Bia', ownerUserId: setup.bia };
    await setup.create(bias, [{ categoryId: setup.shopping }]);

    const page = await setup.budgets.list(setup.home, setup.ana, FIRST_PAGE);

    expect(page.total).toBe(2);
    expect(page.budgets.map((budget) => [budget.name, budget.targets])).toEqual([
      ['Ana', [{ categoryId: setup.shopping }]],
      ['Car', [{ categoryId: setup.transport }]],
    ]);
  }));

  it('filters by visibility and pages', test(async (setup) => {
    await setup.create({ name: 'Car' }, [{ categoryId: setup.transport }]);
    await setup.create({ name: 'Clothes' }, [{ categoryId: setup.shopping }]);
    await setup.create({ name: 'Mine', visibility: 'personal' }, [{ categoryId: setup.shopping }]);

    const page = await setup.budgets.list(
      setup.home,
      setup.ana,
      { visibility: 'shared', limit: 1, offset: 1 },
    );

    expect(page.total).toBe(2);
    expect(page.budgets.map((budget) => budget.name)).toEqual(['Clothes']);
  }));

  it('returns an empty page for a household without Budgets', test(async (setup) => {
    expect(await setup.budgets.list(setup.elsewhere, setup.ana, FIRST_PAGE))
      .toEqual({ budgets: [], total: 0 });
  }));
});

describe('BudgetAccessor.update', () => {
  it('renames without touching the periods', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.budgets.update(setup.home, car, { name: 'Vehicle' }, MARCH)).toBe('updated');

    expect((await setup.budgets.findById(setup.home, car))?.name).toBe('Vehicle');
    expect(await setup.periods(car)).toEqual([['2026-1', 50_000, 0]]);
  }));

  it('applies a new target from the current month on (FR-4.9)', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);
    await setup.accrue({ date: '2026-05-02' });

    expect(await setup.budgets.update(setup.home, car, { targetAmount: 70_000 }, MARCH))
      .toBe('updated');
    await setup.budgets.update(setup.home, car, { targetAmount: 80_000 }, MARCH);

    expect((await setup.budgets.findById(setup.home, car))?.targetAmount).toBe(80_000);
    expect(await setup.periods(car)).toEqual([
      ['2026-1', 50_000, 0], ['2026-3', 80_000, 0], ['2026-5', 80_000, 1_000],
    ]);
  }));

  it('treats an empty edit as a read', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.budgets.update(setup.home, car, {}, MARCH)).toBe('updated');
    expect(await setup.budgets.update(setup.home, UNKNOWN_ID, {}, MARCH)).toBe('not_found');
  }));

  it('edits only this household\'s Budgets', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.budgets.update(setup.elsewhere, car, { targetAmount: 1 }, MARCH))
      .toBe('not_found');
    expect(await setup.periods(car)).toEqual([['2026-1', 50_000, 0]]);
  }));
});

describe('BudgetAccessor.replaceTargets', () => {
  it('swaps the targets, releasing the ones dropped', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.budgets.replaceTargets(setup.home, car, [{ subcategoryId: setup.fuel }]))
      .toEqual({ ok: true });

    expect(await setup.targetsOf(car)).toEqual([{ subcategoryId: setup.fuel }]);
    expect((await setup.attempt({}, [{ subcategoryId: setup.parking }])).ok).toBe(true);
  }));

  it('keeps the old targets when a new one is refused', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);
    const clothes = await setup.create({}, [{ categoryId: setup.shopping }]);

    expect(await setup.budgets.replaceTargets(setup.home, car, [{ subcategoryId: setup.clothing }]))
      .toEqual(claimed({ subcategoryId: setup.clothing }, clothes));

    expect(await setup.targetsOf(car)).toEqual([{ categoryId: setup.transport }]);
  }));

  it('re-claims its own targets', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.budgets.replaceTargets(setup.home, car, [{ categoryId: setup.transport }]))
      .toEqual({ ok: true });
  }));

  it('finds only this household\'s Budgets', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.budgets.replaceTargets(setup.elsewhere, car, []))
      .toEqual({ ok: false, reason: 'not_found' });
    expect(await setup.targetsOf(car)).toEqual([{ categoryId: setup.transport }]);
  }));
});

describe('BudgetAccessor.delete', () => {
  it('releases the claims and keeps the periods as history (FR-4.10)', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);
    await setup.accrue();

    expect(await setup.budgets.delete(setup.home, car)).toBe(true);

    expect(await setup.budgets.findById(setup.home, car)).toBeUndefined();
    expect(await setup.db.select({
      budgetId: budgetPeriods.budgetId, spendAmount: budgetPeriods.spendAmount,
    }).from(budgetPeriods).where(eq(budgetPeriods.householdId, setup.home)))
      .toEqual([{ budgetId: null, spendAmount: 1_000 }]);
    expect((await setup.attempt({}, [{ categoryId: setup.transport }])).ok).toBe(true);
  }));

  it('deletes only this household\'s Budgets', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.budgets.delete(setup.elsewhere, car)).toBe(false);
    expect(await setup.budgets.findById(setup.home, car)).toBeDefined();
  }));
});

describe('BudgetAccessor.listPeriods', () => {
  it('lists the months in the range, inclusive, across a year boundary', test(async (setup) => {
    const november = { year: 2025, month: 11 };
    const car = await setup.create({}, [{ categoryId: setup.transport }], november);
    await setup.accrue({ date: '2025-12-01' });
    await setup.accrue({ date: '2026-02-01' });

    const periods = await setup.budgets.listPeriods(
      setup.home,
      car,
      { year: 2025, month: 12 },
      { year: 2026, month: 2 },
    );

    expect(periods.map((period) => [period.year, period.month])).toEqual([[2025, 12], [2026, 2]]);
    expect(periods[0]).toEqual(expect.objectContaining({ createdAt: expect.any(Date) }));
    expect(await setup.budgets.listPeriods(setup.elsewhere, car, november, MARCH)).toEqual([]);
  }));
});

describe('BudgetAccessor.accrueIfClaimed', () => {
  it('adds a spend to the claiming Budget\'s month, and reverses it', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.accrue()).toBe('accrued');
    await setup.accrue({ subcategoryId: null, amount: 500 });
    await setup.accrue({ amount: -1_000 });

    expect(await setup.periods(car)).toEqual([['2026-1', 50_000, 500]]);
  }));

  it('counts an exactly claimed Subcategory, not its siblings (FR-4.8)', test(async (setup) => {
    const fuel = await setup.create({}, [{ subcategoryId: setup.fuel }]);

    expect(await setup.accrue({ categoryId: null })).toBe('accrued');
    expect(await setup.accrue({ subcategoryId: setup.parking })).toBe('untracked');

    expect(await setup.periods(fuel)).toEqual([['2026-1', 50_000, 1_000]]);
  }));

  it('does not track an uncategorized or unclaimed spend', test(async (setup) => {
    await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.accrue({ categoryId: null, subcategoryId: null })).toBe('untracked');
    expect(await setup.accrue({ categoryId: setup.shopping, subcategoryId: null }))
      .toBe('untracked');
  }));

  it('only counts a spend in the Budget\'s currency', test(async (setup) => {
    await setup.create({}, [{ categoryId: setup.transport }]);

    expect(await setup.accrue({ currency: 'USD' })).toBe('untracked');
  }));

  it('counts a spend toward the Budget of its Account\'s scope (OQ-166)', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);
    const anas = await setup.create({ visibility: 'personal' }, [{ categoryId: setup.transport }]);
    const anaScope: BudgetScope = {
      householdId: setup.home, visibility: 'personal', ownerUserId: setup.ana,
    };

    await setup.accrue({ amount: 100 });
    await setup.accrue({ scope: anaScope, amount: 200 });

    const biaScope = { ...anaScope, ownerUserId: setup.bia };
    expect(await setup.accrue({ scope: biaScope })).toBe('untracked');
    expect(await setup.periods(car)).toEqual([['2026-1', 50_000, 100]]);
    expect(await setup.periods(anas)).toEqual([['2026-1', 50_000, 200]]);
  }));

  it('opens a month with the target in effect then, not before the first', test(async (setup) => {
    const car = await setup.create({}, [{ categoryId: setup.transport }]);
    await setup.budgets.update(setup.home, car, { targetAmount: 70_000 }, MARCH);

    expect(await setup.accrue({ date: '2025-12-31' })).toBe('untracked');
    await setup.accrue({ date: '2026-02-10' });
    await setup.accrue({ date: '2026-04-10' });

    expect(await setup.periods(car)).toEqual([
      ['2026-1', 50_000, 0],
      ['2026-2', 50_000, 1_000],
      ['2026-3', 70_000, 0],
      ['2026-4', 70_000, 1_000],
    ]);
  }));
});
