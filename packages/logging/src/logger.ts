import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { Writable } from 'node:stream';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { formatConsoleLine } from './consoleFormat';
import { readLoggingEnv, type LoggingEnv } from './env';
import { redactEvent, stampAudit, type LogEvent } from './formats';
import { LEVELS } from './levels';
import loggingSettings from './settings';

// The one logger every module uses (OQ-110), as in the financas app: configured
// once, from the environment, when first imported. Modules call
// `createLogger(context)` — a child that adds context (label, correlation ID,
// actor) — and log with info / warn / error / debug / audit.

/** The logger, with the custom `audit` level. */
export type Logger = winston.Logger & { audit: winston.LeveledLogMethod };

/** Context a child logger adds to every event. */
export interface LogContext {
  readonly label?: string;
  readonly correlationId?: string;
  /** `user:<id>`, `system` or `unauthenticated` (NFR-OBS-2). */
  readonly actor?: string;
  readonly [key: string]: unknown;
}

/**
 * Builds the transports for a process: the human-readable console and the
 * daily JSON file; none in test mode.
 *
 * @param env - The logging environment.
 * @returns The transports.
 */
export const buildTransports = (env: LoggingEnv): winston.transport[] => (env.testMode ? [] : [
  new winston.transports.Console({
    format: winston.format.printf((info) => formatConsoleLine(info)),
  }),
  new DailyRotateFile({
    dirname: env.logDir,
    filename: `${env.filePrefix}-%DATE%.log`,
    datePattern: loggingSettings.datePattern,
    maxFiles: `${loggingSettings.retentionDays}d`,
    format: winston.format.json(),
  }),
]);

const settings = readLoggingEnv(process.env, os.homedir());

export const logger = winston.createLogger({
  levels: LEVELS,
  level: settings.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format((info) => Object.assign(info, stampAudit(info as LogEvent, randomUUID)))(),
    winston.format((info) => Object.assign(info, redactEvent(info as LogEvent)))(),
  ),
  // In tests nothing is written; `captureLogs` adds a transport when a test needs one.
  transports: buildTransports(settings),
  silent: settings.testMode,
}) as Logger;

/**
 * A logger that adds context to every event (financas' `createLogger(label)`).
 *
 * @param context - e.g. `{ label: 'IdentityManager' }`, or a request's correlation ID and actor.
 * @returns A child logger.
 */
export const createLogger = (context: LogContext): Logger => logger.child(context);

/**
 * For tests: turns the logger on and records every event it receives.
 *
 * @returns The recorded events and a function that stops recording.
 */
export const captureLogs = () => {
  const events: LogEvent[] = [];
  const transport = new winston.transports.Stream({
    level: 'debug',
    stream: new Writable({
      objectMode: true,
      write: (event: LogEvent, _encoding, done) => {
        events.push(event);
        done();
      },
    }),
  });
  const wasSilent = logger.silent;
  logger.silent = false;
  logger.add(transport);
  return {
    events,
    stop: () => {
      logger.remove(transport);
      logger.silent = wasSilent;
    },
  };
};
