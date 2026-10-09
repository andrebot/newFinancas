import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

/**
 * Any Drizzle Postgres database or transaction: node-postgres in the app, PGlite
 * in tests (OQ-96). Accessors receive one as a parameter.
 */
export type Database = PgDatabase<PgQueryResultHKT>;
