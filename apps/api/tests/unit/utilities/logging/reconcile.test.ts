import {
  describe, expect, it, vi,
} from 'vitest';
import {
  logFileLister, logFilesFor, parseAuditRecords, reconcileAudit,
} from '../../../../src/utilities/logging/reconcile';

const audit = (n: number) => JSON.stringify({
  level: 'audit',
  message: 'CreateBudget',
  auditId: `0199c5a0-0000-7000-8000-00000000000${n}`,
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

    expect(parseAuditRecords(text).map((r) => r.id)).toEqual([
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
