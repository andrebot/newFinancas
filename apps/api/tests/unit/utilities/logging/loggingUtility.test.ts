import { Writable } from 'node:stream';
import winston from 'winston';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  createApiLogger, createLoggingUtility, newAuditId,
} from '../../../../src/utilities/logging';

const NOW = new Date('2026-10-09T14:03:12.000Z');

/**
 * Builds the utility over a spy logger.
 *
 * @returns The utility and the spy.
 */
const setup = () => {
  const log = vi.fn();
  const logging = createLoggingUtility({ logger: { log }, now: () => NOW, newId: () => 'id-1' });
  return { logging, log };
};

describe('LoggingUtility', () => {
  it('logs activity with correlation id and actor, redacting details', () => {
    const { logging, log } = setup();

    logging.logActivity({
      correlationId: 'c1',
      actor: { userId: 'u1' },
      action: 'Login',
      details: { email: 'a@b.c', password: 'p' },
    });

    expect(log).toHaveBeenCalledWith({
      level: 'info',
      message: 'Login',
      correlationId: 'c1',
      actor: 'user:u1',
      action: 'Login',
      details: { email: 'a@b.c', password: '[redacted]' },
    });
  });

  it('omits details when there are none', () => {
    const { logging, log } = setup();

    logging.logActivity({ correlationId: 'c1', actor: 'system', action: 'api.started' });

    expect(log.mock.calls[0]![0]).not.toHaveProperty('details');
  });

  it('logs errors with message and stack (NFR-OBS-3), wrapping non-Error values', () => {
    const { logging, log } = setup();
    const error = new Error('boom');

    logging.logError({
      correlationId: 'c1', actor: 'unauthenticated', action: 'http.unexpected_error', error,
    });
    logging.logError({
      correlationId: 'c2', actor: 'system', action: 'job', error: 'plain',
    });

    expect(log.mock.calls[0]![0]).toMatchObject({
      level: 'error',
      message: 'http.unexpected_error: boom',
      actor: 'unauthenticated',
      stack: error.stack,
    });
    expect(log.mock.calls[1]![0]).toMatchObject({ message: 'job: plain' });
  });

  it('logs requests, as errors when the status is 5xx', () => {
    const { logging, log } = setup();
    const request = {
      correlationId: 'c1',
      actor: 'unauthenticated' as const,
      method: 'GET',
      path: '/health',
      durationMs: 3,
    };

    logging.logRequest({ ...request, status: 200 });
    logging.logRequest({ ...request, status: 503 });

    expect(log.mock.calls[0]![0])
      .toMatchObject({ level: 'info', message: 'GET /health 200 3ms', action: 'http.request' });
    expect(log.mock.calls[1]![0]).toMatchObject({ level: 'error' });
    expect(log.mock.calls[0]![0]).toMatchObject({ method: 'GET', path: '/health', status: 200 });
    expect(log.mock.calls[0]![0]).not.toHaveProperty('details');
  });

  it('records audit entries as marked events with their own id and time', () => {
    const { logging, log } = setup();

    logging.recordAudit({
      correlationId: 'c1',
      actor: { userId: 'u1' },
      householdId: 'h1',
      action: 'CreateBudget',
      entityType: 'Budget',
      entityId: 'b1',
    });

    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      audit: true,
      auditId: 'id-1',
      auditAt: NOW.toISOString(),
      actor: 'user:u1',
      actorId: 'u1',
      householdId: 'h1',
      entityType: 'Budget',
      entityId: 'b1',
    }));
    expect(log.mock.calls[0]![0]).not.toHaveProperty('details');
  });

  it('records system actions without an actor id', () => {
    const { logging, log } = setup();

    logging.recordAudit({
      correlationId: 'c1',
      actor: 'system',
      householdId: null,
      action: 'NotifyMaturedHolding',
      entityType: 'Holding',
      entityId: 'x',
    });

    expect(log.mock.calls[0]![0]).toMatchObject({ actor: 'system', actorId: null });
  });

  it('makes a fresh id for each audit entry', () => {
    expect(newAuditId()).not.toBe(newAuditId());
  });
});

/**
 * A transport that keeps every event it receives.
 *
 * @returns The transport and the events.
 */
const capture = () => {
  const events: Record<string, unknown>[] = [];
  const transport = new winston.transports.Stream({
    level: 'debug',
    stream: new Writable({
      objectMode: true,
      write: (event, _e, done) => {
        events.push(event);
        done();
      },
    }),
  });
  return { transport, events };
};

const AUDIT_EVENT = {
  level: 'info',
  message: 'x',
  audit: true,
  auditId: 'a1',
  auditAt: NOW.toISOString(),
  action: 'A',
  entityType: 'T',
  entityId: 'e',
};

describe('createApiLogger', () => {
  it('stores audit entries even when LOG_LEVEL hides info events', async () => {
    const auditInsert = vi.fn().mockResolvedValue(true);
    const logger = createApiLogger({ level: 'error', logDir: undefined, auditInsert });

    logger.log(AUDIT_EVENT);

    await vi.waitFor(() => expect(auditInsert).toHaveBeenCalledTimes(1));
    logger.close();
  });

  it('logs an entry it gives up on as an error, after every retry', async () => {
    const auditInsert = vi.fn().mockRejectedValue(new Error('db down'));
    const logger = createApiLogger({
      level: 'error', logDir: undefined, auditInsert, sleep: async () => {},
    });
    const { transport, events } = capture();
    logger.add(transport);

    logger.log(AUDIT_EVENT);

    const failure = () => events.find((e) => e.action === 'audit.store_failed');

    await vi.waitFor(() => expect(failure()).toBeDefined());
    expect(failure()).toMatchObject({ level: 'error', details: { auditId: 'a1' } });
    expect(auditInsert).toHaveBeenCalledTimes(4);
    logger.close();
  });

  it('waits between attempts with real timers by default', async () => {
    vi.useFakeTimers();
    const auditInsert = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(true);
    const logger = createApiLogger({ level: 'error', logDir: undefined, auditInsert });

    logger.log(AUDIT_EVENT);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(auditInsert).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    logger.close();
  });
});
