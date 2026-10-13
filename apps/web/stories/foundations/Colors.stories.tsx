import { PALETTE_TOKENS } from '@financas/reference';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SwatchGrid } from '../support/Swatches';

// The colour tokens of styles/theme.css (K1, OQ-121). Switch the toolbar's
// theme to compare the dark and light sets.

const meta = {
  title: 'Foundations/Colors',
  component: SwatchGrid,
} satisfies Meta<typeof SwatchGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Surfaces, lines, text and accents. */
export const Theme: Story = {
  args: {
    tokens: [
      'bg', 'card', 'raised', 'line', 'track', 'ink', 'muted', 'faint', 'mint', 'mintdeep',
      'onmint', 'onmint2', 'coral', 'coraldeep', 'oncoral', 'sky', 'onsky', 'sun', 'lilac',
      'peach', 'deep',
    ],
  },
};

/** The 18 palette tokens a Category stores (OQ-85). */
export const CategoryPalette: Story = {
  args: { tokens: PALETTE_TOKENS.map((token) => `cat-${token}`) },
};
