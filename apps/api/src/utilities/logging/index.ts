import { randomUUID } from 'node:crypto';
import {
  actorLabel, actorUserId, createLogger, redact, type Actor, type LogLevel,
} from '@financas/logging';
import type winston from 'winston';
import type { NewAuditEntry } from '../../accessors/auditLogAccessor';
import { logging } from '../../config/constants';
import { createAuditSink } from './auditSink';

// LoggingUtility (U2, VBD): one Winston logger, one event, several destinations
// (OQ-110) — a human-readable console line, the daily JSON file and, for audit
// events, the audit_log_entries table. Every method is fire-and-forget: Managers
// never wait for logging, and storing audit entries reliably is this utility's job.

export type { Actor } from '@financas/logging';

/** What every application event carries (NFR-OBS-1/2). */
interface EventBase {
  readonly correlationId: string;
  readonly actor: Actor;
  readonly action: string;
}

/** An audit record request — the locked FR-7.1 fields plus tracing context. */
export interface AuditRequest extends EventBase {
  readonly householdId: string | null;
  readonly entityType: string;
  readonly entityId: string;
}

/** What the utility needs: a logger, a clock, and an ID source for audit entries. */
export interface LoggingUtilityDeps {
  readonly logger: Pick<winston.Logger, 'log'>;
  readonly now: () => Date;
  readonly newId: () => string;
}

/**
 * Builds the logging utility.
 *
 * @param deps - Logger, clock and ID source.
 * @returns The utility's operations.
 */
export const createLoggingUtility = (deps: LoggingUtilityDeps) => ({
  /**
   * Logs something the system did (NFR-OBS-1). Details are redacted.
   *
   * @param event - Correlation ID, actor, action and optional details.
   */
  logActivity: (event: EventBase & { readonly details?: Record<string, unknown> }): void => {
    deps.logger.log({
      level: 'info',
      message: event.action,
      correlationId: event.correlationId,
      actor: actorLabel(event.actor),
      action: event.action,
      ...(event.details ? { details: redact(event.details) } : {}),
    });
  },

  /**
   * Logs a failure with its stack trace (NFR-OBS-3).
   *
   * @param event - Correlation ID, actor, the action that failed, and the error.
   */
  logError: (event: EventBase & { readonly error: unknown }): void => {
    const error = event.error instanceof Error ? event.error : new Error(String(event.error));
    deps.logger.log({
      level: 'error',
      message: `${event.action}: ${error.message}`,
      correlationId: event.correlationId,
      actor: actorLabel(event.actor),
      action: event.action,
      stack: error.stack,
    });
  },

  /**
   * Logs one handled HTTP request (NFR-OBS-1).
   *
   * @param event - Correlation ID, actor, and the request's outcome.
   * @param event.method - HTTP method.
   * @param event.path - Request path (no query string — it may hold tokens).
   * @param event.status - Response status.
   * @param event.durationMs - Time spent.
   */
  logRequest: (event: Omit<EventBase, 'action'> & {
    readonly method: string;
    readonly path: string;
    readonly status: number;
    readonly durationMs: number;
  }): void => {
    deps.logger.log({
      level: event.status >= 500 ? 'error' : 'info',
      message: `${event.method} ${event.path} ${event.status} ${event.durationMs}ms`,
      correlationId: event.correlationId,
      actor: actorLabel(event.actor),
      action: 'http.request',
      // Top-level, not `details`: kept in the JSON file, not repeated on the console line.
      method: event.method,
      path: event.path,
      status: event.status,
      durationMs: event.durationMs,
    });
  },

  /**
   * Records an audit entry (FR-7.1): logged like any event — so it shows in the
   * console and the daily file — and stored by the audit sink in the background,
   * with retries and reconciliation (OQ-110). Never waits, never throws.
   *
   * @param event - Actor, household, action, entity type and ID, correlation ID.
   */
  recordAudit: (event: AuditRequest): void => {
    deps.logger.log({
      level: 'info',
      message: event.action,
      audit: true,
      auditId: deps.newId(),
      auditAt: deps.now().toISOString(),
      correlationId: event.correlationId,
      actor: actorLabel(event.actor),
      actorId: actorUserId(event.actor),
      householdId: event.householdId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
    });
  },
});

/** The logging utility's operations, as injected into Managers. */
export type LoggingUtility = ReturnType<typeof createLoggingUtility>;

/** What the API's logger needs. */
export interface ApiLoggerOptions {
  readonly level: LogLevel;
  readonly logDir: string | undefined;
  /** AuditLogAccessor.insert — idempotent by ID. */
  readonly auditInsert: (record: NewAuditEntry) => Promise<unknown>;
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Builds the API's Winston logger: the shared console + daily file transports,
 * plus the audit sink. An entry the sink gives up on is logged as an error —
 * it is already in the daily file, so reconciliation restores it.
 *
 * @param options - Level, directory, the audit insert and an optional sleep.
 * @returns The logger.
 */
export const createApiLogger = (options: ApiLoggerOptions): winston.Logger => {
  const logger = createLogger({
    level: options.level, logDir: options.logDir, filePrefix: logging.filePrefix,
  });
  logger.add(createAuditSink({
    insert: options.auditInsert,
    delaysMs: logging.auditRetryDelaysMs,
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => {
      setTimeout(resolve, ms);
    })),
    onGiveUp: (record) => logger.log({
      level: 'error',
      message: `audit.store_failed: ${record.action} ${record.entityType} ${record.entityId}`
        + ' (restored by reconciliation)',
      action: 'audit.store_failed',
      details: { auditId: record.id },
    }),
  }));
  return logger;
};

/** Default IDs for audit entries. */
export const newAuditId = (): string => randomUUID();
