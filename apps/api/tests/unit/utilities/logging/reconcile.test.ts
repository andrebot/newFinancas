import {
  describe, expect, it, vi,
} from 'vitest';
import {
  logFileLister, logFilesFor, parseAuditRecords, reconcileAudit, reconcileFailureDetails,
} from '../../../../src/utilities/logging/reconcile';

const audit = (sequence: number) => JSON.stringify({
  level: 'audit',
  message: 'CreateBudget',
  auditId: `0199c5a0-0000-7000-8000-00000000000${sequence}`,
  auditAt: '2026-10-09T14:00:00.000Z',
  actor: 'user:u1',
  householdId: 'h1',
  entityType: 'Budget',
  entityId: 'b1',
});

describe('parseAuditRecords', () => {
  it('extracts audit events, skipping other events, blank and malformed lines', () => {
    const other = '{"level":"info","message":"GET /health"}';
    const text = [audit(1), other, '', 'not json', audit(2)].join('\n');

    expect(parseAuditRecords(text).map((record) => record.id)).toEqual([
      '0199c5a0-0000-7000-8000-000000000001', '0199c5a0-0000-7000-8000-000000000002',
    ]);
  });
});

describe('reconcileAudit (OQ-110)', () => {
  it('reads every log file and stores what is missing', async () => {
    const insertMany = vi.fn().mockResolvedValue(1);
    const files: Record<string, string> = { a: audit(1), b: `${audit(2)}\n${audit(3)}` };

    const restored = await reconcileAudit({
      listLogFiles: async () => ['a', 'b'], readFile: async (file) => files[file]!, insertMany,
    });

    expect(restored).toBe(1);
    expect(insertMany.mock.calls[0]![0]).toHaveLength(3);
  });
});

describe('log files', () => {
  it('keeps only this process\'s daily files, oldest first', () => {
    const names = [
      'api-2026-10-09.log', 'seed-2026-10-09.log', 'api-2026-10-08.log', '.x-audit.json', 'api.txt',
      'api-2026-10-07.log.gz',
    ];

    expect(logFilesFor(names, 'api'))
      .toEqual(['api-2026-10-08.log', 'api-2026-10-09.log']);
  });

  it('lists full paths, and nothing when the directory is missing', async () => {
    const present = logFileLister('/logs', 'api', async () => ['api-2026-10-09.log']);
    const missing = logFileLister('/nowhere', 'api', () => Promise.reject(new Error('ENOENT')));

    expect(await present()).toEqual(['/logs/api-2026-10-09.log']);
    expect(await missing()).toEqual([]);
  });
});

describe('reconcileFailureDetails', () => {
  it('logs a wrapped database refusal by its cause, never the batch query', () => {
    const refusal = Object.assign(new Error('insert violates foreign key constraint'), {
      code: '23503',
      detail: 'Key (actor_id)=(u9) is not present in table "users".',
      constraint: 'audit_log_entries_actor_id_users_id_fk',
    });
    const wrapped = new Error('Failed query: insert into "audit_log_entries" … params: u9,…', {
      cause: refusal,
    });

    expect(reconcileFailureDetails(wrapped)).toEqual({
      error: 'Error: insert violates foreign key constraint',
      code: '23503',
      detail: 'Key (actor_id)=(u9) is not present in table "users".',
      constraint: 'audit_log_entries_actor_id_users_id_fk',
    });
  });

  it('keeps only the database fields a cause has', () => {
    const wrapped = new Error('Failed query', { cause: new Error('connection terminated') });

    expect(reconcileFailureDetails(wrapped)).toEqual({ error: 'Error: connection terminated' });
  });

  it('writes a cause that isn\'t an object as text', () => {
    expect(reconcileFailureDetails(new Error('Failed query', { cause: 'timeout' })))
      .toEqual({ error: 'timeout' });
  });

  it('logs an unwrapped failure as it is', () => {
    expect(reconcileFailureDetails(new Error('ENOENT: no log directory')))
      .toEqual({ error: 'Error: ENOENT: no log directory' });
    expect(reconcileFailureDetails('boom')).toEqual({ error: 'boom' });
  });
});
