import type { Meta, StoryObj } from '@storybook/react-vite';
import { StackedBarChart, type BarSeries } from '../../../src/kit/stackedBarChart/StackedBarChart';

// The kit's stacked bar chart (K39, OQ-230). Hover or tap a bar, or tab to the
// plot and press Enter or an arrow: the month comes to full strength and a chip
// lists what each series paid.

const MONTHS = [
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
  '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
];

/**
 * Builds a Holding's payouts: the same each month, from a month on.
 *
 * @param label - Its ticker.
 * @param amount - What it pays a month, in minor units.
 * @param from - How many months in it starts paying.
 * @returns The series.
 */
const holding = (label: string, amount: number, from = 0): BarSeries => ({
  key: label,
  label,
  amounts: MONTHS.slice(from).map((month, index) => ({
    month,
    amount: amount + index * 100,
  })),
});

const PORTFOLIO = [
  holding('XPML11', 85000, 6),
  holding('HGLG11', 31000),
  holding('KNRI11', 19500),
  holding('MXRF11', 15000),
  holding('VISC11', 12000),
  holding('BTLG11', 8000),
  holding('VALE3', 2500),
];

const brl = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' });

const meta: Meta<typeof StackedBarChart> = {
  title: 'Kit/StackedBarChart',
  component: StackedBarChart,
  args: {
    months: MONTHS,
    ariaLabel: 'Payout per month',
    formatValue: (amount: number) => brl.format(amount / 100),
  },
};
export default meta;

type Story = StoryObj<typeof StackedBarChart>;

/** Mockup 50: five Holdings in colour, two grouped as Others. */
export const TopFiveAndOthers: Story = { args: { series: PORTFOLIO } };

/** Fewer series than colours: no Others. */
export const FewSeries: Story = { args: { series: PORTFOLIO.slice(0, 2) } };

/** A window too long to name its months: labels thin out and turn numeric. */
export const LongWindow: Story = {
  args: {
    months: Array.from({ length: 36 }, (_, index) => {
      const year = 2024 + Math.floor(index / 12);
      return `${year}-${String((index % 12) + 1).padStart(2, '0')}`;
    }),
    series: PORTFOLIO,
  },
};
