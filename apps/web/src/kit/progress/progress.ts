// What the kit's progress indicators share (OQ-209): the bar (K33) and the
// ring (K32) both hold a percentage to 0–100, expose it as a progress bar to
// assistive technology and move their fill on the same timing; the percent
// a budget or goal shows is rounded the same way everywhere (OQ-215). They change
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
 * Writes a share as a whole percent, rounded down and never below zero, so
 * 99.7% never reads 100% (OQ-215). Not held to 100: an over-budget 106% says so.
 *
 * @param part - The amount so far, in minor units.
 * @param whole - The target, in minor units; a non-positive one reads 0%.
 * @returns E.g. 106 for 4,250 of 4,000.
 */
export const wholePercent = (part: number, whole: number): number => {
  if (whole <= 0) return 0;
  return Math.max(0, Math.floor((part * 100) / whole));
};

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
