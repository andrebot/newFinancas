import path from 'node:path';
import { isLogLevel, type LogLevel } from './levels';
import loggingSettings from './settings';

// The logger configures itself from the environment when first imported
// (OQ-110): this package owns LOG_LEVEL, LOG_DIR and LOG_FILE_PREFIX (an
// OQ-101 refinement — it is shared by every process, so no app's env.ts can).

/** How this process logs. */
export interface LoggingEnv {
  readonly level: LogLevel;
  /** Directory of the daily JSON files. */
  readonly logDir: string;
  /** Daily file name prefix: `api` → `api-2026-10-09.log`. */
  readonly filePrefix: string;
  /** Under Vitest: no console, no files (tests capture what they need). */
  readonly testMode: boolean;
}

/**
 * Resolves the log directory: `LOG_DIR` if set, else the XDG state home.
 *
 * @param env - Environment (`LOG_DIR`, `XDG_STATE_HOME`).
 * @param homeDir - The user's home directory.
 * @returns The directory path.
 */
export const resolveLogDir = (env: Record<string, string | undefined>, homeDir: string): string => {
  const stateHome = env.XDG_STATE_HOME || path.join(homeDir, '.local', 'state');
  return env.LOG_DIR || path.join(stateHome, loggingSettings.directoryName);
};

/**
 * Reads and validates the logging environment.
 *
 * @param env - The environment, normally `process.env`.
 * @param homeDir - The user's home directory.
 * @returns The settings.
 * @throws {Error} On an unknown `LOG_LEVEL` or an unsafe `LOG_FILE_PREFIX`.
 */
export const readLoggingEnv = (
  env: Record<string, string | undefined>,
  homeDir: string,
): LoggingEnv => {
  const level = env.LOG_LEVEL ?? 'info';
  const filePrefix = env.LOG_FILE_PREFIX ?? 'financas';
  if (!isLogLevel(level)) {
    throw new Error(`LOG_LEVEL must be error, warn, audit, info or debug, got "${level}"`);
  }
  if (!/^[a-z0-9-]+$/.test(filePrefix)) {
    throw new Error(`LOG_FILE_PREFIX must be lowercase letters, digits or -, got "${filePrefix}"`);
  }
  return {
    level, logDir: resolveLogDir(env, homeDir), filePrefix, testMode: env.VITEST !== undefined,
  };
};
