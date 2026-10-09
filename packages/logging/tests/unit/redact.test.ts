import { describe, expect, it } from 'vitest';
import { REDACTED, redact } from '../../src/redact';

describe('redact', () => {
  it('replaces credential-like fields at any depth, in objects and arrays', () => {
    const at = new Date('2026-10-09T00:00:00Z');

    expect(redact({
      email: 'ana@example.com',
      password: 'p',
      newPassword: 'p',
      refreshToken: 't',
      Authorization: 'Bearer x',
      nested: {
        mfaCode: '123456', recoveryCode: 'X', apiSecret: 's', ok: 1,
      },
      list: [{ cookie: 'c', keep: true }],
      at,
    })).toEqual({
      email: 'ana@example.com',
      password: REDACTED,
      newPassword: REDACTED,
      refreshToken: REDACTED,
      Authorization: REDACTED,
      nested: {
        mfaCode: REDACTED, recoveryCode: REDACTED, apiSecret: REDACTED, ok: 1,
      },
      list: [{ cookie: REDACTED, keep: true }],
      at,
    });
  });

  it('leaves primitives and harmless keys alone', () => {
    expect(redact('text')).toBe('text');
    expect(redact(null)).toBeNull();
    expect(redact({ errorCode: 'auth.forbidden', budgetId: 'b1' }))
      .toEqual({ errorCode: 'auth.forbidden', budgetId: 'b1' });
  });
});
