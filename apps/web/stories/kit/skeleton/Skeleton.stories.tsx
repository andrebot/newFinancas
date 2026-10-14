import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton, SkeletonRows, type SkeletonRowsProps } from '../../../src/kit/skeleton/Skeleton';

// The kit's loading placeholders (K28, OQ-132). The rows mirror the ledger's
// next-page placeholder in the Transactions mockup (30); the card story shows
// how a rail composes its own placeholder from single shapes.

const meta = {
  title: 'Kit/Skeleton',
  component: SkeletonRows,
  decorators: [(Story) => <div className="max-w-md rounded-2xl bg-card"><Story /></div>],
  args: { label: 'Loading transactions' },
} satisfies Meta<SkeletonRowsProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The ledger's two loading rows, as the mockup shows them. */
export const Rows: Story = {};

/** A first page loading: more rows, the line widths alternating. */
export const ManyRows: Story = { args: { count: 6 } };

/** A rail card's placeholder, composed from single shapes. */
export const Card: Story = {
  render: () => (
    <div className="flex w-56 flex-col gap-3 p-5">
      <Skeleton className="w-1/2" />
      <Skeleton shape="block" className="h-16" />
      <Skeleton className="h-2.5 w-2/3" />
    </div>
  ),
};
