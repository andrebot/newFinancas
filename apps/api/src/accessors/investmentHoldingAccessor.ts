import {
  and, asc, desc, eq, gt, inArray, isNull, lt, lte, sql,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { accounts, investmentHoldings, investmentScheduleEntries } from '../db/schema';
import type { InterestPayment } from '../db/schema/values';

// InvestmentHoldingAccessor (A11, VBD): Investment Holdings and their FR-11
// schedule (FR-5.1, FR-5.8, FR-11.2–FR-11.3, 02-data-model.md). It applies data
// changes only. Whether a buy accumulates or opens a new Holding (OQ-50), the
// quantity and cost-basis deltas of a trade, when to archive or un-archive, and
// what the schedule is are the Managers' (and InvestmentProductEngine's) decisions.
// What stays here:
// - a Holding never lives in a `credit_card_only` Account (OQ-76);
// - a position never goes below zero, checked under the Holding's row lock;
// - a user archive is one-way, a system archive is undone only by
//   `unarchiveIfSystemArchived` (FR-5.8, OQ-80);
// - a schedule is replaced whole, and never once one of its entries has posted;
//   an entry and a matured notice are each marked once (OQ-171).

/** How a fixed-term Holding's rate is expressed (OQ-50, OQ-86). */
export interface HoldingRate {
  readonly rateType: string;
  /** Percent × 10,000. */
  readonly rateValue: number;
  /** CDI/Selic only, percent × 10,000: a spread on top of the percent (OQ-205). */
  readonly rateSpread: number | null;
}

export interface InvestmentHolding {
  readonly id: string;
  readonly accountId: string;
  /** Reference data (FR-5.1/FR-11.1), validated by the Manager. */
  readonly assetType: string;
  readonly ticker: string | null;
  /** 1e-8 units (OQ-86). */
  readonly quantity: number;
  /** Minor units of the Account's currency. */
  readonly costBasis: number;
  /** Fixed-term types only, immutable once set (OQ-50). */
  readonly rateType: string | null;
  readonly rateValue: number | null;
  /** CDI/Selic only — a spread on top of the percent of the index (OQ-205). */
  readonly rateSpread: number | null;
  /** Debentures only (OQ-79). */
  readonly incentivised: boolean | null;
  /** Fixed-term types only — when the contract pays interest (OQ-201). */
  readonly interestPayment: InterestPayment | null;
  /** Fixed-term types only — the contract's maturity date, `YYYY-MM-DD` (OQ-205). */
  readonly dueDate: string | null;
  readonly archivedAt: Date | null;
  readonly archivedBy: ArchivedBy | null;
  readonly maturedNotifiedAt: Date | null;
  readonly createdAt: Date;
}

/** A Holding with its Account's currency — the currency its value is in (FR-2.2). */
export interface PricedHolding extends InvestmentHolding {
  readonly currency: string;
}

/** Who archived a Holding: a trade that zeroed it, or its user (FR-5.8). */
export type ArchivedBy = 'system' | 'user';

/** A Holding to open, with no position yet — its buy's `applyTrade` sets one. */
export interface NewInvestmentHolding {
  readonly accountId: string;
  readonly assetType: string;
  readonly ticker: string | null;
  readonly rate?: HoldingRate;
  readonly incentivised?: boolean;
  /** Required with a rate, absent without one (a CHECK, OQ-201). */
  readonly interestPayment?: InterestPayment;
  /** Required with a rate, absent without one (a CHECK, OQ-205). */
  readonly dueDate?: string;
}

export type InsertHoldingResult = | { readonly ok: true; readonly holding: InvestmentHolding }
  | { readonly ok: false; readonly reason: 'account_not_found' }
  /** OQ-76: investments live in checking, savings or investment Accounts. */
  | { readonly ok: false; readonly reason: 'account_not_allowed' };

/** A change to a Holding's position, signed by the Manager. */
export interface Trade {
  readonly quantityDelta: number;
  readonly costBasisDelta: number;
}

export type ApplyTradeResult = | {
  readonly ok: true; readonly quantity: number; readonly costBasis: number;
}
  | { readonly ok: false; readonly reason: 'holding_not_found' }
  | { readonly ok: false; readonly reason: 'insufficient_quantity'; readonly quantity: number }
  | { readonly ok: false; readonly reason: 'cost_basis_below_zero'; readonly costBasis: number };

/** One contractual cash event of a fixed-term Holding (FR-11.2). */
export interface ScheduleEntryInput {
  /** `interest_payment`, `redemption` or `tax` (reference data). */
  readonly kind: string;
  /** Positive minor units. */
  readonly amount: number;
  /** `YYYY-MM-DD`. */
  readonly date: string;
}

export interface ScheduleEntry extends ScheduleEntryInput {
  readonly id: string;
  readonly holdingId: string;
  readonly postedAt: Date | null;
  readonly createdAt: Date;
}

/** A schedule entry due to post, with the Account it posts to. */
export interface DueScheduleEntry extends ScheduleEntryInput {
  readonly id: string;
  readonly holdingId: string;
  readonly accountId: string;
}

export type ApplyScheduleResult = | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'holding_not_found' }
  /** An entry has posted: the schedule is history now (OQ-171). */
  | { readonly ok: false; readonly reason: 'schedule_started' };

/** A fixed-term Holding past due with a position, and who its Account belongs to. */
export interface MaturedHolding {
  readonly holdingId: string;
  readonly accountId: string;
  readonly householdId: string;
  /** The personal Account's owner; recipients of a shared one are the Manager's. */
  readonly ownerUserId: string | null;
  readonly visibility: string;
  readonly assetType: string;
  readonly ticker: string | null;
  /**
   * The redemption entry's date: the due date rolled to a business day, when the
   * principal lands — not the contract's `dueDate` (OQ-205).
   */
  readonly dueDate: string;
}

const holdingColumns = {
  id: investmentHoldings.id,
  accountId: investmentHoldings.accountId,
  assetType: investmentHoldings.assetType,
  ticker: investmentHoldings.ticker,
  quantity: investmentHoldings.quantity,
  costBasis: investmentHoldings.costBasis,
  rateType: investmentHoldings.rateType,
  rateValue: investmentHoldings.rateValue,
  rateSpread: investmentHoldings.rateSpread,
  incentivised: investmentHoldings.incentivised,
  interestPayment: sql<InterestPayment | null>`${investmentHoldings.interestPayment}`,
  dueDate: investmentHoldings.dueDate,
  archivedAt: investmentHoldings.archivedAt,
  archivedBy: sql<ArchivedBy | null>`${investmentHoldings.archivedBy}`,
  maturedNotifiedAt: investmentHoldings.maturedNotifiedAt,
  createdAt: investmentHoldings.createdAt,
};

const entryInputColumns = {
  kind: investmentScheduleEntries.kind,
  amount: investmentScheduleEntries.amount,
  date: investmentScheduleEntries.date,
};

/**
 * Locks a Holding's row for the rest of the transaction.
 *
 * @param db - A transaction.
 * @param holdingId - The Holding.
 * @returns Its position, or `undefined` when there is no such Holding.
 */
const lockHolding = async (db: Database, holdingId: string) => {
  const [row] = await db.select({
    quantity: investmentHoldings.quantity, costBasis: investmentHoldings.costBasis,
  }).from(investmentHoldings).where(eq(investmentHoldings.id, holdingId)).for('update');
  return row;
};

/**
 * Tells whether any entry of a Holding's schedule has posted.
 *
 * @param db - A transaction.
 * @param holdingId - The Holding.
 * @returns `true` once one has.
 */
const hasPostedEntry = async (db: Database, holdingId: string) => (
  await db.select({ id: investmentScheduleEntries.id }).from(investmentScheduleEntries)
    .where(and(
      eq(investmentScheduleEntries.holdingId, holdingId),
      sql`${investmentScheduleEntries.postedAt} IS NOT NULL`,
    )).limit(1)
).length > 0;

/**
 * Builds the InvestmentHoldingAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createInvestmentHoldingAccessor = (db: Database) => ({
  /**
   * Opens a Holding in an Account, with no position (FR-5.1); the buy that
   * opens it sets one through `applyTrade`.
   *
   * @param holding - The Holding.
   * @returns The created Holding, or why nothing was written.
   */
  insert: (holding: NewInvestmentHolding): Promise<InsertHoldingResult> => (
    db.transaction(async (tx) => {
      const [account] = await tx.select({ type: accounts.type }).from(accounts)
        .where(eq(accounts.id, holding.accountId));
      if (!account) return { ok: false, reason: 'account_not_found' };
      if (account.type === 'credit_card_only') return { ok: false, reason: 'account_not_allowed' };
      const [row] = await tx.insert(investmentHoldings).values({
        accountId: holding.accountId,
        assetType: holding.assetType,
        ticker: holding.ticker,
        quantity: 0,
        costBasis: 0,
        rateType: holding.rate?.rateType,
        rateValue: holding.rate?.rateValue,
        rateSpread: holding.rate?.rateSpread,
        incentivised: holding.incentivised,
        interestPayment: holding.interestPayment,
        dueDate: holding.dueDate,
      }).returning(holdingColumns);
      return { ok: true, holding: row! };
    })
  ),

  /**
   * Reads one Holding of a household, through its Account.
   *
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @returns The Holding, or `undefined`.
   */
  findById: async (
    householdId: string,
    holdingId: string,
  ): Promise<InvestmentHolding | undefined> => {
    const [row] = await db.select(holdingColumns).from(investmentHoldings)
      .innerJoin(accounts, eq(accounts.id, investmentHoldings.accountId))
      .where(and(eq(investmentHoldings.id, holdingId), eq(accounts.householdId, householdId)));
    return row;
  },

  /**
   * Reads some Holdings of the household with their Account's currency, archived
   * ones included — those funding Goals, whoever's Account holds them (FR-8.5,
   * OQ-206; the caller decides what the viewer is shown).
   *
   * @param householdId - The household.
   * @param holdingIds - The Holdings.
   * @returns The ones found, in no particular order.
   */
  findByIds: async (
    householdId: string,
    holdingIds: readonly string[],
  ): Promise<PricedHolding[]> => {
    if (holdingIds.length === 0) return [];
    return db.select({ ...holdingColumns, currency: accounts.currency }).from(investmentHoldings)
      .innerJoin(accounts, eq(accounts.id, investmentHoldings.accountId))
      .where(and(
        inArray(investmentHoldings.id, [...holdingIds]),
        eq(accounts.householdId, householdId),
      ));
  },

  /**
   * Finds the Holding a market-priced buy accumulates into (FR-5.1, OQ-50) —
   * archived ones included, so a re-buy reopens its position (OQ-171).
   *
   * @param accountId - The Account.
   * @param assetType - The asset type.
   * @param ticker - The ticker, or `null` for none.
   * @returns The latest-opened match, or `undefined`.
   */
  findByTicker: async (
    accountId: string,
    assetType: string,
    ticker: string | null,
  ): Promise<InvestmentHolding | undefined> => {
    const [row] = await db.select(holdingColumns).from(investmentHoldings).where(and(
      eq(investmentHoldings.accountId, accountId),
      eq(investmentHoldings.assetType, assetType),
      ticker === null ? isNull(investmentHoldings.ticker) : eq(investmentHoldings.ticker, ticker),
    )).orderBy(desc(investmentHoldings.createdAt), desc(investmentHoldings.id))
      .limit(1);
    return row;
  },

  /**
   * Lists the Holdings of some Accounts, each Account's in the order opened.
   *
   * @param accountIds - The Accounts.
   * @param options - `includeArchived` to list archived Holdings too.
   * @returns The Holdings.
   */
  listByAccounts: async (
    accountIds: readonly string[],
    options: { readonly includeArchived?: boolean } = {},
  ): Promise<InvestmentHolding[]> => {
    if (accountIds.length === 0) return [];
    return db.select(holdingColumns).from(investmentHoldings).where(and(
      inArray(investmentHoldings.accountId, [...accountIds]),
      options.includeArchived ? undefined : isNull(investmentHoldings.archivedAt),
    )).orderBy(
      asc(investmentHoldings.accountId),
      asc(investmentHoldings.createdAt),
      asc(investmentHoldings.id),
    );
  },

  /**
   * Moves a Holding's position (FR-3.8): the Manager signs both deltas — a buy
   * up, a sell or redemption down at its average cost. Undoing a trade (edit,
   * delete) is the same call negated. Keyed by Holding — the Manager has
   * already loaded it within the household.
   *
   * @param holdingId - The Holding.
   * @param trade - Signed quantity and cost-basis deltas.
   * @returns The new position, or why nothing was written.
   */
  applyTrade: (holdingId: string, trade: Trade): Promise<ApplyTradeResult> => (
    db.transaction(async (tx) => {
      const current = await lockHolding(tx, holdingId);
      if (!current) return { ok: false, reason: 'holding_not_found' };
      const quantity = current.quantity + trade.quantityDelta;
      const costBasis = current.costBasis + trade.costBasisDelta;
      if (quantity < 0) {
        return { ok: false, reason: 'insufficient_quantity', quantity: current.quantity };
      }
      if (costBasis < 0) {
        return { ok: false, reason: 'cost_basis_below_zero', costBasis: current.costBasis };
      }
      await tx.update(investmentHoldings).set({ quantity, costBasis })
        .where(eq(investmentHoldings.id, holdingId));
      return { ok: true, quantity, costBasis };
    })
  ),

  /**
   * Archives a Holding (FR-5.8): `system` when a trade zeroed it, `user` from the
   * matured notice. An archived Holding keeps its first archive.
   *
   * @param holdingId - The Holding.
   * @param by - Who archives it.
   * @returns `true` when it was archived by this call.
   */
  archive: async (holdingId: string, by: ArchivedBy): Promise<boolean> => (
    await db.update(investmentHoldings).set({ archivedAt: sql`now()`, archivedBy: by })
      .where(and(eq(investmentHoldings.id, holdingId), isNull(investmentHoldings.archivedAt)))
      .returning({ id: investmentHoldings.id })
  ).length > 0,

  /**
   * Undoes a system archive — the trade that zeroed the Holding changed (OQ-80).
   * A user archive stays.
   *
   * @param holdingId - The Holding.
   * @returns `true` when it was un-archived.
   */
  unarchiveIfSystemArchived: async (holdingId: string): Promise<boolean> => (
    await db.update(investmentHoldings).set({ archivedAt: null, archivedBy: null })
      .where(and(eq(investmentHoldings.id, holdingId), eq(investmentHoldings.archivedBy, 'system')))
      .returning({ id: investmentHoldings.id })
  ).length > 0,

  /**
   * Replaces a fixed-term Holding's schedule (FR-11.2) with the Engine's output —
   * refused once an entry has posted (OQ-171).
   *
   * @param holdingId - The Holding.
   * @param entries - The whole schedule.
   * @returns `ok`, or why nothing was written.
   */
  applySchedule: (
    holdingId: string,
    entries: readonly ScheduleEntryInput[],
  ): Promise<ApplyScheduleResult> => db.transaction(async (tx) => {
    if (!await lockHolding(tx, holdingId)) return { ok: false, reason: 'holding_not_found' };
    if (await hasPostedEntry(tx, holdingId)) return { ok: false, reason: 'schedule_started' };
    await tx.delete(investmentScheduleEntries)
      .where(eq(investmentScheduleEntries.holdingId, holdingId));
    if (entries.length > 0) {
      await tx.insert(investmentScheduleEntries)
        .values(entries.map((entry) => ({ holdingId, ...entry })));
    }
    return { ok: true };
  }),

  /**
   * Lists the schedules of some Holdings, each by date.
   *
   * @param holdingIds - The Holdings.
   * @returns Their entries, posted or not.
   */
  listSchedule: async (holdingIds: readonly string[]): Promise<ScheduleEntry[]> => {
    if (holdingIds.length === 0) return [];
    return db.select({
      id: investmentScheduleEntries.id,
      holdingId: investmentScheduleEntries.holdingId,
      ...entryInputColumns,
      postedAt: investmentScheduleEntries.postedAt,
      createdAt: investmentScheduleEntries.createdAt,
    }).from(investmentScheduleEntries)
      .where(inArray(investmentScheduleEntries.holdingId, [...holdingIds]))
      .orderBy(
        asc(investmentScheduleEntries.holdingId),
        asc(investmentScheduleEntries.date),
        asc(investmentScheduleEntries.id),
      );
  },

  /**
   * Lists the unposted entries due by a day, for the daily job (FR-11.3).
   *
   * @param today - `YYYY-MM-DD` in the app's time zone.
   * @returns The entries, oldest first.
   */
  findDueScheduleEntries: (today: string): Promise<DueScheduleEntry[]> => db.select({
    id: investmentScheduleEntries.id,
    holdingId: investmentScheduleEntries.holdingId,
    accountId: investmentHoldings.accountId,
    ...entryInputColumns,
  }).from(investmentScheduleEntries)
    .innerJoin(investmentHoldings, eq(investmentHoldings.id, investmentScheduleEntries.holdingId))
    .where(and(
      isNull(investmentScheduleEntries.postedAt),
      lte(investmentScheduleEntries.date, today),
    ))
    .orderBy(asc(investmentScheduleEntries.date), asc(investmentScheduleEntries.id)),

  /**
   * Marks an entry posted, in the transaction that posts it — a second delivery
   * of the same event then finds it already posted (OQ-171).
   *
   * @param entryId - The entry.
   * @returns `true` when this call marked it.
   */
  markEntryPosted: async (entryId: string): Promise<boolean> => (
    await db.update(investmentScheduleEntries).set({ postedAt: sql`now()` })
      .where(and(
        eq(investmentScheduleEntries.id, entryId),
        isNull(investmentScheduleEntries.postedAt),
      ))
      .returning({ id: investmentScheduleEntries.id })
  ).length > 0,

  /**
   * Lists the fixed-term Holdings past due that still have a position and were
   * not yet notified (FR-5.8, OQ-72).
   *
   * @param today - `YYYY-MM-DD` in the app's time zone.
   * @returns The Holdings, soonest due first.
   */
  findMaturedWithPosition: (today: string): Promise<MaturedHolding[]> => db.select({
    holdingId: investmentHoldings.id,
    accountId: investmentHoldings.accountId,
    householdId: accounts.householdId,
    ownerUserId: accounts.ownerUserId,
    visibility: accounts.visibility,
    assetType: investmentHoldings.assetType,
    ticker: investmentHoldings.ticker,
    dueDate: investmentScheduleEntries.date,
  }).from(investmentHoldings)
    .innerJoin(accounts, eq(accounts.id, investmentHoldings.accountId))
    .innerJoin(investmentScheduleEntries, and(
      eq(investmentScheduleEntries.holdingId, investmentHoldings.id),
      eq(investmentScheduleEntries.kind, 'redemption'),
    ))
    .where(and(
      lt(investmentScheduleEntries.date, today),
      gt(investmentHoldings.quantity, 0),
      isNull(investmentHoldings.archivedAt),
      isNull(investmentHoldings.maturedNotifiedAt),
    ))
    .orderBy(asc(investmentScheduleEntries.date), asc(investmentHoldings.id)),

  /**
   * Records that a matured Holding's owners were notified, once.
   *
   * @param holdingId - The Holding.
   * @returns `true` when this call marked it.
   */
  markMaturedNotified: async (holdingId: string): Promise<boolean> => (
    await db.update(investmentHoldings).set({ maturedNotifiedAt: sql`now()` })
      .where(and(
        eq(investmentHoldings.id, holdingId),
        isNull(investmentHoldings.maturedNotifiedAt),
      ))
      .returning({ id: investmentHoldings.id })
  ).length > 0,
});

/** The InvestmentHoldingAccessor's operations. */
export type InvestmentHoldingAccessor = ReturnType<typeof createInvestmentHoldingAccessor>;

export default createInvestmentHoldingAccessor;
