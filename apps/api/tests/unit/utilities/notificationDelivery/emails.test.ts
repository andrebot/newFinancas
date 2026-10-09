import { SUPPORTED_LOCALES } from '@financas/i18n';
import { describe, expect, it } from 'vitest';
import { type EmailParams, renderEmail } from '../../../../src/utilities/notificationDelivery';

const LINK = 'http://localhost:5173/reset-password?token=abc';

describe('renderEmail (OQ-84)', () => {
  it.each(SUPPORTED_LOCALES)('renders password.reset in %s, every argument filled', (locale) => {
    const params = { resetLink: LINK, expiresInMinutes: 30 };
    const { subject, body } = renderEmail('password.reset', params, locale);

    expect(subject).not.toBe('');
    expect(body).toContain(LINK);
    expect(body).toContain('30');
    expect(body).not.toMatch(/[{}]/);
  });

  it('uses the recipient\'s language and plural rules', () => {
    expect(renderEmail('password.reset', { resetLink: LINK, expiresInMinutes: 1 }, 'pt-BR'))
      .toEqual(expect.objectContaining({ subject: 'Redefinição de senha' }));
    expect(renderEmail('password.reset', { resetLink: LINK, expiresInMinutes: 1 }, 'en-US').body)
      .toContain('1 minute:');
    expect(renderEmail('password.reset', { resetLink: LINK, expiresInMinutes: 30 }, 'en-US').body)
      .toContain('30 minutes:');
  });

  it('fails rather than send an email with a hole in it', () => {
    const missingLink = { expiresInMinutes: 30 } as unknown as EmailParams['password.reset'];

    expect(() => renderEmail('password.reset', missingLink, 'en-US')).toThrow();
  });
});
