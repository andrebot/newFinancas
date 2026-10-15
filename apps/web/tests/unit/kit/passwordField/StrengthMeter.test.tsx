import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { barClasses, StrengthMeter } from '../../../../src/kit/passwordField/StrengthMeter';
import type { PasswordStrength } from '../../../../src/utilities/passwordStrength';

// Kit component (BDT: Interaction tier → unit): it only draws a reading, so
// nothing is a stand-in.

/**
 * Renders the meter for a reading and returns its bars.
 *
 * @param reading - The reading to draw.
 * @returns The four bars.
 */
const barsOf = (reading: PasswordStrength) => {
  const { container } = render(
    <StrengthMeter reading={reading} caption="Legenda" captionId="cap" />,
  );
  return Array.from(container.querySelectorAll('[aria-hidden="true"] > span'));
};

describe('StrengthMeter', () => {
  it.each([
    [{ level: 'too_short', segments: 0, hint: 'add_length' }, 0],
    [{ level: 'weak', segments: 1, hint: 'avoid_common' }, 1],
    [{ level: 'fair', segments: 2, hint: 'avoid_dates' }, 2],
    [{ level: 'good', segments: 3, hint: 'add_length' }, 3],
    [{ level: 'strong', segments: 4 }, 4],
  ] as const)('fills as many of its four bars as the reading says (%o)', (reading, filled) => {
    const bars = barsOf(reading);

    expect(bars).toHaveLength(4);
    bars.forEach((bar, index) => {
      expect(bar.className).toBe(barClasses(index < filled, reading.level));
    });
  });

  it('shows the caption under the id the input points at, and hides the bars', () => {
    const { container } = render(
      <StrengthMeter
        reading={{ level: 'strong', segments: 4 }}
        caption="Forte · pelo menos 12 caracteres"
        captionId="cap"
      />,
    );

    expect(screen.getByText('Forte · pelo menos 12 caracteres').id).toBe('cap');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('barClasses', () => {
  it.each([
    ['weak', 'bg-coral'],
    ['fair', 'bg-sun'],
    ['good', 'bg-mint'],
    ['strong', 'bg-mint'],
    ['too_short', 'bg-line'],
  ] as const)('fills a %s bar with %s', (level, colour) => {
    expect(barClasses(true, level)).toContain(colour);
  });

  it('draws an empty bar in the line colour, whatever the level', () => {
    expect(barClasses(false, 'strong')).toContain('bg-line');
    expect(barClasses(false, 'strong')).not.toContain('bg-mint');
  });
});
