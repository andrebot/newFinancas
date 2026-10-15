import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Icon } from '../../../src/kit/icons/Icon';
import { Select, type SelectEntry, type SelectProps } from '../../../src/kit/select/Select';
import { Tag } from '../../../src/kit/tag/Tag';

// The kit's select (K11, OQ-138): the fallback for a pick list too long for
// a row of chips. It holds no value, so each story keeps the choice itself;
// `onChange` also shows in the actions panel. The data echoes the mockups'
// accounts, categories (with budget claims, 42) and roles (60).

/**
 * Renders the select with its choice kept locally, starting from the `value`
 * arg, so picking changes it.
 *
 * @param props - The story's args: the starting value, the change handler and the rest.
 * @returns The interactive select.
 */
function Interactive({ value: initial, onChange, ...rest }: SelectProps<string>) {
  const [value, setValue] = useState(initial);
  return (
    <Select
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

/**
 * Draws an account's colour dot.
 *
 * @param props - The dot's background class.
 * @param props.tone - A `bg-*` utility.
 * @returns The dot.
 */
function Dot({ tone }: { readonly tone: string }) {
  return <span className={`size-2 rounded-full ${tone}`} />;
}

/**
 * Builds an account option: its colour dot before the name, its currency after.
 *
 * @param value - The account's id.
 * @param label - The account's name.
 * @param tone - The dot's `bg-*` utility.
 * @param currency - The account's currency code.
 * @returns The option.
 */
const account = (value: string, label: string, tone: string, currency: string) => ({
  value, label, leading: <Dot tone={tone} />, trailing: <Tag size="sm">{currency}</Tag>,
});

const accounts: readonly SelectEntry<string>[] = [
  account('itau', 'Itaú Conta', 'bg-sun', 'BRL'),
  account('main', 'Main Checking', 'bg-mint', 'USD'),
  account('emergency', 'Emergency Fund', 'bg-sky', 'USD'),
  account('nubank', 'Nubank', 'bg-lilac', 'BRL'),
];

const categories: readonly SelectEntry<string>[] = [
  { value: 'groceries', label: 'Groceries', leading: <Icon name="shopping-cart-outline" /> },
  {
    group: 'Housing',
    options: [
      { value: 'housing', label: 'Housing', leading: <Icon name="home-outline" /> },
      { value: 'rent', label: 'Rent', leading: <Icon name="home-outline" /> },
      { value: 'utilities', label: 'Utilities', leading: <Icon name="home-outline" /> },
    ],
  },
  {
    group: 'Dining & Entertainment',
    options: [
      { value: 'dining', label: 'Dining & Entertainment', leading: <Icon name="restaurant" /> },
      {
        value: 'streaming',
        label: 'Streaming Services',
        leading: <Icon name="restaurant" />,
        disabledReason: 'in Fun Money',
      },
    ],
  },
  {
    value: 'shopping',
    label: 'Shopping',
    leading: <Icon name="shopping-bag-outline" />,
    disabledReason: 'in Fun Money',
  },
  { value: 'health', label: 'Healthcare', leading: <Icon name="medical-services-outline" /> },
];

const roles: readonly SelectEntry<string>[] = [
  {
    value: 'admin',
    label: 'Admin',
    leading: <Icon name="shield-person-outline" />,
    description: 'Manage members, roles, and all shared data',
  },
  {
    value: 'member',
    label: 'Member',
    leading: <Icon name="edit-note-outline" />,
    description: 'Record transactions and manage shared data',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    leading: <Icon name="visibility-outline" />,
    description: 'Read-only access to shared data',
  },
];

const meta = {
  title: 'Kit/Select',
  component: Select,
  render: (args) => <Interactive key={String(args.value)} {...args} />,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    label: 'From account',
    options: accounts,
    value: 'itau',
    onChange: fn(),
  },
} satisfies Meta<SelectProps<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Accounts with their colour dot and currency tag. */
export const Accounts: Story = {};

/** Nothing chosen yet: the placeholder shows. */
export const Empty: Story = { args: { value: null, placeholder: 'Choose an account' } };

/**
 * Categories with their subcategories as groups, and the claimed ones
 * disabled with the budget they live in — the claim-aware picker's case. A
 * search box narrows the long list; "saude"-style searches ignore accents.
 */
export const CategoriesWithSearch: Story = {
  args: {
    label: 'Category',
    options: categories,
    value: 'groceries',
    search: {
      label: 'Search categories',
      placeholder: 'Search categories',
      noResults: 'No category matches.',
    },
  },
};

/** A description under each option, as the role menu's. */
export const Roles: Story = {
  args: { label: 'Role', options: roles, value: 'member' },
};

/** A quieter line under the field. */
export const WithHint: Story = {
  args: { hint: 'The amount’s currency follows the account.' },
};

/** Invalid: the error takes the hint's place. */
export const Invalid: Story = {
  args: {
    value: null,
    placeholder: 'Choose an account',
    hint: 'The amount’s currency follows the account.',
    error: 'Choose the account the money left.',
  },
};

/** Disabled. */
export const Disabled: Story = { args: { disabled: true } };
