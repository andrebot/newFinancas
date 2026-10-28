import type { Meta, StoryObj } from '@storybook/react-vite';
import { KeyValueList } from '../../../src/kit/keyValueList/KeyValueList';

// The kit's key–value list (K44, OQ-210): labelled read-only facts. The
// values here are pre-formatted, as a caller passes them; the tone is the
// caller's choice too.

const meta = {
  title: 'Kit/KeyValueList',
  component: KeyValueList,
  args: {
    emptyLabel: 'Not set',
    columns: 3,
    items: [
      { label: 'Kind', value: 'Charge' },
      { label: 'Date', value: '12/09/2026', numeric: true },
      { label: 'Card', value: 'Mastercard •••• 4242' },
    ],
  },
} satisfies Meta<typeof KeyValueList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A transaction's details, under its open row. */
export const TransactionDetails: Story = {};

/** A fixed-income holding's Contract card: display values, money in mint and out in coral. */
export const Contract: Story = {
  args: {
    size: 'lg',
    columns: 2,
    items: [
      { label: 'Invested', value: 'R$140,000.00', numeric: true },
      { label: 'Bought', value: '10/01/2025', numeric: true },
      {
        label: 'Expected payout', value: 'R$212,200.00', tone: 'mint', numeric: true,
      },
      {
        label: 'Expected taxes', value: '−R$10,830.00', tone: 'coral', numeric: true,
      },
    ],
  },
};

/**
 * A fund's Position card: the payout carries a per-month suffix; a missing
 * value shows a dash, which screen readers hear as "Not set".
 */
export const Position: Story = {
  args: {
    size: 'lg',
    columns: 2,
    items: [
      { label: 'Quantity', value: '1,200', numeric: true },
      { label: 'Avg. price', value: 'R$91.67', numeric: true },
      { label: 'Invested', value: 'R$110,000.00', numeric: true },
      {
        label: 'Payout', value: 'R$890.00', suffix: '/mo', tone: 'mint', numeric: true,
      },
      { label: 'Maturity' },
    ],
  },
};
