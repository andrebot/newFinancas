import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  DateRangePicker, type DateRangePickerProps,
} from '../../../src/kit/dateRangePicker/DateRangePicker';

// The date range picker (K10, OQ-213). It holds no state, so each story keeps
// the range itself; `onChange` shows the wire value in the actions panel. A
// preset fills both dates ending today; typing a date switches to Custom.

/**
 * Renders the picker with its range kept locally, starting from the `value`
 * arg, so chips and typing edit it.
 *
 * @param props - The story's args: the starting range, the change handler and the rest.
 * @returns The interactive picker.
 */
function Interactive({ value: initial, onChange, ...rest }: DateRangePickerProps) {
  const [value, setValue] = useState(initial);
  return (
    <DateRangePicker
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
  title: 'Kit/DateRangePicker',
  component: DateRangePicker,
  render: (args) => <Interactive key={JSON.stringify(args.value)} {...args} />,
  decorators: [(Story) => <div className="max-w-[440px]"><Story /></div>],
  args: {
    label: 'Date range',
    presets: ['anyTime', 'thisMonth', 'last30Days', 'last90Days', 'thisYear'],
    value: { preset: 'last90Days', from: '2026-08-01', to: '2026-10-29' },
    onChange: fn(),
  },
} satisfies Meta<DateRangePickerProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The ledger's filter drawer (mockup 33): every preset, the name shown. */
export const TransactionFilter: Story = {};

/** The audit export dialog (mockup 24): fewer presets, the dialog title names it. */
export const AuditExport: Story = {
  args: {
    label: 'Audit log period',
    labelHidden: true,
    presets: ['last30Days', 'last90Days', 'thisYear'],
  },
};

/** Any time: both dates empty, the format as the placeholder. */
export const AnyTime: Story = {
  args: { value: { preset: 'anyTime', from: '', to: '' } },
};

/** A reversed range, as the form shows the `dateRangeEnd` rule's error. */
export const Reversed: Story = {
  args: {
    value: { preset: 'custom', from: '2026-10-01', to: '2026-07-03' },
    errors: { to: "Can't be before the start date." },
  },
};
