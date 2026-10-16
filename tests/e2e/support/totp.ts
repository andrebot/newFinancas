import { Secret, TOTP } from 'otpauth';

// The authenticator app's side of MFA: the code a user would read off their
// phone. The settings are the API's (apps/api config `authentication.totp`) —
// the defaults every authenticator app assumes.
//
// A code works once (OQ-163), and a journey often signs the same user in
// again within one 30-second step. So each secret's last step is remembered:
// the next code is the current step's, or — once that is used — the next
// step's, which the API accepts as one step of clock drift. Only when both
// are used does it wait for the clock.

const PERIOD_MS = 30_000;

/** The last time step a code was produced for, per secret (spaces removed). */
const lastStepBySecret = new Map<string, number>();

/**
 * The next authenticator code a user may type for a secret.
 *
 * @param secretBase32 - The setup key, spaces allowed (as the screen groups it).
 * @returns The six-digit code, of a step not used before.
 */
const totpCode = async (secretBase32: string): Promise<string> => {
  const secret = secretBase32.replace(/\s/g, '');
  const step = Math.max(
    Math.floor(Date.now() / PERIOD_MS),
    (lastStepBySecret.get(secret) ?? Number.NEGATIVE_INFINITY) + 1,
  );
  // The API takes a code at most one step ahead: wait until `step` is that close.
  const waitMs = (step - 1) * PERIOD_MS - Date.now();
  if (waitMs > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, waitMs + 100);
    });
  }
  lastStepBySecret.set(secret, step);
  return new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD_MS / 1000,
    secret: Secret.fromBase32(secret),
  }).generate({ timestamp: step * PERIOD_MS });
};

export default totpCode;
