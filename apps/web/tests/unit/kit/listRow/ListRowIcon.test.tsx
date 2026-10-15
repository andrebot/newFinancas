import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ListRowIcon, listRowIconClasses } from '../../../../src/kit/listRow/ListRowIcon';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('listRowIconClasses', () => {
  it('draws a centred circle', () => {
    expect(listRowIconClasses('neutral', 'md'))
      .toContain('grid shrink-0 place-items-center rounded-full');
  });

  it('tints each tone with its own ink', () => {
    expect(listRowIconClasses('neutral', 'md')).toContain('bg-ink/5 text-muted');
    expect(listRowIconClasses('mint', 'md')).toContain('bg-mint/15 text-mint');
    expect(listRowIconClasses('sky', 'md')).toContain('bg-sky/15 text-sky');
    expect(listRowIconClasses('sun', 'md')).toContain('bg-sun/15 text-sun');
    expect(listRowIconClasses('lilac', 'md')).toContain('bg-lilac/15 text-lilac');
  });

  it('sizes the circle and glyph: 40px for rows, 36px for dense lists', () => {
    expect(listRowIconClasses('neutral', 'md')).toContain('size-10 text-xl');
    expect(listRowIconClasses('neutral', 'sm')).toContain('size-9 text-lg');
  });
});

describe('ListRowIcon', () => {
  it('draws the glyph in a neutral medium circle by default, hidden from screen readers', () => {
    const { container } = render(<ListRowIcon icon="mail-outline" />);

    const circle = container.firstElementChild!;
    expect(circle.getAttribute('aria-hidden')).toBe('true');
    expect(circle.className).toBe(listRowIconClasses('neutral', 'md'));
    expect(circle.querySelector('svg')).not.toBeNull();
  });

  it('takes its tone and size', () => {
    const { container } = render(<ListRowIcon icon="laptop-mac-outline" tone="mint" size="sm" />);

    expect(container.firstElementChild!.className).toBe(listRowIconClasses('mint', 'sm'));
  });
});
