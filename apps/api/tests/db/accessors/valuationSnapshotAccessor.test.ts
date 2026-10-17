import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createValuationSnapshotAccessor, {
  type ValuationSnapshot,
} from '../../../src/accessors/valuationSnapshotAccessor';
import type { Database } from '../../../src/db/database';
import {
  accountTransactions, accounts, households, investmentHoldings,
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

type Snapshots = ReturnType<typeof createValuationSnapshotAccessor>;

/** One test's data: an investment Account with two stock Holdings, and helpers. */
interface Setup {
  readonly snapshots: Snapshots;
  readonly db: Database;
  readonly stock: string;
  readonly fund: string;
  /** Records a buy of `stock` on a date; returns the transaction id. */
  readonly buy: (date: string) => Promise<string>;
  /** Records a buy of `stock` and the snapshot it leaves behind. */
  readonly trade: (valuation: number, date: string) => Promise<ValuationSnapshot>;
  /** Records a manual market value of `stock`; returns the snapshot id. */
  readonly record: (valuation: number, asOfDate: string) => Promise<string>;
  /** Every snapshot of a Holding as `[valuation, asOfDate, source]`, newest first. */
  readonly history: (holdingId: string) => Promise<unknown[]>;
}

/**
 * Inserts one row and returns its id.
 *
 * @param query - An insert returning `{ id }`.
 * @returns The id.
 */
const idOf = async (query: Promise<{ id: string }[]>) => (await query)[0]!.id;

/**
 * Inserts a stock Holding in an Account.
 *
 * @param db - The test database.
 * @param accountId - Its Account.
 * @param ticker - Its ticker.
 * @returns The Holding id.
 */
const addHolding = (db: Database, accountId: string, ticker: string) => idOf(
  db.insert(investmentHoldings).values({
    accountId, assetType: 'stock', ticker, quantity: 100_000_000, costBasis: 5_000,
  }).returning({ id: investmentHoldings.id }),
);

/**
 * Inserts a buy of a Holding.
 *
 * @param db - The test database.
 * @param accountId - The Account it is paid from.
 * @param holdingId - The Holding bought.
 * @param date - Its date.
 * @returns The transaction id.
 */
const addBuy = (db: Database, accountId: string, holdingId: string, date: string) => idOf(
  db.insert(accountTransactions).values({
    accountId,
    kind: 'investment_buy',
    effect: 'investment_trade',
    date,
    amount: 5_000,
    currency: 'BRL',
    holdingId,
  }).returning({ id: accountTransactions.id }),
);

/**
 * Projects snapshots to the fields the assertions compare.
 *
 * @param rows - Snapshots.
 * @returns `[valuation, asOfDate, source]` per snapshot.
 */
const brief = (rows: readonly ValuationSnapshot[]) => rows.map(
  (row) => [row.valuation, row.asOfDate, row.source],
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
    const householdId = await idOf(
      db.insert(households).values({ name: 'Casa' }).returning({ id: households.id }),
    );
    const accountId = await idOf(db.insert(accounts).values({
      householdId,
      name: 'Broker',
      type: 'investment',
      currency: 'BRL',
      visibility: 'shared',
      startingBalanceDate: '2026-01-01',
    }).returning({ id: accounts.id }));
    const snapshots = createValuationSnapshotAccessor(db);
    const stock = await addHolding(db, accountId, 'PETR4');
    await test({
      snapshots,
      db,
      stock,
      fund: await addHolding(db, accountId, 'HGLG11'),
      buy: (date) => addBuy(db, accountId, stock, date),
      trade: async (valuation, date) => snapshots.insertAutomatic({
        holdingId: stock,
        accountTransactionId: await addBuy(db, accountId, stock, date),
        valuation,
        asOfDate: date,
      }),
      record: async (valuation, asOfDate) => (
        await snapshots.insertManual(stock, { valuation, asOfDate })
      ).id,
      history: async (holdingId) => brief(await snapshots.list(holdingId)),
    });
  },
);

describe('insertManual', () => {
  it('records a manual market value', scenario(async ({ snapshots, stock }) => {
    const snapshot = await snapshots.insertManual(stock, {
      valuation: 6_000, asOfDate: '2026-03-31',
    });

    expect(snapshot).toMatchObject({
      holdingId: stock,
      valuation: 6_000,
      asOfDate: '2026-03-31',
      source: 'manual',
      accountTransactionId: null,
    });
    expect(snapshot.createdAt).toBeInstanceOf(Date);
  }));
});

describe('updateManual', () => {
  it('changes the value and the date', scenario(async ({ snapshots, stock, record }) => {
    const id = await record(6_000, '2026-03-31');

    const updated = await snapshots.updateManual(stock, id, {
      valuation: 6_500, asOfDate: '2026-03-30',
    });

    expect(updated).toMatchObject({ id, valuation: 6_500, asOfDate: '2026-03-30' });
  }));

  it('changes only the fields given', scenario(async ({
    snapshots, stock, record, history,
  }) => {
    const id = await record(6_000, '2026-03-31');

    await snapshots.updateManual(stock, id, { valuation: 6_100 });

    expect(await history(stock)).toEqual([[6_100, '2026-03-31', 'manual']]);
  }));

  it('refuses an unknown snapshot', scenario(async ({ snapshots, stock }) => {
    expect(await snapshots.updateManual(stock, UNKNOWN_ID, { valuation: 1 })).toBe('not_found');
  }));

  it("refuses another Holding's snapshot", scenario(async ({
    snapshots, fund, record, history, stock,
  }) => {
    const id = await record(6_000, '2026-03-31');

    expect(await snapshots.updateManual(fund, id, { valuation: 1 })).toBe('not_found');
    expect(await history(stock)).toEqual([[6_000, '2026-03-31', 'manual']]);
  }));

  it('refuses a transaction snapshot (OQ-56)', scenario(async ({
    snapshots, stock, trade, history,
  }) => {
    const { id } = await trade(5_000, '2026-01-10');

    expect(await snapshots.updateManual(stock, id, { valuation: 1 })).toBe('automatic');
    expect(await history(stock)).toEqual([[5_000, '2026-01-10', 'transaction']]);
  }));
});

describe('deleteManual', () => {
  it('deletes a manual market value', scenario(async ({
    snapshots, stock, record, history,
  }) => {
    await record(5_500, '2026-02-28');
    const id = await record(6_000, '2026-03-31');

    expect(await snapshots.deleteManual(stock, id)).toBe('deleted');
    expect(await history(stock)).toEqual([[5_500, '2026-02-28', 'manual']]);
  }));

  it('refuses an unknown snapshot', scenario(async ({ snapshots, stock }) => {
    expect(await snapshots.deleteManual(stock, UNKNOWN_ID)).toBe('not_found');
  }));

  it("refuses another Holding's snapshot", scenario(async ({
    snapshots, fund, record, history, stock,
  }) => {
    const id = await record(6_000, '2026-03-31');

    expect(await snapshots.deleteManual(fund, id)).toBe('not_found');
    expect(await history(stock)).toHaveLength(1);
  }));

  it('refuses a transaction snapshot (OQ-56)', scenario(async ({
    snapshots, stock, trade, history,
  }) => {
    const { id } = await trade(5_000, '2026-01-10');

    expect(await snapshots.deleteManual(stock, id)).toBe('automatic');
    expect(await history(stock)).toHaveLength(1);
  }));
});

describe('insertAutomatic', () => {
  it('links the snapshot to its transaction', scenario(async ({ snapshots, stock, buy }) => {
    const accountTransactionId = await buy('2026-01-10');

    const snapshot = await snapshots.insertAutomatic({
      holdingId: stock, accountTransactionId, valuation: 5_000, asOfDate: '2026-01-10',
    });

    expect(snapshot).toMatchObject({
      holdingId: stock, valuation: 5_000, source: 'transaction', accountTransactionId,
    });
  }));

  it('dies with its transaction (FK cascade)', scenario(async ({
    snapshots, stock, buy, db, history,
  }) => {
    const accountTransactionId = await buy('2026-01-10');
    await snapshots.insertAutomatic({
      holdingId: stock, accountTransactionId, valuation: 5_000, asOfDate: '2026-01-10',
    });

    await db.delete(accountTransactions).where(eq(accountTransactions.id, accountTransactionId));

    expect(await history(stock)).toEqual([]);
  }));
});

describe('updateAutomatic', () => {
  it("follows its transaction's edit", scenario(async ({
    snapshots, stock, buy, history,
  }) => {
    const accountTransactionId = await buy('2026-01-10');
    await snapshots.insertAutomatic({
      holdingId: stock, accountTransactionId, valuation: 5_000, asOfDate: '2026-01-10',
    });

    const updated = await snapshots.updateAutomatic(accountTransactionId, {
      valuation: 5_200, asOfDate: '2026-01-12',
    });

    expect(updated).toBe(true);
    expect(await history(stock)).toEqual([[5_200, '2026-01-12', 'transaction']]);
  }));

  it('reports a transaction without a snapshot', scenario(async ({ snapshots, buy }) => {
    const updated = await snapshots.updateAutomatic(await buy('2026-01-10'), {
      valuation: 1, asOfDate: '2026-01-10',
    });

    expect(updated).toBe(false);
  }));
});

describe('deleteAutomatic', () => {
  it("removes a transaction's snapshot, keeping the transaction", scenario(async ({
    snapshots, stock, buy, db, history,
  }) => {
    const accountTransactionId = await buy('2026-01-10');
    await snapshots.insertAutomatic({
      holdingId: stock, accountTransactionId, valuation: 5_000, asOfDate: '2026-01-10',
    });

    expect(await snapshots.deleteAutomatic(accountTransactionId)).toBe(true);
    expect(await history(stock)).toEqual([]);
    expect(await db.$count(accountTransactions)).toBe(1);
  }));

  it('reports a transaction without a snapshot', scenario(async ({ snapshots, buy }) => {
    expect(await snapshots.deleteAutomatic(await buy('2026-01-10'))).toBe(false);
  }));
});

describe('list', () => {
  it("lists one Holding's history, newest first", scenario(async ({
    snapshots, stock, fund, record, trade, history,
  }) => {
    await record(5_500, '2026-02-28');
    await trade(5_000, '2026-01-10');
    await record(6_000, '2026-03-31');
    await snapshots.insertManual(fund, { valuation: 9_000, asOfDate: '2026-03-31' });

    expect(await history(stock)).toEqual([
      [6_000, '2026-03-31', 'manual'],
      [5_500, '2026-02-28', 'manual'],
      [5_000, '2026-01-10', 'transaction'],
    ]);
  }));

  it('puts the later-written of two same-day snapshots first', scenario(async ({
    stock, record, history,
  }) => {
    await record(6_000, '2026-03-31');
    await record(6_100, '2026-03-31');

    expect(await history(stock)).toEqual([
      [6_100, '2026-03-31', 'manual'],
      [6_000, '2026-03-31', 'manual'],
    ]);
  }));

  it('keeps to the dates asked for, bounds included', scenario(async ({
    snapshots, stock, record,
  }) => {
    await record(5_000, '2026-01-31');
    await record(5_500, '2026-02-28');
    await record(6_000, '2026-03-31');

    const from = await snapshots.list(stock, { from: '2026-02-28' });
    const to = await snapshots.list(stock, { to: '2026-02-28' });
    const both = await snapshots.list(stock, { from: '2026-02-01', to: '2026-02-28' });

    expect(brief(from).map(([valuation]) => valuation)).toEqual([6_000, 5_500]);
    expect(brief(to).map(([valuation]) => valuation)).toEqual([5_500, 5_000]);
    expect(brief(both).map(([valuation]) => valuation)).toEqual([5_500]);
  }));
});

describe('latestAsOf', () => {
  it("gives each Holding's latest snapshot at or before the date", scenario(async ({
    snapshots, stock, fund, record,
  }) => {
    await record(5_000, '2026-01-31');
    await record(5_500, '2026-02-28');
    await record(6_000, '2026-03-31');
    await snapshots.insertManual(fund, { valuation: 9_000, asOfDate: '2026-01-15' });

    const latest = await snapshots.latestAsOf([stock, fund], '2026-02-28');

    expect(latest.map((row) => [row.holdingId, row.valuation])).toEqual(expect.arrayContaining([
      [stock, 5_500],
      [fund, 9_000],
    ]));
    expect(latest).toHaveLength(2);
  }));

  it('leaves out a Holding with no snapshot by then', scenario(async ({
    snapshots, stock, fund, record,
  }) => {
    await record(6_000, '2026-03-31');
    await snapshots.insertManual(fund, { valuation: 9_000, asOfDate: '2026-01-15' });

    const latest = await snapshots.latestAsOf([stock, fund], '2026-02-28');

    expect(latest.map((row) => row.holdingId)).toEqual([fund]);
  }));

  it('takes the later-written of two same-day snapshots', scenario(async ({
    snapshots, stock, record, trade,
  }) => {
    await trade(5_000, '2026-03-31');
    await record(6_000, '2026-03-31');

    const [latest] = await snapshots.latestAsOf([stock], '2026-03-31');

    expect(latest).toMatchObject({ valuation: 6_000, source: 'manual' });
  }));

  it('reads nothing for no Holdings', scenario(async ({ snapshots }) => {
    expect(await snapshots.latestAsOf([], '2026-03-31')).toEqual([]);
  }));
});
