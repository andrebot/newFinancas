import type { IndexCodeValue } from '@financas/reference';
import {
  and, asc, desc, eq,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { PG_UNIQUE_VIOLATION, pgErrorCode } from '../db/errors';
import { indexRateValues } from '../db/schema';

// IndexRateAccessor (A14, VBD): a household's Index Reference Rates — a dated
// history of values per index (Selic, CDI, IPCA, IGP-M; FR-11.6, OQ-59).
// AccountManager writes them; InvestmentProductEngine reads the latest one to
// project index-linked Holdings. It applies data changes only: whether the index
// is known, the value in range and the date not in the future (OQ-172) are the
// Manager's checks. One value per index per day is the unique index firing.

export interface IndexRateValue {
  readonly id: string;
  readonly householdId: string;
  readonly indexCode: IndexCodeValue;
  /** Percent × 10,000 — 10.50% is `105000` (OQ-86). */
  readonly value: number;
  /** `YYYY-MM-DD`. */
  readonly asOfDate: string;
  /** Who recorded it; `null` once that user is deleted (FR-1.17). */
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
}

/** A value and the day it held on. */
export interface DatedRate {
  readonly value: number;
  readonly asOfDate: string;
}

/** A new value of one index. */
export interface NewIndexRate extends DatedRate {
  readonly indexCode: IndexCodeValue;
}

/** Why a write was refused. */
export type DuplicateDay = 'duplicate_day';

const rateColumns = {
  id: indexRateValues.id,
  householdId: indexRateValues.householdId,
  indexCode: indexRateValues.indexCode,
  value: indexRateValues.value,
  asOfDate: indexRateValues.asOfDate,
  createdByUserId: indexRateValues.createdByUserId,
  createdAt: indexRateValues.createdAt,
};

type RateRow = Omit<IndexRateValue, 'indexCode'> & { readonly indexCode: string };

// Newest first; one value per day, so the date alone orders an index.
const newestFirst = desc(indexRateValues.asOfDate);

/**
 * Narrows a row's `index_code` to the in-code list the Manager writes from.
 *
 * @param row - A selected row.
 * @returns The value.
 */
const toRate = (row: RateRow): IndexRateValue => ({
  ...row,
  indexCode: row.indexCode as IndexCodeValue,
});

/**
 * The condition selecting one value of one index of one household — the guard
 * that keeps another household's or another index's value out of reach.
 *
 * @param householdId - The household.
 * @param indexCode - The index.
 * @param valueId - The value.
 * @returns The SQL condition.
 */
const valueIs = (householdId: string, indexCode: IndexCodeValue, valueId: string) => and(
  eq(indexRateValues.householdId, householdId),
  eq(indexRateValues.indexCode, indexCode),
  eq(indexRateValues.id, valueId),
);

/**
 * Runs a write in a savepoint, turning the one-value-per-day unique index firing
 * into `duplicate_day` and leaving the surrounding transaction usable.
 *
 * @param db - Database or transaction.
 * @param write - The write, given the savepoint.
 * @returns What the write returned, or `duplicate_day`.
 */
const refusingDuplicateDay = async <Result>(
  db: Database,
  write: (tx: Database) => Promise<Result>,
): Promise<Result | DuplicateDay> => {
  try {
    return await db.transaction(write);
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) return 'duplicate_day';
    throw error;
  }
};

/**
 * Reads one value of one index of one household.
 *
 * @param db - Database or transaction.
 * @param householdId - The household.
 * @param indexCode - The index.
 * @param valueId - The value.
 * @returns The value, or `not_found`.
 */
const findValue = async (
  db: Database,
  householdId: string,
  indexCode: IndexCodeValue,
  valueId: string,
): Promise<IndexRateValue | 'not_found'> => {
  const [row] = await db.select(rateColumns).from(indexRateValues)
    .where(valueIs(householdId, indexCode, valueId));
  return row ? toRate(row) : 'not_found';
};

const createIndexRateAccessor = (db: Database) => ({
  /**
   * Records a value of an index (FR-11.6).
   *
   * @param householdId - The household.
   * @param rate - The index, its value and the day it held on.
   * @param createdByUserId - Who recorded it.
   * @returns The new value, or `duplicate_day` when the index has one that day.
   */
  insert: (
    householdId: string,
    rate: NewIndexRate,
    createdByUserId: string,
  ): Promise<IndexRateValue | DuplicateDay> => refusingDuplicateDay(db, async (tx) => {
    const [row] = await tx.insert(indexRateValues)
      .values({ ...rate, householdId, createdByUserId })
      .returning(rateColumns);
    return toRate(row!);
  }),

  /**
   * Corrects a value and/or its day (FR-11.6). An empty change reads it back.
   *
   * @param householdId - The household.
   * @param indexCode - The index, from the route.
   * @param valueId - The value.
   * @param changes - The fields to change.
   * @returns The updated value, `not_found`, or `duplicate_day` when the new day
   *   already has a value.
   */
  update: (
    householdId: string,
    indexCode: IndexCodeValue,
    valueId: string,
    changes: Partial<DatedRate>,
  ): Promise<IndexRateValue | 'not_found' | DuplicateDay> => {
    if (Object.keys(changes).length === 0) return findValue(db, householdId, indexCode, valueId);
    return refusingDuplicateDay(db, async (tx) => {
      const [row] = await tx.update(indexRateValues).set(changes)
        .where(valueIs(householdId, indexCode, valueId))
        .returning(rateColumns);
      return row ? toRate(row) : 'not_found';
    });
  },

  /**
   * Deletes a value (FR-11.6); the index's previous value becomes its latest.
   *
   * @param householdId - The household.
   * @param indexCode - The index, from the route.
   * @param valueId - The value.
   * @returns `deleted`, or `not_found`.
   */
  remove: async (
    householdId: string,
    indexCode: IndexCodeValue,
    valueId: string,
  ): Promise<'deleted' | 'not_found'> => {
    const deleted = await db.delete(indexRateValues)
      .where(valueIs(householdId, indexCode, valueId))
      .returning({ id: indexRateValues.id });
    return deleted.length > 0 ? 'deleted' : 'not_found';
  },

  /**
   * Reads one value of one index of a household — the Manager's access check
   * needs its recorder before an edit or delete (OQ-178).
   *
   * @param householdId - The household.
   * @param indexCode - The index, from the route.
   * @param valueId - The value.
   * @returns The value, or `undefined` for another household's or index's.
   */
  findById: async (
    householdId: string,
    indexCode: IndexCodeValue,
    valueId: string,
  ): Promise<IndexRateValue | undefined> => {
    const found = await findValue(db, householdId, indexCode, valueId);
    return found === 'not_found' ? undefined : found;
  },

  /**
   * An index's latest value — the one with the highest date (FR-11.2/11.6).
   *
   * @param householdId - The household.
   * @param indexCode - The index.
   * @returns The value, or `undefined` when the index has none yet.
   */
  latest: async (
    householdId: string,
    indexCode: IndexCodeValue,
  ): Promise<IndexRateValue | undefined> => {
    const [row] = await db.select(rateColumns).from(indexRateValues)
      .where(and(
        eq(indexRateValues.householdId, householdId),
        eq(indexRateValues.indexCode, indexCode),
      ))
      .orderBy(newestFirst)
      .limit(1);
    return row ? toRate(row) : undefined;
  },

  /**
   * Every value of every index of a household, by index and newest first — the
   * Rates tab's history (FR-11.6). An index with no value is absent.
   *
   * @param householdId - The household.
   * @returns The values.
   */
  list: async (householdId: string): Promise<IndexRateValue[]> => {
    const rows = await db.select(rateColumns).from(indexRateValues)
      .where(eq(indexRateValues.householdId, householdId))
      .orderBy(asc(indexRateValues.indexCode), newestFirst);
    return rows.map(toRate);
  },
});

/** The IndexRateAccessor's operations. */
export type IndexRateAccessor = ReturnType<typeof createIndexRateAccessor>;

export default createIndexRateAccessor;
