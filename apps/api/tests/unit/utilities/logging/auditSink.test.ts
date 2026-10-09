import winston from 'winston';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  createAuditSink, deliverWithRetry, toAuditRecord,
} from '../../../../src/utilities/logging/auditSink';

const EVENT = {
  level: 'audit',
  message: 'CreateBudget',
  auditId: '0199c5a0-0000-7000-8000-0000000000a1',
  auditAt: '2026-10-09T14:03:12.000Z',
  actor: 'user:u1',
  householdId: 'h1',
  entityType: 'Budget',
  entityId: 'b1',
};
const RECORD = {
  id: EVENT.auditId,
  createdAt: new Date(EVENT.auditAt),
  actorId: 'u1',
  householdId: 'h1',
  action: 'CreateBudget',
  entityType: 'Budget',
  entityId: 'b1',
};

describe('toAuditRecord (FR-7.1)', () => {
  it('keeps exactly the locked fields — never details or other context', () => {
    const noisy = { ...EVENT, details: { secret: 'x' }, correlationId: 'c' };

    expect(toAuditRecord(noisy as never)).toEqual(RECORD);
  });

  it('maps a system actor or missing household to null', () => {
    expect(toAuditRecord({ ...EVENT, actor: 'system', householdId: undefined }))
      .toMatchObject({ actorId: null, householdId: null });
  });

  it.each([
    ['a non-audit event', { ...EVENT, level: 'info' }],
    ['an event without an id', { ...EVENT, auditId: undefined }],
    ['an event without an entity', { ...EVENT, entityId: '' }],
  ])('ignores %s', (_case, event) => {
    expect(toAuditRecord(event)).toBeUndefined();
  });
});

describe('deliverWithRetry', () => {
  it('stores on the first try', async () => {
    const insert = vi.fn().mockResolvedValue(true);
    const sleep = vi.fn();

    expect(await deliverWithRetry(RECORD, { insert, delaysMs: [1, 5], sleep })).toBe(true);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries after each delay until it works', async () => {
    const insert = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(true);
    const sleep = vi.fn().mockResolvedValue(undefined);

    expect(await deliverWithRetry(RECORD, { insert, delaysMs: [1000, 5000], sleep })).toBe(true);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last delay', async () => {
    const insert = vi.fn().mockRejectedValue(new Error('down'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    expect(await deliverWithRetry(RECORD, { insert, delaysMs: [1000, 5000], sleep })).toBe(false);
    expect(insert).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1000], [5000]]);
  });
});

describe('createAuditSink', () => {
  /**
   * Builds a logger whose only transport is the audit sink.
   *
   * @param insert - The audit insert.
   * @param onGiveUp - Give-up callback.
   * @returns The logger.
   */
  const loggerWith = (insert: () => Promise<unknown>, onGiveUp = vi.fn()) => winston.createLogger({
    levels: {
      error: 0, warn: 1, audit: 2, info: 3,
    },
    transports: [createAuditSink({
      insert, delaysMs: [], sleep: async () => {}, onGiveUp,
    })],
  });

  it('stores audit events and ignores the others', async () => {
    const insert = vi.fn().mockResolvedValue(true);

    loggerWith(insert).log(EVENT);
    loggerWith(insert).log({ level: 'info', message: 'plain event' });
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));

    expect(insert).toHaveBeenCalledWith(RECORD);
  });

  it('reports a record it could not store', async () => {
    const onGiveUp = vi.fn();

    const failing = () => Promise.reject(new Error('down'));

    loggerWith(failing, onGiveUp).log(EVENT);

    await vi.waitFor(() => expect(onGiveUp).toHaveBeenCalledWith(RECORD));
  });
});
