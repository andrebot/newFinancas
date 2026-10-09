// Keeps credentials out of log files (U2): any detail whose key looks like a
// password, token, secret, auth header, cookie or MFA/recovery code is replaced.

const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|mfa|recovery|otp/i;
export const REDACTED = '[redacted]';

/**
 * Copies a value, replacing sensitive fields at any depth.
 *
 * @param value - Log details (objects, arrays, primitives).
 * @returns The same shape with sensitive values redacted.
 */
export const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).map(
    ([key, inner]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : redact(inner)],
  ));
};
