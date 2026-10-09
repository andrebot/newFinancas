import { captureLogs } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import {
  createConsoleEmailProvider, createEmailProvider, EMAIL_PROVIDERS,
} from '../../../../src/utilities/notificationDelivery';

const MESSAGE = { to: 'ana@example.com', subject: 'Reset', body: 'Use http://x/?token=abc' };

describe('email providers (OQ-88)', () => {
  it('the console provider shows the email in the terminal only, never in the files', async () => {
    const logs = captureLogs();

    await createConsoleEmailProvider().send(MESSAGE);
    logs.stop();

    expect(logs.events).toEqual([expect.objectContaining({
      level: 'info',
      label: 'email',
      message: 'Email to ana@example.com: Reset\nUse http://x/?token=abc',
      consoleOnly: true,
    })]);
  });

  it('builds the provider EMAIL_PROVIDER names', async () => {
    const logs = captureLogs();

    await createEmailProvider('console').send(MESSAGE);
    logs.stop();

    expect(Object.keys(EMAIL_PROVIDERS)).toEqual(['console']);
    expect(logs.events).toHaveLength(1);
  });
});
