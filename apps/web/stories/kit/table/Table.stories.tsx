import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Currency } from '@financas/api-types';
import { Amount } from '../../../src/kit/amount/Amount';
import { Card } from '../../../src/kit/card/Card';
import { Tag } from '../../../src/kit/tag/Tag';
import { Table, type TableColumn, type TableGroup } from '../../../src/kit/table/Table';

// The table (K43, OQ-228): holdings by account (mockup 51) — column headers,
// the groups under small-caps rows with their totals, and one expandable row
// per holding. Click a row: its panel opens under it, edged in mint, and the
// hairline below goes away. The cells and panels are the caller's; here they
// stand in for FL19's ticker chips, type tags and detail cards.

/** A sample holding, as mockup 51 draws one. */
interface SampleHolding {
  readonly id: string;
  readonly ticker: string;
  readonly name: string;
  /** The type tag's text and tint. */
  readonly kind: 'Treasury' | 'FII' | 'Stock';
  /** The rate column, or nothing for a variable-income holding. */
  readonly rate?: string | undefined;
  /** The quantity column, already formatted, or nothing where the mockup draws an em dash. */
  readonly quantity?: string | undefined;
  readonly value: number;
  readonly currency: Currency;
  /** The due date column, or nothing for a variable-income holding. */
  readonly due?: string | undefined;
}

const SELIC: SampleHolding = {
  id: 'selic',
  ticker: 'SELIC29',
  name: 'Tesouro Selic 2029',
  kind: 'Treasury',
  rate: '100% Selic',
  value: 14_000_000,
  currency: 'BRL',
  due: '15/03/2029',
};
const IPCA: SampleHolding = {
  id: 'ipca',
  ticker: 'IPCA35',
  name: 'Tesouro IPCA+ 2035',
  kind: 'Treasury',
  rate: 'IPCA + 5.50%',
  value: 6_000_000,
  currency: 'BRL',
  due: '15/05/2035',
};
const XPML: SampleHolding = {
  id: 'xpml',
  ticker: 'XPML11',
  name: 'XP FII Fund',
  kind: 'FII',
  quantity: '1,200',
  value: 11_000_000,
  currency: 'BRL',
};
const KNRI: SampleHolding = {
  id: 'knri',
  ticker: 'KNRI11',
  name: 'Kinea Renda Imobiliária',
  kind: 'FII',
  quantity: '350',
  value: 4_500_000,
  currency: 'BRL',
};
const VALE: SampleHolding = {
  id: 'vale',
  ticker: 'VALE3',
  name: 'Vale S.A.',
  kind: 'Stock',
  quantity: '300',
  value: 360_000,
  currency: 'BRL',
};

/** The table's columns, as the holdings page passes them (mockup 51's tracks). */
const COLUMNS: readonly TableColumn[] = [
  { label: 'Investment', track: 'minmax(0,2.2fr)' },
  { label: 'Type', track: '110px' },
  { label: 'Rate', track: '150px' },
  { label: 'Quantity', track: '100px', className: 'text-right' },
  { label: 'Value', track: '150px', className: 'text-right' },
  { label: 'Due', track: '120px', className: 'text-right' },
];

/** The two groups of mockup 51's XP Investimentos account. */
const GROUPS: readonly TableGroup<SampleHolding>[] = [
  {
    label: 'Fixed income',
    aside: <Amount amount={20_000_000} currency="BRL" />,
    items: [SELIC,
      IPCA],
  },
  {
    label: 'Variable income',
    aside: <Amount amount={15_860_000} currency="BRL" />,
    items: [XPML,
      KNRI, VALE],
  },
];

/** The ticker chip's tint per kind, as mockup 51 draws it. */
const TICKER_TINT: Record<SampleHolding['kind'], string> = {
  Treasury: 'bg-sky/10 text-sky',
  FII: 'bg-lilac/10 text-lilac',
  Stock: 'bg-mint/10 text-mint',
};

/** The ticker chip's frame, before its kind's tint. */
const TICKER_CHIP = [
  'grid h-[26px] min-w-[62px] place-items-center rounded-lg px-2',
  'type-caption font-bold',
].join(' ');

/** The figure cell's props. */
interface FigureCellProps {
  /** The figure to show, already formatted; nothing draws the mockup's em dash. */
  readonly value?: string | undefined;
}

/**
 * Renders a right-aligned figure cell (quantity, due), faint with an em dash
 * where empty, as mockup 51 draws it.
 *
 * @param props - The figure, when the holding has one.
 * @returns The cell.
 */
function FigureCell({ value }: FigureCellProps) {
  return (
    <span className={`num text-right type-body-sm ${value === undefined ? 'text-faint' : ''}`}>
      {value ?? '—'}
    </span>
  );
}

/**
 * Renders a holding's cells in column order.
 *
 * @param holding - The row's holding.
 * @returns Its six cells.
 */
const renderCells = (holding: SampleHolding) => (
  <>
    <span className="flex min-w-0 items-center gap-3">
      <span className={`${TICKER_CHIP} ${TICKER_TINT[holding.kind]}`}>
        {holding.ticker}
      </span>
      <span className="truncate type-body font-medium">{holding.name}</span>
    </span>
    <Tag className="w-fit">{holding.kind}</Tag>
    <span className={holding.rate ? 'type-body-sm num' : 'text-faint'}>{holding.rate ?? '—'}</span>
    <FigureCell value={holding.quantity} />
    <Amount
      amount={holding.value}
      currency={holding.currency}
      className="num text-right font-semibold"
    />
    <FigureCell value={holding.due} />
  </>
);

/**
 * Renders a holding's panel: two stand-in cards where FL19 draws its contract
 * and goal-allocation details, padded as the mockup indents them.
 *
 * @param holding - The row's holding.
 * @returns Its panel.
 */
const renderPanel = (holding: SampleHolding) => (
  <div className="grid grid-cols-2 gap-4 px-5 pb-5 pl-[95px]">
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="type-body font-semibold">{holding.name}</p>
      <p className="mt-1 type-caption text-muted">Contract · read-only — FL19&apos;s panel</p>
    </div>
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="type-body font-semibold">Counts toward goals</p>
      <p className="mt-1 type-caption text-muted">Editable allocation — FL19&apos;s panel</p>
    </div>
  </div>
);

/** The story's props: whether the table shows its footer line. */
interface HoldingsProps {
  /** Whether the table ends with its count and total line. */
  readonly withFooter: boolean;
}

/**
 * Renders mockup 51's XP Investimentos account in a card, as FL19 composes it.
 *
 * @param props - Whether the footer shows.
 * @returns The holdings table.
 */
function HoldingsTable({ withFooter }: HoldingsProps) {
  return (
    <Card size="none" className="max-w-4xl">
      <h2 className="px-5 pt-4 pb-3 type-heading-sm">XP Investimentos</h2>
      <Table<SampleHolding>
        columns={COLUMNS}
        groups={GROUPS}
        keyOf={(holding) => holding.id}
        renderItem={renderCells}
        renderPanel={renderPanel}
        footer={withFooter ? (
          <>
            <span className="type-body-sm text-muted">
              5 holdings · positions come from this account&apos;s investment transactions
            </span>
            <Amount amount={35_860_000} currency="BRL" className="font-bold" />
          </>
        ) : undefined}
      />
    </Card>
  );
}

const meta = {
  title: 'Kit/Table',
  component: HoldingsTable,
  args: { withFooter: true },
} satisfies Meta<HoldingsProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Mockup 51's account: two groups, five holdings, the total line at its end. */
export const HoldingsByAccount: Story = {};

/** The same table without its footer line. */
export const NoFooter: Story = { args: { withFooter: false } };
