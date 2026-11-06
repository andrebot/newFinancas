import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { stackedBarChart } from '../../../../src/config/constants';
import { StackedBarChart, type StackedBarChartProps } from '../../../../src/kit/stackedBarChart/StackedBarChart';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): the translator, the model and the
// readout hook run for real. jsdom lays nothing out, so a test gives the plot its box.

const MONTHS = ['2026-07', '2026-08', '2026-09'];

const SERIES = [
  {
    key: 'x',
    label: 'XPML11',
    amounts: [{ month: '2026-07', amount: 100 }, { month: '2026-09', amount: 300 }],
  },
  {
    key: 'h',
    label: 'HGLG11',
    amounts: [{ month: '2026-08', amount: 200 }],
  },
];

/**
 * Writes an amount.
 *
 * @param amount - In minor units.
 * @returns It, as text.
 */
const formatValue = (amount: number) => `R$${amount}`;

/**
 * Renders the chart.
 *
 * @param props - What to change in the defaults.
 * @param locale - The interface language.
 * @returns The render's result.
 */
const renderChart = (
  props: Partial<StackedBarChartProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => renderInLocale(
  <StackedBarChart
    months={MONTHS}
    series={SERIES}
    ariaLabel="Payout per month"
    formatValue={formatValue}
    {...props}
  />,
  locale,
);

/**
 * Takes the plot, with a 300px-wide box at the page's left.
 *
 * @returns The plot.
 */
const plotBox = () => {
  const plot = screen.getByRole('group', { name: 'Payout per month' });
  plot.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
  return plot;
};

describe('StackedBarChart', () => {
  it('renders nothing when nothing was paid', () => {
    const { container } = renderChart({ series: [] });
    expect(container.firstChild).toBeNull();
  });

  it('draws one bar per month, with a segment per amount', () => {
    renderChart();
    expect(screen.getAllByTestId('stacked-bar')).toHaveLength(3);
    expect(screen.getAllByTestId('stacked-bar-segment')).toHaveLength(3);
  });

  it('colours a segment and gives it its height', () => {
    renderChart({ series: [SERIES[0]!] });
    const [segment] = screen.getAllByTestId('stacked-bar-segment');
    expect(segment?.getAttribute('style')).toContain('var(--c-cat-lilac)');
    expect(segment?.style.height).toBe(`${(100 / 300) * 87}%`);
  });

  it('uses the mockup height', () => {
    renderChart();
    expect(plotBox().style.height).toBe('170px');
  });

  it('stacks from the bottom, the first group lowest', () => {
    renderChart();
    expect(screen.getAllByTestId('stacked-bar')[0]?.className).toContain('flex-col-reverse');
  });

  it('keeps a gap between segments out of their own height', () => {
    renderChart();
    const [segment] = screen.getAllByTestId('stacked-bar-segment');
    expect(segment?.className).toContain('border-transparent');
    expect(segment?.className).toContain('bg-clip-padding');
  });

  it('hides the wrapper, not the table, so its width stays out of the page', () => {
    renderChart();
    const table = screen.getByRole('table', { name: 'Payout per month' });
    expect(table.className).toBe('');
    expect(table.parentElement?.className).toContain('sr-only');
  });

  it('lists the legend, largest first', () => {
    renderChart();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['XPML11', 'HGLG11']);
  });

  it('names Others in the interface language', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({
      key,
      label: key,
      amounts: [{ month: '2026-09', amount: 10 }],
    }));
    renderChart({ series: many }, 'pt-BR');
    expect(within(screen.getByRole('list')).getByText('Outros (1)')).not.toBeNull();
  });

  it('puts the newest month at full strength and in mint', () => {
    renderChart();
    const bars = screen.getAllByTestId('stacked-bar');
    expect(bars[0]?.className).toContain('opacity-55');
    expect(bars[2]?.className).not.toContain('opacity-55');
    expect(screen.getByText('Sep')?.className).toContain('text-mint');
    expect(screen.getByText('Jul')?.className).toContain('text-muted');
  });

  it('lets every other label give way on a narrow plot', () => {
    const months = Array.from({ length: 12 }, (_, index) => (
      `2026-${String(index + 1).padStart(2, '0')}`
    ));
    renderChart({ months });
    expect(screen.getByText('Nov').className).toContain('@max-md:hidden');
    expect(screen.getByText('Dec').className).not.toContain('@max-md:hidden');
  });

  it('writes a long window numerically', () => {
    const months = Array.from({ length: 13 }, (_, index) => (
      `${2025 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
    ));
    const amounts = [{ month: '2026-01', amount: 5 }];
    renderChart({ months, series: [{ key: 'a', label: 'a', amounts }] });
    expect(screen.getByText('01/26')).not.toBeNull();
  });

  it('reads the month under the pointer and ends as a mouse leaves', () => {
    renderChart();
    const plot = plotBox();
    fireEvent.pointerMove(plot, { clientX: 10 });
    const chip = screen.getByTestId('stacked-bar-readout');
    expect(chip.textContent).toContain('July 2026');
    expect(chip.textContent).toContain('R$100');
    expect(chip.textContent).toContain('XPML11');
    expect(chip.textContent).not.toContain('HGLG11');
    expect(screen.getAllByTestId('stacked-bar')[0]?.className).not.toContain('opacity-55');
    expect(screen.getAllByTestId('stacked-bar')[2]?.className).toContain('opacity-55');
    expect(screen.getByText('Jul')?.className).toContain('text-mint');
    fireEvent.pointerLeave(plot, { pointerType: 'mouse' });
    expect(screen.queryByTestId('stacked-bar-readout')).toBeNull();
  });

  it('places the chip on the side with more room', () => {
    renderChart();
    const plot = plotBox();
    fireEvent.pointerMove(plot, { clientX: 10 });
    const { barSlotShare, maxBarWidthPercent, readoutGapPx } = stackedBarChart;
    const width = Math.min(maxBarWidthPercent, (barSlotShare * 100) / (2 + barSlotShare));
    const chip = screen.getByTestId('stacked-bar-readout');
    expect(chip.getAttribute('style')).toContain(`left: min(${width}% + ${readoutGapPx}px`);
    expect(chip.getAttribute('style')).toContain('100% - 12rem');
    fireEvent.pointerMove(plot, { clientX: 290 });
    expect(screen.getByTestId('stacked-bar-readout').getAttribute('style'))
      .toContain(`right: min(${width}% + ${readoutGapPx}px`);
  });

  it('keeps a tap readable: a press picks nothing and ends nothing', () => {
    renderChart();
    const plot = plotBox();
    fireEvent.pointerDown(plot, { clientX: 150, pointerType: 'touch' });
    fireEvent.click(plot, { clientX: 150 });
    expect(screen.getByTestId('stacked-bar-readout').textContent).toContain('August 2026');
  });

  it('reads from the keyboard, starting at the newest, and announces it', () => {
    renderChart();
    const plot = plotBox();
    expect(plot.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    expect(screen.getByTestId('stacked-bar-readout').textContent).toContain('September 2026');
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    expect(screen.getByTestId('stacked-bar-readout').textContent).toContain('August 2026');
    const spoken = screen.getByText('August 2026 R$200, HGLG11 R$200');
    expect(spoken.getAttribute('aria-live')).toBe('polite');
    fireEvent.keyDown(plot, { key: 'Escape' });
    expect(screen.queryByTestId('stacked-bar-readout')).toBeNull();
  });

  it('lists every amount in a hidden table, zeros included', () => {
    renderChart();
    const table = screen.getByRole('table', { name: 'Payout per month' });
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['Month', 'XPML11', 'HGLG11', 'Total']);
    const august = within(table).getByRole('row', { name: /August 2026/ });
    expect(within(august).getAllByRole('cell').map((cell) => cell.textContent))
      .toEqual(['R$0', 'R$200', 'R$200']);
  });
});
