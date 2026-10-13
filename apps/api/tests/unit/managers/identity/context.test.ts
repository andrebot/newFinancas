import { captureLogs } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import { loggerFor, refreshTokenExpiry } from '../../../../src/managers/identity/context';

const ACTOR = { userId: 'u1', sessionId: 's1', systemRole: 'USER' as const };

describe('loggerFor', () => {
  it.each([
    [{ correlationId: 'c1', actor: ACTOR }, undefined, 'user:u1'],
    [{ correlationId: 'c1' }, 'u2', 'user:u2'],
    [{ correlationId: 'c1' }, undefined, 'unauthenticated'],
  ])('labels %j (user %s) as %s', (context, userId, actor) => {
    const logs = captureLogs();

    loggerFor(context, userId).info('x');
    logs.stop();

    expect(logs.events[0]).toMatchObject({ label: 'IdentityManager', correlationId: 'c1', actor });
  });
});

describe('refreshTokenExpiry', () => {
  it('is 30 days after issue (OQ-30)', () => {
    expect(refreshTokenExpiry(new Date('2026-10-13T12:00:00Z')))
      .toEqual(new Date('2026-11-12T12:00:00Z'));
  });
});
