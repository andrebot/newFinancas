import { describe, expect, it } from 'vitest';
import { formatConsoleLine } from '../../src/consoleFormat';

const base = {
  level: 'info',
  message: 'CreateBudget',
  timestamp: '2026-10-09T14:03:12.345Z',
  correlationId: '7f3a9c21-0000-4000-8000-000000000000',
  actor: 'user:0199c5a0',
};

describe('formatConsoleLine', () => {
  it('writes time, level, short correlation id, actor, action and details', () => {
    expect(formatConsoleLine({ ...base, details: { budgetId: 'b1', amount: 1050 } }, 'UTC'))
      .toBe('14:03:12 INFO  [7f3a9c21] user:0199c5a0 CreateBudget  budgetId=b1 amount=1050');
  });

  it('shows audit events as AUDIT with their target and household', () => {
    expect(formatConsoleLine({
      ...base, audit: true, entityType: 'Budget', entityId: 'b1', householdId: 'h1',
    }, 'UTC'))
      .toBe('14:03:12 AUDIT [7f3a9c21] user:0199c5a0 CreateBudget  Budget b1 (household h1)');
    expect(formatConsoleLine({
      ...base, audit: true, entityType: 'User', entityId: 'u1', householdId: null,
    }, 'UTC')).toBe('14:03:12 AUDIT [7f3a9c21] user:0199c5a0 CreateBudget  User u1');
  });

  it('appends the stack trace on the following lines', () => {
    expect(formatConsoleLine({ ...base, level: 'error', stack: 'Error: x\n    at y' }, 'UTC'))
      .toBe('14:03:12 ERROR [7f3a9c21] user:0199c5a0 CreateBudget\nError: x\n    at y');
  });

  it('shows local wall-clock time in the given zone (the file keeps UTC)', () => {
    expect(formatConsoleLine(base, 'America/Sao_Paulo').slice(0, 8)).toBe('11:03:12');
    expect(formatConsoleLine(base).slice(0, 8)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('copes with events that carry no context', () => {
    expect(formatConsoleLine({ level: 'warn', message: 'plain' }))
      .toBe(' WARN  [--------] - plain');
  });
});
