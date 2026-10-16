import { Secret, TOTP } from 'otpauth';

// The authenticator app's side of MFA: the code a user would read off their
// phone. The settings are the API's (apps/api config `authentication.totp`) —
// the defaults every authenticator app assumes.

/**
 * The current TOTP code for an MFA secret.
 *
 * @param secretBase32 - The setup key, spaces allowed (as the screen groups it).
 * @returns The six-digit code.
 */
const totpCode = (secretBase32: string): string => new TOTP({
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: Secret.fromBase32(secretBase32.replace(/\s/g, '')),
}).generate();

export default totpCode;
