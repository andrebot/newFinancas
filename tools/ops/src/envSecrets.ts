// `pnpm env:secrets` (OQ-100): replaces the public dev-only placeholders from
// .env.example with fresh random secrets in your local .env. A value that is
// already real is never touched — rotating MFA_ENCRYPTION_KEY would make every
// stored MFA secret unreadable.

/** The committed placeholder for each secret (safe for CI, never for real data). */
export const SECRET_PLACEHOLDERS: Readonly<Record<string, string>> = {
  JWT_SECRET: 'dev-only-jwt-secret-run-pnpm-env-secrets',
  MFA_ENCRYPTION_KEY: 'ZGV2LW9ubHktbWZhLWtleS1ydW4tZW52LXNlY3JldHM=',
};

/** What `fillSecrets` changed. */
export interface FilledSecrets {
  readonly text: string;
  readonly filled: string[];
  readonly kept: string[];
}

/**
 * Reads a variable's value from .env text.
 *
 * @param text - The file contents.
 * @param key - Variable name.
 * @returns Its value, or `undefined` when absent.
 */
export const envValue = (text: string, key: string): string | undefined => (
  text.split('\n').find((line) => line.startsWith(`${key}=`))?.slice(key.length + 1)
);

/**
 * Fills every secret that is missing, empty or still the placeholder.
 *
 * @param text - The current .env contents.
 * @param generate - Makes a fresh value for a secret name.
 * @returns The new contents, and which secrets were filled or kept.
 */
export const fillSecrets = (text: string, generate: (key: string) => string): FilledSecrets => (
  Object.entries(SECRET_PLACEHOLDERS).reduce<FilledSecrets>((result, [key, placeholder]) => {
    const current = envValue(result.text, key);
    if (current && current !== placeholder) return { ...result, kept: [...result.kept, key] };
    const line = `${key}=${generate(key)}`;
    const next = current === undefined
      ? `${result.text.replace(/\n?$/, '\n')}${line}\n`
      : result.text.replace(new RegExp(`^${key}=.*$`, 'm'), line);
    return { ...result, text: next, filled: [...result.filled, key] };
  }, { text, filled: [], kept: [] })
);
