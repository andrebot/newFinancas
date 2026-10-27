import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createInvestmentHoldingAccessor, {
  type NewInvestmentHolding, type ScheduleEntryInput,
} from '../../../src/accessors/investmentHoldingAccessor';
import type { Database } from '../../../src/db/database';
import {
  accounts, households, investmentHoldings, users,
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

type Holdings = ReturnType<typeof createInvestmentHoldingAccessor>;

/** One test's data: household Casa with a BRL investment Account, plus helpers. */
interface Setup {
  readonly db: Database;
  readonly accessor: Holdings;
  readonly casa: string;
  /** Casa's shared BRL investment Account. */
  readonly investment: string;
  /** Another household. */
  readonly other: string;
  /** Adds an Account of Casa; returns its id. */
  readonly addAccount: (type: string, ownerUserId?: string) => Promise<string>;
  /** Opens a Holding (a PETR4 stock in the investment Account by default); returns its id. */
  readonly open: (overrides?: Partial<NewInvestmentHolding>) => Promise<string>;
  /** Opens a CDB maturing on a date, with a position; returns its id. */
  readonly openCdb: (dueDate: string, accountId?: string) => Promise<string>;
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
 * @param fields - Its type and, for a personal one, its owner.
 * @returns Its id.
 */
const insertAccount = (
  db: Database,
  householdId: string,
  fields: { readonly type: string; readonly ownerUserId?: string | undefined },
) => idOf(db.insert(accounts).values({
  householdId,
  ownerUserId: fields.ownerUserId,
  name: `${fields.type} account`,
  type: fields.type,
  currency: 'BRL',
  visibility: fields.ownerUserId === undefined ? 'shared' : 'personal',
  startingBalanceDate: TODAY,
}).returning({ id: accounts.id }));

/**
 * Inserts a household with one shared investment Account.
 *
 * @param db - The test database.
 * @param name - The household's name.
 * @returns The household and Account ids.
 */
const addHouseholdWithAccount = async (db: Database, name: string) => {
  const householdId = await idOf(
    db.insert(households).values({ name }).returning({ id: households.id }),
  );
  return { householdId, accountId: await insertAccount(db, householdId, { type: 'investment' }) };
};

/**
 * A CDB's schedule: a tax entry and a redemption on the due date.
 *
 * @param dueDate - `YYYY-MM-DD`.
 * @returns The entries.
 */
const cdbSchedule = (dueDate: string): ScheduleEntryInput[] => [
  { kind: 'redemption', amount: 110_000, date: dueDate },
  { kind: 'tax', amount: 1_500, date: dueDate },
];

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
    const accessor = createInvestmentHoldingAccessor(db);
    /**
     * Opens a Holding and returns its id.
     *
     * @param overrides - Fields replacing the PETR4 stock's.
     * @returns The Holding id.
     */
    const open = async (overrides: Partial<NewInvestmentHolding> = {}) => {
      const result = await accessor.insert({
        accountId: casa.accountId, assetType: 'stock', ticker: 'PETR4', ...overrides,
      });
      if (!result.ok) throw new Error(result.reason);
      return result.holding.id;
    };
    await test({
      db,
      accessor,
      casa: casa.householdId,
      investment: casa.accountId,
      other: (await addHouseholdWithAccount(db, 'Other')).householdId,
      addAccount: (type, ownerUserId) => insertAccount(db, casa.householdId, { type, ownerUserId }),
      open,
      openCdb: async (dueDate, accountId = casa.accountId) => {
        const holdingId = await open({
          accountId,
          assetType: 'cdb',
          ticker: null,
          rate: { rateType: 'cdi', rateValue: 1_100_000 },
          interestPayment: 'at_maturity',
          dueDate,
        });
        await accessor.applyTrade(holdingId, {
          quantityDelta: 100_000_000, costBasisDelta: 100_000,
        });
        await accessor.applySchedule(holdingId, cdbSchedule(dueDate));
        return holdingId;
      },
    });
  },
);

describe('insert', () => {
  it('opens a Holding with no position', scenario(async ({ accessor, investment }) => {
    const result = await accessor.insert({
      accountId: investment, assetType: 'stock', ticker: 'PETR4',
    });

    expect(result).toMatchObject({
      ok: true,
      holding: {
        accountId: investment,
        assetType: 'stock',
        ticker: 'PETR4',
        quantity: 0,
        costBasis: 0,
        rateType: null,
        rateValue: null,
        incentivised: null,
        interestPayment: null,
        dueDate: null,
        archivedAt: null,
        archivedBy: null,
        maturedNotifiedAt: null,
      },
    });
  }));

  it('keeps a fixed-term rate, the debenture flag, interest payment and due date', scenario(async ({
    accessor, investment,
  }) => {
    const result = await accessor.insert({
      accountId: investment,
      assetType: 'debenture',
      ticker: null,
      rate: { rateType: 'ipca', rateValue: 55_000 },
      incentivised: true,
      interestPayment: 'semiannual',
      dueDate: '2035-05-15',
    });

    expect(result).toMatchObject({
      ok: true,
      holding: {
        rateType: 'ipca',
        rateValue: 55_000,
        incentivised: true,
        interestPayment: 'semiannual',
        dueDate: '2035-05-15',
      },
    });
  }));

  it('refuses a rate without interest payment or due date, and those without one', scenario(async ({
    accessor, investment,
  }) => {
    const fixed = { accountId: investment, assetType: 'cdb', ticker: null };
    const rate = { rateType: 'fixed', rateValue: 120_000 } as const;
    await expect(accessor.insert({ ...fixed, rate, dueDate: '2030-01-02' })).rejects.toThrow();
    await expect(accessor.insert({ ...fixed, rate, interestPayment: 'monthly' })).rejects.toThrow();
    const stock = { accountId: investment, assetType: 'stock', ticker: 'VALE3' };
    await expect(accessor.insert({ ...stock, interestPayment: 'monthly' })).rejects.toThrow();
    await expect(accessor.insert({ ...stock, dueDate: '2030-01-02' })).rejects.toThrow();
  }));

  it.each(['checking', 'savings'])('opens one in a %s Account (OQ-76)', (type) => scenario(async ({
    accessor, addAccount,
  }) => {
    const accountId = await addAccount(type);

    expect(await accessor.insert({ accountId, assetType: 'stock', ticker: 'VALE3' }))
      .toMatchObject({ ok: true });
  })());

  it('refuses a credit-card-only Account (OQ-76)', scenario(async ({ accessor, addAccount }) => {
    const accountId = await addAccount('credit_card_only');

    expect(await accessor.insert({ accountId, assetType: 'stock', ticker: 'VALE3' }))
      .toEqual({ ok: false, reason: 'account_not_allowed' });
  }));

  it('refuses an unknown Account', scenario(async ({ accessor }) => {
    expect(await accessor.insert({ accountId: UNKNOWN_ID, assetType: 'stock', ticker: 'VALE3' }))
      .toEqual({ ok: false, reason: 'account_not_found' });
  }));
});

describe('findById', () => {
  it('reads a Holding of the household', scenario(async ({ accessor, casa, open }) => {
    const holdingId = await open();

    expect(await accessor.findById(casa, holdingId))
      .toMatchObject({ id: holdingId, ticker: 'PETR4' });
  }));

  it('finds nothing in another household', scenario(async ({ accessor, other, open }) => {
    expect(await accessor.findById(other, await open())).toBeUndefined();
  }));
});

describe('findByTicker', () => {
  it('finds the Holding of an asset type and ticker in the Account', scenario(async ({
    accessor, investment, addAccount, open,
  }) => {
    const petr4 = await open();
    await open({ ticker: 'VALE3' });
    await open({ assetType: 'fii' });
    await open({ accountId: await addAccount('savings') });

    expect((await accessor.findByTicker(investment, 'stock', 'PETR4'))?.id).toBe(petr4);
    expect(await accessor.findByTicker(investment, 'stock', 'ITUB4')).toBeUndefined();
  }));

  it('matches a missing ticker', scenario(async ({ accessor, investment, open }) => {
    await open();
    const untickered = await open({ assetType: 'real_estate', ticker: null });

    expect((await accessor.findByTicker(investment, 'real_estate', null))?.id).toBe(untickered);
  }));

  it('finds an archived Holding, so a re-buy reopens it (OQ-171)', scenario(async ({
    accessor, investment, open,
  }) => {
    const holdingId = await open();
    await accessor.archive(holdingId, 'system');

    expect(await accessor.findByTicker(investment, 'stock', 'PETR4'))
      .toMatchObject({ id: holdingId, archivedBy: 'system' });
  }));

  it('takes the latest opened when several match', scenario(async ({
    accessor, investment, open,
  }) => {
    await open();
    const latest = await open();

    expect((await accessor.findByTicker(investment, 'stock', 'PETR4'))?.id).toBe(latest);
  }));
});

describe('listByAccounts', () => {
  it('lists open Holdings, each Account\'s in the order opened', scenario(async ({
    accessor, investment, addAccount, open,
  }) => {
    const first = await open();
    const second = await open({ ticker: 'VALE3' });
    await accessor.archive(await open({ ticker: 'ITUB4' }), 'system');
    const savings = await addAccount('savings');
    const third = await open({ accountId: savings });

    expect((await accessor.listByAccounts([investment])).map((holding) => holding.id))
      .toEqual([first, second]);
    expect(new Set((await accessor.listByAccounts([savings, investment])).map(({ id }) => id)))
      .toEqual(new Set([first, second, third]));
  }));

  it('lists archived ones too when asked', scenario(async ({ accessor, investment, open }) => {
    const archived = await open();
    await accessor.archive(archived, 'user');

    expect((await accessor.listByAccounts([investment], { includeArchived: true }))
      .map((holding) => holding.id)).toEqual([archived]);
  }));

  it('reads nothing for no Accounts', scenario(async ({ accessor }) => {
    expect(await accessor.listByAccounts([])).toEqual([]);
  }));
});

describe('applyTrade', () => {
  it('moves the position by signed deltas and returns it', scenario(async ({
    accessor, casa, open,
  }) => {
    const holdingId = await open();

    expect(await accessor.applyTrade(holdingId, { quantityDelta: 1_000, costBasisDelta: 50_000 }))
      .toEqual({ ok: true, quantity: 1_000, costBasis: 50_000 });
    expect(await accessor.applyTrade(holdingId, { quantityDelta: -400, costBasisDelta: -20_000 }))
      .toEqual({ ok: true, quantity: 600, costBasis: 30_000 });
    expect(await accessor.findById(casa, holdingId))
      .toMatchObject({ quantity: 600, costBasis: 30_000 });
  }));

  it('undoes a trade with the same call negated', scenario(async ({ accessor, open }) => {
    const holdingId = await open();
    await accessor.applyTrade(holdingId, { quantityDelta: 1_000, costBasisDelta: 50_000 });
    await accessor.applyTrade(holdingId, { quantityDelta: -1_000, costBasisDelta: -50_000 });

    expect(await accessor.applyTrade(holdingId, { quantityDelta: 1_000, costBasisDelta: 50_000 }))
      .toEqual({ ok: true, quantity: 1_000, costBasis: 50_000 });
  }));

  it('reaches zero without archiving — that is the Manager\'s call', scenario(async ({
    accessor, casa, open,
  }) => {
    const holdingId = await open();
    await accessor.applyTrade(holdingId, { quantityDelta: 1_000, costBasisDelta: 50_000 });

    expect(await accessor.applyTrade(holdingId, { quantityDelta: -1_000, costBasisDelta: -50_000 }))
      .toEqual({ ok: true, quantity: 0, costBasis: 0 });
    expect(await accessor.findById(casa, holdingId)).toMatchObject({ archivedAt: null });
  }));

  it('refuses a quantity below zero, writing nothing', scenario(async ({
    accessor, casa, open,
  }) => {
    const holdingId = await open();
    await accessor.applyTrade(holdingId, { quantityDelta: 1_000, costBasisDelta: 50_000 });

    expect(await accessor.applyTrade(holdingId, { quantityDelta: -1_001, costBasisDelta: -50_000 }))
      .toEqual({ ok: false, reason: 'insufficient_quantity', quantity: 1_000 });
    expect(await accessor.findById(casa, holdingId))
      .toMatchObject({ quantity: 1_000, costBasis: 50_000 });
  }));

  it('refuses a cost basis below zero, writing nothing', scenario(async ({
    accessor, casa, open,
  }) => {
    const holdingId = await open();
    await accessor.applyTrade(holdingId, { quantityDelta: 1_000, costBasisDelta: 50_000 });

    expect(await accessor.applyTrade(holdingId, { quantityDelta: -500, costBasisDelta: -50_001 }))
      .toEqual({ ok: false, reason: 'cost_basis_below_zero', costBasis: 50_000 });
    expect(await accessor.findById(casa, holdingId))
      .toMatchObject({ quantity: 1_000, costBasis: 50_000 });
  }));

  it('refuses an unknown Holding', scenario(async ({ accessor }) => {
    expect(await accessor.applyTrade(UNKNOWN_ID, { quantityDelta: 1, costBasisDelta: 1 }))
      .toEqual({ ok: false, reason: 'holding_not_found' });
  }));
});

describe('archive', () => {
  it.each(['system', 'user'] as const)('archives by %s', (by) => scenario(async ({
    accessor, casa, open,
  }) => {
    const holdingId = await open();

    expect(await accessor.archive(holdingId, by)).toBe(true);
    const holding = await accessor.findById(casa, holdingId);
    expect(holding).toMatchObject({ archivedBy: by });
    expect(holding?.archivedAt).toBeInstanceOf(Date);
  })());

  it('keeps the first archive', scenario(async ({ accessor, casa, open }) => {
    const holdingId = await open();
    await accessor.archive(holdingId, 'system');

    expect(await accessor.archive(holdingId, 'user')).toBe(false);
    expect(await accessor.findById(casa, holdingId)).toMatchObject({ archivedBy: 'system' });
  }));

  it('archives nothing unknown', scenario(async ({ accessor }) => {
    expect(await accessor.archive(UNKNOWN_ID, 'user')).toBe(false);
  }));
});

describe('unarchiveIfSystemArchived', () => {
  it('undoes a system archive (OQ-80)', scenario(async ({ accessor, casa, open }) => {
    const holdingId = await open();
    await accessor.archive(holdingId, 'system');

    expect(await accessor.unarchiveIfSystemArchived(holdingId)).toBe(true);
    expect(await accessor.findById(casa, holdingId))
      .toMatchObject({ archivedAt: null, archivedBy: null });
  }));

  it('leaves a user archive one-way (FR-5.8)', scenario(async ({ accessor, casa, open }) => {
    const holdingId = await open();
    await accessor.archive(holdingId, 'user');

    expect(await accessor.unarchiveIfSystemArchived(holdingId)).toBe(false);
    expect(await accessor.findById(casa, holdingId)).toMatchObject({ archivedBy: 'user' });
  }));

  it('does nothing to an open Holding', scenario(async ({ accessor, open }) => {
    expect(await accessor.unarchiveIfSystemArchived(await open())).toBe(false);
  }));
});

describe('applySchedule', () => {
  it('stores the schedule, each entry unposted', scenario(async ({ accessor, open }) => {
    const holdingId = await open({ assetType: 'cdb', ticker: null });

    expect(await accessor.applySchedule(holdingId, cdbSchedule('2027-10-17')))
      .toEqual({ ok: true });
    expect(await accessor.listSchedule([holdingId])).toMatchObject([
      {
        holdingId,
        kind: 'redemption',
        amount: 110_000,
        date: '2027-10-17',
        postedAt: null,
        createdAt: expect.any(Date),
      },
      {
        holdingId, kind: 'tax', amount: 1_500, date: '2027-10-17', postedAt: null,
      },
    ]);
  }));

  it('replaces the whole schedule while none of it has posted', scenario(async ({
    accessor, open,
  }) => {
    const holdingId = await open({ assetType: 'cdb', ticker: null });
    await accessor.applySchedule(holdingId, cdbSchedule('2027-10-17'));

    expect(await accessor.applySchedule(holdingId, [
      { kind: 'redemption', amount: 120_000, date: '2028-01-10' },
    ])).toEqual({ ok: true });
    expect((await accessor.listSchedule([holdingId])).map(({ kind, amount, date }) => [
      kind, amount, date,
    ])).toEqual([['redemption', 120_000, '2028-01-10']]);
  }));

  it('clears the schedule when given none', scenario(async ({ accessor, open }) => {
    const holdingId = await open({ assetType: 'cdb', ticker: null });
    await accessor.applySchedule(holdingId, cdbSchedule('2027-10-17'));

    expect(await accessor.applySchedule(holdingId, [])).toEqual({ ok: true });
    expect(await accessor.listSchedule([holdingId])).toEqual([]);
  }));

  it('refuses once an entry has posted, keeping the schedule (OQ-171)', scenario(async ({
    accessor, open,
  }) => {
    const holdingId = await open({ assetType: 'tesouro_direto', ticker: null });
    await accessor.applySchedule(holdingId, [
      { kind: 'interest_payment', amount: 3_000, date: '2026-07-01' },
      { kind: 'redemption', amount: 100_000, date: '2029-01-01' },
    ]);
    const [coupon] = await accessor.listSchedule([holdingId]);
    await accessor.markEntryPosted(coupon!.id);

    expect(await accessor.applySchedule(holdingId, cdbSchedule('2027-10-17')))
      .toEqual({ ok: false, reason: 'schedule_started' });
    expect(await accessor.listSchedule([holdingId])).toHaveLength(2);
  }));

  it('refuses an unknown Holding', scenario(async ({ accessor }) => {
    expect(await accessor.applySchedule(UNKNOWN_ID, cdbSchedule('2027-10-17')))
      .toEqual({ ok: false, reason: 'holding_not_found' });
  }));
});

describe('listSchedule', () => {
  it('lists each Holding\'s entries by date', scenario(async ({ accessor, open }) => {
    const first = await open({ assetType: 'cdb', ticker: null });
    const second = await open({ assetType: 'lci', ticker: null });
    await accessor.applySchedule(first, [
      { kind: 'redemption', amount: 100_000, date: '2028-01-01' },
      { kind: 'interest_payment', amount: 2_000, date: '2027-01-01' },
    ]);
    await accessor.applySchedule(second, [
      { kind: 'redemption', amount: 50_000, date: '2027-06-01' },
    ]);

    const entries = await accessor.listSchedule([first, second]);
    expect(entries.filter(({ holdingId }) => holdingId === first).map(({ date }) => date))
      .toEqual(['2027-01-01', '2028-01-01']);
    expect(entries.filter(({ holdingId }) => holdingId === second)).toHaveLength(1);
  }));

  it('reads nothing for no Holdings', scenario(async ({ accessor }) => {
    expect(await accessor.listSchedule([])).toEqual([]);
  }));
});

describe('findDueScheduleEntries', () => {
  it('lists unposted entries due by today, oldest first, with their Account', scenario(async ({
    accessor, investment, open,
  }) => {
    const holdingId = await open({ assetType: 'tesouro_direto', ticker: null });
    await accessor.applySchedule(holdingId, [
      { kind: 'interest_payment', amount: 3_000, date: '2026-04-01' },
      { kind: 'interest_payment', amount: 3_000, date: TODAY },
      { kind: 'interest_payment', amount: 3_000, date: '2026-01-01' },
      { kind: 'redemption', amount: 100_000, date: '2026-10-18' },
    ]);
    const [posted] = await accessor.listSchedule([holdingId]);
    await accessor.markEntryPosted(posted!.id);

    expect((await accessor.findDueScheduleEntries(TODAY)).map(({ date, accountId, kind }) => [
      date, accountId, kind,
    ])).toEqual([
      ['2026-04-01', investment, 'interest_payment'],
      [TODAY, investment, 'interest_payment'],
    ]);
  }));
});

describe('markEntryPosted', () => {
  it('marks an entry once', scenario(async ({ accessor, open }) => {
    const holdingId = await open({ assetType: 'cdb', ticker: null });
    await accessor.applySchedule(holdingId, cdbSchedule(TODAY));
    const [entry] = await accessor.listSchedule([holdingId]);

    expect(await accessor.markEntryPosted(entry!.id)).toBe(true);
    expect(await accessor.markEntryPosted(entry!.id)).toBe(false);
    expect((await accessor.listSchedule([holdingId]))[0]?.postedAt).toBeInstanceOf(Date);
  }));

  it('marks nothing unknown', scenario(async ({ accessor }) => {
    expect(await accessor.markEntryPosted(UNKNOWN_ID)).toBe(false);
  }));
});

describe('findMaturedWithPosition', () => {
  it('lists fixed-term Holdings past due with a position, with their Account', scenario(async ({
    db, accessor, casa, addAccount, openCdb,
  }) => {
    const ana = await idOf(db.insert(users).values({
      email: 'ana@example.com',
      passwordHash: 'x',
      firstName: 'Ana',
      lastName: 'Silva',
      mfaSecret: 'x',
    }).returning({ id: users.id }));
    const personal = await addAccount('savings', ana);
    const later = await openCdb('2026-10-10');
    const sooner = await openCdb('2026-09-30', personal);

    expect(await accessor.findMaturedWithPosition(TODAY)).toEqual([
      {
        holdingId: sooner,
        accountId: personal,
        householdId: casa,
        ownerUserId: ana,
        visibility: 'personal',
        assetType: 'cdb',
        ticker: null,
        dueDate: '2026-09-30',
      },
      expect.objectContaining({ holdingId: later, visibility: 'shared', ownerUserId: null }),
    ]);
  }));

  it('leaves out Holdings due today or later, zeroed, archived or notified', scenario(async ({
    accessor, openCdb,
  }) => {
    await openCdb(TODAY);
    const zeroed = await openCdb('2026-10-01');
    await accessor.applyTrade(zeroed, { quantityDelta: -100_000_000, costBasisDelta: -100_000 });
    await accessor.archive(await openCdb('2026-10-01'), 'user');
    await accessor.markMaturedNotified(await openCdb('2026-10-01'));

    expect(await accessor.findMaturedWithPosition(TODAY)).toEqual([]);
  }));

  it('leaves out market-priced Holdings, which have no due date', scenario(async ({
    accessor, open,
  }) => {
    await accessor.applyTrade(await open(), { quantityDelta: 1_000, costBasisDelta: 50_000 });

    expect(await accessor.findMaturedWithPosition(TODAY)).toEqual([]);
  }));
});

describe('markMaturedNotified', () => {
  it('marks a Holding once', scenario(async ({ db, accessor, openCdb }) => {
    const holdingId = await openCdb('2026-10-01');

    expect(await accessor.markMaturedNotified(holdingId)).toBe(true);
    expect(await accessor.markMaturedNotified(holdingId)).toBe(false);
    const [row] = await db.select({ at: investmentHoldings.maturedNotifiedAt })
      .from(investmentHoldings).where(eq(investmentHoldings.id, holdingId));
    expect(row?.at).toBeInstanceOf(Date);
  }));
});
