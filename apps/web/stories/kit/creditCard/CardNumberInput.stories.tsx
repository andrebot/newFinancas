import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  CardNumberInput, type CardNumberInputProps,
} from '../../../src/kit/creditCard/CardNumberInput';

// The card number input (K48, OQ-187). It holds no state, so each story keeps
// the digits itself; `onChange` shows them in the actions panel. Type or paste
// a number: the groups follow its network (try 3782 8224 6310 005 for Amex).

/**
 * Renders the card number input with its digits kept locally, starting from
 * the `value` arg, so typing edits them.
 *
 * @param props - The story's args: the starting digits, the change handler and the rest.
 * @returns The interactive card number input.
 */
function Interactive({ value: initial, onChange, ...rest }: CardNumberInputProps) {
  const [value, setValue] = useState(initial);
  return (
    <CardNumberInput
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
  title: 'Kit/Credit card/CardNumberInput',
  component: CardNumberInput,
  render: (args) => <Interactive key={args.value} {...args} />,
  decorators: [(Story) => <div className="max-w-[400px]"><Story /></div>],
  args: {
    label: 'Card number',
    value: '550209424242',
    onChange: fn(),
  },
} satisfies Meta<CardNumberInputProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Part of a Mastercard number, as on mockup 11. */
export const Typing: Story = {};

/** An Amex number, grouped 4-6-5. */
export const Amex: Story = { args: { value: '378282246310005' } };

/** Invalid: the Luhn check failed. */
export const Invalid: Story = {
  args: { value: '4111111111111112', error: 'Check the card number.' },
};
