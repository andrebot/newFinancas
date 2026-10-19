import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CategoryChip,
  CategoryDisc,
  chipClasses,
  discClasses,
  discStyle,
} from '../../../../src/kit/categoryChip/CategoryChip';
import { categoryColor, categoryTint } from '../../../../src/utilities/theme';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('discClasses', () => {
  it('draws a round disc that centres its icon and never shrinks', () => {
    expect(discClasses('md')).toContain('grid shrink-0 place-items-center rounded-full');
  });

  it.each([
    ['pill', 'size-5'],
    ['xs', 'size-6'],
    ['sm', 'size-8'],
    ['md', 'size-9'],
    ['lg', 'size-10'],
  ] as const)('sizes the %s disc as the mockups do', (size, classes) => {
    expect(discClasses(size).split(' ')).toContain(classes);
  });

  it('appends the caller’s classes', () => {
    expect(discClasses('md', 'mr-2').endsWith(' mr-2')).toBe(true);
  });
});

describe('chipClasses', () => {
  it('draws the raised 30px pill that never wraps', () => {
    expect(chipClasses()).toContain('inline-flex h-7.5 shrink-0 items-center');
    expect(chipClasses()).toContain('whitespace-nowrap rounded-full bg-raised');
  });

  it('appends the caller’s classes', () => {
    expect(chipClasses('w-fit').endsWith(' w-fit')).toBe(true);
  });
});

describe('discStyle', () => {
  it('paints the icon in the category’s colour on its tint', () => {
    expect(discStyle('sun')).toEqual({
      color: categoryColor('sun'),
      backgroundColor: categoryTint('sun'),
    });
  });
});

describe('CategoryDisc', () => {
  it('is a decorative medium disc by default', () => {
    const { container } = render(<CategoryDisc icon="restaurant" color="sun" />);

    const disc = container.firstElementChild as HTMLElement;
    expect(disc.getAttribute('aria-hidden')).toBe('true');
    expect(disc.className).toBe(discClasses('md'));
    expect(disc.querySelector('svg')!.getAttribute('class')).toBe('size-4.5');
  });

  it('carries the category’s colours inline, so they follow the theme', () => {
    const { container } = render(<CategoryDisc icon="restaurant" color="sun" />);

    const disc = container.firstElementChild as HTMLElement;
    expect(disc.style.color).toBe('var(--c-cat-sun)');
    expect(disc.getAttribute('style')).toContain('background-color');
  });

  it.each([
    ['xs', 'size-3.5'],
    ['sm', 'size-4'],
    ['lg', 'size-5'],
  ] as const)('sizes the %s disc and its icon', (size, iconClasses) => {
    const { container } = render(
      <CategoryDisc icon="pets" color="teal" size={size} className="ml-1" />,
    );

    const disc = container.firstElementChild as HTMLElement;
    expect(disc.className).toBe(discClasses(size, 'ml-1'));
    expect(disc.querySelector('svg')!.getAttribute('class')).toBe(iconClasses);
  });
});

describe('CategoryChip', () => {
  it('names the category beside its small decorative disc', () => {
    const { container } = render(
      <CategoryChip name="Mercado" icon="shopping-cart-outline" color="mint" />,
    );

    const chip = container.firstElementChild as HTMLElement;
    const disc = chip.firstElementChild as HTMLElement;
    expect(chip.className).toBe(chipClasses());
    expect(chip.textContent).toBe('Mercado');
    expect(disc.className).toBe(discClasses('pill'));
    expect(disc.getAttribute('aria-hidden')).toBe('true');
    expect(disc.style.color).toBe('var(--c-cat-mint)');
    expect(disc.querySelector('svg')!.getAttribute('class')).toBe('size-3');
  });

  it('takes extra classes', () => {
    render(
      <CategoryChip name="Shopping" icon="shopping-bag-outline" color="lilac" className="w-fit" />,
    );

    expect(screen.getByText('Shopping').className).toBe(chipClasses('w-fit'));
  });
});
