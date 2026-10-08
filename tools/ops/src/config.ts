import path from 'node:path';

/** Where backups live and how many are kept (OQ-97). */
export interface BackupConfig {
  readonly dir: string;
  readonly keep: number;
}

const DEFAULT_KEEP = 30;

/**
 * Reads the backup settings, with defaults: backups go outside the repository,
 * in the XDG data directory, and the newest 30 are kept.
 *
 * @param env - Environment variables (`BACKUP_DIR`, `BACKUP_KEEP`, `XDG_DATA_HOME`).
 * @param homeDir - The user's home directory.
 * @returns The resolved configuration.
 * @throws {Error} When `BACKUP_KEEP` is not a positive integer.
 */
export const resolveBackupConfig = (
  env: Record<string, string | undefined>,
  homeDir: string,
): BackupConfig => {
  const dataHome = env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
  const keep = env.BACKUP_KEEP ? Number(env.BACKUP_KEEP) : DEFAULT_KEEP;

  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error(`BACKUP_KEEP must be a positive integer, got "${env.BACKUP_KEEP}"`);
  }

  return { dir: env.BACKUP_DIR || path.join(dataHome, 'financas', 'backups'), keep };
};
