import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from '../../../../src/kit/icons/Icon';
import { GLYPHS } from '../../../../src/kit/icons/generated/iconData';
import svgMarkup from './svgMarkup';

// Kit component (BDT: Interaction tier → unit, nothing mocked): the real
// generated registry is the only data it reads.

describe('Icon', () => {
  it('draws the named glyph in a 1em square, 24 × 24 view box', () => {
    const { container } = render(<Icon name="add" />);
    const svg = container.querySelector('svg')!;

    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('width')).toBe('1em');
    expect(svg.getAttribute('height')).toBe('1em');
    expect(svg.innerHTML).toBe(svgMarkup(GLYPHS.add));
  });

  it('is hidden from assistive technology without a label', () => {
    const { container } = render(<Icon name="close" />);

    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('is an image named by its label', () => {
    render(<Icon name="notifications-outline" label="Notificações" />);

    expect(screen.getByRole('img', { name: 'Notificações' })).toBeDefined();
  });

  it('passes classes through, so utilities set its size and colour', () => {
    const { container } = render(<Icon name="pets" className="size-5 text-mint" />);

    expect(container.querySelector('svg')!.getAttribute('class')).toBe('size-5 text-mint');
  });
});
