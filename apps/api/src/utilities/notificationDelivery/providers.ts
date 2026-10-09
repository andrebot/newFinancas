import { createLogger } from '@financas/logging';

// Email providers (U7, OQ-84/OQ-88): sending is static, the provider is
// configuration (EMAIL_PROVIDER). v1 has only the console provider; a real one
// is another entry in EMAIL_PROVIDERS, with no caller changing.

/** What a provider sends. */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

/** Sends a rendered email; rejects when it could not. */
export interface EmailProvider {
  readonly send: (message: EmailMessage) => Promise<void>;
}

/**
 * The console provider (OQ-88): shows the email in the terminal, so a developer
 * can follow a reset link locally. It is console-only — the body holds a live
 * reset link, which must never reach the log files (OQ-112).
 *
 * @returns The provider.
 */
export const createConsoleEmailProvider = (): EmailProvider => {
  const log = createLogger({ label: 'email', actor: 'system' });
  return {
    send: async ({ to, subject, body }) => {
      log.info(`Email to ${to}: ${subject}\n${body}`, { consoleOnly: true });
    },
  };
};

/** Every provider by its EMAIL_PROVIDER name. */
export const EMAIL_PROVIDERS = {
  console: createConsoleEmailProvider,
} as const satisfies Record<string, () => EmailProvider>;

export type EmailProviderName = keyof typeof EMAIL_PROVIDERS;

/**
 * Creates the configured provider.
 *
 * @param name - EMAIL_PROVIDER.
 * @returns The provider.
 */
export const createEmailProvider = (name: EmailProviderName): EmailProvider => (
  EMAIL_PROVIDERS[name]()
);
