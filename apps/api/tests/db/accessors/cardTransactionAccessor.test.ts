import type { PGlite } from '@electric-sql/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createCardTransactionAccessor, {
  type CardTransaction,
  type CardTransactionFilter,
  type NewCardTransaction,
} from '../../../src/accessors/cardTransactionAccessor';
import type { Database } from '../../../src/db/database';
import {
  accounts, categories, creditCards, households, subcategories, users,
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

type Transactions = ReturnType<typeof createCardTransactionAccessor>;

/** One test's data: two cards on one Account, a Category tree and a member. */
interface Setup {
  readonly ledger: Transactions;
  readonly db: Database;
  readonly householdId: string;
  readonly userId: string;
  readonly visa: string;
  readonly master: string;
  readonly food: string;
  readonly groceries: string;
  readonly transport: string;
  /** Records a charge on `visa` (or as overridden); returns it. */
  readonly record: (overrides?: Partial<NewCardTransaction>) => Promise<CardTransaction>;
}

/**
 * Inserts one row and returns its id.
 *
 * @param query - An insert returning `{ id }`.
 * @returns The id.
 */
const idOf = async (query: Promise<{ id: string }[]>) => (await query)[0]!.id;

/**
 * Inserts a card on an Account.
 *
 * @param db - The test database.
 * @param accountId - Its Account.
 * @param last4 - Its last four digits.
 * @returns The card id.
 */
const addCard = (db: Database, accountId: string, last4: string) => idOf(
  db.insert(creditCards).values({
    accountId,
    network: 'visa',
    last4,
    closingDay: 5,
    dueDay: 12,
    expirationMonth: 1,
    expirationYear: 2030,
  }).returning({ id: creditCards.id }),
);

/**
 * Inserts a Category.
 *
 * @param db - The test database.
 * @param householdId - Its household.
 * @param name - Its name.
 * @returns The Category id.
 */
const addCategory = (db: Database, householdId: string, name: string) => idOf(
  db.insert(categories).values({
    householdId, name, icon: 'cart', color: 'teal',
  }).returning({ id: categories.id }),
);

/**
 * Records transactions one after another, so rows on one date order by id as
 * recorded.
 *
 * @param record - The setup's recorder.
 * @param entries - Each transaction's overrides.
 * @returns The transactions, in the order recorded.
 */
const recordAll = (
  record: Setup['record'],
  entries: readonly Partial<NewCardTransaction>[],
) => entries.reduce<Promise<CardTransaction[]>>(
  async (recorded, entry) => [...await recorded, await record(entry)],
  Promise.resolve([]),
);

/**
 * Lists every filtered transaction's id, newest first.
 *
 * @param ledger - The accessor.
 * @param filter - The criteria.
 * @returns The ids.
 */
const idsOf = async (ledger: Transactions, filter: CardTransactionFilter) => (
  await ledger.list(filter, undefined, 100)
).map((transaction) => transaction.id);

/**
 * Runs a test against fresh data, rolled back afterwards.
 *
 * @param test - The test, given its setup.
 * @returns Resolves when the test is done.
 */
const scenario = (test: (setup: Setup) => Promise<void>) => () => withRollback(
  pglite,
  async (db) => {
    const householdId = await idOf(
      db.insert(households).values({ name: 'Casa' }).returning({ id: households.id }),
    );
    const accountId = await idOf(db.insert(accounts).values({
      householdId,
      name: 'Checking',
      type: 'checking',
      currency: 'BRL',
      visibility: 'shared',
      startingBalanceDate: '2026-01-01',
    }).returning({ id: accounts.id }));
    const visa = await addCard(db, accountId, '1234');
    const food = await addCategory(db, householdId, 'Food');
    const ledger = createCardTransactionAccessor(db);
    await test({
      ledger,
      db,
      householdId,
      userId: await idOf(db.insert(users).values({
        email: 'ana@example.com',
        passwordHash: 'x',
        firstName: 'Ana',
        lastName: 'Silva',
        mfaSecret: 'x',
      }).returning({ id: users.id })),
      visa,
      master: await addCard(db, accountId, '5678'),
      food,
      groceries: await idOf(db.insert(subcategories).values({ categoryId: food, name: 'Groceries' })
        .returning({ id: subcategories.id })),
      transport: await addCategory(db, householdId, 'Transport'),
      record: async (overrides = {}) => {
        const result = await ledger.insert({
          creditCardId: visa,
          kind: 'charge',
          date: '2026-10-08',
          amount: 1_000,
          currency: 'BRL',
          ...overrides,
        });
        if (!result.ok) throw new Error(result.reason);
        return result.transaction;
      },
    });
  },
);

describe('insert', () => {
  it('records a charge and a refund and reads them back', scenario(async ({
    record, visa, userId, food, groceries,
  }) => {
    const charge = await record({
      categoryId: food, subcategoryId: groceries, description: 'Market', createdByUserId: userId,
    });
    const refund = await record({ kind: 'refund' });

    expect(charge).toMatchObject({
      creditCardId: visa,
      kind: 'charge',
      date: '2026-10-08',
      amount: 1_000,
      currency: 'BRL',
      categoryId: food,
      subcategoryId: groceries,
      description: 'Market',
      createdByUserId: userId,
    });
    expect(charge.createdAt).toBeInstanceOf(Date);
    expect(refund).toMatchObject({
      kind: 'refund', categoryId: null, description: null, createdByUserId: null,
    });
  }));

  it('reports a reference that is gone', scenario(async ({ ledger }) => {
    expect(await ledger.insert({
      creditCardId: UNKNOWN_ID,
      kind: 'charge',
      date: '2026-10-08',
      amount: 1_000,
      currency: 'BRL',
    })).toEqual({ ok: false, reason: 'reference_not_found' });
  }));

  it('lets any other failure through', scenario(async ({ record }) => {
    await expect(record({ amount: 0 })).rejects.toThrow();
  }));
});

describe('findById', () => {
  it('reads a transaction only within its household', scenario(async ({
    record, ledger, householdId, db,
  }) => {
    const stored = await record();
    const otherHousehold = await idOf(
      db.insert(households).values({ name: 'Other' }).returning({ id: households.id }),
    );

    expect(await ledger.findById(householdId, stored.id)).toEqual(stored);
    expect(await ledger.findById(otherHousehold, stored.id)).toBeUndefined();
    expect(await ledger.findById(householdId, UNKNOWN_ID)).toBeUndefined();
  }));
});

describe('update', () => {
  it('changes the values it is given', scenario(async ({
    record, ledger, food, groceries,
  }) => {
    const charge = await record({ categoryId: food, subcategoryId: groceries, description: 'Old' });

    expect(await ledger.update(charge.id, charge, {
      date: '2026-10-09',
      amount: 2_000,
      categoryId: null,
      subcategoryId: null,
      description: null,
    })).toEqual({
      status: 'updated',
      transaction: {
        ...charge,
        date: '2026-10-09',
        amount: 2_000,
        categoryId: null,
        subcategoryId: null,
        description: null,
      },
    });
  }));

  it('never writes what is not an editable value', scenario(async ({
    record, ledger, master,
  }) => {
    const charge = await record();
    const wider = { description: 'x', creditCardId: master, kind: 'refund' };

    const result = await ledger.update(charge.id, charge, wider);

    expect(result).toEqual({ status: 'updated', transaction: { ...charge, description: 'x' } });
  }));

  it('answers the transaction as it stands when nothing changes', scenario(async ({
    record, ledger,
  }) => {
    const stored = await record();

    expect(await ledger.update(stored.id, stored, {}))
      .toEqual({ status: 'updated', transaction: stored });
  }));

  it('is stale once the values it was computed from changed', scenario(async ({
    record, ledger, food,
  }) => {
    const stored = await record({ categoryId: food });
    await ledger.update(stored.id, stored, { amount: 5_000 });

    expect(await ledger.update(stored.id, stored, { description: 'x' }))
      .toEqual({ status: 'stale' });
    expect(await ledger.update(stored.id, stored, {})).toEqual({ status: 'stale' });
    expect(await ledger.update(stored.id, { ...stored, amount: 5_000, categoryId: null }, {}))
      .toEqual({ status: 'stale' });
    expect(await ledger.update(UNKNOWN_ID, stored, { amount: 1 })).toEqual({ status: 'stale' });
  }));
});

describe('delete', () => {
  it('deletes while it still holds what was read, then is stale', scenario(async ({
    record, ledger, householdId,
  }) => {
    const stored = await record();

    expect(await ledger.delete(stored.id, { ...stored, amount: 1 })).toBe('stale');
    expect(await ledger.delete(stored.id, stored)).toBe('deleted');
    expect(await ledger.findById(householdId, stored.id)).toBeUndefined();
    expect(await ledger.delete(stored.id, stored)).toBe('stale');
  }));
});

describe('list', () => {
  it('matches nothing without cards', scenario(async ({ record, ledger }) => {
    await record();

    expect(await ledger.list({ creditCardIds: [] }, undefined, 10)).toEqual([]);
  }));

  it('pages newest first, two rows on one date neither repeated nor skipped', scenario(async ({
    record, ledger, visa,
  }) => {
    const [older, first, second, newest] = await recordAll(record, [
      { date: '2026-10-01' },
      { date: '2026-10-05' },
      { date: '2026-10-05' },
      { date: '2026-10-09' },
    ]);
    const filter = { creditCardIds: [visa] };

    const page1 = await ledger.list(filter, undefined, 2);
    const last = page1.at(-1)!;
    const page2 = await ledger.list(filter, { date: last.date, id: last.id }, 2);

    expect(page1.map((row) => row.id)).toEqual([newest!.id, second!.id]);
    expect(page2.map((row) => row.id)).toEqual([first!.id, older!.id]);
  }));

  it('reads only the cards it is given', scenario(async ({
    record, ledger, visa, master,
  }) => {
    const mine = await record();
    const other = await record({ creditCardId: master, date: '2026-10-09' });

    expect(await idsOf(ledger, { creditCardIds: [visa] })).toEqual([mine.id]);
    expect(await idsOf(ledger, { creditCardIds: [visa, master] })).toEqual([other.id, mine.id]);
  }));

  it('filters by kind and dates', scenario(async ({ record, ledger, visa }) => {
    const [, refund, charge] = await recordAll(record, [
      { date: '2026-09-30' },
      { kind: 'refund', date: '2026-10-01' },
      { date: '2026-10-31' },
      { date: '2026-11-01' },
    ]);
    const cards = { creditCardIds: [visa] };

    expect(await idsOf(ledger, { ...cards, kinds: ['refund'] })).toEqual([refund!.id]);
    expect(await idsOf(ledger, { ...cards, from: '2026-10-01', to: '2026-10-31' }))
      .toEqual([charge!.id, refund!.id]);
  }));

  it('includes a Category\'s Subcategories, and combines criteria with AND', scenario(async ({
    record, ledger, visa, food, groceries, transport,
  }) => {
    const [byCategory, bySubcategory, refund] = await recordAll(record, [
      { categoryId: food, date: '2026-10-01' },
      { subcategoryId: groceries, date: '2026-10-02' },
      { kind: 'refund', categoryId: food, date: '2026-10-03' },
      { categoryId: transport, date: '2026-10-04' },
    ]);
    const cards = { creditCardIds: [visa] };

    expect(await idsOf(ledger, { ...cards, categoryIds: [food] }))
      .toEqual([refund!.id, bySubcategory!.id, byCategory!.id]);
    expect(await idsOf(ledger, { ...cards, categoryIds: [food], kinds: ['refund'] }))
      .toEqual([refund!.id]);
  }));
});

describe('dayTotals', () => {
  it('sums a day over the whole filtered set, whichever page its rows land on', scenario(async ({
    record, ledger, visa,
  }) => {
    await recordAll(record, [
      { date: '2026-10-05', amount: 100 },
      { date: '2026-10-05', amount: 200 },
      { kind: 'refund', date: '2026-10-05', amount: 50 },
      { date: '2026-10-04', amount: 7 },
    ]);
    const filter = { creditCardIds: [visa] };
    const [firstRow] = await ledger.list(filter, undefined, 1);
    const totals = await ledger.dayTotals(filter, [firstRow!.date]);

    expect(totals).toHaveLength(2);
    expect(totals).toEqual(expect.arrayContaining([
      {
        date: '2026-10-05', currency: 'BRL', kind: 'charge', total: 300,
      },
      {
        date: '2026-10-05', currency: 'BRL', kind: 'refund', total: 50,
      },
    ]));
    expect(await ledger.dayTotals({ ...filter, kinds: ['refund'] }, ['2026-10-04'])).toEqual([]);
  }));

  it('answers nothing for no days or no cards', scenario(async ({ record, ledger, visa }) => {
    await record();

    expect(await ledger.dayTotals({ creditCardIds: [visa] }, [])).toEqual([]);
    expect(await ledger.dayTotals({ creditCardIds: [] }, ['2026-10-08'])).toEqual([]);
  }));
});

describe('monthCounts', () => {
  it('counts the filtered transactions of the months asked', scenario(async ({
    record, ledger, visa,
  }) => {
    await recordAll(record, [
      { date: '2026-10-01' },
      { date: '2026-10-31' },
      { kind: 'refund', date: '2026-10-15' },
      { date: '2026-09-30' },
      { date: '2026-11-01' },
    ]);
    const filter = { creditCardIds: [visa] };

    expect(await ledger.monthCounts(filter, ['2026-10', '2026-09']))
      .toEqual(expect.arrayContaining([
        { month: '2026-10', count: 3 },
        { month: '2026-09', count: 1 },
      ]));
    expect(await ledger.monthCounts({ ...filter, kinds: ['refund'] }, ['2026-10', '2026-09']))
      .toEqual([{ month: '2026-10', count: 1 }]);
  }));

  it('answers nothing for no months or no cards', scenario(async ({ record, ledger, visa }) => {
    await record();

    expect(await ledger.monthCounts({ creditCardIds: [visa] }, [])).toEqual([]);
    expect(await ledger.monthCounts({ creditCardIds: [] }, ['2026-10'])).toEqual([]);
  }));
});

describe('monthlySums', () => {
  it('sums by month, currency and kind within the range', scenario(async ({
    record, ledger, visa, master,
  }) => {
    await recordAll(record, [
      { date: '2026-10-01', amount: 100 },
      { date: '2026-10-20', amount: 200 },
      { kind: 'refund', date: '2026-10-21', amount: 5 },
      { date: '2026-11-02', amount: 7 },
      { date: '2026-12-01', amount: 9 },
      { creditCardId: master, date: '2026-10-02', amount: 1 },
    ]);

    const sums = await ledger.monthlySums([visa], '2026-10-01', '2026-11-30');

    expect(sums).toHaveLength(3);
    expect(sums).toEqual(expect.arrayContaining([
      {
        month: '2026-10', currency: 'BRL', kind: 'charge', total: 300,
      },
      {
        month: '2026-10', currency: 'BRL', kind: 'refund', total: 5,
      },
      {
        month: '2026-11', currency: 'BRL', kind: 'charge', total: 7,
      },
    ]));
  }));

  it('answers nothing for no cards', scenario(async ({ record, ledger }) => {
    await record();

    expect(await ledger.monthlySums([], '2026-01-01', '2026-12-31')).toEqual([]);
  }));
});
