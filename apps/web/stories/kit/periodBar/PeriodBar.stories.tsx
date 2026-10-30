import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Amount } from '../../../src/kit/amount/Amount';
import { PeriodBar, type PeriodBarProps } from '../../../src/kit/periodBar/PeriodBar';
import type { Period, PeriodMonth } from '../../../src/kit/periodBar/periodBar';

// The period bar (K40, OQ-216): mockup 30's card from `xl` up, mockup 34's
// month stepper below it — narrow the viewport to see it. Below `sm` the
// months become a swiped strip: faded where more months hide, and a mouse
// wheel over it scrolls it sideways.
// It holds no state, so the story keeps the selected month; months after
// today's are disabled. The summary is the caller's: here a stand-in for
// Month Overview's In / Out / Total.

const TODAY = new Date();
const THIS_YEAR = TODAY.getFullYear();
const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** A year of sample figures, in cents: steady income, varying spend. */
const SAMPLE: readonly PeriodMonth[] = [
  260000, 220000, 360000, 240000, 280000, 400000, 300000, 240000, 166278, 290000, 310000, 350000,
].map((out, index) => ({ month: index + 1, in: index === 4 ? 360000 : 320000, out }));

/**
 * Stands in for Month Overview's summary: the month's In, Out and Total.
 *
 * @param props - The month's figures.
 * @returns The summary.
 */
function Summary({ figures }: { figures: PeriodMonth | undefined }) {
  const income = figures?.in ?? 0;
  const spend = figures?.out ?? 0;
  return (
    <div className="grid grid-cols-3 gap-2 type-body-sm xl:flex xl:flex-col">
      <span className="flex flex-col xl:flex-row xl:justify-between xl:gap-6">
        In
        <Amount amount={income} currency="USD" tone="signed" />
      </span>
      <span className="flex flex-col xl:flex-row xl:justify-between xl:gap-6">
        Out
        <Amount amount={-spend} currency="USD" tone="signed" />
      </span>
      <span className="flex flex-col font-semibold xl:flex-row xl:justify-between xl:gap-6">
        Total
        <Amount amount={income - spend} currency="USD" sign="always" />
      </span>
    </div>
  );
}

/**
 * Renders the bar with its selected month kept locally, starting from the
 * `period` arg, so months and arrows move it.
 *
 * @param props - The story's args: the starting month, the change handler and the rest.
 * @returns The interactive bar.
 */
function Interactive({
  period: initial, onChange, months, ...rest
}: PeriodBarProps) {
  const [period, setPeriod] = useState<Period>(initial);
  const shown = period.year === THIS_YEAR ? months : SAMPLE;
  return (
    <PeriodBar
      {...rest}
      period={period}
      periodLabel={`${NAMES[period.month - 1]}/${period.year}`}
      months={shown}
      summary={<Summary figures={shown?.find((entry) => entry.month === period.month)} />}
      onChange={(next) => {
        setPeriod(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Kit/PeriodBar',
  component: PeriodBar,
  render: (args) => <Interactive key={JSON.stringify(args.period)} {...args} />,
  args: {
    period: { year: THIS_YEAR, month: TODAY.getMonth() + 1 },
    periodLabel: '',
    months: SAMPLE.slice(0, TODAY.getMonth() + 1),
    currency: 'USD',
    firstYear: THIS_YEAR - 2,
    onChange: fn(),
  },
} satisfies Meta<PeriodBarProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** This month selected: the months ahead are faded and disabled. */
export const ThisMonth: Story = {};

/** A past year, every month happened; "Previous year" stops at `firstYear`. */
export const PastYear: Story = {
  args: { period: { year: THIS_YEAR - 2, month: 3 }, months: SAMPLE },
};

/** A year with no money moved: every bar grey. */
export const Empty: Story = {
  args: { period: { year: THIS_YEAR, month: 1 }, months: [] },
};

/** The figures not known yet (loading, or a failed read): empty bars, only the year heard. */
export const Unknown: Story = {
  args: { months: undefined },
};
