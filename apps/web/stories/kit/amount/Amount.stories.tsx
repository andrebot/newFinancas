import type { Meta, StoryObj } from '@storybook/react-vite';
import { Amount } from '../../../src/kit/amount/Amount';

// The kit's amount (K29, OQ-211): minor units in, the currency's own
// conventions out, in tabular figures. The examples are the mockups': the
// ledger's rows, day totals and In/Out (30), the balance rail (30), the
// net-worth hero (20).

const meta = {
  title: 'Kit/Amount',
  component: Amount,
  args: { amount: 324050, currency: 'USD' },
  argTypes: {
    currency: { control: 'inline-radio', options: ['BRL', 'USD'] },
    sign: { control: 'inline-radio', options: ['auto', 'always'] },
    tone: { control: 'inline-radio', options: ['plain', 'signed', 'inflow'] },
  },
} satisfies Meta<typeof Amount>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A plain balance, in the surrounding colour. */
export const Plain: Story = {};

/** A transaction's amount: + and mint for money in, − and coral for money out. */
export const Signed: Story = {
  render: () => (
    <div className="flex flex-col gap-2 type-body-sm">
      <Amount amount={320000} currency="USD" tone="signed" className="font-semibold" />
      <Amount amount={-4599} currency="USD" tone="signed" className="font-semibold" />
      <Amount amount={-5840} currency="BRL" tone="signed" className="font-semibold" />
    </div>
  ),
};

/** The ledger's day totals: mint only when money came in, the rest in the header's muted. */
export const DayTotals: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-1 type-label text-muted">
      <div className="flex justify-between">
        <span>Mon · Sep 7</span>
        <Amount amount={-4599} currency="USD" tone="inflow" />
      </div>
      <div className="flex justify-between">
        <span>Tue · Sep 1</span>
        <Amount amount={320000} currency="USD" tone="inflow" />
      </div>
    </div>
  ),
};

/** The In/Out summary: the Total keeps the ink, only In and Out take the sign's colour. */
export const InOutSummary: Story = {
  render: () => (
    <div className="flex w-56 flex-col gap-2 type-body">
      <div className="flex justify-between">
        <span className="text-muted">In</span>
        <Amount amount={320000} currency="USD" tone="signed" className="font-semibold" />
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Out</span>
        <Amount amount={-83139} currency="USD" tone="signed" className="font-semibold" />
      </div>
      <div className="flex justify-between border-t border-line pt-2">
        <span className="font-semibold">Total</span>
        <Amount amount={236861} currency="USD" sign="always" className="font-bold" />
      </div>
    </div>
  ),
};

/** The sizes the mockups use, set by the caller: hero, rail, row and caption. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Amount amount={35860000} currency="BRL" className="type-display-lg" />
      <Amount amount={324050} currency="USD" className="type-display-xs" />
      <Amount amount={-4599} currency="USD" tone="signed" className="type-body-sm font-semibold" />
      <Amount amount={15450} currency="USD" className="type-caption text-muted" />
    </div>
  ),
};
