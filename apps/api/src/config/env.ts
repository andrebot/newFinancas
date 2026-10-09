import { z } from 'zod';
import { KEY_BYTES } from '../utilities/authentication/secretBox';
import { authentication } from './constants';

// Environment variables (OQ-101): values that differ per environment or are
// secret, read from .env and validated at startup. Fixed settings live in
// constants.ts.

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

const envSchema = z.object({
  PORT: z.coerce.number()
    .int()
    .min(1)
    .max(65535)
    .default(3000),
  DATABASE_URL: postgresUrl,
  EMAIL_PROVIDER: z.enum(['console']).default('console'),
  JWT_SECRET: z.string().min(authentication.accessToken.minSecretLength),
  MFA_ENCRYPTION_KEY: z.base64().refine(
    (value) => Buffer.from(value, 'base64').length === KEY_BYTES,
    `must be ${KEY_BYTES} bytes, base64-encoded`,
  ),
});

/** The API's validated environment. */
export interface Env {
  readonly port: number;
  readonly databaseUrl: string;
  readonly emailProvider: 'console';
  readonly jwtSecret: string;
  readonly mfaEncryptionKey: string;
}

/**
 * Reads and validates the API's environment variables.
 *
 * Validates every variable at once and fails at startup rather than at first
 * use. Only what the running API needs is read — the migration (owner)
 * credentials are deliberately not part of it.
 *
 * @param env - The environment to read, normally `process.env`.
 * @returns The validated, typed environment.
 * @throws {Error} Listing every missing or invalid variable.
 */
const loadEnv = (env: Record<string, string | undefined>): Env => {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }

  return {
    port: result.data.PORT,
    databaseUrl: result.data.DATABASE_URL,
    emailProvider: result.data.EMAIL_PROVIDER,
    jwtSecret: result.data.JWT_SECRET,
    mfaEncryptionKey: result.data.MFA_ENCRYPTION_KEY,
  };
};

export default loadEnv;
