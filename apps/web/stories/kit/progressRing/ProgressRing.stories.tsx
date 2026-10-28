import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressRing } from '../../../src/kit/progressRing/ProgressRing';

// The kit's progress ring (K32, OQ-209): a budget's or a goal's percent in a
// ring, as on the rail cards. The labels here are pre-formatted, as a caller
// passes them; the tone is the caller's choice too.

const meta = {
  title: 'Kit/ProgressRing',
  component: ProgressRing,
  args: {
    value: 57,
    label: '57%',
    ariaLabel: 'House Down Payment',
  },
} satisfies Meta<typeof ProgressRing>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A goal on its rail card, in sky. */
export const Goal: Story = {};

/** Not funded yet: an empty track, the label muted. */
export const Empty: Story = {
  args: { value: 0, label: '0%', ariaLabel: 'New Laptop Fund' },
};

/** A budget well within its limit. */
export const BudgetOnTrack: Story = {
  args: {
    value: 48, label: '48%', tone: 'mint', ariaLabel: 'Fun Money',
  },
};

/** A budget getting close to its limit. */
export const BudgetNearLimit: Story = {
  args: {
    value: 78, label: '78%', tone: 'sun', ariaLabel: 'Dining Out',
  },
};

/** Over budget: the ring is full, the label says the real figure in coral. */
export const BudgetOver: Story = {
  args: {
    value: 106, label: '106%', tone: 'coral', ariaLabel: 'Household Essentials',
  },
};

/** The small ring, as in the auth panel's preview. */
export const Small: Story = {
  args: { size: 'sm' },
};
