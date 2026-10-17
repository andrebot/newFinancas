import {
  and, asc, desc, eq, inArray, sql,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { accounts, creditCardMonthBalances, creditCards } from '../db/schema';
import cycleOf from './billingCycle';
import {
  monthsBetween, type CalendarMonth, type MonthRange,
} from './calendarMonth';

// CreditCardAccessor (A6, VBD): Credit Cards and their outstanding balance by
// billing cycle (FR-2.7–FR-2.10, 02-data-model.md). It applies data changes only.
// Which Accounts take cards (FR-2.7), whether a network is known, and the sign of
// a charge, refund or bill payment are the Managers' decisions. What stays here:
// - a movement in a currency other than the card's Account's is refused (FR-2.2);
// - a movement lands in the billing cycle its date falls in, named by the month
//   the cycle closes in, under the closing day the card has when it is written —
//   editing the closing day never moves the past (OQ-170);
// - the cycle balances form one gapless chain opening at 0 (a card has no starting
//   balance, FR-2.10), each cycle opening at the last one's ending — kept by
//   `applyMovement` while holding the card's row lock.

export interface CreditCard {
  readonly id: string;
  readonly accountId: string;
  /** Reference data (FR-2.8), validated by the Manager. */
  readonly network: string;
  readonly last4: string;
  readonly closingDay: number;
  readonly dueDay: number;
  readonly expirationMonth: number;
  readonly expirationYear: number;
  readonly createdAt: Date;
}

/** A card to attach to an Account. */
export type NewCreditCard = Omit<CreditCard, 'id' | 'createdAt'>;

/** What an edit may change: anything but the Account it belongs to. */
export type CreditCardChanges = Partial<Omit<NewCreditCard, 'accountId'>>;

/** A change to a card's outstanding balance. */
export interface CardMovement {
  /** Signed minor units: positive raises the outstanding balance (a charge). */
  readonly amount: number;
  readonly currency: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
}

export type ApplyCardMovementResult = | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'card_not_found' }
  /** FR-2.2: the card takes its Account's currency only. */
  | { readonly ok: false; readonly reason: 'currency_mismatch'; readonly cardCurrency: string };

/** One billing cycle of a card's outstanding balance, named by its closing month. */
export interface CreditCardMonthBalance extends CalendarMonth {
  readonly creditCardId: string;
  readonly openingOutstandingBalance: number;
  readonly endingOutstandingBalance: number;
  readonly updatedAt: Date;
}

const cardColumns = {
  id: creditCards.id,
  accountId: creditCards.accountId,
  network: creditCards.network,
  last4: creditCards.last4,
  closingDay: creditCards.closingDay,
  dueDay: creditCards.dueDay,
  expirationMonth: creditCards.expirationMonth,
  expirationYear: creditCards.expirationYear,
  createdAt: creditCards.createdAt,
};

const balanceColumns = {
  creditCardId: creditCardMonthBalances.creditCardId,
  year: creditCardMonthBalances.year,
  month: creditCardMonthBalances.month,
  openingOutstandingBalance: creditCardMonthBalances.openingOutstandingBalance,
  endingOutstandingBalance: creditCardMonthBalances.endingOutstandingBalance,
  updatedAt: creditCardMonthBalances.updatedAt,
};

/**
 * The condition selecting one card of an Account.
 *
 * @param accountId - The Account.
 * @param creditCardId - The card.
 * @returns The SQL condition.
 */
const cardIs = (accountId: string, creditCardId: string) => and(
  eq(creditCards.id, creditCardId),
  eq(creditCards.accountId, accountId),
);

/**
 * Compares a balance row's cycle with a given month.
 *
 * @param operator - The comparison.
 * @param month - The month to compare with.
 * @returns The SQL condition.
 */
const balanceMonth = (operator: '<=' | '=' | '>=' | '>', month: CalendarMonth) => {
  const row = sql`(${creditCardMonthBalances.year}, ${creditCardMonthBalances.month})`;
  return sql`${row} ${sql.raw(operator)} (${month.year}, ${month.month})`;
};

/**
 * Shifts a card's cycle balances matching a condition by fixed deltas.
 *
 * @param db - A transaction.
 * @param creditCardId - The card.
 * @param where - Which of its cycles.
 * @param deltas - What to add to the opening and to the ending balance.
 * @returns Resolves once shifted.
 */
const shiftBalances = async (
  db: Database,
  creditCardId: string,
  where: ReturnType<typeof balanceMonth>,
  deltas: { readonly opening: number; readonly ending: number },
) => {
  const { openingOutstandingBalance: opening, endingOutstandingBalance: ending } = (
    creditCardMonthBalances
  );
  await db.update(creditCardMonthBalances).set({
    openingOutstandingBalance: sql`${opening} + ${deltas.opening}`,
    endingOutstandingBalance: sql`${ending} + ${deltas.ending}`,
    updatedAt: sql`now()`,
  }).where(and(eq(creditCardMonthBalances.creditCardId, creditCardId), where));
};

/**
 * Adds cycle rows that open and end at one balance — the cycles with no
 * movement yet, filled so the chain has no gaps.
 *
 * @param db - A transaction.
 * @param creditCardId - The card.
 * @param months - The cycles to add.
 * @param balance - Their opening and ending outstanding balance.
 * @returns Resolves once added.
 */
const addFlatMonths = async (
  db: Database,
  creditCardId: string,
  months: readonly CalendarMonth[],
  balance: number,
) => {
  if (months.length === 0) return;
  await db.insert(creditCardMonthBalances).values(months.map((month) => ({
    creditCardId,
    ...month,
    openingOutstandingBalance: balance,
    endingOutstandingBalance: balance,
  })));
};

/**
 * Reads one end of a card's balance chain.
 *
 * @param db - A transaction.
 * @param creditCardId - The card.
 * @param end - The first cycle, or the last.
 * @returns That cycle's row.
 */
const chainEnd = async (db: Database, creditCardId: string, end: 'first' | 'last') => {
  const order = end === 'first' ? asc : desc;
  const [row] = await db.select(balanceColumns).from(creditCardMonthBalances)
    .where(eq(creditCardMonthBalances.creditCardId, creditCardId))
    .orderBy(order(creditCardMonthBalances.year), order(creditCardMonthBalances.month))
    .limit(1);
  return row!;
};

/**
 * Moves a cycle's ending balance and carries it through every later cycle,
 * first growing the chain to reach the cycle: backward at the chain's opening,
 * forward at its ending.
 *
 * @param db - A transaction holding the card's row lock.
 * @param creditCardId - The card.
 * @param cycle - The movement's cycle.
 * @param amount - Signed minor units.
 * @returns Resolves once applied.
 */
const applyToCycle = async (
  db: Database,
  creditCardId: string,
  cycle: CalendarMonth,
  amount: number,
) => {
  const first = await chainEnd(db, creditCardId, 'first');
  const last = await chainEnd(db, creditCardId, 'last');
  const before = monthsBetween(cycle, first).slice(0, -1);
  const after = monthsBetween(last, cycle).slice(1);
  await addFlatMonths(db, creditCardId, before, first.openingOutstandingBalance);
  await addFlatMonths(db, creditCardId, after, last.endingOutstandingBalance);
  await shiftBalances(db, creditCardId, balanceMonth('=', cycle), { opening: 0, ending: amount });
  await shiftBalances(db, creditCardId, balanceMonth('>', cycle), {
    opening: amount, ending: amount,
  });
};

/**
 * Builds the CreditCardAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createCreditCardAccessor = (db: Database) => ({
  /**
   * Attaches a card to an Account (FR-2.7) with its first cycle balance at 0,
   * in the cycle `today` falls in (FR-2.10).
   *
   * @param card - The card.
   * @param today - `YYYY-MM-DD` in the app's time zone (OQ-104).
   * @returns The created card.
   */
  insert: (card: NewCreditCard, today: string): Promise<CreditCard> => (
    db.transaction(async (tx) => {
      const [row] = await tx.insert(creditCards).values(card).returning(cardColumns);
      await addFlatMonths(tx, row!.id, [cycleOf(today, card.closingDay)], 0);
      return row!;
    })
  ),

  /**
   * Reads one card of a household, through its Account.
   *
   * @param householdId - The household.
   * @param creditCardId - The card.
   * @returns The card, or `undefined`.
   */
  findById: async (householdId: string, creditCardId: string): Promise<CreditCard | undefined> => {
    const [row] = await db.select(cardColumns).from(creditCards)
      .innerJoin(accounts, eq(accounts.id, creditCards.accountId))
      .where(and(eq(creditCards.id, creditCardId), eq(accounts.householdId, householdId)));
    return row;
  },

  /**
   * Lists the cards of some Accounts, each Account's in the order attached.
   *
   * @param accountIds - The Accounts.
   * @returns The cards.
   */
  listByAccounts: async (accountIds: readonly string[]): Promise<CreditCard[]> => {
    if (accountIds.length === 0) return [];
    return db.select(cardColumns).from(creditCards)
      .where(inArray(creditCards.accountId, [...accountIds]))
      .orderBy(asc(creditCards.accountId), asc(creditCards.createdAt), asc(creditCards.id));
  },

  /**
   * Edits a card of an Account (FR-2.9). A new closing day applies to the
   * movements written after it; past cycles stay as they are (OQ-170).
   *
   * @param accountId - The Account being edited.
   * @param creditCardId - The card.
   * @param changes - The fields to change; none is a plain read.
   * @returns The card as it now stands, or `undefined` when the Account has no such card.
   */
  update: async (
    accountId: string,
    creditCardId: string,
    changes: CreditCardChanges,
  ): Promise<CreditCard | undefined> => {
    const set = Object.fromEntries(Object.entries(changes)
      .filter(([, value]) => value !== undefined));
    const [row] = Object.keys(set).length > 0
      ? await db.update(creditCards).set(set).where(cardIs(accountId, creditCardId))
        .returning(cardColumns)
      : await db.select(cardColumns).from(creditCards).where(cardIs(accountId, creditCardId));
    return row;
  },

  /**
   * Removes a card of an Account (FR-2.9), with its Card Transactions and
   * balances; bill payments keep their Account's history, unlinked.
   *
   * @param accountId - The Account being edited.
   * @param creditCardId - The card.
   * @returns `true` when the Account had it.
   */
  remove: async (accountId: string, creditCardId: string): Promise<boolean> => (
    await db.delete(creditCards).where(cardIs(accountId, creditCardId))
      .returning({ id: creditCards.id })
  ).length > 0,

  /**
   * Moves a card's outstanding balance in the cycle the date falls in
   * (FR-2.10): the Manager signs it — a charge up, a refund or a bill payment
   * down. Undoing a movement (edit, delete) is the same call with the amount
   * negated. Keyed by card — the Manager has already loaded it within the household.
   *
   * @param creditCardId - The card.
   * @param movement - Signed amount, currency and date.
   * @returns `ok`, or why nothing was written.
   */
  applyMovement: (
    creditCardId: string,
    movement: CardMovement,
  ): Promise<ApplyCardMovementResult> => db.transaction(async (tx) => {
    const [card] = await tx.select({
      closingDay: creditCards.closingDay, currency: accounts.currency,
    }).from(creditCards).innerJoin(accounts, eq(accounts.id, creditCards.accountId))
      .where(eq(creditCards.id, creditCardId))
      .for('update', { of: creditCards });
    if (!card) return { ok: false, reason: 'card_not_found' };
    if (card.currency !== movement.currency) {
      return { ok: false, reason: 'currency_mismatch', cardCurrency: card.currency };
    }
    await applyToCycle(tx, creditCardId, cycleOf(movement.date, card.closingDay), movement.amount);
    return { ok: true };
  }),

  /**
   * Lists a card's cycle balances, oldest first (FR-2.10).
   *
   * @param creditCardId - The card.
   * @param range - The cycles; open ends reach the chain's ends.
   * @returns The balances.
   */
  listBalances: (
    creditCardId: string,
    range: MonthRange = {},
  ): Promise<CreditCardMonthBalance[]> => db.select(balanceColumns)
    .from(creditCardMonthBalances).where(and(
      eq(creditCardMonthBalances.creditCardId, creditCardId),
      range.from === undefined ? undefined : balanceMonth('>=', range.from),
      range.to === undefined ? undefined : balanceMonth('<=', range.to),
    )).orderBy(asc(creditCardMonthBalances.year), asc(creditCardMonthBalances.month)),

  /**
   * Reads each card's balance as of a cycle — its latest cycle at or before it,
   * since a cycle with no row has had no movement since.
   *
   * @param creditCardIds - The cards.
   * @param month - The cycle's closing month.
   * @returns One balance per card with history by then, in no particular order.
   */
  balancesAsOf: async (
    creditCardIds: readonly string[],
    month: CalendarMonth,
  ): Promise<CreditCardMonthBalance[]> => {
    if (creditCardIds.length === 0) return [];
    return db.selectDistinctOn([creditCardMonthBalances.creditCardId], balanceColumns)
      .from(creditCardMonthBalances)
      .where(and(
        inArray(creditCardMonthBalances.creditCardId, [...creditCardIds]),
        balanceMonth('<=', month),
      ))
      .orderBy(
        creditCardMonthBalances.creditCardId,
        desc(creditCardMonthBalances.year),
        desc(creditCardMonthBalances.month),
      );
  },
});

/** The CreditCardAccessor's operations. */
export type CreditCardAccessor = ReturnType<typeof createCreditCardAccessor>;

export default createCreditCardAccessor;
