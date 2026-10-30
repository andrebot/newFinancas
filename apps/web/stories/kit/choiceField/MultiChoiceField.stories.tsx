import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  MultiChoiceField, type MultiChoiceFieldProps,
} from '../../../src/kit/choiceField/MultiChoiceField';

// The kit's chips-or-multi-select picker (OQ-220). It holds no state, so each
// story keeps the choice itself; `onChange` also shows in the actions panel.

type Props = MultiChoiceFieldProps<string>;

/** Mockup 33's accounts and cards. */
const SOURCES = [
  { value: 'checking', label: 'Main Checking' },
  { value: 'emergency', label: 'Emergency Fund' },
  { value: 'itau', label: 'Itaú Conta' },
  { value: 'visa', label: 'Visa •••• 1111' },
  { value: 'mastercard', label: 'Mastercard •••• 4242' },
];

/** More categories than the chips take, so the field turns into a multi-select. */
const MANY_CATEGORIES = [
  'Housing', 'Groceries', 'Transportation', 'Health', 'Education', 'Leisure',
  'Restaurants', 'Clothing', 'Pets', 'Gifts', 'Travel', 'Subscriptions',
].map((label) => ({ value: label.toLowerCase(), label, icon: 'home-outline' as const }));

/**
 * Renders the field with the choice kept in local state, starting from the
 * `value` arg, so ticking a choice chooses it.
 *
 * @param props - The story's args: the starting choice, the change handler and the rest.
 * @returns The interactive field.
 */
function Interactive({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <MultiChoiceField
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
  title: 'Kit/MultiChoiceField',
  component: MultiChoiceField,
  render: (args) => <Interactive key={args.value.join()} {...args} />,
  args: {
    label: 'Account / Card',
    options: SOURCES,
    value: ['mastercard'],
    onChange: fn(),
    summary: (chosen: number, total: number) => `${chosen} of ${total}`,
  },
} satisfies Meta<Props>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Up to ten choices: chips. */
export const Chips: Story = {};

/** Past ten: the multi-select, with its search. */
export const MultiSelect: Story = {
  args: {
    label: 'Category',
    options: MANY_CATEGORIES,
    value: ['groceries'],
    summary: (chosen: number, total: number) => `${chosen} of ${total} categories`,
    placeholder: 'All categories',
    search: { label: 'Search categories', noResults: 'No category matches.' },
  },
};
