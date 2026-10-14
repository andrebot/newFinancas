import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag, type TagProps } from '../../../src/kit/tag/Tag';

// The kit's tag (K30, OQ-133). The tones and labels are the ones the mockups
// use: currencies and account kinds (40, 51), "Shared" (31), "This device"
// (70), "Mixed currencies" (43), "read-only" / "editable" (51) and "v2" (50).

const meta = {
  title: 'Kit/Tag',
  component: Tag,
  args: { children: 'USD' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['neutral', 'mint', 'sky', 'sun', 'coral'] },
    size: { control: 'inline-radio', options: ['md', 'sm', 'micro'] },
  },
} satisfies Meta<TagProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The plain grey pill, e.g. a currency. */
export const Neutral: Story = {};

/** Every tone, with the mockups' labels. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Tag icon="person-outline">Personal</Tag>
      <Tag tone="mint">This device</Tag>
      <Tag tone="sky" icon="group-outline">Shared</Tag>
      <Tag tone="sun" icon="currency-exchange">Mixed currencies</Tag>
      <Tag tone="coral">Over budget</Tag>
    </div>
  ),
};

/** The three sizes side by side. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Tag>BRL</Tag>
      <Tag size="sm">BRL</Tag>
      <Tag size="micro">v2</Tag>
    </div>
  ),
};

/** A section header's count, as on the archived accounts list. */
export const Count: Story = {
  render: () => (
    <div className="flex items-center gap-2 type-body">
      <span className="font-semibold">Archived</span>
      <Tag>1</Tag>
    </div>
  ),
};

/** The contract panel's edit state. */
export const ReadOnly: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Tag>read-only</Tag>
      <Tag tone="mint">editable</Tag>
    </div>
  ),
};
