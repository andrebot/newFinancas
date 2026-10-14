import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '../../../src/kit/icons/Icon';
import {
  SectionHeader, type SectionHeaderProps,
} from '../../../src/kit/sectionHeader/SectionHeader';
import { Tag } from '../../../src/kit/tag/Tag';

// The kit's section header (K34, OQ-135), with the mockups' uses: a rail's
// title with its period and arrows (20, 30), the ledger's "newest first"
// (30), the payout chart's description and total (20), the members' note
// (60) and the pending invitations' count (60).

const meta = {
  title: 'Kit/SectionHeader',
  component: SectionHeader,
  args: { title: 'Members' },
  argTypes: {
    as: { control: 'inline-radio', options: ['h2', 'h3'] },
  },
} satisfies Meta<SectionHeaderProps>;

export default meta;

type Story = StoryObj<typeof meta>;

const ARROW = 'grid size-8 place-items-center rounded-full border border-line text-muted';

/** Just the title. */
export const Title: Story = {};

/** A rail's header: the period chip and the scroll arrows. */
export const Period: Story = {
  args: {
    title: 'Balances',
    period: 'September/2026',
    actions: (
      <>
        <button type="button" className={ARROW} aria-label="Scroll balances left">
          <Icon name="chevron-left" className="size-5" />
        </button>
        <button type="button" className={ARROW} aria-label="Scroll balances right">
          <Icon name="chevron-right" className="size-5" />
        </button>
      </>
    ),
  },
};

/** The ledger's quiet hint. */
export const Hint: Story = {
  args: { title: 'All transactions', hint: 'newest first' },
};

/** The payout chart: a description and a total on the right. */
export const Description: Story = {
  args: {
    title: 'Payout over time',
    description: 'Dividends and interest received, from your transactions · last 12 months',
    actions: (
      <div className="text-right">
        <p className="type-label text-muted">September/2026</p>
        <p className="type-display-xs text-mint tabular-nums">R$1,841.00</p>
      </div>
    ),
  },
};

/** A note or a count on the right. */
export const Notes: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-6">
      <SectionHeader
        title="Members"
        actions={<span className="type-caption text-muted">You&apos;re the Owner</span>}
      />
      <SectionHeader title="Pending invitations" actions={<Tag>1</Tag>} />
    </div>
  ),
};
