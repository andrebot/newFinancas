import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { MoneyInput, type MoneyInputProps } from '../../../src/kit/moneyInput/MoneyInput';

// The money input (K7, OQ-188). It holds no state, so each story keeps the
// amount itself; `onChange` shows the minor units in the actions panel. Type
// digits: cents fill first (1, 2, 3 → 0,01 → 0,12 → 1,23).

/**
 * Renders the money input with its amount kept locally, starting from the
 * `value` arg, so typing edits it.
 *
 * @param props - The story's args: the starting amount, the change handler and the rest.
 * @returns The interactive money input.
 */
function Interactive({ value: initial, onChange, ...rest }: MoneyInputProps) {
  const [value, setValue] = useState(initial);
  return (
    <MoneyInput
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
  title: 'Kit/MoneyInput',
  component: MoneyInput,
  render: (args) => <Interactive key={`${args.value}`} {...args} />,
  decorators: [(Story) => <div className="max-w-[400px]"><Story /></div>],
  args: {
    label: 'New value',
    currency: 'BRL',
    value: 11248000,
    onChange: fn(),
  },
} satisfies Meta<MoneyInputProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The field look: a market value, as on mockup 52. */
export const Field: Story = {};

/** Empty: the placeholder shows the currency's zero. */
export const Empty: Story = { args: { value: null } };

/** The hero look, money out: the record drawer's amount (mockup 31). */
export const HeroMoneyOut: Story = {
  args: {
    label: 'Amount',
    variant: 'hero',
    value: 8690,
    direction: 'out',
    hint: 'Money out · currency follows the account (BRL)',
  },
};

/** The hero look in dollars, signed: a starting balance may be overdrawn (mockup 11). */
export const HeroStartingBalance: Story = {
  args: {
    label: 'Starting balance',
    variant: 'hero',
    currency: 'USD',
    value: 324050,
    allowNegative: true,
    hint: 'Type - to make it negative.',
  },
};

/** Invalid: a target must be more than zero. */
export const Invalid: Story = {
  args: {
    label: 'Monthly target',
    variant: 'hero',
    value: null,
    error: 'Enter an amount above zero.',
  },
};

/** Disabled. */
export const Disabled: Story = { args: { disabled: true } };
