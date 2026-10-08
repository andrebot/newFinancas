/** What `db:restore` was asked to do. */
export interface RestoreArgs {
  /** Backup file to restore; the newest one when omitted. */
  readonly file?: string;
  /** Overwrite the live `financas` database instead of the scratch one. */
  readonly intoLive: boolean;
}

/**
 * Parses `db:restore` arguments: an optional backup file and `--into-live`.
 *
 * @param argv - Arguments after the command name.
 * @returns The parsed arguments.
 * @throws {Error} On an unknown flag or more than one file.
 */
export const parseRestoreArgs = (argv: readonly string[]): RestoreArgs => {
  // A bare `--` (as in `pnpm db:restore -- --into-live`) only separates arguments.
  const given = argv.filter((arg) => arg !== '--');
  const flags = given.filter((arg) => arg.startsWith('--'));
  const files = given.filter((arg) => !arg.startsWith('--'));
  const unknown = flags.filter((flag) => flag !== '--into-live');

  if (unknown.length > 0) throw new Error(`Unknown option: ${unknown.join(', ')}`);
  if (files.length > 1) throw new Error('Give at most one backup file');

  return {
    intoLive: flags.includes('--into-live'),
    ...(files[0] === undefined ? {} : { file: files[0] }),
  };
};
