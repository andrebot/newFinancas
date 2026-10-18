import {
  and, asc, desc, eq, inArray, or, sql,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { accountMonthBalances, accounts } from '../db/schema';
import type { AccountType, Visibility } from '../db/schema/values';
import {
  monthOf, monthsBetween, type CalendarMonth, type MonthRange,
} from './calendarMonth';

// AccountAccessor (A5, VBD): Financial Accounts and their month balances (FR-2,
// FR-5.4/FR-6.6, 02-data-model.md). It applies data changes only. Who may see or
// change an Account, and whether an archived one still takes movements, are
// AccountManager's and TransactionManager's decisions. What stays here:
// - a movement in another currency is refused (FR-2.2);
// - the month balances form one gapless chain, each month opening at the last
//   one's ending — a cross-row rule no CHECK can express, kept by `applyMovement`
//   while holding the Account's row lock, so two movements run one after the other.
// The starting balance is the balance on the Account's starting-balance date
// (OQ-169): a movement dated on or after it moves the balance from its month on;
// one dated before it was already in that balance, so it only rebuilds the
// history behind it and the current balance never changes.

export interface Account {
  readonly id: string;
  readonly householdId: string;
  /** Owner if personal; provenance (nullable) if shared. */
  readonly ownerUserId: string | null;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: string;
  readonly visibility: Visibility;
  /** `YYYY-MM-DD`: the day the starting balance was true. */
  readonly startingBalanceDate: string;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
}

/** An Account to create; its creator owns it (identity if personal, provenance if shared). */
export interface NewAccount {
  readonly householdId: string;
  readonly ownerUserId: string;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: string;
  readonly visibility: Visibility;
  /** Minor units of `currency` (FR-2.1). */
  readonly startingBalance: number;
  /** `YYYY-MM-DD`: the day the starting balance was true — creation day. */
  readonly startingBalanceDate: string;
}

/**
 * What an edit may change: never the type or currency (OQ-32, FR-2.2), never the
 * owner — an Account turned personal goes back to its creator (OQ-169).
 */
export interface AccountChanges {
  readonly name?: string;
  readonly visibility?: Visibility;
}

/** Which Accounts a list returns; every visibility the viewer can see by default. */
export interface AccountFilter {
  readonly visibility?: Visibility | undefined;
}

/** A money movement on an Account. */
export interface Movement {
  /** Signed minor units: positive in, negative out. */
  readonly amount: number;
  readonly currency: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
}

export type ApplyMovementResult = | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'account_not_found' }
  /** FR-2.2: the Account holds `accountCurrency` only. */
  | { readonly ok: false; readonly reason: 'currency_mismatch'; readonly accountCurrency: string };

/** One month of an Account's balance (FR-5.4/FR-6.6). */
export interface AccountMonthBalance extends CalendarMonth {
  readonly accountId: string;
  readonly openingBalance: number;
  readonly endingBalance: number;
  readonly updatedAt: Date;
}

const accountColumns = {
  id: accounts.id,
  householdId: accounts.householdId,
  ownerUserId: accounts.ownerUserId,
  name: accounts.name,
  type: accounts.type,
  currency: accounts.currency,
  visibility: accounts.visibility,
  startingBalanceDate: accounts.startingBalanceDate,
  archivedAt: accounts.archivedAt,
  createdAt: accounts.createdAt,
};

const balanceColumns = {
  accountId: accountMonthBalances.accountId,
  year: accountMonthBalances.year,
  month: accountMonthBalances.month,
  openingBalance: accountMonthBalances.openingBalance,
  endingBalance: accountMonthBalances.endingBalance,
  updatedAt: accountMonthBalances.updatedAt,
};

type AccountRow = Omit<Account, 'type' | 'visibility'> & {
  readonly type: string;
  readonly visibility: string;
};

/**
 * Narrows a row's `type` and `visibility` to the closed sets the CHECK
 * constraints enforce.
 *
 * @param row - A selected Account row.
 * @returns The Account.
 */
const toAccount = (row: AccountRow): Account => ({
  ...row, type: row.type as AccountType, visibility: row.visibility as Visibility,
});

/**
 * The condition selecting one Account of a household.
 *
 * @param householdId - The household.
 * @param accountId - The Account.
 * @returns The SQL condition.
 */
const accountIs = (householdId: string, accountId: string) => and(
  eq(accounts.id, accountId),
  eq(accounts.householdId, householdId),
);

/**
 * The condition selecting the Accounts a member can see in a household: every
 * shared one and their own personal ones (FR-2.3), optionally of one visibility.
 *
 * @param householdId - The household.
 * @param viewerUserId - The member.
 * @param filter - An optional visibility.
 * @returns The SQL condition.
 */
const visibleTo = (householdId: string, viewerUserId: string, filter: AccountFilter) => and(
  eq(accounts.householdId, householdId),
  or(
    eq(accounts.visibility, 'shared'),
    and(eq(accounts.visibility, 'personal'), eq(accounts.ownerUserId, viewerUserId)),
  ),
  filter.visibility === undefined ? undefined : eq(accounts.visibility, filter.visibility),
);

/**
 * Compares a balance row's month with a given month.
 *
 * @param operator - The comparison.
 * @param month - The month to compare with.
 * @returns The SQL condition.
 */
const balanceMonth = (operator: '<' | '<=' | '=' | '>=' | '>', month: CalendarMonth) => {
  const row = sql`(${accountMonthBalances.year}, ${accountMonthBalances.month})`;
  return sql`${row} ${sql.raw(operator)} (${month.year}, ${month.month})`;
};

/**
 * Shifts an Account's month balances matching a condition by fixed deltas.
 *
 * @param db - A transaction.
 * @param accountId - The Account.
 * @param where - Which of its months.
 * @param deltas - What to add to the opening and to the ending balance.
 * @returns Resolves once shifted.
 */
const shiftBalances = async (
  db: Database,
  accountId: string,
  where: ReturnType<typeof balanceMonth>,
  deltas: { readonly opening: number; readonly ending: number },
) => {
  await db.update(accountMonthBalances).set({
    openingBalance: sql`${accountMonthBalances.openingBalance} + ${deltas.opening}`,
    endingBalance: sql`${accountMonthBalances.endingBalance} + ${deltas.ending}`,
    updatedAt: sql`now()`,
  }).where(and(eq(accountMonthBalances.accountId, accountId), where));
};

/**
 * Adds month rows that open and end at one balance — the months with no
 * movement yet, filled so the chain has no gaps.
 *
 * @param db - A transaction.
 * @param accountId - The Account.
 * @param months - The months to add.
 * @param balance - Their opening and ending balance.
 * @returns Resolves once added.
 */
const addFlatMonths = async (
  db: Database,
  accountId: string,
  months: readonly CalendarMonth[],
  balance: number,
) => {
  if (months.length === 0) return;
  await db.insert(accountMonthBalances).values(months.map((month) => ({
    accountId, ...month, openingBalance: balance, endingBalance: balance,
  })));
};

/**
 * Reads one end of an Account's balance chain.
 *
 * @param db - A transaction.
 * @param accountId - The Account.
 * @param end - The first month, or the last.
 * @returns That month's row.
 */
const chainEnd = async (db: Database, accountId: string, end: 'first' | 'last') => {
  const order = end === 'first' ? asc : desc;
  const [row] = await db.select(balanceColumns).from(accountMonthBalances)
    .where(eq(accountMonthBalances.accountId, accountId))
    .orderBy(order(accountMonthBalances.year), order(accountMonthBalances.month))
    .limit(1);
  return row!;
};

/**
 * Applies a movement dated on or after the starting-balance date: the chain
 * grows forward to its month, which ends `amount` higher, and every later
 * month opens and ends `amount` higher.
 *
 * @param db - A transaction holding the Account's row lock.
 * @param accountId - The Account.
 * @param month - The movement's month.
 * @param amount - Signed minor units.
 * @returns Resolves once applied.
 */
const applyForward = async (
  db: Database,
  accountId: string,
  month: CalendarMonth,
  amount: number,
) => {
  const last = await chainEnd(db, accountId, 'last');
  await addFlatMonths(db, accountId, monthsBetween(last, month).slice(1), last.endingBalance);
  await shiftBalances(db, accountId, balanceMonth('=', month), { opening: 0, ending: amount });
  await shiftBalances(db, accountId, balanceMonth('>', month), { opening: amount, ending: amount });
};

/**
 * Applies a movement dated before the starting-balance date, which already
 * includes it: the chain grows backward to its month, which opens `amount`
 * lower, and every earlier month opens and ends `amount` lower.
 *
 * @param db - A transaction holding the Account's row lock.
 * @param accountId - The Account.
 * @param month - The movement's month.
 * @param amount - Signed minor units.
 * @returns Resolves once applied.
 */
const applyBackward = async (
  db: Database,
  accountId: string,
  month: CalendarMonth,
  amount: number,
) => {
  const first = await chainEnd(db, accountId, 'first');
  const before = monthsBetween(month, first).slice(0, -1);
  await addFlatMonths(db, accountId, before, first.openingBalance);
  await shiftBalances(db, accountId, balanceMonth('=', month), { opening: -amount, ending: 0 });
  await shiftBalances(db, accountId, balanceMonth('<', month), {
    opening: -amount, ending: -amount,
  });
};

/**
 * Builds the AccountAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createAccountAccessor = (db: Database) => ({
  /**
   * Creates an Account with its first month balance, opening and ending at the
   * starting balance in the starting-balance date's month (FR-2.1).
   *
   * @param account - The Account and its starting balance.
   * @returns The created Account.
   */
  insert: (account: NewAccount): Promise<Account> => db.transaction(async (tx) => {
    const { startingBalance, ...columns } = account;
    const [row] = await tx.insert(accounts).values(columns).returning(accountColumns);
    await addFlatMonths(tx, row!.id, [monthOf(account.startingBalanceDate)], startingBalance);
    return toAccount(row!);
  }),

  /**
   * Reads one Account of a household.
   *
   * @param householdId - The household.
   * @param accountId - The Account.
   * @returns The Account, or `undefined`.
   */
  findById: async (householdId: string, accountId: string): Promise<Account | undefined> => {
    const [row] = await db.select(accountColumns).from(accounts)
      .where(accountIs(householdId, accountId));
    return row && toAccount(row);
  },

  /**
   * Lists the Accounts a member can see (shared ones and their own personal
   * ones), open ones first, then archived (FR-2.4), each by name.
   *
   * @param householdId - The household.
   * @param viewerUserId - The member.
   * @param filter - An optional visibility.
   * @returns The Accounts.
   */
  list: async (
    householdId: string,
    viewerUserId: string,
    filter: AccountFilter = {},
  ): Promise<Account[]> => {
    const rows = await db.select(accountColumns).from(accounts)
      .where(visibleTo(householdId, viewerUserId, filter))
      .orderBy(sql`${accounts.archivedAt} IS NOT NULL`, asc(accounts.name), asc(accounts.id));
    return rows.map(toAccount);
  },

  /**
   * Edits an Account's name and/or visibility (FR-2.3). Only its creator may
   * change the visibility — the Manager's check (OQ-169).
   *
   * @param householdId - The household.
   * @param accountId - The Account.
   * @param changes - The fields to change; none is a plain read.
   * @returns The Account as it now stands, or `undefined` when it isn't found.
   */
  update: async (
    householdId: string,
    accountId: string,
    changes: AccountChanges,
  ): Promise<Account | undefined> => {
    const set = Object.fromEntries(Object.entries(changes)
      .filter(([, value]) => value !== undefined));
    const [row] = Object.keys(set).length > 0
      ? await db.update(accounts).set(set).where(accountIs(householdId, accountId))
        .returning(accountColumns)
      : await db.select(accountColumns).from(accounts).where(accountIs(householdId, accountId));
    return row && toAccount(row);
  },

  /**
   * Archives an Account, one way (FR-2.4, OQ-34); its history stays. Archiving
   * it again keeps the first time.
   *
   * @param householdId - The household.
   * @param accountId - The Account.
   * @returns `true` when it exists.
   */
  archive: async (householdId: string, accountId: string): Promise<boolean> => (
    await db.update(accounts).set({ archivedAt: sql`coalesce(${accounts.archivedAt}, now())` })
      .where(accountIs(householdId, accountId)).returning({ id: accounts.id })
  ).length > 0,

  /**
   * Moves money on an Account (FR-3), refused in another currency (FR-2.2).
   * Keyed by Account — the Manager has already loaded it within the household.
   * Undoing a movement (edit, delete) is the same call with the amount negated.
   *
   * @param accountId - The Account.
   * @param movement - Signed amount, currency and date.
   * @returns `ok`, or why nothing was written.
   */
  applyMovement: (
    accountId: string,
    movement: Movement,
  ): Promise<ApplyMovementResult> => db.transaction(async (tx) => {
    const [account] = await tx.select({
      currency: accounts.currency, startingBalanceDate: accounts.startingBalanceDate,
    }).from(accounts).where(eq(accounts.id, accountId)).for('update');
    if (!account) return { ok: false, reason: 'account_not_found' };
    if (account.currency !== movement.currency) {
      return { ok: false, reason: 'currency_mismatch', accountCurrency: account.currency };
    }
    const apply = movement.date < account.startingBalanceDate ? applyBackward : applyForward;
    await apply(tx, accountId, monthOf(movement.date), movement.amount);
    return { ok: true };
  }),

  /**
   * Lists an Account's month balances, oldest first (FR-5.4/FR-6.6).
   *
   * @param accountId - The Account.
   * @param range - The months; open ends reach the chain's ends.
   * @returns The balances.
   */
  listBalances: (accountId: string, range: MonthRange = {}): Promise<AccountMonthBalance[]> => (
    db.select(balanceColumns).from(accountMonthBalances).where(and(
      eq(accountMonthBalances.accountId, accountId),
      range.from === undefined ? undefined : balanceMonth('>=', range.from),
      range.to === undefined ? undefined : balanceMonth('<=', range.to),
    )).orderBy(asc(accountMonthBalances.year), asc(accountMonthBalances.month))
  ),

  /**
   * Reads each Account's balance as of a month — its latest month at or before
   * it, since a month with no row has had no movement since. The current
   * balance is the one as of today's month; reporting reads month ends.
   *
   * @param accountIds - The Accounts.
   * @param month - The month.
   * @returns One balance per Account with history by then, in no particular order.
   */
  balancesAsOf: async (
    accountIds: readonly string[],
    month: CalendarMonth,
  ): Promise<AccountMonthBalance[]> => {
    if (accountIds.length === 0) return [];
    return db.selectDistinctOn([accountMonthBalances.accountId], balanceColumns)
      .from(accountMonthBalances)
      .where(and(
        inArray(accountMonthBalances.accountId, [...accountIds]),
        balanceMonth('<=', month),
      ))
      .orderBy(
        accountMonthBalances.accountId,
        desc(accountMonthBalances.year),
        desc(accountMonthBalances.month),
      );
  },
});

/** The AccountAccessor's operations. */
export type AccountAccessor = ReturnType<typeof createAccountAccessor>;

export default createAccountAccessor;
