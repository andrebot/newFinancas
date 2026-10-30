import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  ChipCheckGroup, ChipChecks, type ChipCheckGroupProps,
} from '../../../src/kit/chipGroup/ChipChecks';

// The kit's multi-pick chips (OQ-220). They hold no state, so each story keeps
// the choice itself; `onChange` also shows in the actions panel.

type Props = ChipCheckGroupProps<string>;

/** Mockup 33's cash kinds. */
const KINDS = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'boleto_payment', label: 'Boleto', icon: 'barcode' as const },
  { value: 'pix_payment', label: 'Pix payment', icon: 'bolt' as const },
  { value: 'pix_receipt', label: 'Pix receipt', icon: 'bolt' as const },
];

/**
 * Renders the group with the choice kept in local state, starting from the
 * `value` arg, so ticking a chip chooses it.
 *
 * @param props - The story's args: the starting choice, the change handler and the rest.
 * @returns The interactive group.
 */
function Interactive({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <ChipCheckGroup
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
  title: 'Kit/ChipChecks',
  component: ChipCheckGroup,
  render: (args) => <Interactive key={args.value.join()} {...args} />,
  args: {
    label: 'Cash',
    options: KINDS,
    value: ['pix_payment'],
    onChange: fn(),
  },
} satisfies Meta<Props>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Mockup 33's kind chips, Pix payment ticked. */
export const Default: Story = {};

/** Nothing ticked yet. */
export const NothingChosen: Story = { args: { value: [] } };

/** Archived entries carry a tag, as the filter lists them (OQ-220). */
export const WithTags: Story = {
  args: {
    label: 'Category',
    options: [
      { value: 'housing', label: 'Housing', icon: 'home-outline' },
      {
        value: 'retired', label: 'Retired', icon: 'home-outline', tag: 'Archived',
      },
    ],
    value: [],
  },
};

/** The bare chips, named by a label only screen readers hear. */
export const Bare: Story = {
  render: (args) => (
    <ChipChecks
      label="Cash kinds"
      options={args.options}
      value={args.value}
      onChange={args.onChange}
    />
  ),
};
