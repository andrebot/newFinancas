const BACKUP_PATTERN = /^financas-\d{8}T\d{6}Z\.dump$/;

/**
 * Names a backup file after the moment it was taken, in UTC so names sort
 * chronologically and never collide across daylight-saving changes.
 *
 * @param now - When the backup is taken.
 * @returns e.g. `financas-20261008T143005Z.dump`.
 */
export const backupFileName = (now: Date): string => {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `financas-${stamp}.dump`;
};

/**
 * Tells whether a file name is a backup made by `backupFileName`.
 *
 * @param name - A file name (not a path).
 * @returns `true` for backup files; other files in the directory are ignored.
 */
export const isBackupFile = (name: string): boolean => BACKUP_PATTERN.test(name);

/**
 * Lists the backup files among `names`, newest first.
 *
 * @param names - File names found in the backup directory.
 * @returns Only backup files, newest first (their names sort chronologically).
 */
export const newestFirst = (names: readonly string[]): string[] => (
  names.filter(isBackupFile).sort().reverse()
);

/**
 * Picks the most recent backup.
 *
 * @param names - File names found in the backup directory.
 * @returns The newest backup file name, or `undefined` when there is none.
 */
export const latestBackup = (names: readonly string[]): string | undefined => newestFirst(names)[0];

/**
 * Picks the backups that fall outside the retention window.
 *
 * @param names - File names found in the backup directory.
 * @param keep - How many of the newest backups to keep.
 * @returns The older backups to delete; never anything that isn't a backup file.
 */
export const backupsToPrune = (names: readonly string[], keep: number): string[] => (
  newestFirst(names).slice(keep)
);
