import { describe, expect, it } from 'vitest';
import { isConsoleOnly, redactEvent, stampAudit } from '../../src/formats';

describe('stampAudit', () => {
  it('gives an audit event its own id and the time of the action', () => {
    expect(stampAudit({ level: 'audit', message: 'Login', timestamp: 'T' }, () => 'id-1'))
      .toEqual({
        level: 'audit', message: 'Login', timestamp: 'T', auditId: 'id-1', auditAt: 'T',
      });
  });

  it('leaves other events, and already-stamped audit events, alone', () => {
    const info = { level: 'info', message: 'x' };
    const stamped = { level: 'audit', message: 'x', auditId: 'keep' };

    expect(stampAudit(info, () => 'id')).toBe(info);
    expect(stampAudit(stamped, () => 'id')).toBe(stamped);
  });
});

describe('redactEvent', () => {
  it('redacts credential-like fields anywhere, keeping the event fields', () => {
    const event = { level: 'info', message: 'Login', correlationId: 'c1' };

    expect(redactEvent({ ...event, password: 'p', nested: { token: 't', ok: 1 } })).toEqual({
      ...event, password: '[redacted]', nested: { token: '[redacted]', ok: 1 },
    });
  });
});

describe('isConsoleOnly', () => {
  it('is true only when the event says so', () => {
    expect(isConsoleOnly({ level: 'info', message: 'x', consoleOnly: true })).toBe(true);
    expect(isConsoleOnly({ level: 'info', message: 'x', consoleOnly: 'yes' })).toBe(false);
    expect(isConsoleOnly({ level: 'info', message: 'x' })).toBe(false);
  });
});
