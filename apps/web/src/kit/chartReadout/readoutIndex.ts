// The arithmetic of reading a chart's values (K38, K39): which value is nearest
// the pointer, and where the keys move to. Pure, and shared by the kit's charts.

/** Where a value sits across a plot. */
export interface ReadoutPosition {
  /** In percent of the plot's width. */
  readonly left: number;
}

/**
 * Finds the position closest to a point on the X axis: a reader aims at a
 * date, never at a thin line.
 *
 * @param positions - The positions.
 * @param left - Where the pointer is, in percent of the plot's width.
 * @returns The closest one's index, the latest of a tie, so that of two values on
 * one day it reads the one that counts; -1 with none.
 */
export const nearestIndex = (positions: readonly ReadoutPosition[], left: number): number => (
  positions.reduce((closest, position, index) => {
    const current = positions[closest];
    return current === undefined
      || Math.abs(position.left - left) <= Math.abs(current.left - left)
      ? index
      : closest;
  }, -1)
);

/**
 * Moves through a series from the keyboard. With nothing active yet, the arrows
 * start at the newest value.
 *
 * @param key - The key pressed.
 * @param current - The active index, or -1.
 * @param count - How many values the series has.
 * @returns The new index, or undefined when the key doesn't move it.
 */
export const steppedIndex = (
  key: string,
  current: number,
  count: number,
): number | undefined => {
  const last = count - 1;
  const steps: Record<string, number> = {
    ArrowLeft: current < 0 ? last : Math.max(current - 1, 0),
    ArrowRight: current < 0 ? last : Math.min(current + 1, last),
    Home: 0,
    End: last,
  };
  return steps[key];
};
