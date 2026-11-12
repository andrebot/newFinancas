import type { Currency, InvestmentHolding } from '@financas/api-types';
import type { ReactNode } from 'react';
import { portfolio } from '../../../../../config/constants';
import { Amount } from '../../../../../kit/amount/Amount';
import { Card } from '../../../../../kit/card/Card';
import { Icon } from '../../../../../kit/icons/Icon';
import { Table, type TableColumn, type TableGroup } from '../../../../../kit/table/Table';
import { Tag } from '../../../../../kit/tag/Tag';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { categoryColor, categoryTint } from '../../../../../utilities/theme';
import useFormatter from '../../../../../utilities/useFormatter';
import {
  assetFamilyOf, assetTypeName, holdingIdOf, rateText,
} from '../../../../holdingNames';
import shareTone from '../../../shareTone';
import {
  groupsTotalOf, isFixedTermHolding, typeSharesOf, unitsOf, type HoldingGroup, type HoldingRow,
} from '../holdingMaintenance';

// Holdings Table (FL19; mockup 51; FR-5.1, FR-5.2, OQ-228, OQ-234): one
// account's Holdings on K43 — its name over a bar of its value by asset type,
// the Fixed income and Variable income groups with their totals, a row per
// Holding (ticker, type, rate, quantity, value, due date), archived ones last
// and marked, and the count and total at the end. Below `md` only Investment
// and Value stay (the rest is in the open row's cards). Each row opens the
// caller's panel. Display only: the table holds the open rows, the caller
// the rest.

/** Holdings Table's props. */
export interface HoldingsTableProps {
  /** The account's name, the table's heading. */
  readonly accountName: string;
  readonly currency: Currency;
  /** The account's Holdings, grouped and ordered. */
  readonly groups: readonly HoldingGroup[];
  /** Whether the screen is wide enough for every column. */
  readonly wide: boolean;
  /** The panel under an opened row. */
  readonly renderPanel: (row: HoldingRow) => ReactNode;
  /** The Holding whose row is open at first — the one a link pointed at (OQ-243). */
  readonly openHoldingId?: string | undefined;
}

/** The ticker chip's frame (mockup 51's `.ticker`), before its family's tint. */
const TICKER_CHIP = [
  'grid h-[26px] min-w-[62px] max-w-36 shrink-0 place-items-center truncate rounded-lg px-2',
  'type-caption font-bold',
].join(' ');

/**
 * Draws a Holding's name: a market-priced one's ticker in a chip tinted by its
 * family, a fixed-term one's name beside a bank glyph (mockup 51); an archived
 * one marked.
 *
 * @param props - The Holding.
 * @returns The cell.
 */
function InvestmentCell({ holding }: { readonly holding: InvestmentHolding }) {
  const translator = useI18n();
  const tone = portfolio.familyTones[assetFamilyOf(holding.assetType)];
  const tint = { background: categoryTint(tone), color: categoryColor(tone) };
  const fixedTerm = isFixedTermHolding(holding);
  return (
    <span className="flex min-w-0 items-center gap-3">
      {fixedTerm ? (
        <span
          aria-hidden="true"
          className="grid size-[26px] shrink-0 place-items-center rounded-lg"
          style={tint}
        >
          <Icon name="account-balance-outline" className="size-4" />
        </span>
      ) : <span className={TICKER_CHIP} style={tint}>{holding.ticker}</span>}
      {fixedTerm && <span className="truncate type-body font-medium">{holding.ticker}</span>}
      {holding.archivedAt && (
        <Tag size="sm">{translator.text('holdingMaintenance', 'archived')}</Tag>
      )}
    </span>
  );
}

/**
 * Draws a figure cell, right-aligned, with a muted dash where there's none.
 *
 * @param props - The figure, already written.
 * @returns The cell.
 */
function FigureCell({ value }: { readonly value: string | undefined }) {
  return (
    <span className={`text-right type-body-sm tabular-nums ${value ? '' : 'text-muted'}`}>
      {value ?? '—'}
    </span>
  );
}

/**
 * Builds the columns the screen has room for (mockup 51's tracks).
 *
 * @param label - Names a column.
 * @param wide - Whether every column fits.
 * @returns The columns, in order.
 */
const columnsOf = (label: (key: string) => string, wide: boolean): TableColumn[] => {
  const value = {
    label: label('value'), track: wide ? '150px' : 'minmax(0,1fr)', className: 'text-right',
  };
  if (!wide) return [{ label: label('investment'), track: 'minmax(0,1.6fr)' }, value];
  return [
    { label: label('investment'), track: 'minmax(0,2.2fr)' },
    { label: label('type'), track: '110px' },
    { label: label('rate'), track: '150px' },
    { label: label('quantity'), track: '100px', className: 'text-right' },
    value,
    { label: label('due'), track: '110px', className: 'text-right' },
  ];
};

/**
 * Draws a row's cells, in the columns' order.
 *
 * @param props - The row, its currency and whether every column shows.
 * @returns The cells.
 */
function RowCells({ row, currency, wide }: {
  readonly row: HoldingRow;
  readonly currency: Currency;
  readonly wide: boolean;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  const { holding } = row;
  const value = (
    <Amount amount={row.value} currency={currency} className="text-right font-semibold" />
  );
  if (!wide) {
    return (
      <>
        <InvestmentCell holding={holding} />
        {value}
      </>
    );
  }
  const fixedTerm = isFixedTermHolding(holding);
  return (
    <>
      <InvestmentCell holding={holding} />
      <Tag className="w-fit">{assetTypeName(translator, holding.assetType)}</Tag>
      <span className={`truncate type-body-sm ${holding.rate ? 'tabular-nums' : 'text-muted'}`}>
        {holding.rate ? rateText(translator, formatter, holding.rate) : '—'}
      </span>
      <FigureCell value={fixedTerm ? undefined : translator.text('holdingMaintenance', 'quantity', {
        units: unitsOf(holding.quantity),
      })}
      />
      {value}
      <FigureCell value={holding.dueDate ? formatter.date(holding.dueDate) : undefined} />
    </>
  );
}

/**
 * Draws the account's value by asset type: a bar and its legend (mockup 51).
 *
 * @param props - The account's groups.
 * @returns The bar, or nothing when the account is worth nothing.
 */
function TypeBar({ groups }: { readonly groups: readonly HoldingGroup[] }) {
  const translator = useI18n();
  const formatter = useFormatter();
  const shares = typeSharesOf(groups);
  if (shares.length === 0) return null;
  const total = groupsTotalOf(groups);
  const legend = shares.map((share) => translator.text('holdingMaintenance', 'typeBar.share', {
    type: assetTypeName(translator, share.assetType), percent: formatter.percent(share.percent),
  }));
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2">
      <div
        role="img"
        aria-label={translator.text('holdingMaintenance', 'typeBar.label', {
          shares: formatter.list(legend),
        })}
        className="flex h-2.5 min-w-32 max-w-[420px] flex-1 gap-0.5 overflow-hidden rounded-full"
      >
        {shares.map((share, index) => (
          <span
            key={share.assetType}
            style={{
              width: `${(share.amount / total) * 100}%`,
              background: categoryColor(shareTone(index)),
            }}
          />
        ))}
      </div>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-muted">
        {shares.map((share, index) => (
          <li key={share.assetType} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: categoryColor(shareTone(index)) }}
            />
            {legend[index]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders one account's Holdings.
 *
 * @param props - The account's name, currency and groups, the screen's width, the panel
 *   and the row open at first.
 * @returns The table in its card.
 */
export function HoldingsTable({
  accountName, currency, groups, wide, renderPanel, openHoldingId,
}: HoldingsTableProps) {
  const translator = useI18n();
  const text = (key: string) => translator.text('holdingMaintenance', key as 'column.value');
  const tableGroups: TableGroup<HoldingRow>[] = groups.map((group) => ({
    label: text(`group.${group.kind}`),
    aside: <Amount amount={group.total} currency={currency} />,
    items: group.rows,
  }));
  const count = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return (
    <Card size="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <h2 className="type-heading-sm">{accountName}</h2>
        <TypeBar groups={groups} />
      </div>
      <Table<HoldingRow>
        columns={columnsOf((key) => text(`column.${key}`), wide)}
        groups={tableGroups}
        keyOf={(row) => holdingIdOf(row.holding)}
        renderItem={(row) => <RowCells row={row} currency={currency} wide={wide} />}
        renderPanel={renderPanel}
        initialOpenKeys={openHoldingId === undefined ? [] : [openHoldingId]}
        footer={(
          <>
            <span className="type-body-sm text-muted">
              {translator.text('holdingMaintenance', 'footer', { count })}
            </span>
            <Amount amount={groupsTotalOf(groups)} currency={currency} className="font-bold" />
          </>
        )}
      />
    </Card>
  );
}
