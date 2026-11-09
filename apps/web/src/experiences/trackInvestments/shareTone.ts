import { portfolio } from '../../config/constants';

// A share's colour by its place, largest first (FL18's donuts and bars,
// FL19's type bar — mockups 50, 51; OQ-234): shared by Track Investments'
// Flows so the same place wears the same colour on every tab.

/**
 * Picks a share's colour by its place, largest first.
 *
 * @param index - The share's place.
 * @returns A palette token; the tones repeat past the last.
 */
const shareTone = (index: number) => (
  // The index is taken modulo the tones' count, so it always lands on one.
  portfolio.shareTones[index % portfolio.shareTones.length]!
);

export default shareTone;
