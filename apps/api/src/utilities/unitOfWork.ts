import type { Database } from '../db/database';

// One database transaction around several Accessors' writes (OQ-175). Each
// Accessor is built over a database *or* a transaction, so the composition root
// builds a set of them over the transaction and hands it to the Manager's work:
// everything it writes commits together, and a throw rolls all of it back. The
// Manager never sees the database, only the Accessors it already knows.

/** Runs work against Accessors sharing one transaction. */
export type InTransaction<Stores> = <Result>(
  work: (stores: Stores) => Promise<Result>,
) => Promise<Result>;

/**
 * Builds a unit of work over a database.
 *
 * @param db - The database.
 * @param storesOver - Builds the Accessors over a database or transaction.
 * @returns A function running work inside one transaction.
 */
const createUnitOfWork = <Stores>(
  db: Database,
  storesOver: (db: Database) => Stores,
): InTransaction<Stores> => (work) => db.transaction((tx) => work(storesOver(tx)));

export default createUnitOfWork;
