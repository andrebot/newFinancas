import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { DateInput, type DateInputProps } from '../../../src/kit/dateInput/DateInput';

// The date input (K9, OQ-190). It holds no state, so each story keeps the
// date itself; `onChange` shows the wire `YYYY-MM-DD` in the actions panel
// (or the pieces typed so far). The toolbar's locale picks the order:
// `dd/mm/aaaa` in pt-BR, `mm/dd/yyyy` in en-US. Try `1/9/2026`.

/**
 * Renders the date input with its date kept locally, starting from the
 * `value` arg, so typing edits it.
 *
 * @param props - The story's args: the starting date, the change handler and the rest.
 * @returns The interactive date input.
 */
function Interactive({ value: initial, onChange, ...rest }: DateInputProps) {
  const [value, setValue] = useState(initial);
  return (
    <DateInput
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
  title: 'Kit/DateInput',
  component: DateInput,
  render: (args) => <Interactive key={args.value} {...args} />,
  decorators: [(Story) => <div className="max-w-[400px]"><Story /></div>],
  args: {
    label: 'Date',
    value: '2026-09-14',
    onChange: fn(),
    className: 'w-40',
  },
} satisfies Meta<DateInputProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A transaction's date on the record drawer (mockup 31). */
export const TransactionDate: Story = {};

/** Empty: the format shows as the placeholder. */
export const Empty: Story = {
  args: { label: 'Due date', value: '', className: 'w-48' },
};

/** An impossible date, as the form shows the `isoDate` rule's error. */
export const Invalid: Story = {
  args: { label: 'As of', value: '2026-02-31', error: 'Enter a valid date.' },
};

/** Disabled. */
export const Disabled: Story = {
  args: { disabled: true },
};
