import type { PGlite } from '@electric-sql/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createAccountAccessor, {
  type Movement, type NewAccount,
} from '../../../src/accessors/accountAccessor';
import type { Database } from '../../../src/db/database';
import { households, users } from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const UNKNOWN_ID = '00000000-0000-7000-8000-000000000000';

type Accounts = ReturnType<typeof createAccountAccessor>;

/** One test's data: household Casa with two members, plus helpers. */
interface Setup {
  readonly accessor: Accounts;
  readonly casa: string;
  readonly ana: string;
  readonly bruno: string;
  /** Another household. */
  readonly other: string;
  /** Creates a Casa Account (Ana's, shared, R$1,000 on 2026-10-17 by default); returns its id. */
  readonly create: (overrides?: Partial<NewAccount>) => Promise<string>;
  /** An Account's month balances as `[YYYY-MM, opening, ending]`, oldest first. */
  readonly chainOf: (accountId: string) => Promise<unknown[]>;
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
 * The Account fields every test starts from.
 *
 * @param householdId - Its household.
 * @param ownerUserId - Its creator.
 * @returns A shared BRL checking Account holding R$1,000 on 2026-10-17.
 */
const accountOf = (householdId: string, ownerUserId: string): NewAccount => ({
  householdId,
  ownerUserId,
  name: 'Main Checking',
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalance: 100_000,
  startingBalanceDate: '2026-10-17',
});

/**
 * A BRL movement.
 *
 * @param amount - Signed minor units.
 * @param date - `YYYY-MM-DD`.
 * @returns The movement.
 */
const brl = (amount: number, date: string): Movement => ({ amount, currency: 'BRL', date });

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
    const accessor = createAccountAccessor(db);
    await test({
      accessor,
      casa,
      ana,
      bruno: await addUser(db, 'bruno'),
      other: await addHousehold(db, 'Other'),
      create: async (overrides = {}) => (
        await accessor.insert({ ...accountOf(casa, ana), ...overrides })
      ).id,
      chainOf: async (accountId) => (await accessor.listBalances(accountId)).map((row) => [
        `${row.year}-${String(row.month).padStart(2, '0')}`, row.openingBalance, row.endingBalance,
      ]),
    });
  },
);

describe('insert', () => {
  it('creates an open Account owned by its creator', scenario(async ({ accessor, casa, ana }) => {
    const account = await accessor.insert(accountOf(casa, ana));

    expect(account).toMatchObject({
      householdId: casa,
      ownerUserId: ana,
      name: 'Main Checking',
      type: 'checking',
      currency: 'BRL',
      visibility: 'shared',
      startingBalanceDate: '2026-10-17',
      archivedAt: null,
    });
    expect(account.createdAt).toBeInstanceOf(Date);
  }));

  it('opens the balance chain at the starting balance, in its month', scenario(async (setup) => {
    const accountId = await setup.create();

    expect(await setup.chainOf(accountId)).toEqual([['2026-10', 100_000, 100_000]]);
  }));
});

describe('findById', () => {
  it('reads an Account of the household', scenario(async ({ accessor, casa, create }) => {
    const accountId = await create({ name: 'Savings' });

    expect(await accessor.findById(casa, accountId))
      .toMatchObject({ id: accountId, name: 'Savings' });
  }));

  it('finds nothing in another household', scenario(async ({ accessor, other, create }) => {
    expect(await accessor.findById(other, await create())).toBeUndefined();
  }));
});

describe('list', () => {
  it('lists shared Accounts and the viewer\'s own personal ones, open first, by name', scenario(
    async ({
      accessor, casa, ana, bruno, other, create,
    }) => {
      const zebra = await create({ name: 'Zebra' });
      const apple = await create({ name: 'Apple' });
      const old = await create({ name: 'Aardvark' });
      await accessor.archive(casa, old);
      const anaOwn = await create({ name: 'Mine', visibility: 'personal' });
      await create({ name: 'Bruno\'s', visibility: 'personal', ownerUserId: bruno });
      await accessor.insert({ ...accountOf(other, ana), name: 'Elsewhere' });

      const listed = await accessor.list(casa, ana);

      expect(listed.map((account) => account.id)).toEqual([apple, anaOwn, zebra, old]);
    },
  ));

  it('narrows to one visibility', scenario(async ({
    accessor, casa, ana, create,
  }) => {
    await create({ name: 'Shared' });
    const own = await create({ name: 'Mine', visibility: 'personal' });

    expect((await accessor.list(casa, ana, { visibility: 'personal' })).map((row) => row.id))
      .toEqual([own]);
  }));
});

describe('hasAccountInUse', () => {
  it('sees an Account of any visibility, someone else\'s personal one included', scenario(async ({
    accessor, casa, bruno, create,
  }) => {
    await create({ name: 'Bruno\'s', visibility: 'personal', ownerUserId: bruno });

    expect(await accessor.hasAccountInUse(casa)).toBe(true);
  }));

  it('counts none in a household with no Account, or only archived ones', scenario(async ({
    accessor, casa, ana, other, create,
  }) => {
    expect(await accessor.hasAccountInUse(casa)).toBe(false);
    await accessor.insert({ ...accountOf(other, ana), name: 'Elsewhere' });
    const old = await create({ name: 'Old' });
    await accessor.archive(casa, old);

    expect(await accessor.hasAccountInUse(casa)).toBe(false);
  }));
});

describe('update', () => {
  it('renames an Account and turns it personal, back to its creator', scenario(async ({
    accessor, casa, bruno, create,
  }) => {
    const accountId = await create({ ownerUserId: bruno });

    const updated = await accessor.update(casa, accountId, {
      name: 'Bruno\'s own', visibility: 'personal',
    });

    expect(updated).toMatchObject({
      name: 'Bruno\'s own', visibility: 'personal', ownerUserId: bruno, type: 'checking',
    });
  }));

  it('changes only the given fields, and reads back when none is', scenario(async ({
    accessor, casa, create,
  }) => {
    const accountId = await create();

    expect(await accessor.update(casa, accountId, {}))
      .toMatchObject({ id: accountId, name: 'Main Checking' });
    expect(await accessor.update(casa, accountId, { visibility: 'personal' }))
      .toMatchObject({ name: 'Main Checking', visibility: 'personal' });
  }));

  it('finds nothing in another household', scenario(async ({
    accessor, other, create,
  }) => {
    const accountId = await create();

    expect(await accessor.update(other, accountId, { name: 'Taken' })).toBeUndefined();
    expect(await accessor.update(other, accountId, {})).toBeUndefined();
  }));
});

describe('archive', () => {
  it('archives once and keeps the first time', scenario(async ({ accessor, casa, create }) => {
    const accountId = await create();

    expect(await accessor.archive(casa, accountId)).toBe(true);
    const { archivedAt } = (await accessor.findById(casa, accountId))!;
    expect(archivedAt).toBeInstanceOf(Date);
    expect(await accessor.archive(casa, accountId)).toBe(true);
    expect((await accessor.findById(casa, accountId))!.archivedAt).toEqual(archivedAt);
  }));

  it('finds nothing in another household', scenario(async ({ accessor, other, create }) => {
    expect(await accessor.archive(other, await create())).toBe(false);
  }));
});

describe('applyMovement', () => {
  it('moves the starting month\'s ending balance', scenario(async (setup) => {
    const accountId = await setup.create();

    expect(await setup.accessor.applyMovement(accountId, brl(-5_000, '2026-10-17')))
      .toEqual({ ok: true });
    expect(await setup.chainOf(accountId)).toEqual([['2026-10', 100_000, 95_000]]);
  }));

  it('fills the months with no movement up to a later month', scenario(async (setup) => {
    const accountId = await setup.create();

    await setup.accessor.applyMovement(accountId, brl(20_000, '2027-01-05'));

    expect(await setup.chainOf(accountId)).toEqual([
      ['2026-10', 100_000, 100_000],
      ['2026-11', 100_000, 100_000],
      ['2026-12', 100_000, 100_000],
      ['2027-01', 100_000, 120_000],
    ]);
  }));

  it('carries a backdated movement forward through every later month', scenario(async (setup) => {
    const accountId = await setup.create();
    await setup.accessor.applyMovement(accountId, brl(20_000, '2026-12-01'));

    await setup.accessor.applyMovement(accountId, brl(-3_000, '2026-11-10'));

    expect(await setup.chainOf(accountId)).toEqual([
      ['2026-10', 100_000, 100_000],
      ['2026-11', 100_000, 97_000],
      ['2026-12', 97_000, 117_000],
    ]);
  }));

  it('rebuilds history backward for a movement before the starting date', scenario(
    async (setup) => {
      const accountId = await setup.create();

      await setup.accessor.applyMovement(accountId, brl(-20_000, '2026-08-10'));

      expect(await setup.chainOf(accountId)).toEqual([
        ['2026-08', 120_000, 100_000],
        ['2026-09', 100_000, 100_000],
        ['2026-10', 100_000, 100_000],
      ]);
    },
  ));

  it('keeps the current balance for a movement earlier in the starting month', scenario(
    async (setup) => {
      const accountId = await setup.create();

      await setup.accessor.applyMovement(accountId, brl(-5_000, '2026-10-03'));

      expect(await setup.chainOf(accountId)).toEqual([['2026-10', 105_000, 100_000]]);
    },
  ));

  it('shifts every earlier month for a movement inside the rebuilt history', scenario(
    async (setup) => {
      const accountId = await setup.create();
      await setup.accessor.applyMovement(accountId, brl(-20_000, '2026-08-10'));

      await setup.accessor.applyMovement(accountId, brl(4_000, '2026-09-02'));

      expect(await setup.chainOf(accountId)).toEqual([
        ['2026-08', 116_000, 96_000],
        ['2026-09', 96_000, 100_000],
        ['2026-10', 100_000, 100_000],
      ]);
    },
  ));

  it('undoes a movement with the amount negated', scenario(async (setup) => {
    const accountId = await setup.create();
    await setup.accessor.applyMovement(accountId, brl(-20_000, '2026-08-10'));
    await setup.accessor.applyMovement(accountId, brl(7_000, '2026-11-10'));

    await setup.accessor.applyMovement(accountId, brl(20_000, '2026-08-10'));
    await setup.accessor.applyMovement(accountId, brl(-7_000, '2026-11-10'));

    expect(await setup.chainOf(accountId)).toEqual([
      ['2026-08', 100_000, 100_000],
      ['2026-09', 100_000, 100_000],
      ['2026-10', 100_000, 100_000],
      ['2026-11', 100_000, 100_000],
    ]);
  }));

  it('refuses another currency and writes nothing (FR-2.2)', scenario(async (setup) => {
    const accountId = await setup.create();

    const dollars = { ...brl(500, '2026-10-20'), currency: 'USD' };

    expect(await setup.accessor.applyMovement(accountId, dollars))
      .toEqual({ ok: false, reason: 'currency_mismatch', accountCurrency: 'BRL' });
    expect(await setup.chainOf(accountId)).toEqual([['2026-10', 100_000, 100_000]]);
  }));

  it('refuses an unknown Account', scenario(async ({ accessor }) => {
    expect(await accessor.applyMovement(UNKNOWN_ID, brl(500, '2026-10-20')))
      .toEqual({ ok: false, reason: 'account_not_found' });
  }));
});

describe('listBalances', () => {
  it('lists the months within a range, both ends included', scenario(async (setup) => {
    const accountId = await setup.create();
    await setup.accessor.applyMovement(accountId, brl(1_000, '2027-02-01'));

    const balances = await setup.accessor.listBalances(accountId, {
      from: { year: 2026, month: 11 }, to: { year: 2027, month: 1 },
    });

    expect(balances.map((row) => [row.year, row.month]))
      .toEqual([[2026, 11], [2026, 12], [2027, 1]]);
    expect(balances[0]).toMatchObject({ accountId, openingBalance: 100_000 });
    expect(balances[0]!.updatedAt).toBeInstanceOf(Date);
  }));
});

describe('balancesAsOf', () => {
  it('reads each Account\'s latest month at or before the given one', scenario(async (setup) => {
    const checking = await setup.create();
    const savings = await setup.create({
      startingBalance: 7_000, startingBalanceDate: '2026-12-01',
    });
    await setup.accessor.applyMovement(checking, brl(-1_000, '2026-11-20'));

    const march = { year: 2027, month: 3 };
    const balances = await setup.accessor.balancesAsOf([checking, savings], march);
    const byAccount = Object.fromEntries(balances.map((row) => [row.accountId, row]));

    expect(byAccount[checking]).toMatchObject({ year: 2026, month: 11, endingBalance: 99_000 });
    expect(byAccount[savings]).toMatchObject({ year: 2026, month: 12, endingBalance: 7_000 });
  }));

  it('skips an Account with no history by then', scenario(async (setup) => {
    const accountId = await setup.create();

    expect(await setup.accessor.balancesAsOf([accountId], { year: 2026, month: 9 })).toEqual([]);
  }));

  it('reads nothing for no Accounts', scenario(async ({ accessor }) => {
    expect(await accessor.balancesAsOf([], { year: 2026, month: 10 })).toEqual([]);
  }));
});
