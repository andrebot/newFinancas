import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandMark, type BrandMarkProps } from '../../../src/kit/brand/BrandMark';

// The kit's brand mark (K34, OQ-135): the shell and wizard bars' size and
// the auth brand panel's.

const meta = {
  title: 'Kit/BrandMark',
  component: BrandMark,
  argTypes: {
    size: { control: 'inline-radio', options: ['md', 'lg'] },
  },
} satisfies Meta<BrandMarkProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The bars' 32px tile. */
export const Medium: Story = {};

/** The auth panel's 40px tile. */
export const Large: Story = { args: { size: 'lg' } };
