import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandMark } from '../../../../src/kit/brand/BrandMark';
import { brand } from '../../../../src/config/constants';

// Kit component (BDT: Interaction tier → unit): nothing mocked; the real Icon
// draws the tile's glyph.

describe('BrandMark', () => {
  it("shows the product's name beside a decorative tile", () => {
    const { container } = render(<BrandMark />);

    expect(screen.getByText(brand.name)).toBeTruthy();
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws the 32px tile by default and the 40px one at lg', () => {
    const { container: medium } = render(<BrandMark />);
    const { container: large } = render(<BrandMark size="lg" />);

    expect(medium.querySelector('svg')!.parentElement!.className).toContain('size-8');
    expect(large.querySelector('svg')!.parentElement!.className).toContain('size-10');
    expect(screen.getAllByText(brand.name)[1]!.className).toContain('type-heading-sm');
  });
});
