import { describe, expect, it } from 'vitest';
import { formatConsoleLine } from '../../src/consoleFormat';

const PREFIX = '14:03:12 INFO  [7f3a9c21] user:0199c5a0 IdentityManager';
const AUDIT = '14:03:12 AUDIT [7f3a9c21] user:0199c5a0 IdentityManager';

const base = {
  level: 'info',
  message: 'Login',
  timestamp: '2026-10-09T14:03:12.345Z',
  label: 'IdentityManager',
  correlationId: '7f3a9c21-0000-4000-8000-000000000000',
  actor: 'user:0199c5a0',
};

describe('formatConsoleLine', () => {
  it('writes time, level, short correlation id, actor, label: message, extra fields', () => {
    expect(formatConsoleLine({ ...base, deviceInfo: 'Firefox', attempts: 2 }, 'UTC'))
      .toBe(`${PREFIX}: Login  deviceInfo=Firefox attempts=2`);
  });

  it('shows audit events with their target and household', () => {
    const audit = {
      ...base,
      level: 'audit',
      auditId: 'a1',
      auditAt: base.timestamp,
      entityType: 'Session',
      entityId: 's1',
    };

    expect(formatConsoleLine({ ...audit, householdId: 'h1' }, 'UTC'))
      .toBe(`${AUDIT}: Login  Session s1 (household h1)`);
    expect(formatConsoleLine({ ...audit, householdId: null }, 'UTC'))
      .toBe(`${AUDIT}: Login  Session s1`);
  });

  it('appends the stack trace on the following lines', () => {
    expect(formatConsoleLine({ ...base, level: 'error', stack: 'Error: x\n    at y' }, 'UTC'))
      .toBe(`${PREFIX.replace('INFO ', 'ERROR')}: Login\nError: x\n    at y`);
  });

  it('shows local wall-clock time (the file keeps UTC)', () => {
    expect(formatConsoleLine(base, 'America/Sao_Paulo').slice(0, 8)).toBe('11:03:12');
    expect(formatConsoleLine(base).slice(0, 8)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('copes with events that carry no context', () => {
    expect(formatConsoleLine({ level: 'warn', message: 'plain' }))
      .toBe(' WARN  [--------] - plain');
  });
});
