import {
  describe, expect, it, vi,
} from 'vitest';
import { createNotificationEngine, ROUTES } from '../../../../src/engines/notification';

const INVITATION = {
  invitationId: 'i1', householdId: 'h1', inviterUserId: 'u2', role: 'Member',
} as const;
const RESET = { resetLink: 'http://x/?token=abc', expiresInMinutes: 30 };

/**
 * Builds the Engine over a fake inbox and a fake email sender — the Accessors
 * directly beneath it (BDT).
 *
 * @returns The Engine and its fakes.
 */
const setup = () => {
  const insertNotification = vi.fn(async () => ({
    id: 'n1', type: 'invitation.received', params: {}, seenAt: null, createdAt: new Date(),
  }));
  const sendEmail = vi.fn(async () => undefined);
  return {
    engine: createNotificationEngine({ insertNotification, sendEmail }),
    insertNotification,
    sendEmail,
  };
};

describe('NotificationEngine (OQ-113)', () => {
  it('routes each v1 kind to exactly its channels', () => {
    expect(ROUTES).toEqual({
      'invitation.received': ['in_app'],
      'holding.matured': ['in_app'],
      'password.reset': ['email'],
    });
  });

  it('stores an in-app notification as type + params only (OQ-82)', async () => {
    const { engine, insertNotification, sendEmail } = setup();

    await engine.notify('invitation.received', { userId: 'u1' }, INVITATION);

    expect(insertNotification).toHaveBeenCalledWith('u1', 'invitation.received', INVITATION);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('renders an email in the recipient\'s language and hands it to EmailAccessor', async () => {
    const { engine, insertNotification, sendEmail } = setup();

    await engine.notify('password.reset', { email: 'ana@example.com', language: 'pt-BR' }, RESET);

    expect(sendEmail).toHaveBeenCalledWith({
      to: 'ana@example.com',
      subject: 'Redefinição de senha',
      body: expect.stringContaining('http://x/?token=abc'),
    });
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it('rejects when a channel fails, so the Manager can decide', async () => {
    const { engine, insertNotification, sendEmail } = setup();
    insertNotification.mockRejectedValueOnce(new Error('db down'));
    sendEmail.mockRejectedValueOnce(new Error('provider down'));

    await expect(engine.notify('holding.matured', { userId: 'u1' }, {
      holdingId: 'h1', holdingName: 'CDB', dueDate: '2026-10-01',
    })).rejects.toThrow('db down');
    await expect(engine.notify('password.reset', { email: 'a@b.c', language: 'en-US' }, RESET))
      .rejects.toThrow('provider down');
  });

  it('makes the Manager supply what the routed channels need (compile-time)', () => {
    const { engine } = setup();
    const checks = () => [
      // @ts-expect-error password.reset is routed to email: the recipient needs email + language
      engine.notify('password.reset', { userId: 'u1' }, RESET),
      // @ts-expect-error invitation.received is routed in-app: the recipient needs a userId
      engine.notify('invitation.received', { email: 'a@b.c', language: 'en-US' }, INVITATION),
      // @ts-expect-error the email template needs its arguments
      engine.notify('password.reset', { email: 'a@b.c', language: 'en-US' }, {}),
    ];

    expect(typeof checks).toBe('function');
  });
});
