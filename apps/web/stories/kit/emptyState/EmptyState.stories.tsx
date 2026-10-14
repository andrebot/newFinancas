import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState, type EmptyStateProps } from '../../../src/kit/emptyState/EmptyState';

// The kit's empty state (K28, OQ-132). No mockup draws one; the look was
// agreed with the stakeholder. Until K4 lands, the action is a plain button.

const meta = {
  title: 'Kit/Empty state',
  component: EmptyState,
  decorators: [(Story) => <div className="max-w-md rounded-2xl bg-card"><Story /></div>],
  args: {
    icon: 'receipt-long-outline',
    title: 'No transactions yet',
    description: 'Record your first one and it will show up here.',
  },
} satisfies Meta<EmptyStateProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A list with nothing in it yet. */
export const NothingYet: Story = {};

/** Filters that match nothing, with a way back. */
export const NoResults: Story = {
  args: {
    icon: 'search',
    title: 'No results',
    description: 'No transaction matches these filters.',
    action: (
      <button
        type="button"
        className="rounded-full bg-mint px-4 py-2 type-body-sm font-semibold text-onmint"
      >
        Clear filters
      </button>
    ),
  },
};

/** Only a title, for tight spaces such as a rail. */
export const TitleOnly: Story = { args: { description: undefined } };
