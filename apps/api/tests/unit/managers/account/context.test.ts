import { captureLogs } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import { loggerFor, requestLogger } from '../../../../src/managers/account/context';

const ACTOR = { userId: 'u1', sessionId: 's1', systemRole: 'USER' as const };

describe('loggerFor', () => {
  it.each([
    ['u1', 'user:u1'],
    [undefined, 'system'],
  ])('labels user %s as %s', (userId, actor) => {
    const logs = captureLogs();

    loggerFor('c1', userId).info('x');
    logs.stop();

    expect(logs.events[0]).toMatchObject({ label: 'AccountManager', correlationId: 'c1', actor });
  });
});

describe('requestLogger', () => {
  it('carries the request\'s correlation ID and actor', () => {
    const logs = captureLogs();

    requestLogger({ correlationId: 'c2', actor: ACTOR }).info('x');
    logs.stop();

    expect(logs.events[0]).toMatchObject({
      label: 'AccountManager', correlationId: 'c2', actor: 'user:u1',
    });
  });
});
