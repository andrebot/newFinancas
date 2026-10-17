import type { PGlite } from '@electric-sql/pglite';
import { defaultCategoriesFor } from '@financas/reference';
import { eq } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createCategoryAccessor, { type Category } from '../../../src/accessors/categoryAccessor';
import type { Database } from '../../../src/db/database';
import { categories, households, subcategories } from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const UNKNOWN_ID = '00000000-0000-7000-8000-000000000000';
const EARLIER = new Date('2026-01-02T03:04:05Z');

type Categories = ReturnType<typeof createCategoryAccessor>;

/** One test's data: two households and helpers. */
interface Setup {
  readonly categories: Categories;
  readonly db: Database;
  readonly householdId: string;
  readonly otherHouseholdId: string;
  /** Creates a Category in `householdId` with these Subcategories; fails on a refusal. */
  readonly create: (name: string, subcategoryNames?: readonly string[]) => Promise<Category>;
}

/**
 * Inserts a household.
 *
 * @param db - The test database.
 * @param name - Its name.
 * @returns The household id.
 */
const addHousehold = async (db: Database, name: string) => (
  await db.insert(households).values({ name }).returning({ id: households.id })
)[0]!.id;

/**
 * Narrows a write's result to a Category, failing the test on a refusal.
 *
 * @param result - What the write returned.
 * @returns The Category.
 */
const categoryOf = (result: Category | string): Category => {
  if (typeof result === 'string') throw new Error(`refused: ${result}`);
  return result;
};

/**
 * Projects Categories to their names and their Subcategories' names.
 *
 * @param rows - Categories.
 * @returns `[name, [subcategory names]]` per Category.
 */
const names = (rows: readonly Category[]) => rows.map(
  (row) => [row.name, row.subcategories.map((child) => child.name)],
);

/**
 * Marks a Subcategory archived at a fixed earlier time.
 *
 * @param db - The test database.
 * @param subcategoryId - The Subcategory.
 * @returns Resolves once marked.
 */
const archiveEarlier = async (db: Database, subcategoryId: string) => {
  await db.update(subcategories).set({ archivedAt: EARLIER })
    .where(eq(subcategories.id, subcategoryId));
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
    const householdId = await addHousehold(db, 'Casa');
    const otherHouseholdId = await addHousehold(db, 'Outra');
    const accessor = createCategoryAccessor(db);
    await test({
      categories: accessor,
      db,
      householdId,
      otherHouseholdId,
      create: async (name, subcategoryNames = []) => {
        const category = categoryOf(await accessor.insert(
          householdId,
          { name, icon: 'restaurant', color: 'sun' },
        ));
        if (subcategoryNames.length === 0) return category;
        return categoryOf(await accessor.update(householdId, category.id, {
          subcategories: subcategoryNames.map((childName) => ({ name: childName })),
        }));
      },
    });
  },
);

describe('CategoryAccessor.insert', () => {
  it('creates a Category with no Subcategories yet', scenario(async (setup) => {
    const category = categoryOf(await setup.categories.insert(
      setup.householdId,
      { name: 'Pets', icon: 'pets', color: 'mint' },
    ));

    expect(category).toMatchObject({
      householdId: setup.householdId,
      name: 'Pets',
      icon: 'pets',
      color: 'mint',
      archivedAt: null,
      subcategories: [],
    });
    expect(category.createdAt).toBeInstanceOf(Date);
    expect(await setup.categories.findById(setup.householdId, category.id)).toEqual(category);
  }));

  it('refuses an icon outside the icon set, writing nothing', scenario(async (setup) => {
    const result = await setup.categories.insert(
      setup.householdId,
      { name: 'Pets', icon: 'dog', color: 'mint' },
    );

    expect(result).toBe('invalid_icon');
    expect(await setup.categories.list(setup.householdId)).toEqual([]);
  }));

  it('refuses a colour outside the palette, writing nothing', scenario(async (setup) => {
    const result = await setup.categories.insert(
      setup.householdId,
      { name: 'Pets', icon: 'pets', color: '#00ff00' },
    );

    expect(result).toBe('invalid_color');
    expect(await setup.categories.list(setup.householdId)).toEqual([]);
  }));
});

describe('CategoryAccessor.findById', () => {
  it('reads a Category with every Subcategory, open first, by name', scenario(async (setup) => {
    const created = await setup.create('Food', ['Restaurants', 'Bakery', 'Groceries']);
    await archiveEarlier(setup.db, created.subcategories.find(
      (child) => child.name === 'Bakery',
    )!.id);

    const category = await setup.categories.findById(setup.householdId, created.id);

    expect(category?.subcategories.map((child) => [child.name, child.archivedAt])).toEqual([
      ['Groceries', null], ['Restaurants', null], ['Bakery', EARLIER],
    ]);
    expect(category?.subcategories.every((child) => child.categoryId === created.id)).toBe(true);
  }));

  it('finds nothing in another household or for an unknown id', scenario(async (setup) => {
    const category = await setup.create('Food');

    expect(await setup.categories.findById(setup.otherHouseholdId, category.id)).toBeUndefined();
    expect(await setup.categories.findById(setup.householdId, UNKNOWN_ID)).toBeUndefined();
  }));
});

describe('CategoryAccessor.list', () => {
  it('lists open Categories and Subcategories by name', scenario(async (setup) => {
    const transport = await setup.create('Transport', ['Taxi', 'Fuel']);
    await setup.create('Food');
    const pets = await setup.create('Pets');
    await setup.categories.archive(setup.householdId, pets.id);
    await setup.categories.archiveSubcategory(
      setup.householdId,
      transport.id,
      transport.subcategories.find((child) => child.name === 'Taxi')!.id,
    );

    expect(names(await setup.categories.list(setup.householdId))).toEqual([
      ['Food', []], ['Transport', ['Fuel']],
    ]);
  }));

  it('includes archived ones on request, after the open ones', scenario(async (setup) => {
    const transport = await setup.create('Transport', ['Taxi', 'Fuel']);
    const animals = await setup.create('Animals', ['Vet']);
    await setup.create('Food');
    await setup.categories.archive(setup.householdId, animals.id);
    await setup.categories.archiveSubcategory(
      setup.householdId,
      transport.id,
      transport.subcategories.find((child) => child.name === 'Fuel')!.id,
    );

    expect(names(await setup.categories.list(setup.householdId, { includeArchived: true })))
      .toEqual([['Food', []], ['Transport', ['Taxi', 'Fuel']], ['Animals', ['Vet']]]);
  }));

  it('lists only the household\'s own Categories', scenario(async (setup) => {
    await setup.create('Food');

    expect(await setup.categories.list(setup.otherHouseholdId)).toEqual([]);
  }));
});

describe('CategoryAccessor.update', () => {
  it('changes the name, icon and colour', scenario(async (setup) => {
    const category = await setup.create('Food');

    const updated = categoryOf(await setup.categories.update(
      setup.householdId,
      category.id,
      { name: 'Groceries', icon: 'shopping-cart-outline', color: 'mint' },
    ));

    expect(updated).toMatchObject({
      id: category.id, name: 'Groceries', icon: 'shopping-cart-outline', color: 'mint',
    });
  }));

  it('reads the Category back for an empty change', scenario(async (setup) => {
    const category = await setup.create('Food', ['Bakery']);

    expect(await setup.categories.update(setup.householdId, category.id, {})).toEqual(category);
  }));

  it('renames listed Subcategories and creates new ones in one edit', scenario(async (setup) => {
    const category = await setup.create('Food', ['Bakery', 'Restaurants']);
    const bakery = category.subcategories.find((child) => child.name === 'Bakery')!;

    const updated = categoryOf(await setup.categories.update(setup.householdId, category.id, {
      name: 'Eating',
      subcategories: [{ id: bakery.id, name: 'Bread' }, { name: 'Coffee' }],
    }));

    expect(names([updated])).toEqual([['Eating', ['Bread', 'Coffee', 'Restaurants']]]);
    expect(updated.subcategories.find((child) => child.name === 'Bread')?.id).toBe(bakery.id);
  }));

  it('accepts the same Subcategory listed twice', scenario(async (setup) => {
    const category = await setup.create('Food', ['Bakery']);
    const [bakery] = category.subcategories;

    const updated = categoryOf(await setup.categories.update(setup.householdId, category.id, {
      subcategories: [{ id: bakery!.id, name: 'Bread' }, { id: bakery!.id, name: 'Bread' }],
    }));

    expect(names([updated])).toEqual([['Food', ['Bread']]]);
  }));

  it('refuses an unknown icon or colour, writing nothing', scenario(async (setup) => {
    const category = await setup.create('Food');

    expect(await setup.categories.update(setup.householdId, category.id, { icon: 'dog' }))
      .toBe('invalid_icon');
    expect(await setup.categories.update(setup.householdId, category.id, { color: 'red' }))
      .toBe('invalid_color');
    expect(await setup.categories.findById(setup.householdId, category.id)).toEqual(category);
  }));

  it('refuses another household\'s Category', scenario(async (setup) => {
    const category = await setup.create('Food');

    expect(await setup.categories.update(setup.otherHouseholdId, category.id, { name: 'Mine' }))
      .toBe('not_found');
    expect((await setup.categories.findById(setup.householdId, category.id))?.name).toBe('Food');
  }));

  it('refuses a Subcategory of another Category, writing nothing', scenario(async (setup) => {
    const food = await setup.create('Food', ['Bakery']);
    const transport = await setup.create('Transport', ['Fuel']);

    const result = await setup.categories.update(setup.householdId, food.id, {
      name: 'Eating',
      subcategories: [{ name: 'Coffee' }, { id: transport.subcategories[0]!.id, name: 'Bread' }],
    });

    expect(result).toBe('subcategory_not_found');
    expect(names(await setup.categories.list(setup.householdId))).toEqual([
      ['Food', ['Bakery']], ['Transport', ['Fuel']],
    ]);
  }));
});

describe('CategoryAccessor.archive', () => {
  it('archives the Category and its open Subcategories together', scenario(async (setup) => {
    const category = await setup.create('Food', ['Bakery', 'Restaurants', 'Coffee']);
    const coffee = category.subcategories.find((child) => child.name === 'Coffee')!;
    await archiveEarlier(setup.db, coffee.id);

    expect(await setup.categories.archive(setup.householdId, category.id)).toBe(true);

    const archived = (await setup.categories.findById(setup.householdId, category.id))!;
    const times = Object.fromEntries(archived.subcategories.map(
      (child) => [child.name, child.archivedAt],
    ));
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(times).toEqual({
      Bakery: archived.archivedAt, Restaurants: archived.archivedAt, Coffee: EARLIER,
    });
  }));

  it('keeps the first archive time when archived again', scenario(async (setup) => {
    const category = await setup.create('Food');
    await setup.db.update(categories).set({ archivedAt: EARLIER })
      .where(eq(categories.id, category.id));

    expect(await setup.categories.archive(setup.householdId, category.id)).toBe(true);
    expect((await setup.categories.findById(setup.householdId, category.id))?.archivedAt)
      .toEqual(EARLIER);
  }));

  it('leaves other Categories alone', scenario(async (setup) => {
    const food = await setup.create('Food', ['Bakery']);
    await setup.create('Transport', ['Fuel']);

    await setup.categories.archive(setup.householdId, food.id);

    expect(names(await setup.categories.list(setup.householdId))).toEqual([
      ['Transport', ['Fuel']],
    ]);
  }));

  it('refuses another household\'s Category', scenario(async (setup) => {
    const category = await setup.create('Food', ['Bakery']);

    expect(await setup.categories.archive(setup.otherHouseholdId, category.id)).toBe(false);
    expect(await setup.categories.findById(setup.householdId, category.id)).toEqual(category);
  }));
});

describe('CategoryAccessor.archiveSubcategory', () => {
  it('archives one Subcategory, leaving its Category and siblings open', scenario(async (setup) => {
    const category = await setup.create('Food', ['Bakery', 'Coffee']);
    const bakery = category.subcategories.find((child) => child.name === 'Bakery')!;

    expect(await setup.categories.archiveSubcategory(setup.householdId, category.id, bakery.id))
      .toBe(true);

    const after = (await setup.categories.findById(setup.householdId, category.id))!;
    expect(after.archivedAt).toBeNull();
    expect(after.subcategories.map((child) => [child.name, child.archivedAt !== null]))
      .toEqual([['Coffee', false], ['Bakery', true]]);
  }));

  it('keeps the first archive time when archived again', scenario(async (setup) => {
    const category = await setup.create('Food', ['Bakery']);
    const [bakery] = category.subcategories;
    await archiveEarlier(setup.db, bakery!.id);

    expect(await setup.categories.archiveSubcategory(setup.householdId, category.id, bakery!.id))
      .toBe(true);
    expect((await setup.categories.findById(setup.householdId, category.id))
      ?.subcategories[0]?.archivedAt).toEqual(EARLIER);
  }));

  it('refuses a Subcategory under another Category', scenario(async (setup) => {
    const food = await setup.create('Food', ['Bakery']);
    const transport = await setup.create('Transport');

    expect(await setup.categories.archiveSubcategory(
      setup.householdId,
      transport.id,
      food.subcategories[0]!.id,
    )).toBe(false);
    expect(await setup.categories.findById(setup.householdId, food.id)).toEqual(food);
  }));

  it('refuses a Subcategory of another household', scenario(async (setup) => {
    const food = await setup.create('Food', ['Bakery']);

    expect(await setup.categories.archiveSubcategory(
      setup.otherHouseholdId,
      food.id,
      food.subcategories[0]!.id,
    )).toBe(false);
    expect(await setup.categories.findById(setup.householdId, food.id)).toEqual(food);
  }));
});

describe('CategoryAccessor.seedDefaults', () => {
  it('seeds the defaults in the creator\'s language, styled', scenario(async (setup) => {
    expect(await setup.categories.seedDefaults(setup.householdId, 'pt-BR')).toBe(true);

    const seeded = await setup.categories.list(setup.householdId);
    const brief = (rows: readonly {
      name: string; icon: string; color: string; subcategories: readonly unknown[];
    }[]) => rows.map((row) => [row.name, row.icon, row.color]);
    const expected = defaultCategoriesFor('pt-BR')
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
    expect(brief(seeded)).toEqual(brief(expected));
    expect(seeded.map((row) => row.subcategories.map((child) => child.name).sort()))
      .toEqual(expected.map((row) => [...row.subcategories].sort()));
  }));

  it('names the defaults in English for an English-speaking creator', scenario(async (setup) => {
    await setup.categories.seedDefaults(setup.householdId, 'en-US');

    const seeded = await setup.categories.list(setup.householdId);
    expect(seeded.map((row) => row.name).sort())
      .toEqual(defaultCategoriesFor('en-US').map((row) => row.name).sort());
  }));

  it('seeds a household only once', scenario(async (setup) => {
    await setup.categories.seedDefaults(setup.householdId, 'pt-BR');

    expect(await setup.categories.seedDefaults(setup.householdId, 'pt-BR')).toBe(false);
    expect(await setup.categories.list(setup.householdId))
      .toHaveLength(defaultCategoriesFor('pt-BR').length);
  }));

  it('leaves a household that already has a Category alone', scenario(async (setup) => {
    await setup.create('Food');

    expect(await setup.categories.seedDefaults(setup.householdId, 'pt-BR')).toBe(false);
    expect(names(await setup.categories.list(setup.householdId))).toEqual([['Food', []]]);
  }));

  it('seeds nothing for a household that does not exist', scenario(async (setup) => {
    expect(await setup.categories.seedDefaults(UNKNOWN_ID, 'pt-BR')).toBe(false);
  }));

  it('seeds each household on its own', scenario(async (setup) => {
    await setup.categories.seedDefaults(setup.householdId, 'pt-BR');

    expect(await setup.categories.seedDefaults(setup.otherHouseholdId, 'en-US')).toBe(true);
  }));
});
