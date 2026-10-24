import type { PGlite } from '@electric-sql/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createCreditCardAccessor, {
  type CardMovement, type NewCreditCard,
} from '../../../src/accessors/creditCardAccessor';
import type { Database } from '../../../src/db/database';
import {
  accountTransactions, accounts, cardTransactions, households,
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
const TODAY = '2026-10-17';

type Cards = ReturnType<typeof createCreditCardAccessor>;

/** One test's data: household Casa with a BRL Account, plus helpers. */
interface Setup {
  readonly db: Database;
  readonly accessor: Cards;
  readonly casa: string;
  /** Casa's BRL checking Account. */
  readonly checking: string;
  /** Another household. */
  readonly other: string;
  /** Attaches a card closing on the 5th (to checking by default) today; returns its id. */
  readonly attach: (overrides?: Partial<NewCreditCard>) => Promise<string>;
  /** A card's cycle balances as `[YYYY-MM, opening, ending]`, oldest first. */
  readonly chainOf: (creditCardId: string) => Promise<unknown[]>;
}

/**
 * Inserts one row and returns its id.
 *
 * @param query - An insert returning `{ id }`.
 * @returns The id.
 */
const idOf = async (query: Promise<{ id: string }[]>) => (await query)[0]!.id;

/**
 * Inserts a household with one shared checking Account.
 *
 * @param db - The test database.
 * @param name - The household's name.
 * @returns The household and Account ids.
 */
const addHouseholdWithAccount = async (db: Database, name: string) => {
  const householdId = await idOf(
    db.insert(households).values({ name }).returning({ id: households.id }),
  );
  const accountId = await idOf(db.insert(accounts).values({
    householdId,
    name: 'Main Checking',
    type: 'checking',
    currency: 'BRL',
    visibility: 'shared',
    startingBalanceDate: TODAY,
  }).returning({ id: accounts.id }));
  return { householdId, accountId };
};

/**
 * The card fields every test starts from.
 *
 * @param accountId - Its Account.
 * @returns A Mastercard closing on the 5th, due on the 12th.
 */
const cardOf = (accountId: string): NewCreditCard => ({
  accountId,
  network: 'mastercard',
  last4: '4242',
  closingDay: 5,
  dueDay: 12,
  expirationMonth: 8,
  expirationYear: 2030,
});

/**
 * A BRL card movement.
 *
 * @param amount - Signed minor units.
 * @param date - `YYYY-MM-DD`.
 * @returns The movement.
 */
const brl = (amount: number, date: string): CardMovement => ({ amount, currency: 'BRL', date });

/**
 * Runs a test against fresh data, rolled back afterwards.
 *
 * @param test - The test, given its setup.
 * @returns Resolves when the test is done.
 */
const scenario = (test: (setup: Setup) => Promise<void>) => () => withRollback(
  pglite,
  async (db) => {
    const casa = await addHouseholdWithAccount(db, 'Casa');
    const accessor = createCreditCardAccessor(db);
    await test({
      db,
      accessor,
      casa: casa.householdId,
      checking: casa.accountId,
      other: (await addHouseholdWithAccount(db, 'Other')).householdId,
      attach: async (overrides = {}) => (
        await accessor.insert({ ...cardOf(casa.accountId), ...overrides }, TODAY)
      ).id,
      chainOf: async (creditCardId) => (await accessor.listBalances(creditCardId)).map((row) => [
        `${row.year}-${String(row.month).padStart(2, '0')}`,
        row.openingOutstandingBalance,
        row.endingOutstandingBalance,
      ]),
    });
  },
);

describe('insert', () => {
  it('attaches a card to its Account', scenario(async ({ accessor, checking }) => {
    const card = await accessor.insert(cardOf(checking), TODAY);

    expect(card).toMatchObject(cardOf(checking));
    expect(card.createdAt).toBeInstanceOf(Date);
  }));

  it('opens the balance chain at 0, in today\'s cycle', scenario(async (setup) => {
    const creditCardId = await setup.attach();

    expect(await setup.chainOf(creditCardId)).toEqual([['2026-11', 0, 0]]);
  }));
});

describe('findById', () => {
  it('reads a card of the household', scenario(async ({ accessor, casa, attach }) => {
    const creditCardId = await attach({ last4: '1111' });

    expect(await accessor.findById(casa, creditCardId))
      .toMatchObject({ id: creditCardId, last4: '1111' });
  }));

  it('finds nothing in another household', scenario(async ({ accessor, other, attach }) => {
    expect(await accessor.findById(other, await attach())).toBeUndefined();
  }));
});

describe('listByAccounts', () => {
  it('lists the Accounts\' cards in the order attached', scenario(async ({
    db, accessor, casa, checking, attach,
  }) => {
    const first = await attach({ last4: '1111' });
    const second = await attach({ last4: '2222' });
    const savings = await idOf(db.insert(accounts).values({
      householdId: casa,
      name: 'Savings',
      type: 'savings',
      currency: 'BRL',
      visibility: 'shared',
      startingBalanceDate: TODAY,
    }).returning({ id: accounts.id }));
    const third = await attach({ accountId: savings });

    expect((await accessor.listByAccounts([checking])).map((card) => card.id))
      .toEqual([first, second]);
    expect(new Set((await accessor.listByAccounts([savings, checking])).map((card) => card.id)))
      .toEqual(new Set([first, second, third]));
  }));

  it('reads nothing for no Accounts', scenario(async ({ accessor }) => {
    expect(await accessor.listByAccounts([])).toEqual([]);
  }));
});

describe('update', () => {
  it('changes only the given fields, and reads back when none is', scenario(async ({
    accessor, checking, attach,
  }) => {
    const creditCardId = await attach();

    expect(await accessor.update(checking, creditCardId, {}))
      .toMatchObject({ id: creditCardId, closingDay: 5 });
    expect(await accessor.update(checking, creditCardId, { closingDay: 25 }))
      .toMatchObject({ closingDay: 25, network: 'mastercard', dueDay: 12 });
  }));

  it('finds nothing on another Account', scenario(async ({ accessor, attach }) => {
    const creditCardId = await attach();

    expect(await accessor.update(UNKNOWN_ID, creditCardId, { last4: '9999' })).toBeUndefined();
    expect(await accessor.update(UNKNOWN_ID, creditCardId, {})).toBeUndefined();
  }));

  it('lands later movements under the new closing day, leaving past cycles', scenario(
    async (setup) => {
      const creditCardId = await setup.attach();
      await setup.accessor.applyMovement(creditCardId, brl(1_000, '2026-10-20'));

      await setup.accessor.update(setup.checking, creditCardId, { closingDay: 25 });
      await setup.accessor.applyMovement(creditCardId, brl(500, '2026-10-20'));

      expect(await setup.chainOf(creditCardId)).toEqual([
        ['2026-10', 0, 500],
        ['2026-11', 500, 1_500],
      ]);
    },
  ));
});

describe('remove', () => {
  it('removes a card with its Card Transactions, unlinking bill payments', scenario(async ({
    db, accessor, casa, checking, attach,
  }) => {
    const creditCardId = await attach();
    await db.insert(cardTransactions).values({
      creditCardId, kind: 'charge', date: TODAY, amount: 1_000, currency: 'BRL',
    });
    const paymentId = await idOf(db.insert(accountTransactions).values({
      accountId: checking,
      creditCardId,
      kind: 'credit_card_bill_payment',
      effect: 'bill_payment',
      date: TODAY,
      amount: 1_000,
      currency: 'BRL',
    }).returning({ id: accountTransactions.id }));

    expect(await accessor.remove(checking, creditCardId)).toBe(true);
    expect(await accessor.findById(casa, creditCardId)).toBeUndefined();
    expect(await db.select().from(cardTransactions)).toEqual([]);
    expect(await accessor.listBalances(creditCardId)).toEqual([]);
    const [payment] = await db.select().from(accountTransactions);
    expect(payment).toMatchObject({ id: paymentId, creditCardId: null });
  }));

  it('finds nothing on another Account', scenario(async ({ accessor, attach }) => {
    expect(await accessor.remove(UNKNOWN_ID, await attach())).toBe(false);
  }));
});

describe('applyMovement', () => {
  it('lands a charge in the cycle its date falls in', scenario(async (setup) => {
    const creditCardId = await setup.attach();

    expect(await setup.accessor.applyMovement(creditCardId, brl(3_000, '2026-11-05')))
      .toEqual({ ok: true });
    await setup.accessor.applyMovement(creditCardId, brl(2_000, '2026-11-06'));

    expect(await setup.chainOf(creditCardId)).toEqual([
      ['2026-11', 0, 3_000],
      ['2026-12', 3_000, 5_000],
    ]);
  }));

  it('fills the cycles with no movement up to a later one', scenario(async (setup) => {
    const creditCardId = await setup.attach();

    await setup.accessor.applyMovement(creditCardId, brl(1_000, '2027-01-20'));

    expect(await setup.chainOf(creditCardId)).toEqual([
      ['2026-11', 0, 0],
      ['2026-12', 0, 0],
      ['2027-01', 0, 0],
      ['2027-02', 0, 1_000],
    ]);
  }));

  it('fills the gap after a longer chain from its last cycle, not its first', scenario(
    async (setup) => {
      const creditCardId = await setup.attach();
      await setup.accessor.applyMovement(creditCardId, brl(3_000, '2026-11-05'));
      await setup.accessor.applyMovement(creditCardId, brl(2_000, '2026-11-06'));

      await setup.accessor.applyMovement(creditCardId, brl(1_000, '2027-02-01'));

      expect(await setup.chainOf(creditCardId)).toEqual([
        ['2026-11', 0, 3_000],
        ['2026-12', 3_000, 5_000],
        ['2027-01', 5_000, 5_000],
        ['2027-02', 5_000, 6_000],
      ]);
    },
  ));

  it('carries a charge before the card was added forward, the chain opening at 0', scenario(
    async (setup) => {
      const creditCardId = await setup.attach();
      await setup.accessor.applyMovement(creditCardId, brl(2_000, '2026-10-17'));

      await setup.accessor.applyMovement(creditCardId, brl(1_000, '2026-09-01'));

      expect(await setup.chainOf(creditCardId)).toEqual([
        ['2026-09', 0, 1_000],
        ['2026-10', 1_000, 1_000],
        ['2026-11', 1_000, 3_000],
      ]);
    },
  ));

  it('lowers the balance for a refund or a bill payment', scenario(async (setup) => {
    const creditCardId = await setup.attach();
    await setup.accessor.applyMovement(creditCardId, brl(5_000, '2026-10-20'));

    await setup.accessor.applyMovement(creditCardId, brl(-1_000, '2026-10-25'));
    await setup.accessor.applyMovement(creditCardId, brl(-4_000, '2026-12-01'));

    expect(await setup.chainOf(creditCardId)).toEqual([
      ['2026-11', 0, 4_000],
      ['2026-12', 4_000, 0],
    ]);
  }));

  it('undoes a movement with the amount negated', scenario(async (setup) => {
    const creditCardId = await setup.attach();
    await setup.accessor.applyMovement(creditCardId, brl(1_000, '2026-09-01'));

    await setup.accessor.applyMovement(creditCardId, brl(-1_000, '2026-09-01'));

    expect(await setup.chainOf(creditCardId)).toEqual([
      ['2026-09', 0, 0],
      ['2026-10', 0, 0],
      ['2026-11', 0, 0],
    ]);
  }));

  it('refuses another currency and writes nothing (FR-2.2)', scenario(async (setup) => {
    const creditCardId = await setup.attach();

    const dollars = { ...brl(500, '2026-10-20'), currency: 'USD' };

    expect(await setup.accessor.applyMovement(creditCardId, dollars))
      .toEqual({ ok: false, reason: 'currency_mismatch', cardCurrency: 'BRL' });
    expect(await setup.chainOf(creditCardId)).toEqual([['2026-11', 0, 0]]);
  }));

  it('refuses an unknown card', scenario(async ({ accessor }) => {
    expect(await accessor.applyMovement(UNKNOWN_ID, brl(500, '2026-10-20')))
      .toEqual({ ok: false, reason: 'card_not_found' });
  }));
});

describe('listBalances', () => {
  it('lists the cycles within a range, both ends included', scenario(async (setup) => {
    const creditCardId = await setup.attach();
    await setup.accessor.applyMovement(creditCardId, brl(1_000, '2027-02-01'));

    const balances = await setup.accessor.listBalances(creditCardId, {
      from: { year: 2026, month: 12 }, to: { year: 2027, month: 1 },
    });

    expect(balances.map((row) => [row.year, row.month])).toEqual([[2026, 12], [2027, 1]]);
    expect(balances[0]).toMatchObject({ creditCardId, openingOutstandingBalance: 0 });
    expect(balances[0]!.updatedAt).toBeInstanceOf(Date);
  }));
});

describe('balancesAsOf', () => {
  it('reads each card\'s latest cycle at or before the given one', scenario(async (setup) => {
    const gold = await setup.attach();
    const black = await setup.attach({ closingDay: 25 });
    await setup.accessor.applyMovement(gold, brl(1_000, '2026-12-01'));

    const march = { year: 2027, month: 3 };
    const balances = await setup.accessor.balancesAsOf([gold, black], march);
    const byCard = Object.fromEntries(balances.map((row) => [row.creditCardId, row]));

    expect(byCard[gold]).toMatchObject({ year: 2026, month: 12, endingOutstandingBalance: 1_000 });
    expect(byCard[black]).toMatchObject({ year: 2026, month: 10, endingOutstandingBalance: 0 });
  }));

  it('skips a card with no history by then', scenario(async (setup) => {
    const creditCardId = await setup.attach();

    expect(await setup.accessor.balancesAsOf([creditCardId], { year: 2026, month: 10 }))
      .toEqual([]);
  }));

  it('reads nothing for no cards', scenario(async ({ accessor }) => {
    expect(await accessor.balancesAsOf([], { year: 2026, month: 10 })).toEqual([]);
  }));
});
