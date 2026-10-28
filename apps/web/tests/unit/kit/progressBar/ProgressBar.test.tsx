import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  FILL_MOTION,
  PILL_LABEL,
  PILL_TRACK,
  ProgressBar,
  THIN_TRACK,
  clampSegments,
  isThin,
} from '../../../../src/kit/progressBar/ProgressBar';

// Kit component (BDT: Interaction tier → unit): display only, nothing to
// stand in for.

/**
 * Finds the progress bar by its accessible name.
 *
 * @param name - The bar's accessible name.
 * @returns The progress bar element.
 */
const barNamed = (name: string) => screen.getByRole('progressbar', { name });

/**
 * Takes one child of an element.
 *
 * @param element - The parent.
 * @param index - The child's position.
 * @returns The child element.
 */
const childAt = (element: Element, index: number) => element.children.item(index) as HTMLElement;

describe('clampSegments', () => {
  it('keeps segments that fit together', () => {
    expect(clampSegments([{ value: 60 }, { value: 25 }])).toEqual([60, 25]);
  });

  it('cuts the segment that passes 100% and gives later ones no width', () => {
    expect(clampSegments([{ value: 70 }, { value: 50 }, { value: 10 }])).toEqual([70, 30, 0]);
  });

  it('holds each segment to 0–100 first', () => {
    expect(clampSegments([{ value: -10 }, { value: 150 }])).toEqual([0, 100]);
  });

  it('has no widths without segments', () => {
    expect(clampSegments([])).toEqual([]);
  });
});

describe('isThin', () => {
  it('is true only for the thin bar', () => {
    expect(isThin({ size: 'thin', segments: [], ariaLabel: 'Bar' })).toBe(true);
    expect(isThin({ size: 'pill', value: 1, ariaLabel: 'Bar' })).toBe(false);
    expect(isThin({ value: 1, ariaLabel: 'Bar' })).toBe(false);
  });
});

describe('ProgressBar — pill', () => {
  it('is a progress bar from 0 to 100, its text as the value text', () => {
    render(<ProgressBar value={32} label="$3,200.00 / $10,000.00" ariaLabel="Emergency Fund" />);

    const bar = barNamed('Emergency Fund');
    expect(bar.className).toBe(PILL_TRACK);
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('32');
    expect(bar.getAttribute('aria-valuetext')).toBe('$3,200.00 / $10,000.00');
  });

  it('fills to the value in sky by default, animating the width', () => {
    render(<ProgressBar value={57} ariaLabel="House" />);
    const fill = barNamed('House').firstElementChild as HTMLElement;

    expect(fill.style.width).toBe('57%');
    expect(fill.className).toContain('bg-sky');
    expect(fill.className).toContain(FILL_MOTION);
  });

  it('holds the fill to 100% for an overfunded goal, rounding the reported value', () => {
    const { rerender } = render(<ProgressBar value={112} ariaLabel="Laptop" />);
    const bar = barNamed('Laptop');
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('100%');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');

    rerender(<ProgressBar value={33.4} ariaLabel="Laptop" />);
    expect(bar.getAttribute('aria-valuenow')).toBe('33');
  });

  it('writes its text twice: ink over the track, the dark ink clipped to the fill', () => {
    render(<ProgressBar value={32} label="$3,200.00 / $10,000.00" ariaLabel="Emergency Fund" />);
    const bar = barNamed('Emergency Fund');
    const onTrack = childAt(bar, 1);
    const onFill = childAt(bar, 2);

    expect(onTrack.textContent).toBe('$3,200.00 / $10,000.00');
    expect(onTrack.className).toBe(`${PILL_LABEL} text-ink`);
    expect(onTrack.getAttribute('aria-hidden')).toBe('true');
    expect(onFill.className).toBe(`${PILL_LABEL} text-onsky`);
    expect(onFill.style.clipPath).toBe('inset(0 68% 0 0)');
    expect(onFill.getAttribute('aria-hidden')).toBe('true');
  });

  it('centres its text in the pill', () => {
    expect(PILL_LABEL).toContain('justify-center');
  });

  it('turns mint, with the mint ink on the fill, for a completed goal', () => {
    render(<ProgressBar value={100} label="$2,000.00 / $2,000.00" tone="mint" ariaLabel="Done" />);
    const bar = barNamed('Done');
    const fill = childAt(bar, 0);
    const onFill = childAt(bar, 2);

    expect(fill.className).toContain('bg-mint');
    expect(onFill.className).toContain('text-onmint');
  });

  it('draws only the fill without a label, and has no value text', () => {
    render(<ProgressBar size="pill" value={0} ariaLabel="Not funded" />);
    const bar = barNamed('Not funded');

    expect(bar.children).toHaveLength(1);
    expect(bar.hasAttribute('aria-valuetext')).toBe(false);
  });
});

describe('ProgressBar — thin', () => {
  it('draws its segments side by side and reports their total', () => {
    render(
      <ProgressBar
        size="thin"
        segments={[{ value: 60 }, { value: 25, tone: 'skysoft' }]}
        ariaLabel="Allocated"
        ariaValueText="85% allocated · 15% free"
      />,
    );
    const bar = barNamed('Allocated');
    const first = childAt(bar, 0);
    const second = childAt(bar, 1);

    expect(bar.className).toBe(THIN_TRACK);
    expect(bar.getAttribute('aria-valuenow')).toBe('85');
    expect(bar.getAttribute('aria-valuetext')).toBe('85% allocated · 15% free');
    expect(first.style.width).toBe('60%');
    expect(first.className).toContain('bg-sky');
    expect(first.className).toContain(FILL_MOTION);
    expect(second.style.width).toBe('25%');
    expect(second.className).toContain('bg-sky/60');
  });

  it('never passes 100% in total', () => {
    render(
      <ProgressBar
        size="thin"
        segments={[{ value: 80 }, { value: 40, tone: 'mint' }]}
        ariaLabel="Over"
      />,
    );
    const bar = barNamed('Over');
    const second = bar.lastElementChild as HTMLElement;

    expect(second.style.width).toBe('20%');
    expect(second.className).toContain('bg-mint');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('is an empty track with no segments', () => {
    render(<ProgressBar size="thin" segments={[]} ariaLabel="Nothing" />);
    const bar = barNamed('Nothing');

    expect(bar.children).toHaveLength(0);
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
  });
});
