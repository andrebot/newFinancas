import path from 'node:path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { formatConsoleLine } from './consoleFormat';
import loggingSettings from './settings';

// The Winston logger every process uses (OQ-110): the same event goes to a
// human-readable console line and to a daily JSON-lines file. Processes add
// their own transports on top (the API adds the audit sink).

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/** How a process wants its logger. */
export interface LoggerOptions {
  readonly level: LogLevel;
  /** Directory for the daily files; `undefined` disables the file (e.g. tests). */
  readonly logDir: string | undefined;
  /** File name prefix: `api` → `api-2026-10-09.log`. */
  readonly filePrefix: string;
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
 * Builds the transports: always the console line, plus the daily JSON file.
 *
 * @param options - Level, directory and file prefix.
 * @returns The transports.
 */
export const buildTransports = (options: LoggerOptions): winston.transport[] => [
  new winston.transports.Console({
    format: winston.format.printf((info) => formatConsoleLine(info)),
  }),
  ...(options.logDir === undefined ? [] : [new DailyRotateFile({
    dirname: options.logDir,
    filename: `${options.filePrefix}-%DATE%.log`,
    datePattern: loggingSettings.datePattern,
    maxFiles: `${loggingSettings.retentionDays}d`,
    format: winston.format.json(),
  })]),
];

/**
 * Creates the process's logger.
 *
 * @param options - Level, directory and file prefix.
 * @returns A Winston logger that timestamps every event.
 */
export const createLogger = (options: LoggerOptions): winston.Logger => winston.createLogger({
  level: options.level,
  format: winston.format.timestamp(),
  transports: buildTransports(options),
});
