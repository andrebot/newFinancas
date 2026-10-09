import type { PGlite } from '@electric-sql/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createAuditLogAccessor from '../../../src/accessors/auditLogAccessor';
import type { Database } from '../../../src/db/database';
import { auditLogEntries } from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const HOME = '0199c5a0-0000-7000-8000-000000000001';
const OTHER_HOME = '0199c5a0-0000-7000-8000-000000000002';
const ANA = '0199c5a0-0000-7000-8000-0000000000a1';
const ENTITY = '0199c5a0-0000-7000-8000-0000000000e1';

type Audit = ReturnType<typeof createAuditLogAccessor>;

/**
 * Runs a test with a fresh accessor inside a rolled-back transaction.
 *
 * @param work - The test body.
 * @returns A Vitest test function.
 */
const test = (work: (audit: Audit, db: Database) => Promise<void>) => (
  () => withRollback(pglite, (db) => work(createAuditLogAccessor(db), db))
);

/**
 * Inserts an entry at an exact instant (the accessor itself lets the database stamp it).
 *
 * @param db - The test database.
 * @param at - ISO instant.
 * @param householdId - Household.
 * @param action - Action name, used to identify the row.
 * @returns Resolves once inserted.
 */
const entryAt = async (db: Database, at: string, householdId: string, action: string) => {
  await db.insert(auditLogEntries).values({
    actorId: ANA,
    householdId,
    action,
    entityType: 'Budget',
    entityId: ENTITY,
    createdAt: new Date(at),
  });
};

describe('AuditLogAccessor', () => {
  const entry = (n: number, overrides = {}) => ({
    id: `0199c5a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`,
    actorId: ANA,
    householdId: HOME,
    action: 'CreateBudget',
    entityType: 'Budget',
    entityId: ENTITY,
    createdAt: new Date('2026-10-08T15:00:00Z'),
    ...overrides,
  });

  it('stores an entry with the caller\'s id and time', test(async (audit) => {
    expect(await audit.insert(entry(1))).toBe(true);

    const [stored] = await audit.listForExport(HOME, '2026-10-08', '2026-10-08');
    expect(stored).toEqual(entry(1));
  }));

  it('skips an id it already has, keeping the first (OQ-110)', test(async (audit) => {
    await audit.insert(entry(1));

    expect(await audit.insert(entry(1, { action: 'Changed' }))).toBe(false);
    expect((await audit.listForExport(HOME, '2026-10-08', '2026-10-08')).map((e) => e.action))
      .toEqual(['CreateBudget']);
  }));

  it('records system actions without an actor', test(async (audit) => {
    await audit.insert(entry(1, { actorId: null, action: 'NotifyMaturedHolding' }));

    const [stored] = await audit.listForExport(HOME, '2026-10-08', '2026-10-08');
    expect(stored?.actorId).toBeNull();
  }));

  it('inserts many, counting only the missing ones', test(async (audit) => {
    await audit.insert(entry(1));

    expect(await audit.insertMany([entry(1), entry(2), entry(3)])).toBe(2);
    expect(await audit.insertMany([])).toBe(0);
    expect(await audit.listForExport(HOME, '2026-10-08', '2026-10-08')).toHaveLength(3);
  }));

  it('exposes no way to change or remove entries', () => {
    const operations = Object.keys(createAuditLogAccessor({} as Database)).sort();

    expect(operations).toEqual(['insert', 'insertMany', 'listForExport']);
  });

  describe('listForExport (FR-7.2)', () => {
    it('takes whole São Paulo days, both ends inclusive (OQ-104)', test(async (audit, db) => {
      // 2026-10-08 in São Paulo (UTC−3) runs from 03:00Z on the 8th to 02:59:59Z on the 9th.
      await entryAt(db, '2026-10-08T02:59:59Z', HOME, 'late on the 7th');
      await entryAt(db, '2026-10-08T03:00:00Z', HOME, 'start of the 8th');
      await entryAt(db, '2026-10-09T02:59:59Z', HOME, 'end of the 8th');
      await entryAt(db, '2026-10-09T03:00:00Z', HOME, 'start of the 9th');

      const entries = await audit.listForExport(HOME, '2026-10-08', '2026-10-08');

      expect(entries.map((e) => e.action)).toEqual(['start of the 8th', 'end of the 8th']);
    }));

    it('only returns the requested household, oldest first', test(async (audit, db) => {
      await entryAt(db, '2026-10-10T12:00:00Z', HOME, 'second');
      await entryAt(db, '2026-10-09T12:00:00Z', HOME, 'first');
      await entryAt(db, '2026-10-09T13:00:00Z', OTHER_HOME, 'other household');

      const entries = await audit.listForExport(HOME, '2026-10-01', '2026-10-31');

      expect(entries.map((e) => e.action)).toEqual(['first', 'second']);
    }));

    it('returns nothing for an empty or inverted range', test(async (audit, db) => {
      await entryAt(db, '2026-10-09T12:00:00Z', HOME, 'x');

      expect(await audit.listForExport(HOME, '2026-11-01', '2026-11-30')).toEqual([]);
      expect(await audit.listForExport(HOME, '2026-10-31', '2026-10-01')).toEqual([]);
    }));
  });
});
