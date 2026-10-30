import {
  and, asc, desc, eq, gte, inArray, isNull, lte, ne, or,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { valuationSnapshots } from '../db/schema';
import type { SnapshotSource } from '../db/schema/values';

// ValuationSnapshotAccessor (A12, VBD): a market-priced Holding's value history
// (FR-5.2, 02-data-model.md). Two kinds, tagged by `source` (OQ-56):
// - `manual` market values, which AccountManager records, edits and deletes;
// - `transaction` snapshots, which TransactionManager writes with each trade.
//   They change only through their transaction, and die with it (FK cascade).
// It applies data changes only: whether a Holding is market-priced (OQ-51), and
// which household it belongs to, the Manager checks before calling.
// A Holding's value on a date is its latest snapshot at or before it; snapshots
// on the same date are ordered by when they were written, the later one winning.

export interface ValuationSnapshot {
  readonly id: string;
  readonly holdingId: string;
  /** The Holding's total value in minor units, not a per-unit price (FR-5.2). */
  readonly valuation: number;
  /** `YYYY-MM-DD`. */
  readonly asOfDate: string;
  readonly source: SnapshotSource;
  /** Set for `transaction` snapshots only. */
  readonly accountTransactionId: string | null;
  readonly createdAt: Date;
}

/** A value and the date it held on. */
export interface Valuation {
  readonly valuation: number;
  readonly asOfDate: string;
}

/** The snapshot a trade writes, linked to its transaction. */
export interface AutomaticSnapshot extends Valuation {
  readonly holdingId: string;
  readonly accountTransactionId: string;
}

/** Why a manual-snapshot change was refused. */
export type ManualRefusal = 'not_found' | 'automatic';

/** Optional date bounds, both inclusive, `YYYY-MM-DD`. */
export interface DateRange {
  readonly from?: string;
  readonly to?: string;
}

const snapshotColumns = {
  id: valuationSnapshots.id,
  holdingId: valuationSnapshots.holdingId,
  valuation: valuationSnapshots.valuation,
  asOfDate: valuationSnapshots.asOfDate,
  source: valuationSnapshots.source,
  accountTransactionId: valuationSnapshots.accountTransactionId,
  createdAt: valuationSnapshots.createdAt,
};

type SnapshotRow = Omit<ValuationSnapshot, 'source'> & { readonly source: string };

// Newest first: the first row at or before a date is the value then.
const newestFirst = [
  desc(valuationSnapshots.asOfDate),
  desc(valuationSnapshots.createdAt),
  desc(valuationSnapshots.id),
];

/**
 * Narrows a row's `source` to the closed set the CHECK constraint enforces.
 *
 * @param row - A selected snapshot row.
 * @returns The snapshot.
 */
const toSnapshot = (row: SnapshotRow): ValuationSnapshot => ({
  ...row,
  source: row.source as SnapshotSource,
});

/**
 * The condition selecting one snapshot of one Holding.
 *
 * @param holdingId - The Holding.
 * @param snapshotId - The snapshot.
 * @returns The SQL condition.
 */
const snapshotIs = (holdingId: string, snapshotId: string) => and(
  eq(valuationSnapshots.holdingId, holdingId),
  eq(valuationSnapshots.id, snapshotId),
);

/**
 * The condition selecting snapshots dated within a range.
 *
 * @param range - Optional inclusive bounds.
 * @returns The SQL condition, or `undefined` for no bounds.
 */
const dateWithin = (range: DateRange) => and(
  range.from === undefined ? undefined : gte(valuationSnapshots.asOfDate, range.from),
  range.to === undefined ? undefined : lte(valuationSnapshots.asOfDate, range.to),
);

/**
 * Tells why a guarded manual-snapshot write touched no row: the snapshot isn't
 * this Holding's, or it is a `transaction` one.
 *
 * @param db - Database or transaction.
 * @param holdingId - The Holding.
 * @param snapshotId - The snapshot.
 * @returns The refusal.
 */
const refusalOf = async (
  db: Database,
  holdingId: string,
  snapshotId: string,
): Promise<ManualRefusal> => {
  const [row] = await db.select({ id: valuationSnapshots.id }).from(valuationSnapshots)
    .where(snapshotIs(holdingId, snapshotId));
  return row ? 'automatic' : 'not_found';
};

/**
 * The condition selecting one manual snapshot of one Holding — the guard that
 * keeps `transaction` snapshots out of reach of a direct edit (OQ-56).
 *
 * @param holdingId - The Holding.
 * @param snapshotId - The snapshot.
 * @returns The SQL condition.
 */
const manualSnapshotIs = (holdingId: string, snapshotId: string) => and(
  snapshotIs(holdingId, snapshotId),
  eq(valuationSnapshots.source, 'manual'),
);

const createValuationSnapshotAccessor = (db: Database) => ({
  /**
   * Records a market value for a Holding (FR-5.2).
   *
   * @param holdingId - The Holding.
   * @param value - Its total value and the date it held on.
   * @returns The new snapshot.
   */
  insertManual: async (holdingId: string, value: Valuation): Promise<ValuationSnapshot> => {
    const [row] = await db.insert(valuationSnapshots)
      .values({ ...value, holdingId, source: 'manual' })
      .returning(snapshotColumns);
    return toSnapshot(row!);
  },

  /**
   * Corrects a manual market value's amount and/or date (OQ-56).
   *
   * @param holdingId - The Holding.
   * @param snapshotId - The snapshot.
   * @param changes - The fields to change.
   * @returns The updated snapshot, or why it was refused.
   */
  updateManual: (
    holdingId: string,
    snapshotId: string,
    changes: Partial<Valuation>,
  ): Promise<ValuationSnapshot | ManualRefusal> => db.transaction(async (tx) => {
    const [row] = await tx.update(valuationSnapshots).set(changes)
      .where(manualSnapshotIs(holdingId, snapshotId))
      .returning(snapshotColumns);
    return row ? toSnapshot(row) : refusalOf(tx, holdingId, snapshotId);
  }),

  /**
   * Deletes a manual market value (OQ-56); the previous snapshot becomes the
   * Holding's value again.
   *
   * @param holdingId - The Holding.
   * @param snapshotId - The snapshot.
   * @returns `deleted`, or why it was refused.
   */
  deleteManual: (
    holdingId: string,
    snapshotId: string,
  ): Promise<'deleted' | ManualRefusal> => db.transaction(async (tx) => {
    const deleted = await tx.delete(valuationSnapshots)
      .where(manualSnapshotIs(holdingId, snapshotId))
      .returning({ id: valuationSnapshots.id });
    return deleted.length > 0 ? 'deleted' : refusalOf(tx, holdingId, snapshotId);
  }),

  /**
   * Records the snapshot a trade leaves behind, linked to its transaction.
   *
   * @param snapshot - The Holding, the transaction, the value and its date.
   * @returns The new snapshot.
   */
  insertAutomatic: async (snapshot: AutomaticSnapshot): Promise<ValuationSnapshot> => {
    const [row] = await db.insert(valuationSnapshots)
      .values({ ...snapshot, source: 'transaction' })
      .returning(snapshotColumns);
    return toSnapshot(row!);
  },

  /**
   * Follows an edited trade: its snapshot takes the new value and date.
   *
   * @param accountTransactionId - The trade.
   * @param value - The value and date after the edit.
   * @returns `true` when the trade had a snapshot.
   */
  updateAutomatic: async (accountTransactionId: string, value: Valuation): Promise<boolean> => (
    await db.update(valuationSnapshots).set(value)
      .where(eq(valuationSnapshots.accountTransactionId, accountTransactionId))
      .returning({ id: valuationSnapshots.id })
  ).length > 0,

  /**
   * Removes a trade's snapshot while the transaction stays (an edit took it off
   * the Holding). Deleting the transaction needs no call: the FK cascades.
   *
   * @param accountTransactionId - The trade.
   * @returns `true` when the trade had a snapshot.
   */
  deleteAutomatic: async (accountTransactionId: string): Promise<boolean> => (
    await db.delete(valuationSnapshots)
      .where(eq(valuationSnapshots.accountTransactionId, accountTransactionId))
      .returning({ id: valuationSnapshots.id })
  ).length > 0,

  /**
   * Lists a Holding's value history, newest first (FR-5.2/FR-5.4).
   *
   * @param holdingId - The Holding.
   * @param range - Optional inclusive date bounds.
   * @returns The snapshots.
   */
  list: async (holdingId: string, range: DateRange = {}): Promise<ValuationSnapshot[]> => {
    const rows = await db.select(snapshotColumns).from(valuationSnapshots)
      .where(and(eq(valuationSnapshots.holdingId, holdingId), dateWithin(range)))
      .orderBy(...newestFirst);
    return rows.map(toSnapshot);
  },

  /**
   * Each Holding's value on a date: its latest snapshot at or before it (FR-5.4,
   * FR-8.7). A Holding with none by then is left out.
   *
   * @param holdingIds - The Holdings.
   * @param date - The date, `YYYY-MM-DD`.
   * @param exceptTransactionId - A trade whose own snapshot is left out — an
   *   edit reads the value before it.
   * @returns At most one snapshot per Holding.
   */
  latestAsOf: async (
    holdingIds: readonly string[],
    date: string,
    exceptTransactionId?: string,
  ): Promise<ValuationSnapshot[]> => {
    if (holdingIds.length === 0) return [];
    const rows = await db.selectDistinctOn([valuationSnapshots.holdingId], snapshotColumns)
      .from(valuationSnapshots)
      .where(and(
        inArray(valuationSnapshots.holdingId, [...holdingIds]),
        lte(valuationSnapshots.asOfDate, date),
        exceptTransactionId === undefined ? undefined : or(
          isNull(valuationSnapshots.accountTransactionId),
          ne(valuationSnapshots.accountTransactionId, exceptTransactionId),
        ),
      ))
      .orderBy(asc(valuationSnapshots.holdingId), ...newestFirst);
    return rows.map(toSnapshot);
  },
});

/** The ValuationSnapshotAccessor's operations. */
export type ValuationSnapshotAccessor = ReturnType<typeof createValuationSnapshotAccessor>;

export default createValuationSnapshotAccessor;
