import type { PGlite } from '@electric-sql/pglite';
import type { IndexCodeValue } from '@financas/reference';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createIndexRateAccessor, {
  type IndexRateValue,
} from '../../../src/accessors/indexRateAccessor';
import type { Database } from '../../../src/db/database';
import { households, indexRateValues, users } from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const UNKNOWN_ID = '00000000-0000-7000-8000-000000000000';

type Rates = ReturnType<typeof createIndexRateAccessor>;

/** One test's data: two households, a user, and helpers. */
interface Setup {
  readonly rates: Rates;
  readonly db: Database;
  readonly householdId: string;
  readonly otherHouseholdId: string;
  readonly userId: string;
  /** Records a value in `householdId`; returns it, failing on a duplicate day. */
  readonly record: (
    indexCode: IndexCodeValue,
    value: number,
    asOfDate: string,
  ) => Promise<IndexRateValue>;
}

/**
 * Inserts one row and returns its id.
 *
 * @param query - An insert returning `{ id }`.
 * @returns The id.
 */
const idOf = async (query: Promise<{ id: string }[]>) => (await query)[0]!.id;

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
 * Narrows a write's result to a value, failing the test on a refusal.
 *
 * @param result - What the write returned.
 * @returns The value.
 */
const valueOf = (result: IndexRateValue | string): IndexRateValue => {
  if (typeof result === 'string') throw new Error(`refused: ${result}`);
  return result;
};

/**
 * Projects values to the fields the assertions compare.
 *
 * @param rows - Values.
 * @returns `[indexCode, value, asOfDate]` per value.
 */
const brief = (rows: readonly IndexRateValue[]) => rows.map(
  (row) => [row.indexCode, row.value, row.asOfDate],
);

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
    const userId = await idOf(db.insert(users).values({
      email: 'ana@example.com',
      passwordHash: 'x',
      firstName: 'Ana',
      lastName: 'Silva',
      mfaSecret: 'x',
    }).returning({ id: users.id }));
    const rates = createIndexRateAccessor(db);
    await test({
      rates,
      db,
      householdId,
      otherHouseholdId,
      userId,
      record: async (indexCode, value, asOfDate) => valueOf(
        await rates.insert(householdId, { indexCode, value, asOfDate }, userId),
      ),
    });
  },
);

describe('IndexRateAccessor.insert', () => {
  it('records a value with its household and recorder', scenario(async (setup) => {
    const rate = await setup.record('selic', 105_000, '2026-10-01');

    expect(rate).toMatchObject({
      householdId: setup.householdId,
      indexCode: 'selic',
      value: 105_000,
      asOfDate: '2026-10-01',
      createdByUserId: setup.userId,
    });
    expect(rate.createdAt).toBeInstanceOf(Date);
  }));

  it('stores a large fixed-point value exactly', scenario(async (setup) => {
    const rate = await setup.record('ipca', 1_234_567_891, '2026-10-01');

    expect((await setup.rates.latest(setup.householdId, 'ipca'))?.value).toBe(rate.value);
    expect(rate.value).toBe(1_234_567_891);
  }));

  it('refuses a second value for an index on the same day', scenario(async (setup) => {
    await setup.record('cdi', 104_000, '2026-10-01');

    const result = await setup.rates.insert(
      setup.householdId,
      { indexCode: 'cdi', value: 105_000, asOfDate: '2026-10-01' },
      setup.userId,
    );

    expect(result).toBe('duplicate_day');
    expect(brief(await setup.rates.list(setup.householdId)))
      .toEqual([['cdi', 104_000, '2026-10-01']]);
  }));

  it('allows the same day for another index or household', scenario(async (setup) => {
    await setup.record('cdi', 104_000, '2026-10-01');
    await setup.record('selic', 105_000, '2026-10-01');
    const other = await setup.rates.insert(
      setup.otherHouseholdId,
      { indexCode: 'cdi', value: 99_000, asOfDate: '2026-10-01' },
      setup.userId,
    );

    expect(valueOf(other).householdId).toBe(setup.otherHouseholdId);
    expect(await setup.rates.list(setup.householdId)).toHaveLength(2);
  }));

  it('rethrows any other database error', scenario(async (setup) => {
    await expect(setup.rates.insert(
      UNKNOWN_ID,
      { indexCode: 'cdi', value: 104_000, asOfDate: '2026-10-01' },
      setup.userId,
    )).rejects.toThrow();
  }));
});

describe('IndexRateAccessor.update', () => {
  it('changes the value and the day', scenario(async (setup) => {
    const rate = await setup.record('selic', 105_000, '2026-10-01');

    const updated = await setup.rates.update(
      setup.householdId,
      'selic',
      rate.id,
      { value: 107_500, asOfDate: '2026-09-30' },
    );

    expect(brief([valueOf(updated)])).toEqual([['selic', 107_500, '2026-09-30']]);
  }));

  it('changes only the fields given', scenario(async (setup) => {
    const rate = await setup.record('selic', 105_000, '2026-10-01');

    const updated = await setup.rates.update(
      setup.householdId,
      'selic',
      rate.id,
      { value: 106_000 },
    );

    expect(brief([valueOf(updated)])).toEqual([['selic', 106_000, '2026-10-01']]);
  }));

  it('reads the value back for an empty change', scenario(async (setup) => {
    const rate = await setup.record('selic', 105_000, '2026-10-01');

    expect(await setup.rates.update(setup.householdId, 'selic', rate.id, {})).toEqual(rate);
    expect(await setup.rates.update(setup.householdId, 'selic', UNKNOWN_ID, {})).toBe('not_found');
  }));

  it('refuses moving a value onto a day that has one', scenario(async (setup) => {
    await setup.record('ipca', 45_000, '2026-09-01');
    const rate = await setup.record('ipca', 46_000, '2026-10-01');

    const result = await setup.rates.update(
      setup.householdId,
      'ipca',
      rate.id,
      { asOfDate: '2026-09-01' },
    );

    expect(result).toBe('duplicate_day');
    expect(brief(await setup.rates.list(setup.householdId))).toEqual([
      ['ipca', 46_000, '2026-10-01'],
      ['ipca', 45_000, '2026-09-01'],
    ]);
  }));

  it('changes nothing through another household or index', scenario(async (setup) => {
    const rate = await setup.record('selic', 105_000, '2026-10-01');

    expect(await setup.rates.update(setup.otherHouseholdId, 'selic', rate.id, { value: 1 }))
      .toBe('not_found');
    expect(await setup.rates.update(setup.householdId, 'cdi', rate.id, { value: 1 }))
      .toBe('not_found');
    expect(await setup.rates.update(setup.householdId, 'selic', UNKNOWN_ID, { value: 1 }))
      .toBe('not_found');
    expect((await setup.rates.latest(setup.householdId, 'selic'))?.value).toBe(105_000);
  }));
});

describe('IndexRateAccessor.remove', () => {
  it('deletes a value; the previous one becomes the latest', scenario(async (setup) => {
    await setup.record('igpm', 30_000, '2026-09-01');
    const rate = await setup.record('igpm', 32_000, '2026-10-01');

    expect(await setup.rates.remove(setup.householdId, 'igpm', rate.id)).toBe('deleted');
    expect((await setup.rates.latest(setup.householdId, 'igpm'))?.value).toBe(30_000);
  }));

  it('deletes nothing through another household or index', scenario(async (setup) => {
    const rate = await setup.record('igpm', 32_000, '2026-10-01');

    expect(await setup.rates.remove(setup.otherHouseholdId, 'igpm', rate.id)).toBe('not_found');
    expect(await setup.rates.remove(setup.householdId, 'ipca', rate.id)).toBe('not_found');
    expect(await setup.rates.list(setup.householdId)).toHaveLength(1);
  }));
});

describe('IndexRateAccessor.findById', () => {
  it('reads a value of the household and index asked for', scenario(async (setup) => {
    const rate = await setup.record('cdi', 104_000, '2026-10-01');

    expect(await setup.rates.findById(setup.householdId, 'cdi', rate.id)).toEqual(rate);
  }));

  it('finds nothing through another household or index', scenario(async (setup) => {
    const rate = await setup.record('cdi', 104_000, '2026-10-01');

    expect(await setup.rates.findById(setup.otherHouseholdId, 'cdi', rate.id)).toBeUndefined();
    expect(await setup.rates.findById(setup.householdId, 'selic', rate.id)).toBeUndefined();
  }));
});

describe('IndexRateAccessor.latest', () => {
  it('picks the highest date, not the last written', scenario(async (setup) => {
    await setup.record('cdi', 104_000, '2026-10-01');
    await setup.record('cdi', 99_000, '2026-08-01');

    expect((await setup.rates.latest(setup.householdId, 'cdi'))?.value).toBe(104_000);
  }));

  it('reads only the household and index asked for', scenario(async (setup) => {
    await setup.record('selic', 105_000, '2026-10-01');
    await setup.rates.insert(
      setup.otherHouseholdId,
      { indexCode: 'cdi', value: 99_000, asOfDate: '2026-10-05' },
      setup.userId,
    );

    expect(await setup.rates.latest(setup.householdId, 'cdi')).toBeUndefined();
  }));
});

describe('IndexRateAccessor.list', () => {
  it('lists every value by index, newest first', scenario(async (setup) => {
    await setup.record('selic', 105_000, '2026-09-01');
    await setup.record('cdi', 104_000, '2026-10-01');
    await setup.record('selic', 107_500, '2026-10-01');
    await setup.rates.insert(
      setup.otherHouseholdId,
      { indexCode: 'ipca', value: 45_000, asOfDate: '2026-10-01' },
      setup.userId,
    );

    expect(brief(await setup.rates.list(setup.householdId))).toEqual([
      ['cdi', 104_000, '2026-10-01'],
      ['selic', 107_500, '2026-10-01'],
      ['selic', 105_000, '2026-09-01'],
    ]);
  }));

  it('is empty for a household with no values', scenario(async (setup) => {
    expect(await setup.rates.list(setup.householdId)).toEqual([]);
  }));

  it('keeps a value once its recorder is anonymized', scenario(async (setup) => {
    const rate = await setup.record('cdi', 104_000, '2026-10-01');
    await setup.db.update(indexRateValues).set({ createdByUserId: null });

    expect(await setup.rates.list(setup.householdId)).toEqual([{ ...rate, createdByUserId: null }]);
  }));
});
