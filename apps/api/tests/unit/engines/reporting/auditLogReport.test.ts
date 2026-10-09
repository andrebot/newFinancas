import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../../../../src/accessors/auditLogAccessor';
import auditLogCsv from '../../../../src/engines/reporting/auditLogReport';

const entry = (overrides: Partial<AuditEntry>): AuditEntry => ({
  id: 'e1',
  actorId: '0199c5a0-0000-7000-8000-0000000000a1',
  householdId: '0199c5a0-0000-7000-8000-000000000001',
  action: 'CreateBudget',
  entityType: 'Budget',
  entityId: '0199c5a0-0000-7000-8000-0000000000b1',
  createdAt: new Date('2026-10-08T15:04:05.000Z'),
  ...overrides,
});

describe('auditLogCsv (ReportingEngine)', () => {
  it('writes the FR-7.1 fields, in order, with ISO UTC timestamps', () => {
    expect(auditLogCsv([entry({})])).toBe(
      'timestamp,actor_id,action,entity_type,entity_id\r\n'
      + '2026-10-08T15:04:05.000Z,0199c5a0-0000-7000-8000-0000000000a1,CreateBudget,Budget,'
      + '0199c5a0-0000-7000-8000-0000000000b1\r\n',
    );
  });

  it('marks system actions as "system"', () => {
    expect(auditLogCsv([entry({ actorId: null, action: 'NotifyMaturedHolding' })]))
      .toContain('\r\n2026-10-08T15:04:05.000Z,system,NotifyMaturedHolding,');
  });

  it('keeps the given order and writes only the header for no entries', () => {
    const csv = auditLogCsv([entry({ action: 'First' }), entry({ action: 'Second' })]);
    const rows = csv.split('\r\n');

    expect(rows.map((row) => row.split(',')[2])).toEqual(['action', 'First', 'Second', undefined]);
    expect(auditLogCsv([])).toBe('timestamp,actor_id,action,entity_type,entity_id\r\n');
  });
});
