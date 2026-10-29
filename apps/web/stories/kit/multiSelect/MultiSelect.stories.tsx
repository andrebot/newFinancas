import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Amount } from '../../../src/kit/amount/Amount';
import { Icon } from '../../../src/kit/icons/Icon';
import {
  MultiSelect, type MultiSelectProps,
} from '../../../src/kit/multiSelect/MultiSelect';
import type { SelectEntry } from '../../../src/kit/select/Select';

// The kit's multi-select (K12, OQ-214). It holds no choice, so each story
// keeps it itself; `onChange` also shows in the actions panel. The data
// echoes mockup 50's payout holdings: a colour swatch before each name, this
// month's payout after it, and the chart's note beside Done.

/**
 * Renders the multi-select with its choice kept locally, starting from the
 * `value` arg, so ticks and presets change it.
 *
 * @param props - The story's args: the starting choice, the change handler and the rest.
 * @returns The interactive multi-select.
 */
function Interactive({ value: initial, onChange, ...rest }: MultiSelectProps<string>) {
  const [value, setValue] = useState(initial);
  return (
    <MultiSelect
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
 * Draws a holding's chart colour.
 *
 * @param props - The swatch's colour.
 * @param props.color - A CSS colour, as the chart series has it.
 * @returns The swatch.
 */
function Swatch({ color }: { readonly color: string }) {
  return <span className="size-2.5 rounded-sm" style={{ background: color }} />;
}

/**
 * Builds a holding option: its swatch before the ticker, this month's payout
 * after it (a muted "—" when none, hidden from screen readers).
 *
 * @param value - The holding's ticker, as its id too.
 * @param color - The holding's chart colour.
 * @param cents - This month's payout in BRL cents.
 * @returns The option.
 */
const holding = (value: string, color: string, cents: number) => ({
  value,
  label: value,
  leading: <Swatch color={color} />,
  trailing: cents > 0 ? (
    <Amount amount={cents} currency="BRL" tone="inflow" sign="auto" />
  ) : <span aria-hidden>—</span>,
});

const holdings: readonly SelectEntry<string>[] = [
  {
    group: 'FIIs',
    options: [
      holding('XPML11', '#5EE6B8', 8410),
      holding('KNRI11', '#7CC4FA', 6200),
      holding('HGLG11', '#F5C86B', 5530),
      holding('MXRF11', '#C9A7F5', 1100),
      holding('VISC11', '#F28B82', 4210),
      holding('BTLG11', '#4A5550', 3980),
    ],
  },
  {
    group: 'Stocks',
    options: [
      holding('VALE3', '#4A5550', 5120),
      holding('ITSA4', '#4A5550', 1240),
      holding('PETR4', '#4A5550', 0),
      holding('BBAS3', '#4A5550', 0),
    ],
  },
  {
    group: 'Fixed income',
    options: [
      holding('CDB Inter', '#4A5550', 0),
      holding('Tesouro IPCA+ 2035', '#4A5550', 0),
    ],
  },
];

const meta = {
  title: 'Kit/MultiSelect',
  component: MultiSelect,
  render: (args) => <Interactive key={JSON.stringify(args.value)} {...args} />,
  decorators: [(Story) => <div className="max-w-[640px]"><Story /></div>],
  args: {
    label: 'Holdings',
    labelHidden: true,
    options: holdings,
    value: ['XPML11', 'KNRI11', 'HGLG11', 'MXRF11', 'VISC11', 'BTLG11', 'VALE3'],
    onChange: fn(),
    summary: (chosen: number, total: number) => `${chosen} of ${total} holdings`,
    presets: [
      { label: 'FIIs', values: ['XPML11', 'KNRI11', 'HGLG11', 'MXRF11', 'VISC11', 'BTLG11'] },
      { label: 'Stocks', values: ['VALE3', 'ITSA4', 'PETR4', 'BBAS3'] },
      { label: 'Fixed income', values: ['CDB Inter', 'Tesouro IPCA+ 2035'] },
    ],
    search: {
      label: 'Search holdings',
      placeholder: 'Search ticker or name',
      noResults: 'No holdings match.',
    },
    note: 'The 5 largest selected keep their colour; the rest are grouped as Others.',
  },
} satisfies Meta<MultiSelectProps<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The payout chart's holdings (mockups 20 and 50), the card title naming it. */
export const PayoutHoldings: Story = {};

/** Nothing chosen yet: the placeholder in the box. */
export const Empty: Story = {
  args: { value: [], placeholder: 'Choose holdings' },
};

/** A short list with no search, presets or note, the label shown. */
export const Accounts: Story = {
  args: {
    label: 'Account / Card',
    labelHidden: false,
    options: [
      { value: 'main', label: 'Main Checking', leading: <Icon name="account-balance-outline" /> },
      { value: 'itau', label: 'Itaú Conta', leading: <Icon name="account-balance-outline" /> },
      { value: 'old', label: 'Old Savings', disabledReason: 'Archived' },
    ],
    value: ['main'],
    summary: (chosen: number, total: number) => `${chosen} of ${total} accounts`,
    presets: [],
    search: undefined,
    note: undefined,
  },
};

/** Invalid: the coral box and the message under it. */
export const Invalid: Story = {
  args: { value: [], labelHidden: false, error: 'Pick at least one holding.' },
};
