import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { NumberInput, type NumberInputProps } from '../../../src/kit/numberInput/NumberInput';

// The number input (K8, OQ-189). It holds no state, so each story keeps the
// number itself; `onChange` shows the wire integer in the actions panel
// (a rate × 10,000, a quantity × 10⁸). Type the point with `,` or `.`; the
// toolbar's locale picks the sign it shows.

/**
 * Renders the number input with its number kept locally, starting from the
 * `value` arg, so typing edits it.
 *
 * @param props - The story's args: the starting number, the change handler and the rest.
 * @returns The interactive number input.
 */
function Interactive({ value: initial, onChange, ...rest }: NumberInputProps) {
  const [value, setValue] = useState(initial);
  return (
    <NumberInput
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
  title: 'Kit/NumberInput',
  component: NumberInput,
  render: (args) => <Interactive key={`${args.kind}-${args.value}`} {...args} />,
  decorators: [(Story) => <div className="max-w-[400px]"><Story /></div>],
  args: {
    label: 'Rate · % of CDI',
    kind: 'rate',
    value: 1100000,
    onChange: fn(),
  },
} satisfies Meta<NumberInputProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A fixed-income buy's rate: 110% of CDI (mockup 32). */
export const Rate: Story = {};

/** An index value, negatives allowed for deflation (mockup 53). */
export const IndexValue: Story = {
  args: {
    label: 'New value (% a.a.)',
    value: 102500,
    allowNegative: true,
    hint: 'Type - for a negative reading.',
  },
};

/** A quantity, up to 8 decimals: Tesouro Direto's 0.01 step. */
export const Quantity: Story = {
  args: { label: 'Quantity', kind: 'quantity', value: 1000000 },
};

/** A Goal allocation row's compact whole percent (mockups 32, 51). */
export const CompactPercent: Story = {
  args: {
    label: 'Percentage for House Down Payment',
    kind: 'percent',
    size: 'compact',
    value: 60,
  },
};

/** Invalid: the shares can't pass 100%. */
export const Invalid: Story = {
  args: {
    label: 'Percentage for Emergency Fund',
    kind: 'percent',
    size: 'compact',
    value: 120,
    error: 'Up to 100% in total.',
  },
};

/** Empty, with a placeholder. */
export const Empty: Story = { args: { value: null, placeholder: '0' } };

/** Disabled. */
export const Disabled: Story = { args: { disabled: true } };
