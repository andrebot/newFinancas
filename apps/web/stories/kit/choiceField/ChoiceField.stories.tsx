import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ChoiceField, type ChoiceFieldProps } from '../../../src/kit/choiceField/ChoiceField';

// The kit's chips-or-select picker (OQ-219). It holds no state, so each story
// keeps the choice itself; `onChange` also shows in the actions panel.

type Props = ChoiceFieldProps<string>;

/** Mockup 31's accounts, each with its currency. */
const ACCOUNTS = [
  { value: 'itau', label: 'Itaú Conta', tag: 'BRL' },
  { value: 'checking', label: 'Main Checking', tag: 'USD' },
  { value: 'emergency', label: 'Emergency Fund', tag: 'USD' },
];

/** More categories than the chips take, so the field turns into a select. */
const MANY_CATEGORIES = [
  'Housing', 'Groceries', 'Transportation', 'Health', 'Education', 'Leisure',
  'Restaurants', 'Clothing', 'Pets', 'Gifts', 'Travel', 'Subscriptions',
].map((label) => ({ value: label.toLowerCase(), label, icon: 'home-outline' as const }));

/**
 * Renders the field with the choice kept in local state, starting from the
 * `value` arg, so picking a choice chooses it.
 *
 * @param props - The story's args: the starting value, the change handler and the rest.
 * @returns The interactive field.
 */
function Interactive({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <ChoiceField
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
  title: 'Kit/ChoiceField',
  component: ChoiceField,
  render: (args) => <Interactive key={String(args.value)} {...args} />,
  args: {
    label: 'From account',
    options: ACCOUNTS,
    value: 'itau',
    onChange: fn(),
  },
} satisfies Meta<Props>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A short list: chips. */
export const Chips: Story = {};

/** A list past `choiceField.chipListLimit`: a select, the note after the caption. */
export const LongList: Story = {
  args: {
    label: 'Category',
    note: '· optional',
    options: MANY_CATEGORIES,
    value: undefined,
  },
};

/** Nothing chosen on a refused submit: the error replaces the hint. */
export const Invalid: Story = {
  args: { value: undefined, hint: 'Currency follows the account', error: 'Choose an account' },
};
