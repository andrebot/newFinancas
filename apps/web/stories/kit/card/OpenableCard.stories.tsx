import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { OpenableCard, type OpenableCardProps } from '../../../src/kit/card/OpenableCard';
import { Tag } from '../../../src/kit/tag/Tag';

// The kit's openable card (OQ-194): the account cards of mockup 40 and the
// budget cards of mockup 42 — the whole card opens its edit drawer, where Edit
// and the destructive action live. Without an opener it is a plain card.

const meta = {
  title: 'Kit/OpenableCard',
  component: OpenableCard,
  args: {
    name: 'Household Essentials',
    nameClassName: 'type-heading-sm',
    className: 'flex max-w-sm flex-col gap-3',
    onOpen: fn(),
    aside: (
      <span className="flex shrink-0 gap-2 pt-1">
        <Tag size="sm" tone="sky" icon="group-outline">Shared</Tag>
        <Tag size="sm">BRL</Tag>
      </span>
    ),
    children: <span className="type-display-sm tabular-nums">R$ 4.000,00</span>,
  },
} satisfies Meta<OpenableCardProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A card the actor may manage: hover lifts it, a click anywhere opens it. */
export const Openable: Story = {};

/** A card the actor may not manage: plain, its name a disabled button. */
export const Plain: Story = {
  render: ({ onOpen: _, ...args }) => <OpenableCard {...args} />,
};
