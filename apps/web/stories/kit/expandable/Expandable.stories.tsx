import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../../src/kit/button/Button';
import { Expandable, type ExpandableProps } from '../../../src/kit/expandable/Expandable';
import { KeyValueList } from '../../../src/kit/keyValueList/KeyValueList';
import { ListRowIcon } from '../../../src/kit/listRow/ListRowIcon';
import { Tag } from '../../../src/kit/tag/Tag';

// The kit's expandable row / accordion (K42, OQ-182): a ledger row that opens
// on its details and actions, a card section that folds away, and a ledger
// that keeps one row open. The text here is pre-translated and pre-formatted,
// as a caller passes it.

/**
 * Renders a ledger transaction's summary: its icon, name, meta and amount.
 *
 * @param props - The transaction's name and amount.
 * @returns The summary's content.
 */
function TransactionSummary({ name, amount }: { readonly name: string; readonly amount: string }) {
  return (
    <div className="flex items-center gap-3">
      <ListRowIcon icon="restaurant" tone="sun" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink">{name}</div>
        <div className="truncate type-caption text-muted">
          Mastercard •••• 4242 · Dining & Entertainment
        </div>
      </div>
      <span className="font-semibold text-coral">{amount}</span>
    </div>
  );
}

/**
 * Renders a ledger transaction's panel: its details and Edit / Delete.
 *
 * @returns The panel's content.
 */
function TransactionDetails() {
  return (
    <div className="flex items-end justify-between gap-4 px-5 pb-4 pl-[68px]">
      <KeyValueList
        emptyLabel="Not set"
        items={[
          { label: 'Kind', value: 'Charge' },
          { label: 'Date', value: '12/09/2026', numeric: true },
        ]}
      />
      <div className="flex shrink-0 gap-2">
        <Button size="md" leadingIcon="edit-outline">Edit</Button>
        <Button size="md" variant="danger" leadingIcon="delete-outline">Delete</Button>
      </div>
    </div>
  );
}

const meta = {
  title: 'Kit/Expandable',
  component: Expandable,
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
  args: {
    summary: <TransactionSummary name="Coffee Shop" amount="−R$18.50" />,
    children: <TransactionDetails />,
  },
} satisfies Meta<ExpandableProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A closed ledger row: click it to open. */
export const Row: Story = {};

/** An open ledger row: raised, edged in mint, its details and actions below. */
export const RowOpen: Story = {
  args: { defaultExpanded: true },
};

/** A section that folds away, as the archived categories. */
export const Card: Story = {
  args: {
    surface: 'card',
    summary: (
      <div className="flex items-center gap-2">
        <span className="font-semibold">Archived</span>
        <Tag size="sm">2</Tag>
      </div>
    ),
    children: <div className="px-5 py-4 text-ink">Pets · Subscriptions</div>,
    defaultExpanded: true,
  },
};

/** The caller holds the state: opening a row closes the one that was open. */
export const OneOpenAtATime: Story = {
  render: function Ledger() {
    const [openName, setOpenName] = useState<string | null>('Coffee Shop');
    const rows = [
      { name: 'Netflix', amount: '−R$39.90' },
      { name: 'Coffee Shop', amount: '−R$18.50' },
      { name: 'Amazon', amount: '−$45.99' },
    ];
    return (
      <div>
        {rows.map(({ name, amount }) => (
          <Expandable
            key={name}
            summary={<TransactionSummary name={name} amount={amount} />}
            expanded={openName === name}
            onExpandedChange={(open) => setOpenName(open ? name : null)}
          >
            <TransactionDetails />
          </Expandable>
        ))}
      </div>
    );
  },
};
