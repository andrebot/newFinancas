import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@financas/logging';

// EmailAccessor (U7, OQ-113): sends an already-rendered email through the
// configured provider — the external system. It knows how to send, never what
// to say: composing the email is NotificationEngine's. The provider is this
// Accessor's configuration (EMAIL_PROVIDER); v1 sends through `console`
// (OQ-88), and the E2E API through `outbox`, a test sink (OQ-260).

/** A rendered email. */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

/** Sends one email; rejects when it could not. */
type SendEmail = (message: EmailMessage) => Promise<void>;

/**
 * The console provider (OQ-88): shows the email in the terminal, so a developer
 * can follow a reset link locally. It is console-only — the body holds a live
 * reset link, which must never reach the log files (OQ-112).
 *
 * @returns The provider's send function.
 */
export const createConsoleProvider = (): SendEmail => {
  const log = createLogger({ label: 'email', actor: 'system' });
  return async ({ to, subject, body }) => {
    log.info(`Email to ${to}: ${subject}\n${body}`, { consoleOnly: true });
  };
};

/**
 * The outbox provider (OQ-260), the E2E suite's email sink: writes each email as
 * a JSON file of its own into a folder, where a journey reads the reset link
 * back. It keeps live links on disk, so the config refuses it in production.
 *
 * @param outboxDir - The folder to write into, created when missing.
 * @returns The provider's send function.
 */
export const createOutboxProvider = (outboxDir: string): SendEmail => async (message) => {
  await mkdir(outboxDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.json`;
  await writeFile(join(outboxDir, fileName), JSON.stringify(message));
};

/** The provider EMAIL_PROVIDER names, with what it needs to run. */
export type EmailSettings = | { readonly provider: 'console' }
  | { readonly provider: 'outbox'; readonly outboxDir: string };

/**
 * The provider the settings name, ready to send.
 *
 * @param settings - The provider and its settings.
 * @returns The provider's send function.
 */
const providerFor = (settings: EmailSettings): SendEmail => (
  settings.provider === 'outbox'
    ? createOutboxProvider(settings.outboxDir)
    : createConsoleProvider()
);

/**
 * Builds the EmailAccessor over the configured provider.
 *
 * @param settings - EMAIL_PROVIDER and its settings.
 * @returns The accessor's operations.
 */
const createEmailAccessor = (settings: EmailSettings) => {
  const sendThroughProvider = providerFor(settings);
  return {
    /**
     * Sends an email.
     *
     * @param message - Recipient address, subject and plain-text body.
     * @returns Resolves once the provider accepted it; rejects otherwise.
     */
    send: (message: EmailMessage): Promise<void> => sendThroughProvider(message),
  };
};

export default createEmailAccessor;

export type EmailAccessor = ReturnType<typeof createEmailAccessor>;
