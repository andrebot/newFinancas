import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar, type PillProgressBarProps } from '../../../src/kit/progressBar/ProgressBar';

// The kit's progress bar (K33, OQ-181): the pill with its amount inside and
// the thin bar of one or more segments. The amounts here are pre-formatted,
// as a caller passes them. The args are the pill's; the thin stories render
// their own bar.

const meta = {
  title: 'Kit/ProgressBar',
  component: ProgressBar,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    value: 32,
    label: '$3,200.00 / $10,000.00',
    ariaLabel: 'Emergency Fund',
  },
} satisfies Meta<PillProgressBarProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A goal card's pill, partly funded. */
export const Pill: Story = {};

/** The text crosses the fill's edge: each part stays readable. */
export const PillPastHalf: Story = {
  args: { value: 57, label: 'R$85,000.00 / R$150,000.00', ariaLabel: 'House Down Payment' },
};

/** Not funded yet: an empty track with the text. */
export const PillEmpty: Story = {
  args: { value: 0, label: '$0.00 / $2,000.00', ariaLabel: 'New Laptop Fund' },
};

/** A completed goal, in mint. */
export const PillCompleted: Story = {
  args: {
    value: 100, label: '$2,000.00 / $2,000.00', tone: 'mint', ariaLabel: 'Trip to Japan',
  },
};

/** One thin bar, as a holding's term elapsed. */
export const Thin: Story = {
  render: () => (
    <ProgressBar size="thin" segments={[{ value: 42 }]} ariaLabel="Term elapsed" />
  ),
};

/** The buy drawer's allocation total: one segment per goal. */
export const ThinSegments: Story = {
  render: () => (
    <ProgressBar
      size="thin"
      segments={[{ value: 60 }, { value: 25, tone: 'skysoft' }]}
      ariaLabel="Allocated to goals"
      ariaValueText="85% allocated · 15% free"
    />
  ),
};
