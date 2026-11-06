import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LineChart, type LineChartProps, type LinePoint } from '../../../src/kit/lineChart/LineChart';

// The kit's line chart (K38, OQ-229). Hover, tap or tab to a plot and use the
// arrows: a crosshair snaps to the nearest value and a chip reads it.

/**
 * Builds a value.
 *
 * @param date - Its day.
 * @param value - Its value.
 * @param valueLabel - The value, written out.
 * @returns The point.
 */
const point = (date: string, value: number, valueLabel: string): LinePoint => ({
  key: date,
  date,
  value,
  valueLabel,
  dateLabel: date.split('-').reverse().join('/'),
});

const NET_WORTH = [
  point('2026-04-30', 12400, '$12,400.00'),
  point('2026-05-31', 13800, '$13,800.00'),
  point('2026-06-30', 15100, '$15,100.00'),
  point('2026-07-31', 16900, '$16,900.00'),
  point('2026-08-31', 19130, '$19,130.00'),
  point('2026-09-30', 21540, '$21,540.00'),
];

const VALUE_HISTORY = [
  point('2026-04-30', 108000, 'R$108,000.00'),
  point('2026-05-31', 111000, 'R$111,000.00'),
  point('2026-06-30', 107000, 'R$107,000.00'),
  point('2026-07-31', 113500, 'R$113,500.00'),
  point('2026-08-31', 110000, 'R$110,000.00'),
];

const SELIC = [
  point('2026-04-30', 10.75, '10.75%'),
  point('2026-05-31', 10.75, '10.75%'),
  point('2026-06-30', 10.5, '10.50%'),
  point('2026-07-31', 10.5, '10.50%'),
  point('2026-08-31', 10.5, '10.50%'),
  point('2026-09-30', 10.5, '10.50%'),
];

const INVESTED = { value: 110000, label: 'invested R$110k' };

const meta = {
  title: 'Kit/LineChart',
  component: LineChart,
  decorators: [(Story) => <div className="max-w-xl rounded-card bg-card p-6"><Story /></div>],
  args: {
    points: VALUE_HISTORY,
    ariaLabel: 'Market value history',
    tone: 'lilac',
    reference: INVESTED,
  },
} satisfies Meta<LineChartProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Net worth on the Dashboard (mockup 20): a smooth curve over a grid. */
export const NetWorth: Story = {
  args: {
    points: NET_WORTH,
    ariaLabel: 'Net worth in USD',
    tone: 'mint',
    shape: 'trend',
    grid: true,
    heightPx: 150,
    reference: undefined,
  },
};

/** A Holding's market value (mockup 51): every saved value marked, against what was invested. */
export const MarketValue: Story = {};

/** A rate's history (mockup 53): its lowest and highest values on dashed lines. */
export const RateHistory: Story = {
  args: {
    points: SELIC,
    ariaLabel: 'Selic history',
    tone: 'sky',
    showRange: true,
    reference: undefined,
  },
};

/**
 * Draws the editor's use: a picked value, with a click moving the pick.
 *
 * @param props - The chart's props.
 * @returns The chart, holding the pick as K46 will.
 */
function EditingChart(props: LineChartProps) {
  const [selectedKey, setSelectedKey] = useState('2026-07-31');
  return (
    <LineChart
      {...props}
      selectedKey={selectedKey}
      selectedLabel={`${selectedKey} · editing`}
      onSelect={setSelectedKey}
    />
  );
}

/** Editing a saved value (mockup 52): a crosshair and its pill; a press picks the nearest value. */
export const EditingAValue: Story = {
  args: { heightPx: 150 },
  render: EditingChart,
};

/** Markers too close to aim at: a press picks what the chip shows, whichever lies on top. */
export const DenseHistory: Story = {
  args: {
    reference: undefined,
    points: Array.from({ length: 60 }, (_, index) => {
      const year = 2022 + Math.floor(index / 12);
      const date = `${year}-${String((index % 12) + 1).padStart(2, '0')}-15`;
      return point(date, 100 + ((index * 7) % 40), `R$${index}`);
    }),
  },
  render: EditingChart,
};

/** A value about to be saved (mockup 52): a dashed ring and segment, its month in mint. */
export const AboutToSave: Story = {
  args: { pending: { date: '2026-09-30', value: 118000 }, surface: 'bg' },
  decorators: [(Story) => <div className="max-w-xl rounded-card bg-bg p-6"><Story /></div>],
};

/** A value that can't be picked has no button: a transaction's snapshot (OQ-56). */
export const TransactionSnapshot: Story = {
  args: {
    onSelect: () => {},
    points: VALUE_HISTORY.map((value, index) => ({ ...value, selectable: index > 1 })),
  },
};

/** The sparkline: the line alone, not interactive. */
export const Sparkline: Story = {
  args: {
    points: NET_WORTH,
    ariaLabel: 'Net worth in USD',
    tone: 'mint',
    shape: 'trend',
    compact: true,
    reference: undefined,
  },
};

/** A lone value: only a dot. */
export const LoneValue: Story = {
  args: { points: VALUE_HISTORY.slice(0, 1), reference: undefined },
};

/** Two years of rates: the labels thin out and name the year where it changes. */
export const LongHistory: Story = {
  args: {
    points: Array.from({ length: 25 }, (_, index) => {
      const year = 2024 + Math.floor(index / 12);
      const month = String((index % 12) + 1).padStart(2, '0');
      return point(`${year}-${month}-28`, 10 + Math.sin(index / 3), `${10 + index}%`);
    }),
    ariaLabel: 'Selic history',
    tone: 'sky',
    reference: undefined,
  },
};

/** Irregular dates: a long gap looks long. */
export const IrregularDates: Story = {
  args: {
    points: [
      point('2026-01-10', 100, 'R$100.00'),
      point('2026-01-17', 104, 'R$104.00'),
      point('2026-02-01', 98, 'R$98.00'),
      point('2026-09-20', 130, 'R$130.00'),
    ],
    reference: undefined,
  },
};
