import { describe, expect, it } from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import {
  ANA, fakeDeps, NOW, SESSION,
} from './fakes';

const ACTOR = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };
const CONTEXT = { correlationId: 'c1', actor: ACTOR };

describe('IdentityManager — sessions (uc-16, uc-17, NFR-SEC-5)', () => {
  it('lists active sessions, flagging the one making the request', async () => {
    const { deps, sessions } = fakeDeps();
    const other = { ...SESSION, id: 'other', deviceInfo: null };
    sessions.listByUser.mockResolvedValueOnce([SESSION, other]);

    const listed = await createIdentityManager(deps).listSessions(CONTEXT);

    expect(sessions.listByUser).toHaveBeenCalledWith(ANA.id, NOW);
    expect(listed.map((session) => [session.id, session.current]))
      .toEqual([[SESSION.id, true], ['other', false]]);
    expect(listed[1]).not.toHaveProperty('expiresAt');
  });

  it('revokes one of the caller\'s sessions, 404 for a missing or foreign one', async () => {
    const { deps, sessions } = fakeDeps();
    const identity = createIdentityManager(deps);

    await identity.revokeSession(CONTEXT, 's2');
    expect(sessions.deleteForUser).toHaveBeenCalledWith(ANA.id, 's2');

    sessions.deleteForUser.mockResolvedValueOnce(false);
    await expect(identity.revokeSession(CONTEXT, 's3'))
      .rejects.toMatchObject({ apiError: { status: 404, code: 'session.not_found' } });
  });

  it('signs out every other session, keeping this one', async () => {
    const { deps, sessions } = fakeDeps();

    await createIdentityManager(deps).revokeOtherSessions(CONTEXT);

    expect(sessions.deleteAllExceptCurrent).toHaveBeenCalledWith(ANA.id, SESSION.id);
  });
});
