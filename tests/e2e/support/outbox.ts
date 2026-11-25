import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';

// The API under test's email sink (OQ-260): the outbox provider writes each
// email as a JSON file into EMAIL_OUTBOX_DIR (set by playwright.config.ts).

/** An email as the outbox provider wrote it. */
interface OutboxEmail {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

/**
 * Every email in the outbox so far, oldest first; none before the first send.
 *
 * @returns The emails the API sent.
 */
const outboxEmails = async (): Promise<OutboxEmail[]> => {
  const folder = process.env.EMAIL_OUTBOX_DIR;
  if (!folder) throw new Error('EMAIL_OUTBOX_DIR is not set (playwright.config.ts sets it)');
  const names = await readdir(folder).catch(() => []);
  return Promise.all(names.sort().map(async (name) => (
    JSON.parse(await readFile(path.join(folder, name), 'utf8')) as OutboxEmail
  )));
};

/**
 * Waits for the newest email sent to an address and returns the reset link it
 * holds, as a path on the web app — so the journey opens it on whatever origin
 * it runs against (dev or the production shape).
 *
 * @param email - The recipient's address.
 * @param count - How many emails the address has had once this one arrived.
 * @returns The link's path and query, e.g. `/reset-password?token=…`.
 */
const resetLinkSentTo = async (email: string, count = 1): Promise<string> => {
  let sent: OutboxEmail[] = [];
  await expect.poll(async () => {
    sent = (await outboxEmails()).filter((message) => message.to === email);
    return sent.length;
  }).toBe(count);
  const link = sent.at(-1)!.body.match(/https?:\/\/\S+\/reset-password\?token=\S+/)?.[0];
  if (!link) throw new Error(`The email to ${email} holds no reset link`);
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
};

export default resetLinkSentTo;
