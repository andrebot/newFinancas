// `docker compose exec` command lines for the `db` service (compose.yaml). The
// Postgres client tools run inside the container, so they always match the
// server version and nothing needs installing on the host.

/** The live database and the scratch database restores go to by default. */
export const LIVE_DATABASE = 'financas';
export const SCRATCH_DATABASE = 'financas_restore';

const OWNER = 'financas';

/**
 * Builds an `exec` command line for the database container.
 *
 * @param command - The client tool and its arguments.
 * @returns `docker compose` arguments; `-T` because stdin/stdout are files, not a TTY.
 */
export const inDatabaseContainer = (command: readonly string[]): string[] => (
  ['compose', 'exec', '-T', 'db', ...command]
);

/**
 * Dumps the live database in Postgres' compressed custom format (includes grants).
 *
 * @returns The command; its stdout is the backup.
 */
export const dumpCommand = (): string[] => inDatabaseContainer(
  ['pg_dump', '--username', OWNER, '--format', 'custom', LIVE_DATABASE],
);

/**
 * Drops a database, disconnecting anyone still using it.
 *
 * @param database - The database to drop.
 * @returns The command.
 */
export const dropDatabaseCommand = (database: string): string[] => inDatabaseContainer(
  ['dropdb', '--username', OWNER, '--if-exists', '--force', database],
);

/**
 * Creates an empty database owned by the owner role.
 *
 * @param database - The database to create.
 * @returns The command.
 */
export const createDatabaseCommand = (database: string): string[] => inDatabaseContainer(
  ['createdb', '--username', OWNER, '--owner', OWNER, database],
);

/**
 * Restores a backup read from stdin into a database.
 *
 * @param database - The (empty) target database.
 * @returns The command; feed the backup file to its stdin.
 */
export const restoreCommand = (database: string): string[] => inDatabaseContainer(
  ['pg_restore', '--username', OWNER, '--dbname', database, '--exit-on-error'],
);

const ROW_COUNTS_SQL = `SELECT table_name, (xpath('/row/c/text()', query_to_xml(
  format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
  FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;

/**
 * Counts the rows of every table in a database, one `table|count` line each.
 *
 * @param database - The database to inspect.
 * @returns The command.
 */
export const rowCountsCommand = (database: string): string[] => inDatabaseContainer(
  [
    'psql', '--username', OWNER, '--dbname', database,
    '--no-align', '--tuples-only', '--command', ROW_COUNTS_SQL,
  ],
);

/**
 * Parses `rowCountsCommand` output.
 *
 * @param output - Lines of `table|count`.
 * @returns Row count per table.
 */
export const parseRowCounts = (output: string): Record<string, number> => Object.fromEntries(
  output.split('\n').filter((line) => line.includes('|')).map((line) => {
    const [table, count] = line.split('|');
    return [table!.trim(), Number(count)];
  }),
);

/**
 * Compares two databases' row counts, table by table.
 *
 * @param expected - Counts of the source (live) database.
 * @param actual - Counts of the restored database.
 * @returns One description per table that differs or is missing on either side.
 */
export const countMismatches = (
  expected: Record<string, number>,
  actual: Record<string, number>,
): string[] => [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
  .filter((table) => expected[table] !== actual[table])
  .map((table) => (
    `${table}: expected ${expected[table] ?? 'missing'}, got ${actual[table] ?? 'missing'}`
  ));
