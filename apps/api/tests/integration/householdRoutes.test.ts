import {
  describe, expect, it, vi,
} from 'vitest';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const BEN_ID = '0199c5a0-0000-7000-8000-000000000002';
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
const ACTOR = { userId: USER_ID, sessionId: 's1', systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');
const HOUSEHOLD = {
  id: HOME, name: 'Casa', createdAt: NOW, role: 'Owner' as const,
};
const HOUSEHOLD_JSON = { ...HOUSEHOLD, createdAt: NOW.toISOString() };

/**
 * The app, with a token check accepting only `good-token`.
 *
 * @returns The app and its mocked Manager.
 */
const setup = () => appWithMocks(vi.fn(async (token: string) => (
  token === 'good-token' ? ACTOR : undefined
)));

/**
 * Sends a signed-in JSON request under /api/v1.
 *
 * @param app - The app.
 * @param method - HTTP method.
 * @param path - Path under /api/v1.
 * @param body - JSON body, if any.
 * @returns The response.
 */
const send = (
  app: ReturnType<typeof setup>['app'],
  method: string,
  path: string,
  body?: unknown,
) => app.request(`/api/v1${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe('household routes', () => {
  const PATHS = ['/households', `/households/${HOME}`];

  it.each(PATHS)('check the token exactly once (%s)', async (path) => {
    const verify = vi.fn(async () => ACTOR);
    const { app, identity } = appWithMocks(verify);
    identity.listMyHouseholds.mockResolvedValueOnce([]);
    identity.getHousehold.mockResolvedValueOnce(HOUSEHOLD);

    await app.request(`/api/v1${path}`, { headers: { Authorization: 'Bearer t' } });

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('need a signed-in user', async () => {
    const { app } = setup();

    const response = await app.request(`/api/v1/households/${HOME}`);

    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe('auth.unauthenticated');
  });

  it('POST /households → 201 with my role; the name goes on as sent', async () => {
    const { app, identity } = setup();
    identity.createHousehold.mockResolvedValueOnce(HOUSEHOLD);

    const created = await send(app, 'POST', '/households', { name: ' Casa ' });

    expect(created.status).toBe(201);
    expect(await created.json()).toEqual(HOUSEHOLD_JSON);
    expect(identity.createHousehold)
      .toHaveBeenCalledWith(expect.objectContaining({ actor: ACTOR }), ' Casa ');
  });

  it('POST /households refuses an empty name against the contract', async () => {
    const { app, identity } = setup();

    const empty = await send(app, 'POST', '/households', { name: '' });

    expect(empty.status).toBe(422);
    expect(identity.createHousehold).not.toHaveBeenCalled();
  });

  it('GET and DELETE /households/:id', async () => {
    const { app, identity } = setup();
    identity.getHousehold.mockResolvedValueOnce(HOUSEHOLD);

    const got = await send(app, 'GET', `/households/${HOME}`);
    const deleted = await send(app, 'DELETE', `/households/${HOME}`);
    const malformed = await send(app, 'GET', '/households/not-a-uuid');

    expect(await got.json()).toEqual(HOUSEHOLD_JSON);
    expect(deleted.status).toBe(204);
    expect(identity.deleteHousehold).toHaveBeenCalledWith(expect.anything(), HOME);
    expect(malformed.status).toBe(422);
  });

  it('GET /households/:id/members lists them with names', async () => {
    const { app, identity } = setup();
    identity.listMembers.mockResolvedValueOnce([{
      userId: BEN_ID,
      firstName: 'Ben',
      lastName: 'Demo',
      email: 'ben@x.co',
      role: 'Member',
      joinedAt: NOW,
    }]);

    const response = await send(app, 'GET', `/households/${HOME}/members`);

    expect(await response.json()).toEqual({
      data: [{
        householdId: HOME,
        userId: BEN_ID,
        firstName: 'Ben',
        lastName: 'Demo',
        email: 'ben@x.co',
        role: 'Member',
        joinedAt: NOW.toISOString(),
      }],
    });
  });

  it('DELETE /households/:id/members/:userId removes (or leaves)', async () => {
    const { app, identity } = setup();

    const response = await send(app, 'DELETE', `/households/${HOME}/members/${BEN_ID}`);

    expect(response.status).toBe(204);
    expect(identity.removeMember).toHaveBeenCalledWith(expect.anything(), HOME, BEN_ID);
  });

  it('PATCH …/role sets Admin/Member/Viewer; Owner is refused at the door', async () => {
    const { app, identity } = setup();
    const path = `/households/${HOME}/members/${BEN_ID}/role`;

    const changed = await send(app, 'PATCH', path, { role: 'Admin' });
    const toOwner = await send(app, 'PATCH', path, { role: 'Owner' });

    expect(changed.status).toBe(200);
    expect(identity.changeMemberRole)
      .toHaveBeenCalledWith(expect.anything(), HOME, BEN_ID, 'Admin');
    expect(toOwner.status).toBe(422);
    expect(identity.changeMemberRole).toHaveBeenCalledTimes(1);
  });

  it('POST …/transfer-ownership hands it to the target', async () => {
    const { app, identity } = setup();

    const response = await send(app, 'POST', `/households/${HOME}/transfer-ownership`, {
      targetUserId: BEN_ID,
    });

    expect(response.status).toBe(200);
    expect(identity.transferOwnership).toHaveBeenCalledWith(expect.anything(), HOME, BEN_ID);
  });

  describe('invitations (OQ-118)', () => {
    const INVITATION_ID = '0199c5a0-0000-7000-8000-0000000000dd';
    const INVITATION = {
      id: INVITATION_ID,
      householdId: HOME,
      invitedUserId: BEN_ID,
      invitedByUserId: USER_ID,
      role: 'Member' as const,
      status: 'pending' as const,
      createdAt: NOW,
      resolvedAt: null,
    };
    const INVITATION_JSON = { ...INVITATION, createdAt: NOW.toISOString() };

    it('GET …/invitations lists them with invitee names', async () => {
      const { app, identity } = setup();
      const invitee = {
        inviteeFirstName: 'Ben', inviteeLastName: 'Demo', inviteeEmail: 'ben@x.co',
      };
      identity.listHouseholdInvitations.mockResolvedValueOnce([{ ...INVITATION, ...invitee }]);

      const response = await send(app, 'GET', `/households/${HOME}/invitations`);

      expect(await response.json()).toEqual({ data: [{ ...INVITATION_JSON, ...invitee }] });
    });

    it('POST …/invitations → 201', async () => {
      const { app, identity } = setup();
      identity.inviteUser.mockResolvedValueOnce({
        ...INVITATION, status: 'accepted', resolvedAt: NOW,
      });
      const body = { email: 'ben@x.co', role: 'Member' };

      const response = await send(app, 'POST', `/households/${HOME}/invitations`, body);

      expect(response.status).toBe(201);
      expect(await response.json())
        .toEqual({ ...INVITATION_JSON, status: 'accepted', resolvedAt: NOW.toISOString() });
      expect(identity.inviteUser).toHaveBeenCalledWith(expect.anything(), HOME, body);
    });

    it('DELETE …/invitations/:id revokes', async () => {
      const { app, identity } = setup();

      const path = `/households/${HOME}/invitations/${INVITATION_ID}`;
      const response = await send(app, 'DELETE', path);

      expect(response.status).toBe(204);
      expect(identity.revokeInvitation)
        .toHaveBeenCalledWith(expect.anything(), HOME, INVITATION_ID);
    });

    it('accept and decline need a signed-in user', async () => {
      const { app, identity } = setup();
      identity.acceptInvitation.mockResolvedValueOnce({ householdId: HOME, role: 'Member' });

      const accepted = await send(app, 'POST', `/invitations/${INVITATION_ID}/accept`);
      const declined = await send(app, 'POST', `/invitations/${INVITATION_ID}/decline`);
      const signedOut = await app.request(`/api/v1/invitations/${INVITATION_ID}/accept`, {
        method: 'POST',
      });

      expect(await accepted.json()).toEqual({ householdId: HOME, role: 'Member' });
      expect(declined.status).toBe(200);
      expect(identity.declineInvitation).toHaveBeenCalledWith(expect.anything(), INVITATION_ID);
      expect(signedOut.status).toBe(401);
    });
  });
});
