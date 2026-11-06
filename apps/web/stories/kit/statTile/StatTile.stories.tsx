import type { Meta, StoryObj } from '@storybook/react-vite';
import type { LinePoint } from '../../../src/kit/lineChart/LineChart';
import { StatTile } from '../../../src/kit/statTile/StatTile';

// The kit's Stat tile (K37, OQ-231): net worth for one currency, with its change
// against the previous month and a chart whose months can be read.

const MONTHS = [
  ['2026-04-30', 'Apr'], ['2026-05-31', 'May'], ['2026-06-30', 'Jun'],
  ['2026-07-31', 'Jul'], ['2026-08-31', 'Aug'], ['2026-09-30', 'Sep'],
] as const;

/**
 * Builds a net worth series over the months above.
 *
 * @param values - A value per month, in major units.
 * @param symbol - The currency's symbol.
 * @returns The series.
 */
const series = (values: readonly number[], symbol: string): LinePoint[] => MONTHS.map(
  ([date, dateLabel], index) => {
    const value = values[index] ?? 0;
    return {
      key: date, date, dateLabel, value, valueLabel: `${symbol}${value.toLocaleString('en-US')}`,
    };
  },
);

const USD_POINTS = series([12400, 13300, 14600, 15700, 16720, 19130], '$');
const BRL_POINTS = series([281000, 295000, 309000, 318000, 327400, 358600], 'R$');

const meta: Meta<typeof StatTile> = {
  title: 'Kit/StatTile',
  component: StatTile,
  args: {
    label: 'Net worth · USD',
    amount: 1913000,
    currency: 'USD',
    change: { amount: 241000, comparedTo: 'Aug' },
    points: USD_POINTS,
  },
};
export default meta;

type Story = StoryObj<typeof StatTile>;

/** Mockup 50: a rise, in USD. */
export const Rise: Story = {};

/** Mockup 20's chart: taller, with gridlines, in BRL. */
export const DashboardBrl: Story = {
  args: {
    label: 'Net worth · BRL',
    amount: 35860000,
    currency: 'BRL',
    change: { amount: 3120000, comparedTo: 'Aug' },
    points: BRL_POINTS,
    chartHeightPx: 150,
    grid: true,
  },
};

/** A fall: coral with a down arrow. */
export const Fall: Story = { args: { change: { amount: -241000, comparedTo: 'Aug' } } };

/** No change: a neutral pill with no arrow. */
export const Unchanged: Story = { args: { change: { amount: 0, comparedTo: 'Aug' } } };

/** No previous month to compare against: no pill. */
export const NoChange: Story = { args: { change: undefined } };

/** A large figure, for the narrow tile: the number shrinks and the pill wraps. */
export const LargeFigure: Story = {
  args: {
    label: 'Net worth · BRL',
    amount: 135860000,
    currency: 'BRL',
    change: { amount: 3120000, comparedTo: 'Aug' },
    points: BRL_POINTS,
  },
};

/** No series yet: the figure alone. */
export const NoSeries: Story = { args: { points: [], change: undefined } };
