// Fixed application settings (OQ-101): the same in every environment, changed
// only in code, grouped by area. Per-environment values and secrets live in
// env.ts. Facts that belong to an algorithm (AES-GCM's 12-byte IV, the Crockford
// alphabet, …) stay next to the code that implements it — they aren't settings.

/** Authentication policy (U4, OQ-100). */
export const authentication = {
  accessToken: {
    /** Lifetime of an access JWT; a revoked session lasts at most this long. */
    ttlSeconds: 15 * 60,
    algorithm: 'HS256',
    issuer: 'financas-api',
    audience: 'financas-web',
    /** Shortest JWT_SECRET accepted at startup. */
    minSecretLength: 32,
  },
  refreshToken: {
    /** Lifetime of a refresh token; each one is single-use (rotated). */
    ttlDays: 30,
  },
  /** Random bytes in an opaque token (refresh, password reset): 256 bits. */
  opaqueTokenBytes: 32,
  /** Argon2id parameters (OWASP); stored in each hash, so they can be raised. */
  passwordHashing: {
    memoryCostKib: 19_456,
    timeCost: 2,
    parallelism: 1,
  },
  /** TOTP as authenticator apps expect it (RFC 6238). */
  totp: {
    issuer: 'Finance APP',
    algorithm: 'SHA1',
    digits: 6,
    periodSeconds: 30,
    /** Accepted clock drift, in steps either side. */
    driftSteps: 1,
    secretBytes: 20,
  },
  recoveryCodes: {
    count: 10,
    /** 80 bits → 16 Crockford base32 characters. */
    bytes: 10,
  },
} as const;

/** HTTP layer settings. */
export const http = {
  /** Request/response header carrying the correlation ID (OQ-99). */
  correlationIdHeader: 'X-Correlation-Id',
} as const;
