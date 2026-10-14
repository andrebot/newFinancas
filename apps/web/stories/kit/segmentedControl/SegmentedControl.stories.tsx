import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  SegmentedControl, type SegmentedControlProps,
} from '../../../src/kit/segmentedControl/SegmentedControl';

// The kit's segmented control (K13, OQ-127). It holds no state, so each story
// keeps the selection itself; `onChange` also shows in the actions panel.

type Props = SegmentedControlProps<string>;

/**
 * Renders the control with the selection kept in local state, starting from
 * the `value` arg, so clicking a segment selects it.
 *
 * @param props - The story's args: the starting value, the change handler and the rest.
 * @returns The interactive control.
 */
function Interactive({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <SegmentedControl
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Kit/SegmentedControl',
  component: SegmentedControl,
  render: (args) => <Interactive key={args.value} {...args} />,
  args: {
    label: 'Currency',
    options: [{ value: 'USD', label: '$' }, { value: 'BRL', label: 'R$' }],
    value: 'BRL',
    onChange: fn(),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['md', 'sm', 'xs'] },
    layout: { control: 'inline-radio', options: ['pills', 'tiles'] },
  },
} satisfies Meta<Props>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The default pill size, as the $ / R$ switch uses it. */
export const Medium: Story = {};

/** The small pills. */
export const Small: Story = { args: { size: 'sm' } };

/** The extra-small pills. */
export const ExtraSmall: Story = { args: { size: 'xs' } };

/** Pills with a count after the text, as goal status shows them. */
export const WithCounts: Story = {
  args: {
    label: 'Goal status',
    options: [
      { value: 'active', label: 'Active', count: 4 },
      { value: 'achieved', label: 'Achieved', count: 2 },
      { value: 'archived', label: 'Archived', count: 0 },
    ],
    value: 'active',
  },
};

/** Pills with an icon before the text. */
export const WithIcons: Story = {
  args: {
    label: 'Theme',
    options: [
      { value: 'dark', label: 'Dark', icon: 'dark-mode-outline' },
      { value: 'light', label: 'Light', icon: 'light-mode-outline' },
    ],
    value: 'dark',
    size: 'sm',
  },
};

/** Full-width tiles with the icon on top, as the Record drawer's kind groups. */
export const Tiles: Story = {
  args: {
    label: 'Kind',
    layout: 'tiles',
    options: [
      { value: 'cash', label: 'Cash', icon: 'payments-outline' },
      { value: 'transfer', label: 'Transfer', icon: 'swap-horiz' },
      { value: 'credit_card', label: 'Card', icon: 'credit-card-outline' },
      { value: 'investment', label: 'Investment', icon: 'trending-up' },
    ],
    value: 'cash',
  },
};
