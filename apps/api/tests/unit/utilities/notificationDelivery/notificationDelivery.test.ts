import {
  describe, expect, it, vi,
} from 'vitest';
import {
  createNotificationDeliveryUtility, type EmailProvider,
} from '../../../../src/utilities/notificationDelivery';

const INVITATION = {
  invitationId: 'i1', householdId: 'h1', inviterUserId: 'u2', role: 'Member',
} as const;

/**
 * Builds the utility over a fake inbox and a fake email provider.
 *
 * @param email - The provider to configure (a recording fake by default).
 * @returns The utility and its fakes.
 */
const setup = (email: EmailProvider = { send: vi.fn(async () => undefined) }) => {
  const insertNotification = vi.fn(async () => ({
    id: 'n1', type: 'invitation.received', params: {}, seenAt: null, createdAt: new Date(),
  }));
  return {
    notify: createNotificationDeliveryUtility({ insertNotification, email }),
    insertNotification,
    email,
  };
};

describe('NotificationDeliveryUtility', () => {
  it('stores an in-app notification as type + params only (OQ-82)', async () => {
    const { notify, insertNotification, email } = setup();

    await notify.deliver({
      channel: 'in_app', userId: 'u1', type: 'invitation.received', params: INVITATION,
    });

    expect(insertNotification).toHaveBeenCalledWith('u1', 'invitation.received', INVITATION);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('renders an email in the recipient\'s language and sends it via the provider', async () => {
    const { notify, insertNotification, email } = setup();

    await notify.deliver({
      channel: 'email',
      to: 'ana@example.com',
      language: 'pt-BR',
      type: 'password.reset',
      params: { resetLink: 'http://x/?token=abc', expiresInMinutes: 30 },
    });

    expect(email.send).toHaveBeenCalledWith({
      to: 'ana@example.com',
      subject: 'Redefinição de senha',
      body: expect.stringContaining('http://x/?token=abc'),
    });
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it('rejects when the channel fails, so the Manager can decide', async () => {
    const failing = {
      send: vi.fn(async () => {
        throw new Error('smtp down');
      }),
    };
    const { notify, insertNotification } = setup(failing);
    insertNotification.mockRejectedValueOnce(new Error('db down'));

    await expect(notify.deliver({
      channel: 'in_app', userId: 'u1', type: 'invitation.received', params: INVITATION,
    })).rejects.toThrow('db down');
    await expect(notify.deliver({
      channel: 'email',
      to: 'a@b.c',
      language: 'en-US',
      type: 'password.reset',
      params: { resetLink: 'l', expiresInMinutes: 5 },
    })).rejects.toThrow('smtp down');
  });
});
