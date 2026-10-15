import { mfa } from '../../config/constants';
import type { Mask } from '../maskedInput/useMaskedInput';

// The backup code's mask (K17, OQ-139). Codes are Crockford base32 (the API's
// `newRecoveryCode`), shown in dashed groups: `7HJX-21NA-Q4KD-9WTE`. Typing is
// forgiving the way the API is: lower case is raised, the look-alikes O, I and
// L become 0, 1 and 1, and anything else (U, spaces, the dashes) is dropped.

const { length, groupSize } = mfa.backupCode;
const CROCKFORD = /[0-9A-HJKMNP-TV-Z]/;
const LOOK_ALIKES: Readonly<Record<string, string>> = { O: '0', I: '1', L: '1' };

/**
 * Reads one typed character as a backup-code character.
 *
 * @param character - One character as typed.
 * @returns Its Crockford spelling, or `''` when a code can't hold it.
 */
const crockfordOf = (character: string): string => {
  const upper = character.toUpperCase();
  const spelled = LOOK_ALIKES[upper] ?? upper;
  return CROCKFORD.test(spelled) ? spelled : '';
};

/**
 * Turns typed text into a clean backup code, at most a code long.
 *
 * @param text - What the user typed or pasted.
 * @returns The code's characters, upper case, without dashes.
 */
export const parseBackupCode = (text: string): string => (
  Array.from(text, crockfordOf).join('').slice(0, length)
);

/**
 * Shows a clean backup code in its groups. A dash appears only once the next
 * group has begun, so deleting never leaves one dangling.
 *
 * @param clean - The code's characters.
 * @returns The code with a dash between groups.
 */
export const formatBackupCode = (clean: string): string => (
  clean.match(new RegExp(`.{1,${groupSize}}`, 'g'))?.join('-') ?? ''
);

/** The backup code's mask, for `useMaskedInput`. */
export const backupCodeMask: Mask = { format: formatBackupCode, parse: parseBackupCode };
