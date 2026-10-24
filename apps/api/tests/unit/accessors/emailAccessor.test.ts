import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import createEmailAccessor, {
  createConsoleProvider, EMAIL_PROVIDERS,
} from '../../../src/accessors/emailAccessor';

const MESSAGE = { to: 'ana@example.com', subject: 'Reset', body: 'Use http://x/?token=abc' };

describe('EmailAccessor (OQ-113)', () => {
  it('sends through the provider EMAIL_PROVIDER names, unchanged', async () => {
    const logs = captureLogs(onTestFinished);

    await createEmailAccessor('console').send(MESSAGE);

    expect(Object.keys(EMAIL_PROVIDERS)).toEqual(['console']);
    expect(logs.events).toEqual([expect.objectContaining({
      message: 'Email to ana@example.com: Reset\nUse http://x/?token=abc',
    })]);
  });

  it('the console provider shows the email in the terminal only, never in the files', async () => {
    const logs = captureLogs(onTestFinished);

    await createConsoleProvider()(MESSAGE);

    expect(logs.events).toEqual([expect.objectContaining({
      level: 'info', label: 'email', consoleOnly: true,
    })]);
  });
});
