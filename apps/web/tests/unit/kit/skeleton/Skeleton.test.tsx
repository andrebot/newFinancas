import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { skeleton } from '../../../../src/config/constants';
import { Skeleton, SkeletonRows, skeletonClasses } from '../../../../src/kit/skeleton/Skeleton';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

/**
 * Counts the rows drawn inside the loading region.
 *
 * @param region - The status region SkeletonRows renders.
 * @returns How many rows it holds.
 */
const rowCount = (region: HTMLElement) => region.children.length;

describe('skeletonClasses', () => {
  it('draws a pulsing raised shape that stops pulsing for reduced motion', () => {
    expect(skeletonClasses('line')).toBe('bg-raised motion-safe:animate-pulse h-3 rounded');
  });

  it('rounds each shape its own way', () => {
    expect(skeletonClasses('circle')).toContain('rounded-full');
    expect(skeletonClasses('block')).toContain('rounded-2xl');
  });

  it('appends the caller’s size classes', () => {
    expect(skeletonClasses('circle', 'size-9'))
      .toBe('bg-raised motion-safe:animate-pulse rounded-full size-9');
  });
});

describe('Skeleton', () => {
  it('is a text line hidden from screen readers by default', () => {
    const { container } = render(<Skeleton className="w-16" />);

    const shape = container.firstElementChild!;
    expect(shape.getAttribute('aria-hidden')).toBe('true');
    expect(shape.className).toBe(skeletonClasses('line', 'w-16'));
  });

  it('draws the shape it is given', () => {
    const { container } = render(<Skeleton shape="block" />);

    expect(container.firstElementChild!.className).toBe(skeletonClasses('block'));
  });
});

describe('SkeletonRows', () => {
  it('is one busy status region named by its label', () => {
    render(<SkeletonRows label="Carregando transações" />);

    const region = screen.getByRole('status', { name: 'Carregando transações' });
    expect(region.getAttribute('aria-busy')).toBe('true');
  });

  it('draws the configured number of rows by default', () => {
    render(<SkeletonRows label="Carregando" />);

    expect(rowCount(screen.getByRole('status'))).toBe(skeleton.rows);
  });

  it('draws as many rows as asked, alternating the line widths', () => {
    render(<SkeletonRows label="Carregando" count={3} />);

    const rows = [...screen.getByRole('status').children];
    const titleWidth = (row: Element) => row.children[1]!.firstElementChild!.className;
    expect(rows).toHaveLength(3);
    expect(titleWidth(rows[0]!)).toContain('w-2/5');
    expect(titleWidth(rows[1]!)).toContain('w-1/3');
    expect(titleWidth(rows[2]!)).toContain('w-2/5');
  });

  it('draws each row as an avatar, two lines and an amount', () => {
    render(<SkeletonRows label="Carregando" count={1} />);

    const row = screen.getByRole('status').firstElementChild!;
    const [avatar, lines, amount] = [...row.children];
    expect(avatar!.className).toBe(skeletonClasses('circle', 'size-9'));
    expect(lines!.children).toHaveLength(2);
    expect(lines!.children[1]!.className).toContain('opacity-70');
    expect(amount!.className).toBe(skeletonClasses('line', 'w-16'));
  });
});
