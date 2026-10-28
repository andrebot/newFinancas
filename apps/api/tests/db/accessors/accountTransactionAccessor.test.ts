import type { PGlite } from '@electric-sql/pglite';
import { findKind } from '@financas/reference';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createAccountTransactionAccessor, {
  type AccountTransaction,
  type AccountTransactionFilter,
  type NewAccountTransaction,
} from '../../../src/accessors/accountTransactionAccessor';
import type { Database } from '../../../src/db/database';
import {
  accounts, categories, creditCards, households, investmentHoldings, subcategories, users,
  valuationSnapshots,
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

type Transactions = ReturnType<typeof createAccountTransactionAccessor>;

/** One test's data: two Accounts of one household, a card, a Category tree and a Holding. */
interface Setup {
  readonly ledger: Transactions;
  readonly db: Database;
  readonly householdId: string;
  readonly userId: string;
  readonly checking: string;
  readonly savings: string;
  readonly card: string;
  readonly food: string;
  readonly groceries: string;
  readonly transport: string;
  readonly holding: string;
  /** Records a transaction on `checking` (or as overridden); returns it. */
  readonly record: (overrides?: Partial<NewAccountTransaction>) => Promise<AccountTransaction>;
}

/**
 * Inserts one row and returns its id.
 *
 * @param query - An insert returning `{ id }`.
 * @returns The id.
 */
const idOf = async (query: Promise<{ id: string }[]>) => (await query)[0]!.id;

/**
 * Inserts an Account.
 *
 * @param db - The test database.
 * @param householdId - Its household.
 * @param name - Its name.
 * @returns The Account id.
 */
const addAccount = (db: Database, householdId: string, name: string) => idOf(
  db.insert(accounts).values({
    householdId,
    name,
    type: 'checking',
    currency: 'BRL',
    visibility: 'shared',
    startingBalanceDate: '2026-01-01',
  }).returning({ id: accounts.id }),
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
  entries: readonly Partial<NewAccountTransaction>[],
) => entries.reduce<Promise<AccountTransaction[]>>(
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
const idsOf = async (ledger: Transactions, filter: AccountTransactionFilter) => (
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
    const userId = await idOf(db.insert(users).values({
      email: 'ana@example.com',
      passwordHash: 'x',
      firstName: 'Ana',
      lastName: 'Silva',
      mfaSecret: 'x',
    }).returning({ id: users.id }));
    const checking = await addAccount(db, householdId, 'Checking');
    const food = await addCategory(db, householdId, 'Food');
    const ledger = createAccountTransactionAccessor(db);
    await test({
      ledger,
      db,
      householdId,
      userId,
      checking,
      savings: await addAccount(db, householdId, 'Savings'),
      card: await idOf(db.insert(creditCards).values({
        accountId: checking,
        network: 'visa',
        last4: '1234',
        closingDay: 5,
        dueDay: 12,
        expirationMonth: 1,
        expirationYear: 2030,
      }).returning({ id: creditCards.id })),
      food,
      groceries: await idOf(db.insert(subcategories).values({ categoryId: food, name: 'Groceries' })
        .returning({ id: subcategories.id })),
      transport: await addCategory(db, householdId, 'Transport'),
      holding: await idOf(db.insert(investmentHoldings).values({
        accountId: checking, assetType: 'stock', ticker: 'PETR4', quantity: 0, costBasis: 0,
      }).returning({ id: investmentHoldings.id })),
      record: async (overrides = {}) => {
        const result = await ledger.insert({
          accountId: checking,
          kind: 'pix_payment',
          effect: 'movement',
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
  it('records each effect and reads it back', scenario(async ({
    record, checking, card, holding, userId, food, groceries,
  }) => {
    const payment = await record({
      categoryId: food, subcategoryId: groceries, description: 'Market', createdByUserId: userId,
    });
    const transfer = await record({ kind: 'transfer_sent', effect: 'transfer' });
    const bill = await record({
      kind: 'credit_card_bill_payment', effect: 'bill_payment', creditCardId: card,
    });
    const buy = await record({
      kind: 'investment_buy',
      effect: 'investment_trade',
      holdingId: holding,
      trade: { quantityDelta: 200_000_000, costBasisDelta: 1_000 },
      source: 'schedule',
    });

    expect(payment).toMatchObject({
      accountId: checking,
      kind: 'pix_payment',
      effect: 'movement',
      date: '2026-10-08',
      amount: 1_000,
      currency: 'BRL',
      categoryId: food,
      subcategoryId: groceries,
      description: 'Market',
      holdingId: null,
      holding: null,
      trade: null,
      creditCardId: null,
      createdByUserId: userId,
      source: 'manual',
    });
    expect(payment.createdAt).toBeInstanceOf(Date);
    expect(transfer.effect).toBe('transfer');
    expect(bill).toMatchObject({ effect: 'bill_payment', creditCardId: card });
    expect(buy).toMatchObject({
      effect: 'investment_trade',
      holdingId: holding,
      holding: { ticker: 'PETR4', assetType: 'stock' },
      trade: { quantityDelta: 200_000_000, costBasisDelta: 1_000 },
      createdByUserId: null,
      source: 'schedule',
    });
  }));

  it('keeps the stored effect when the mapping says otherwise', scenario(async ({
    record, ledger, householdId,
  }) => {
    const stored = await record({ kind: 'deposit', effect: 'transfer' });

    expect(findKind('deposit')?.effect).toBe('movement');
    expect((await ledger.findById(householdId, stored.id))?.effect).toBe('transfer');
  }));

  it('reports a reference that is gone', scenario(async ({ ledger }) => {
    expect(await ledger.insert({
      accountId: UNKNOWN_ID,
      kind: 'deposit',
      effect: 'movement',
      date: '2026-10-08',
      amount: 1_000,
      currency: 'BRL',
    })).toEqual({ ok: false, reason: 'reference_not_found' });
  }));

  it('reports a Holding that is gone', scenario(async ({ record }) => {
    await expect(record({ kind: 'investment_dividend', holdingId: UNKNOWN_ID }))
      .rejects.toThrow('reference_not_found');
  }));

  it('lets an unknown Category through, a bug and not a race (OQ-203)', scenario(async ({
    record,
  }) => {
    await expect(record({ categoryId: UNKNOWN_ID })).rejects.not.toThrow('reference_not_found');
    await expect(record({ subcategoryId: UNKNOWN_ID })).rejects.not.toThrow('reference_not_found');
  }));

  it('never writes what is not a new transaction\'s value', scenario(async ({ record }) => {
    const wider = { description: 'wide', id: UNKNOWN_ID, createdAt: new Date('2000-01-01') };

    const stored = await record(wider);

    expect(stored.id).not.toBe(UNKNOWN_ID);
    expect(stored.createdAt.getFullYear()).toBeGreaterThan(2000);
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
    record, ledger, food, groceries, holding,
  }) => {
    const sell = await record({
      kind: 'investment_sell',
      effect: 'investment_trade',
      holdingId: holding,
      categoryId: food,
      subcategoryId: groceries,
      description: 'Old',
      trade: { quantityDelta: -100, costBasisDelta: -50 },
    });

    const result = await ledger.update(sell.id, sell, {
      date: '2026-10-09',
      amount: 2_000,
      categoryId: null,
      subcategoryId: null,
      description: null,
      trade: { quantityDelta: -300, costBasisDelta: -150 },
    });

    expect(result).toEqual({
      status: 'updated',
      transaction: {
        ...sell,
        date: '2026-10-09',
        amount: 2_000,
        categoryId: null,
        subcategoryId: null,
        description: null,
        trade: { quantityDelta: -300, costBasisDelta: -150 },
      },
    });
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
    expect(await ledger.update(UNKNOWN_ID, stored, { amount: 1 })).toEqual({ status: 'stale' });
  }));

  it('guards on the trade deltas too', scenario(async ({ record, ledger, holding }) => {
    const buy = await record({
      kind: 'investment_buy',
      effect: 'investment_trade',
      holdingId: holding,
      trade: { quantityDelta: 100, costBasisDelta: 50 },
    });

    const otherTrade = { ...buy, trade: { quantityDelta: 100, costBasisDelta: 49 } };

    expect(await ledger.update(buy.id, otherTrade, { amount: 2 })).toEqual({ status: 'stale' });
    expect(await ledger.update(buy.id, { ...buy, trade: null }, { amount: 2 }))
      .toEqual({ status: 'stale' });
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

describe('delete, with a trade', () => {
  it('takes the trade\'s automatic Valuation Snapshot with it', scenario(async ({
    record, ledger, db, holding,
  }) => {
    const buy = await record({
      kind: 'investment_buy',
      effect: 'investment_trade',
      holdingId: holding,
      trade: { quantityDelta: 100, costBasisDelta: 50 },
    });
    await db.insert(valuationSnapshots).values({
      holdingId: holding,
      accountTransactionId: buy.id,
      valuation: 50,
      asOfDate: buy.date,
      source: 'transaction',
    });

    expect(await ledger.delete(buy.id, buy)).toBe('deleted');
    expect(await db.$count(valuationSnapshots)).toBe(0);
  }));
});

describe('countForHolding', () => {
  it('counts the other transactions referencing a Holding', scenario(async ({
    record, ledger, holding,
  }) => {
    const buy = await record({
      kind: 'investment_buy',
      effect: 'investment_trade',
      holdingId: holding,
      trade: { quantityDelta: 100, costBasisDelta: 50 },
    });
    await record();

    expect(await ledger.countForHolding(holding, buy.id)).toBe(0);
    await record({ kind: 'investment_dividend', holdingId: holding });
    expect(await ledger.countForHolding(holding, buy.id)).toBe(1);
  }));
});

describe('list', () => {
  it('matches nothing with an empty scope', scenario(async ({ record, ledger }) => {
    await record();

    expect(await ledger.list({ scopeAccountIds: [] }, undefined, 10)).toEqual([]);
  }));

  it('pages newest first, two rows on one date neither repeated nor skipped', scenario(async ({
    record, ledger, checking,
  }) => {
    const [older, first, second, newest] = await recordAll(record, [
      { date: '2026-10-01' },
      { date: '2026-10-05' },
      { date: '2026-10-05' },
      { date: '2026-10-09' },
    ]);
    const filter = { scopeAccountIds: [checking] };

    const page1 = await ledger.list(filter, undefined, 2);
    const last = page1.at(-1)!;
    const page2 = await ledger.list(filter, { date: last.date, id: last.id }, 2);

    expect(page1.map((row) => row.id)).toEqual([newest!.id, second!.id]);
    expect(page2.map((row) => row.id)).toEqual([first!.id, older!.id]);
  }));

  it('keeps to the scope', scenario(async ({
    record, ledger, checking, savings,
  }) => {
    const mine = await record();
    await record({ accountId: savings });

    expect(await idsOf(ledger, { scopeAccountIds: [checking] })).toEqual([mine.id]);
  }));

  it('filters by kind, Holding and dates', scenario(async ({
    record, ledger, checking, holding,
  }) => {
    const [, deposit, dividend] = await recordAll(record, [
      { date: '2026-09-30' },
      { kind: 'deposit', date: '2026-10-01' },
      { kind: 'investment_dividend', holdingId: holding, date: '2026-10-31' },
      { date: '2026-11-01' },
    ]);
    const scope = { scopeAccountIds: [checking] };

    expect(await idsOf(ledger, { ...scope, kinds: ['deposit'] })).toEqual([deposit!.id]);
    expect(await idsOf(ledger, { ...scope, holdingId: holding })).toEqual([dividend!.id]);
    expect(await idsOf(ledger, { ...scope, from: '2026-10-01', to: '2026-10-31' }))
      .toEqual([dividend!.id, deposit!.id]);
  }));

  it('takes the picked Accounts and cards together', scenario(async ({
    record, ledger, checking, savings, card,
  }) => {
    const [savingsRow, bill] = await recordAll(record, [
      { accountId: savings, date: '2026-10-01' },
      {
        kind: 'credit_card_bill_payment',
        effect: 'bill_payment',
        creditCardId: card,
        date: '2026-10-02',
      },
      { date: '2026-10-03' },
    ]);
    const scope = { scopeAccountIds: [checking, savings] };

    expect(await idsOf(ledger, { ...scope, creditCardIds: [card] })).toEqual([bill!.id]);
    expect(await idsOf(ledger, { ...scope, accountIds: [savings] })).toEqual([savingsRow!.id]);
    expect(await idsOf(ledger, { ...scope, accountIds: [savings], creditCardIds: [card] }))
      .toEqual([bill!.id, savingsRow!.id]);
    expect(await idsOf(ledger, { ...scope, accountIds: [], creditCardIds: [] })).toHaveLength(3);
  }));

  it('includes a Category\'s Subcategories, and combines criteria with AND', scenario(async ({
    record, ledger, checking, food, groceries, transport,
  }) => {
    const [byCategory, bySubcategory, deposit] = await recordAll(record, [
      { categoryId: food, date: '2026-10-01' },
      { subcategoryId: groceries, date: '2026-10-02' },
      { kind: 'deposit', categoryId: food, date: '2026-10-03' },
      { categoryId: transport, date: '2026-10-04' },
    ]);
    const scope = { scopeAccountIds: [checking] };

    expect(await idsOf(ledger, { ...scope, categoryIds: [food] }))
      .toEqual([deposit!.id, bySubcategory!.id, byCategory!.id]);
    expect(await idsOf(ledger, { ...scope, categoryIds: [food], kinds: ['deposit'] }))
      .toEqual([deposit!.id]);
  }));
});

describe('dayTotals', () => {
  it('sums a day over the whole filtered set, whichever page its rows land on', scenario(async ({
    record, ledger, checking,
  }) => {
    await recordAll(record, [
      { date: '2026-10-05', amount: 100 },
      { date: '2026-10-05', amount: 200 },
      { kind: 'deposit', date: '2026-10-05', amount: 1_000 },
      { date: '2026-10-04', amount: 50 },
    ]);
    const filter = { scopeAccountIds: [checking] };
    const [firstRow] = await ledger.list(filter, undefined, 1);
    const pageDates = [firstRow!.date];

    expect(await ledger.dayTotals(filter, pageDates)).toEqual(expect.arrayContaining([
      {
        date: '2026-10-05', currency: 'BRL', kind: 'pix_payment', total: 300,
      },
      {
        date: '2026-10-05', currency: 'BRL', kind: 'deposit', total: 1_000,
      },
    ]));
    expect(await ledger.dayTotals(filter, pageDates)).toHaveLength(2);
    expect(await ledger.dayTotals({ ...filter, kinds: ['deposit'] }, ['2026-10-04'])).toEqual([]);
  }));

  it('answers nothing for no days or an empty scope', scenario(async ({
    record, ledger, checking,
  }) => {
    await record();

    expect(await ledger.dayTotals({ scopeAccountIds: [checking] }, [])).toEqual([]);
    expect(await ledger.dayTotals({ scopeAccountIds: [] }, ['2026-10-08'])).toEqual([]);
  }));
});

describe('monthCounts', () => {
  it('counts the filtered transactions of the months asked', scenario(async ({
    record, ledger, checking,
  }) => {
    await recordAll(record, [
      { date: '2026-10-01' }, { date: '2026-10-31' }, { kind: 'deposit', date: '2026-10-15' },
      { date: '2026-09-30' }, { date: '2026-11-01' },
    ]);
    const filter = { scopeAccountIds: [checking] };

    expect(await ledger.monthCounts(filter, ['2026-10', '2026-09']))
      .toEqual(expect.arrayContaining([
        { month: '2026-10', count: 3 },
        { month: '2026-09', count: 1 },
      ]));
    expect(await ledger.monthCounts({ ...filter, kinds: ['deposit'] }, ['2026-10', '2026-09']))
      .toEqual([{ month: '2026-10', count: 1 }]);
  }));

  it('closes December at the year\'s end', scenario(async ({ record, ledger, checking }) => {
    await recordAll(record, [
      { date: '2026-11-30' },
      { date: '2026-12-01' },
      { date: '2026-12-31' },
      { date: '2027-01-01' },
    ]);

    expect(await ledger.monthCounts({ scopeAccountIds: [checking] }, ['2026-12']))
      .toEqual([{ month: '2026-12', count: 2 }]);
  }));

  it('answers nothing for no months or an empty scope', scenario(async ({
    record, ledger, checking,
  }) => {
    await record();

    expect(await ledger.monthCounts({ scopeAccountIds: [checking] }, [])).toEqual([]);
    expect(await ledger.monthCounts({ scopeAccountIds: [] }, ['2026-10'])).toEqual([]);
  }));
});

describe('monthlySums', () => {
  it('sums by month, currency, kind and stored effect within the range', scenario(async ({
    record, ledger, checking, savings,
  }) => {
    await recordAll(record, [
      { date: '2026-10-01', amount: 100 },
      { date: '2026-10-20', amount: 200 },
      {
        kind: 'deposit', effect: 'transfer', date: '2026-10-21', amount: 5,
      },
      { date: '2026-11-02', amount: 7 },
      { date: '2026-12-01', amount: 9 },
      { accountId: savings, date: '2026-10-02', amount: 1 },
    ]);

    const sums = await ledger.monthlySums([checking], '2026-10-01', '2026-11-30');

    expect(sums).toHaveLength(3);
    expect(sums).toEqual(expect.arrayContaining([
      {
        month: '2026-10', currency: 'BRL', kind: 'pix_payment', effect: 'movement', total: 300,
      },
      {
        month: '2026-10', currency: 'BRL', kind: 'deposit', effect: 'transfer', total: 5,
      },
      {
        month: '2026-11', currency: 'BRL', kind: 'pix_payment', effect: 'movement', total: 7,
      },
    ]));
  }));

  it('answers nothing for no Accounts', scenario(async ({ record, ledger }) => {
    await record();

    expect(await ledger.monthlySums([], '2026-01-01', '2026-12-31')).toEqual([]);
  }));
});

describe('costBasisAsOf', () => {
  it('sums each Holding\'s trade deltas dated by then, payouts left out', scenario(async ({
    record, ledger, holding,
  }) => {
    const trade = (date: string, costBasisDelta: number) => ({
      kind: 'investment_buy',
      effect: 'investment_trade' as const,
      holdingId: holding,
      date,
      trade: { quantityDelta: 1, costBasisDelta },
    });
    await recordAll(record, [
      trade('2026-01-10', 1000),
      trade('2026-02-28', -400),
      { kind: 'investment_dividend', holdingId: holding, date: '2026-02-01' },
      trade('2026-03-01', 5000),
    ]);

    expect(await ledger.costBasisAsOf([holding], '2026-02-28')).toEqual([
      { holdingId: holding, costBasis: 600 },
    ]);
  }));

  it('leaves out a Holding with no trade by then', scenario(async ({ record, ledger, holding }) => {
    await record({ kind: 'investment_dividend', holdingId: holding });

    expect(await ledger.costBasisAsOf([holding], '2026-12-31')).toEqual([]);
    expect(await ledger.costBasisAsOf([], '2026-12-31')).toEqual([]);
  }));
});

describe('findBuy', () => {
  it('answers with the buy that opened the Holding', scenario(async ({
    record, ledger, householdId, holding,
  }) => {
    const buy = await record({
      kind: 'investment_buy',
      effect: 'investment_trade',
      holdingId: holding,
      trade: { quantityDelta: 1, costBasisDelta: 100 },
    });

    const found = await ledger.findBuy(householdId, holding);

    expect(found).toMatchObject({ id: buy.id, kind: 'investment_buy' });
  }));

  it('answers undefined when the Holding has no buy on record', scenario(async ({
    ledger, householdId,
  }) => {
    expect(await ledger.findBuy(householdId, UNKNOWN_ID)).toBeUndefined();
  }));
});
