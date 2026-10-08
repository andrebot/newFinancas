import path from 'node:path';
import type { RestoreArgs } from './args';
import { backupFileName, backupsToPrune, latestBackup } from './backupFiles';
import {
  countMismatches, createDatabaseCommand, dropDatabaseCommand, dumpCommand, LIVE_DATABASE,
  parseRowCounts, restoreCommand, rowCountsCommand, SCRATCH_DATABASE,
} from './commands';
import type { BackupConfig } from './config';

/** Files a `docker` call reads its stdin from or writes its stdout to. */
export interface DockerFiles {
  readonly stdin?: string;
  readonly stdout?: string;
}

/** Everything the operations touch outside themselves, injected (main.ts wires the real ones). */
export interface OpsDeps {
  /** Runs `docker <args>`; returns stdout unless redirected to a file. Rejects on failure. */
  readonly docker: (args: readonly string[], files?: DockerFiles) => Promise<string>;
  readonly listDir: (dir: string) => Promise<string[]>;
  readonly ensureDir: (dir: string) => Promise<void>;
  readonly remove: (file: string) => Promise<void>;
  readonly exists: (file: string) => Promise<boolean>;
  readonly now: () => Date;
  readonly log: (message: string) => void;
}

/** Outcome of a restore drill. */
export interface DrillResult {
  readonly backup: string;
  readonly tables: number;
  readonly mismatches: string[];
}

/**
 * Takes a backup of the live database and prunes backups beyond the retention.
 *
 * @param deps - Injected I/O.
 * @param config - Backup directory and retention.
 * @returns The path of the new backup.
 */
export const runBackup = async (deps: OpsDeps, config: BackupConfig): Promise<string> => {
  await deps.ensureDir(config.dir);
  const file = path.join(config.dir, backupFileName(deps.now()));
  await deps.docker(dumpCommand(), { stdout: file });
  deps.log(`Backup written: ${file}`);

  const stale = backupsToPrune(await deps.listDir(config.dir), config.keep);
  await Promise.all(stale.map((name) => deps.remove(path.join(config.dir, name))));
  if (stale.length > 0) deps.log(`Pruned ${stale.length} old backup(s), keeping ${config.keep}`);
  return file;
};

/**
 * Finds the backup to restore: the given file (a name in the backup directory or
 * a path), or the newest backup.
 *
 * @param deps - Injected I/O.
 * @param config - Backup directory.
 * @param file - Optional file name or path.
 * @returns The backup's path.
 * @throws {Error} When the file does not exist, or there are no backups.
 */
export const resolveBackupPath = async (
  deps: OpsDeps,
  config: BackupConfig,
  file?: string,
): Promise<string> => {
  const candidate = file ?? latestBackup(await deps.listDir(config.dir));
  if (candidate === undefined) throw new Error(`No backups in ${config.dir}`);

  const resolved = candidate.includes(path.sep) ? candidate : path.join(config.dir, candidate);
  if (!(await deps.exists(resolved))) throw new Error(`Backup not found: ${resolved}`);
  return resolved;
};

/**
 * Replaces a database with the contents of a backup.
 *
 * @param deps - Injected I/O.
 * @param file - Backup path.
 * @param database - Database to (re)create and restore into.
 * @returns Resolves once restored.
 */
export const restoreInto = async (deps: OpsDeps, file: string, database: string): Promise<void> => {
  await deps.docker(dropDatabaseCommand(database));
  await deps.docker(createDatabaseCommand(database));
  await deps.docker(restoreCommand(database), { stdin: file });
};

/**
 * Restores a backup — into the scratch database by default, or over the live one
 * with `--into-live`, after taking a safety backup of the live data.
 *
 * @param deps - Injected I/O.
 * @param config - Backup directory and retention.
 * @param args - Which file, and whether to overwrite the live database.
 * @returns The database that was restored into.
 */
export const runRestore = async (
  deps: OpsDeps,
  config: BackupConfig,
  args: RestoreArgs,
): Promise<string> => {
  const file = await resolveBackupPath(deps, config, args.file);
  const target = args.intoLive ? LIVE_DATABASE : SCRATCH_DATABASE;

  if (args.intoLive) {
    const safety = await runBackup(deps, config);
    deps.log(`Safety backup of the live data before overwriting it: ${safety}`);
  }
  await restoreInto(deps, file, target);
  deps.log(`Restored ${file} into "${target}"`);
  return target;
};

/**
 * Restore drill: backs up the live database, restores that backup into the
 * scratch database, compares row counts table by table, then drops the scratch copy.
 *
 * @param deps - Injected I/O.
 * @param config - Backup directory and retention.
 * @returns The backup used, how many tables were compared, and any mismatches.
 */
export const runRestoreDrill = async (
  deps: OpsDeps,
  config: BackupConfig,
): Promise<DrillResult> => {
  const backup = await runBackup(deps, config);
  await restoreInto(deps, backup, SCRATCH_DATABASE);
  try {
    const live = parseRowCounts(await deps.docker(rowCountsCommand(LIVE_DATABASE)));
    const restored = parseRowCounts(await deps.docker(rowCountsCommand(SCRATCH_DATABASE)));
    const mismatches = countMismatches(live, restored);
    return { backup, tables: Object.keys(live).length, mismatches };
  } finally {
    await deps.docker(dropDatabaseCommand(SCRATCH_DATABASE));
  }
};
