import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ChipGroup, type ChipGroupProps } from '../../../src/kit/chipGroup/ChipGroup';

// The kit's chip group (OQ-219). It holds no state, so each story keeps the
// choice itself; `onChange` also shows in the actions panel.

type Props = ChipGroupProps<string>;

/**
 * Renders the group with the choice kept in local state, starting from the
 * `value` arg, so clicking a chip chooses it.
 *
 * @param props - The story's args: the starting value, the change handler and the rest.
 * @returns The interactive group.
 */
function Interactive({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <ChipGroup
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
  title: 'Kit/ChipGroup',
  component: ChipGroup,
  render: (args) => <Interactive key={String(args.value)} {...args} />,
  args: {
    label: 'From account',
    options: [
      { value: 'itau', label: 'Itaú Conta', tag: 'BRL' },
      { value: 'checking', label: 'Main Checking', tag: 'USD' },
      { value: 'emergency', label: 'Emergency Fund', tag: 'USD' },
    ],
    value: 'itau',
    onChange: fn(),
  },
} satisfies Meta<Props>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Mockup 31's account chips, each with its currency. */
export const Accounts: Story = {};

/** Mockup 31's category chips: icons, a note after the caption, nothing chosen yet. */
export const Categories: Story = {
  args: {
    label: 'Category',
    note: "· optional — uncategorized isn't tracked by budgets",
    options: [
      { value: 'housing', label: 'Housing', icon: 'home-outline' },
      { value: 'groceries', label: 'Groceries', icon: 'shopping-cart-outline' },
      { value: 'transport', label: 'Transportation', icon: 'directions-car-outline' },
    ],
    value: undefined,
  },
};

/** Nothing chosen on a refused submit: the error replaces the hint. */
export const Invalid: Story = {
  args: { value: undefined, hint: 'Currency follows the account', error: 'Choose an account' },
};
