import {
  mkdtemp, readdir, readFile, rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import createEmailAccessor, {
  createConsoleProvider, createOutboxProvider,
} from '../../../src/accessors/emailAccessor';

const MESSAGE = { to: 'ana@example.com', subject: 'Reset', body: 'Use http://x/?token=abc' };

/**
 * A fresh, empty folder under the OS temp dir, removed when the test ends.
 *
 * @returns The folder's path.
 */
const scratchFolder = async (): Promise<string> => {
  const folder = await mkdtemp(join(tmpdir(), 'outbox-'));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  return folder;
};

/**
 * Every email an outbox folder holds, parsed, in file-name order.
 *
 * @param folder - The outbox folder.
 * @returns The emails written there.
 */
const outboxEmails = async (folder: string): Promise<unknown[]> => {
  const names = (await readdir(folder)).sort();
  return Promise.all(names.map(async (name) => (
    JSON.parse(await readFile(join(folder, name), 'utf8'))
  )));
};

describe('EmailAccessor (OQ-113)', () => {
  it('sends through the console provider, unchanged', async () => {
    const logs = captureLogs(onTestFinished);

    await createEmailAccessor({ provider: 'console' }).send(MESSAGE);

    expect(logs.events).toEqual([expect.objectContaining({
      message: 'Email to ana@example.com: Reset\nUse http://x/?token=abc',
    })]);
  });

  it('sends through the outbox provider into its folder (OQ-260)', async () => {
    const folder = await scratchFolder();

    await createEmailAccessor({ provider: 'outbox', outboxDir: folder }).send(MESSAGE);

    expect(await outboxEmails(folder)).toEqual([MESSAGE]);
  });

  it('the console provider shows the email in the terminal only, never in the files', async () => {
    const logs = captureLogs(onTestFinished);

    await createConsoleProvider()(MESSAGE);

    expect(logs.events).toEqual([expect.objectContaining({
      level: 'info', label: 'email', consoleOnly: true,
    })]);
  });

  it('the outbox provider creates its folder, each email in a file of its own', async () => {
    const folder = join(await scratchFolder(), 'nested', 'outbox');
    const send = createOutboxProvider(folder);
    const second = { ...MESSAGE, to: 'bia@example.com' };

    await send(MESSAGE);
    await send(second);

    expect(await outboxEmails(folder)).toEqual(expect.arrayContaining([MESSAGE, second]));
    expect(await readdir(folder)).toHaveLength(2);
  });
});
