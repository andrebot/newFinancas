import type { OnTestFinished } from './capture';
import { LEVELS, type LogLevel } from './levels';
import { redact } from './redact';
import loggingSettings from './settings';

// The browser's logger (OQ-123): `import { createLogger } from
// '@financas/logging/browser'`. Winston and its file transport are Node-only,
// so the web app logs through this entry instead: the same
// `createLogger({ label })` call, the same levels and the same redaction.
// Audit is the API's alone, so there is no `audit` method. The console sink
// below is the one place in the web app that touches `console`, as Winston's
// Console transport is on the server. Under Vitest nothing is written; tests
// read events with `captureLogs(onTestFinished)`.

/** A browser log level: every server level except `audit`. */
export type BrowserLogLevel = Exclude<LogLevel, 'audit'>;

/** One browser log event, already redacted. */
export interface BrowserLogEvent {
  readonly level: BrowserLogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly label?: string;
  readonly [key: string]: unknown;
}

/** Context a logger adds to every event. */
export interface BrowserLogContext {
  readonly label?: string;
  readonly [key: string]: unknown;
}

/** Logs one event at a level: a message plus optional details. */
export type BrowserLogMethod = (message: string, details?: Record<string, unknown>) => void;

/** A logger for one module. */
export type BrowserLogger = Readonly<Record<BrowserLogLevel, BrowserLogMethod>>;

/** Where events go once they pass the level. */
export type BrowserLogSink = (event: BrowserLogEvent) => void;

/**
 * Writes an event to the browser's console, at the console method of its level.
 *
 * @param event - The redacted event.
 */
export const consoleSink: BrowserLogSink = (event) => {
  const { level, message, label } = event;
  // eslint-disable-next-line no-console -- the browser logger's one transport
  console[level](label ? `[${label}] ${message}` : message, event);
};

/**
 * Tells whether this code runs under Vitest (where the browser has no `process`).
 *
 * @param scope - The global object.
 * @returns `true` when `process.env.VITEST` is set.
 */
export const isTestRun = (scope: { process?: { env?: Record<string, unknown> } }): boolean => (
  Boolean(scope.process?.env?.VITEST)
);

const silentSink: BrowserLogSink = () => {};

let currentSink: BrowserLogSink = isTestRun(globalThis) ? silentSink : consoleSink;

/**
 * Tells whether an event at a level passes the configured threshold.
 *
 * @param level - The event's level.
 * @returns `true` when it should be written.
 */
const passes = (level: BrowserLogLevel): boolean => (
  LEVELS[level] <= LEVELS[loggingSettings.browserLevel]
);

/**
 * Builds the logging method for one level.
 *
 * @param level - The level the method logs at.
 * @param context - The logger's context, added to every event.
 * @returns The method.
 */
const methodFor = (level: BrowserLogLevel, context: BrowserLogContext): BrowserLogMethod => (
  (message, details = {}) => {
    if (!passes(level)) return;
    const fields = redact({ ...details, ...context }) as Record<string, unknown>;
    currentSink({
      ...fields, level, message, timestamp: new Date().toISOString(),
    });
  }
);

/**
 * A logger that adds context to every event (the server's `createLogger`).
 *
 * @param context - e.g. `{ label: 'I18nUtility' }`.
 * @returns The module's logger.
 */
export const createLogger = (context: BrowserLogContext = {}): BrowserLogger => ({
  error: methodFor('error', context),
  warn: methodFor('warn', context),
  info: methodFor('info', context),
  debug: methodFor('debug', context),
});

/**
 * For tests: records every event that passes the level instead of writing it,
 * until the test finishes — the stop is registered on the runner's hook, so a
 * test that throws can't leave the capture on for the rest of its file (OQ-199).
 *
 * @param onFinished - The runner's clean-up hook, e.g. Vitest's `onTestFinished`.
 * @returns The recorded events.
 */
export const captureLogs = (
  onFinished: OnTestFinished,
): { readonly events: BrowserLogEvent[] } => {
  const events: BrowserLogEvent[] = [];
  const previous = currentSink;
  currentSink = (event) => {
    events.push(event);
  };
  onFinished(() => {
    currentSink = previous;
  });
  return { events };
};
