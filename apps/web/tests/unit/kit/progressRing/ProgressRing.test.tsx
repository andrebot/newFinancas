import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ProgressRing,
  RING_BOX,
  RING_FRAME,
  RING_MOTION,
  RING_RADIUS,
  RING_STROKE,
  labelColour,
} from '../../../../src/kit/progressRing/ProgressRing';

// Kit component (BDT: Interaction tier → unit): display only, nothing to
// stand in for.

/**
 * Finds the ring by its accessible name.
 *
 * @param name - The ring's accessible name.
 * @returns The progress ring element.
 */
const ringNamed = (name: string) => screen.getByRole('progressbar', { name });

/**
 * Takes the ring's two circles.
 *
 * @param ring - The progress ring element.
 * @returns The track and the fill.
 */
const circlesOf = (ring: Element) => {
  const [track, fill] = Array.from(ring.querySelectorAll('circle'));
  return { track: track!, fill: fill! };
};

describe('ring geometry', () => {
  it('leaves a hole 78% of the ring wide, as on the mockups', () => {
    expect(RING_RADIUS + RING_STROKE / 2).toBe(RING_BOX / 2);
    expect((RING_BOX - 2 * RING_STROKE) / RING_BOX).toBeCloseTo(0.78, 2);
  });
});

describe('labelColour', () => {
  it('is coral for an over-budget ring, whatever the value', () => {
    expect(labelColour('coral', 100)).toBe('text-coral');
    expect(labelColour('coral', 0)).toBe('text-coral');
  });

  it('is faint at 0 and the ink otherwise', () => {
    expect(labelColour('sky', 0)).toBe('text-faint');
    expect(labelColour('sky', 57)).toBe('text-ink');
    expect(labelColour('sun', 78)).toBe('text-ink');
  });
});

describe('ProgressRing', () => {
  it('is a progress bar from 0 to 100, its label as the value text', () => {
    render(<ProgressRing value={57} label="57%" ariaLabel="House Down Payment" />);

    const ring = ringNamed('House Down Payment');
    expect(ring.className).toBe(`${RING_FRAME} size-16 text-[0.8125rem]`);
    expect(ring.getAttribute('aria-valuemin')).toBe('0');
    expect(ring.getAttribute('aria-valuemax')).toBe('100');
    expect(ring.getAttribute('aria-valuenow')).toBe('57');
    expect(ring.getAttribute('aria-valuetext')).toBe('57%');
  });

  it('draws the track and a sky fill swept to the value, animating it', () => {
    render(<ProgressRing value={32} ariaLabel="Emergency Fund" />);
    const ring = ringNamed('Emergency Fund');
    const { track, fill } = circlesOf(ring);

    expect(ring.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(track.getAttribute('class')).toBe('stroke-track');
    expect(fill.getAttribute('pathLength')).toBe('100');
    expect(fill.getAttribute('stroke-dasharray')).toBe('100 100');
    expect(fill.getAttribute('stroke-dashoffset')).toBe('68');
    expect(fill.getAttribute('class')).toBe(`stroke-sky ${RING_MOTION}`);
  });

  it('turns the sweep off under reduced motion', () => {
    expect(RING_MOTION).toContain('motion-reduce:transition-none');
  });

  it('holds the fill full for an over-budget value, its label still the real figure', () => {
    render(<ProgressRing value={106} label="106%" tone="coral" ariaLabel="Household Essentials" />);
    const ring = ringNamed('Household Essentials');
    const label = ring.querySelector('span')!;

    expect(circlesOf(ring).fill.getAttribute('stroke-dashoffset')).toBe('0');
    expect(circlesOf(ring).fill.getAttribute('class')).toContain('stroke-coral');
    expect(ring.getAttribute('aria-valuenow')).toBe('100');
    expect(label.textContent).toBe('106%');
    expect(label.className).toBe('relative text-coral');
    expect(label.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows an empty track with a faint label at 0', () => {
    render(<ProgressRing value={-3} label="0%" ariaLabel="New Laptop Fund" />);
    const ring = ringNamed('New Laptop Fund');

    expect(circlesOf(ring).fill.getAttribute('stroke-dashoffset')).toBe('100');
    expect(ring.querySelector('span')!.className).toBe('relative text-faint');
  });

  it('draws the other tones and the small size', () => {
    render(<ProgressRing value={48} label="48%" tone="mint" size="sm" ariaLabel="Fun Money" />);
    const ring = ringNamed('Fun Money');

    expect(ring.className).toBe(`${RING_FRAME} size-13 text-xs`);
    expect(circlesOf(ring).fill.getAttribute('class')).toContain('stroke-mint');
    expect(ring.querySelector('span')!.className).toBe('relative text-ink');
  });

  it('draws only the ring without a label, and has no value text', () => {
    render(<ProgressRing value={78} tone="sun" ariaLabel="Dining Out" />);
    const ring = ringNamed('Dining Out');

    expect(ring.querySelector('span')).toBeNull();
    expect(ring.hasAttribute('aria-valuetext')).toBe(false);
    expect(circlesOf(ring).fill.getAttribute('class')).toContain('stroke-sun');
  });
});
