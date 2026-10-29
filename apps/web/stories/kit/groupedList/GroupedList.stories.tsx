import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Currency } from '@financas/api-types';
import { Fragment, useState } from 'react';
import { Amount } from '../../../src/kit/amount/Amount';
import { Card } from '../../../src/kit/card/Card';
import { EmptyState } from '../../../src/kit/emptyState/EmptyState';
import {
  GroupedList, type GroupedListStatus,
} from '../../../src/kit/groupedList/GroupedList';
import { ListRowIcon } from '../../../src/kit/listRow/ListRowIcon';

// The grouped list (K41, OQ-217): the ledger's sticky month headers and day
// bands, a page at a time (mockups 30, 34). Scroll the page: the headers
// stick at its top (no App Shell here), and the next page loads as the end
// nears, after a short pause standing in for the network.
// The asides and rows are the caller's — here stand-ins for Browse
// Transactions' month counts, day totals (R$ first, then $) and rows.

/** A stand-in ledger row. */
interface SampleRow {
  readonly id: string;
  readonly date: string;
  readonly name: string;
  readonly amount: number;
  readonly currency: Currency;
}

const NAMES = ['Groceries', 'Coffee Shop', 'Netflix', 'Paycheck', 'Amazon', 'Pharmacy', 'Rent'];

/** Forty rows, newest first, two a day every other day, every third in R$, from September back. */
const SAMPLE: readonly SampleRow[] = Array.from({ length: 40 }, (_, index) => {
  const day = new Date(Date.UTC(2026, 8, 12 - Math.floor(index / 2) * 2));
  return {
    id: `row-${index}`,
    date: day.toISOString().slice(0, 10),
    name: NAMES[index % NAMES.length]!,
    amount: index % 7 === 3 ? 320000 : -((index * 1371) % 9000) - 500,
    currency: index % 3 === 0 ? 'BRL' : 'USD',
  };
});

const PAGE_SIZE = 12;

/**
 * Counts a month's rows, as the ledger's `monthCounts` would.
 *
 * @param rows - Every row.
 * @param month - The month, `YYYY-MM`.
 * @returns How many rows fall in it.
 */
const countIn = (rows: readonly SampleRow[], month: string) => (
  rows.filter((row) => row.date.startsWith(month)).length
);

/** The story's props: where the list starts. */
interface LedgerProps {
  /** The rows loaded at first. */
  readonly initial: number;
  readonly status: GroupedListStatus;
  /** Whether there are rows at all. */
  readonly blank: boolean;
}

/**
 * Sums a day's rows by currency, R$ first, as the ledger's `dayTotals` would.
 *
 * @param date - The day.
 * @returns Each currency's net that day.
 */
const dayTotals = (date: string) => (['BRL', 'USD'] as const).flatMap((currency) => {
  const rows = SAMPLE.filter((row) => row.date === date && row.currency === currency);
  return rows.length > 0 ? [{ currency, net: rows.reduce((sum, row) => sum + row.amount, 0) }] : [];
});

/**
 * Renders a day's totals side by side, a middle dot between them.
 *
 * @param date - The day.
 * @returns The totals.
 */
const renderTotals = (date: string) => dayTotals(date).map((total, index) => (
  <Fragment key={total.currency}>
    {index > 0 && <span aria-hidden="true">·</span>}
    <Amount amount={total.net} currency={total.currency} tone="inflow" />
  </Fragment>
));

/**
 * Renders a stand-in ledger row, laid out as mockup 30's (FL16 renders K42's
 * `Expandable` here; `ListRow` is an `li` of its own `ListRows`, so it can't).
 *
 * @param row - The row.
 * @returns The row.
 */
const renderRow = (row: SampleRow) => (
  <div className="flex items-center gap-3 py-3 pr-4 pl-5">
    <ListRowIcon icon={row.amount > 0 ? 'savings-outline' : 'shopping-cart-outline'} size="sm" />
    <div className="min-w-0 flex-1">
      <p className="truncate type-body font-medium">{row.name}</p>
      <p className="truncate type-body-sm text-muted">Main Checking</p>
    </div>
    <Amount amount={row.amount} currency={row.currency} tone="signed" className="font-semibold" />
  </div>
);

/**
 * Renders a ledger card that loads the sample a page at a time.
 *
 * @param props - How many rows start loaded, the starting status and whether there are none.
 * @returns The card.
 */
function Ledger({ initial, status: initialStatus, blank }: LedgerProps) {
  const source = blank ? [] : SAMPLE;
  const [loaded, setLoaded] = useState(initial);
  const [status, setStatus] = useState(initialStatus);

  const loadMore = () => {
    setStatus('loading');
    setTimeout(() => {
      setLoaded((count) => count + PAGE_SIZE);
      setStatus('idle');
    }, 600);
  };

  return (
    <Card size="none" className="max-w-xl">
      <h2 className="px-5 pt-4 pb-3 type-heading-sm">All transactions</h2>
      <GroupedList<SampleRow>
        items={source.slice(0, loaded)}
        dateOf={(row) => row.date}
        keyOf={(row) => row.id}
        renderItem={renderRow}
        monthAside={(month) => `${countIn(source, month)} transactions`}
        dayAside={renderTotals}
        hasMore={loaded < source.length}
        status={status}
        onReachedEnd={loadMore}
        empty={<EmptyState icon="receipt-long-outline" title="No transactions yet" />}
        stickyTop="0px"
      />
    </Card>
  );
}

const meta = {
  title: 'Kit/GroupedList',
  component: Ledger,
  args: { initial: PAGE_SIZE, status: 'idle', blank: false },
} satisfies Meta<LedgerProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The first page loaded; scroll down for the next ones. */
export const Paged: Story = {};

/** Nothing loaded yet: skeleton rows only. */
export const FirstPageLoading: Story = {
  args: { initial: 0, status: 'loading' },
};

/** The next page failed: "Try again" asks for it once more. */
export const PageFailed: Story = {
  args: { status: 'error' },
};

/** No transactions at all: the caller's empty state. */
export const Empty: Story = {
  args: { initial: 0, blank: true },
};
