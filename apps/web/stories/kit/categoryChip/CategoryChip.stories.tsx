import type { Meta, StoryObj } from '@storybook/react-vite';
import { PALETTE_TOKENS } from '@financas/reference';
import {
  CategoryChip,
  CategoryDisc,
  type CategoryChipProps,
} from '../../../src/kit/categoryChip/CategoryChip';

// The kit's category chip (K50, OQ-184). The categories are the mockups'
// seeds: the ledger's discs (30), setup's review (12), the category cards (41)
// and a budget's pills and picker (42).

const meta = {
  title: 'Kit/Category chip',
  component: CategoryChip,
  args: { name: 'Dining & Entertainment', icon: 'restaurant', color: 'sun' },
  argTypes: {
    color: { control: 'select', options: [...PALETTE_TOKENS] },
  },
} satisfies Meta<CategoryChipProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The pill, as on a budget's card. */
export const Pill: Story = {};

/** A budget's categories, side by side. */
export const Pills: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <CategoryChip name="Groceries" icon="shopping-cart-outline" color="mint" />
      <CategoryChip name="Transportation" icon="directions-car-outline" color="sky" />
      <CategoryChip name="Housing" icon="home-outline" color="peach" />
      <CategoryChip name="Shopping" icon="shopping-bag-outline" color="lilac" />
    </div>
  ),
};

/** The four disc sizes, smallest first. */
export const DiscSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <CategoryDisc icon="restaurant" color="sun" size="xs" />
      <CategoryDisc icon="restaurant" color="sun" size="sm" />
      <CategoryDisc icon="restaurant" color="sun" />
      <CategoryDisc icon="restaurant" color="sun" size="lg" />
    </div>
  ),
};

/** The whole palette, one disc per token. */
export const Palette: Story = {
  render: () => (
    <div className="grid grid-cols-6 gap-3">
      {PALETTE_TOKENS.map((token) => (
        <CategoryDisc key={token} icon="category-outline" color={token} />
      ))}
    </div>
  ),
};

/** A disc beside its name, as on a ledger row. */
export const BesideName: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <CategoryDisc icon="shopping-cart-outline" color="mint" />
      <span className="type-body font-semibold text-ink">Groceries</span>
    </div>
  ),
};
