import { createLogger } from '@financas/logging';

// EmailAccessor (U7, OQ-113): sends an already-rendered email through the
// configured provider — the external system. It knows how to send, never what
// to say: composing the email is NotificationEngine's. The provider is this
// Accessor's configuration (EMAIL_PROVIDER); v1 has only `console` (OQ-88).

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

/** Every provider by its EMAIL_PROVIDER name; a real one is a new entry. */
export const EMAIL_PROVIDERS = {
  console: createConsoleProvider,
} as const satisfies Record<string, () => SendEmail>;

export type EmailProviderName = keyof typeof EMAIL_PROVIDERS;

/**
 * Builds the EmailAccessor over the configured provider.
 *
 * @param provider - EMAIL_PROVIDER.
 * @returns The accessor's operations.
 */
const createEmailAccessor = (provider: EmailProviderName) => {
  const sendThroughProvider = EMAIL_PROVIDERS[provider]();
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
