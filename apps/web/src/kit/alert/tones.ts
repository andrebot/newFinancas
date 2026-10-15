import { toast } from '../../config/constants';
import type { IconName } from '../icons/Icon';

// What the toast and the inline banner share (K25, OQ-141): four tones, each
// with its glyph and its accent colour, and the ARIA role it is announced
// with. An error interrupts (`alert`); the others wait their turn (`status`).

/** What an alert is about: a save went through, a note, a caution, a failure. */
export type AlertTone = 'success' | 'info' | 'warning' | 'error';

/** The glyph shown before the message, per tone. */
export const TONE_ICONS: Record<AlertTone, IconName> = {
  success: 'check-circle-outline',
  info: 'info-outline',
  warning: 'warning-outline',
  error: 'error-outline',
};

/** The glyph's colour, per tone. */
export const TONE_ACCENTS: Record<AlertTone, string> = {
  success: 'text-mint',
  info: 'text-sky',
  warning: 'text-sun',
  error: 'text-coral',
};

/**
 * Picks how an alert is announced: an error at once, the rest politely.
 *
 * @param tone - The alert's tone.
 * @returns The ARIA role for the alert's root.
 */
export const roleOf = (tone: AlertTone) => (tone === 'error' ? 'alert' : 'status');

/**
 * Picks how long a toast stays when the caller doesn't say: success and info
 * fade after `toast.durationMs`; warnings and errors stay until closed.
 *
 * @param tone - The toast's tone.
 * @returns The time in ms, or `null` for a toast that stays.
 */
export const defaultDurationOf = (tone: AlertTone): number | null => (
  (toast.stickyTones as readonly AlertTone[]).includes(tone) ? null : toast.durationMs
);
