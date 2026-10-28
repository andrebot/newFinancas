// What the kit's progress indicators share (OQ-209): the bar (K33) and the
// ring (K32) both hold a percentage to 0–100, expose it as a progress bar to
// assistive technology and move their fill on the same timing. They change
// for progress-indicator reasons, so they live here, not in either one.

/** How long a fill takes to move (the design system's 150–250ms). */
export const FILL_MOTION_DURATION = 'duration-200';

/**
 * Holds a percentage to 0–100; anything that is not a number counts as 0.
 *
 * @param value - The percentage.
 * @returns The percentage between 0 and 100.
 */
export const clampPercent = (value: number): number => (
  Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value))
);

/**
 * The accessible attributes of a progress indicator. An empty value text is
 * left out, so a screen reader falls back to the number instead of silence.
 *
 * @param ariaLabel - Its name.
 * @param value - Its value, already held to 0–100.
 * @param ariaValueText - What to say for the value, if not the bare number.
 * @returns The `role="progressbar"` attributes.
 */
export const progressAttributes = (ariaLabel: string, value: number, ariaValueText?: string) => ({
  role: 'progressbar',
  'aria-label': ariaLabel,
  'aria-valuemin': 0,
  'aria-valuemax': 100,
  'aria-valuenow': Math.round(value),
  'aria-valuetext': ariaValueText || undefined,
});
