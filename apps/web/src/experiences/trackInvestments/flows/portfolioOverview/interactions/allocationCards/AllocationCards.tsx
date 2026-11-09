import type { Account, GoalWithProgress, InvestmentHolding } from '@financas/api-types';
import type { ReactNode } from 'react';
import { Amount } from '../../../../../../kit/amount/Amount';
import { Card } from '../../../../../../kit/card/Card';
import { ProgressBar } from '../../../../../../kit/progressBar/ProgressBar';
import { goalStatus } from '../../../../../../kit/railCard/railCard';
import { SectionHeader } from '../../../../../../kit/sectionHeader/SectionHeader';
import { Skeleton } from '../../../../../../kit/skeleton/Skeleton';
import { useI18n } from '../../../../../../utilities/I18nProvider';
import useFormatter from '../../../../../../utilities/useFormatter';
import { ownFundingOf } from '../../../../../goalFunding';
import { assetTypeName, type AssetFamily } from '../../../../../holdingNames';
import {
  accountRowsOf, familySharesOf, typeSharesOf, type AllocationSlice, type CurrencyShares,
} from '../../portfolioOverview';
import { Donut, ShareBar, ShareLegend } from './ShareParts';

// Allocation Cards (FL18; mockup 50; FR-5.3, OQ-233): today's value of the
// open Holdings, sliced the ways mockup 50 draws them — the Stocks and FIIs
// panels a donut per currency, By type a bar per currency, Goals what each
// active Goal's Holdings fund, By account each Account's Holdings. Never
// summed across currencies. A family panel shows only when the household
// holds that family; the others say when they have nothing. Each panel is its
// own card, placed by the Flow's grid. Display only.

/** What every panel is built from; the report's slices are unknown while it loads. */
export interface AllocationSources {
  readonly slices: readonly AllocationSlice[] | undefined;
  readonly holdings: readonly InvestmentHolding[];
}

/**
 * Frames a panel: its card and heading, a placeholder while loading, a line when empty.
 *
 * @param props - The title, its hint, whether it loads or is empty, and the content.
 * @returns The panel.
 */
function Panel({
  title, hint, loading, empty, children,
}: {
  readonly title: string;
  readonly hint?: string | undefined;
  readonly loading: boolean;
  readonly empty: boolean;
  readonly children: ReactNode;
}) {
  const translator = useI18n();
  return (
    <Card as="section" className="flex min-w-0 flex-col gap-4">
      <SectionHeader title={title} hint={hint} />
      {loading && (
        <div
          role="status"
          aria-busy="true"
          aria-label={translator.text('allocationCards', 'loading', { title })}
        >
          <Skeleton shape="block" className="h-24" />
        </div>
      )}
      {!loading && empty && (
        <p className="type-body-sm text-muted">{translator.text('allocationCards', 'empty')}</p>
      )}
      {!loading && !empty && children}
    </Card>
  );
}

/**
 * Renders one family's Holdings: a donut and legend per currency (Stocks, FIIs).
 *
 * @param props - The slices, the Holdings and the family.
 * @returns The panel, or nothing when the household holds none of that family.
 */
export function FamilyAllocation({ slices, holdings, family }: AllocationSources & {
  readonly family: Extract<AssetFamily, 'fii' | 'stock'>;
}) {
  const translator = useI18n();
  const wholes = slices && familySharesOf(slices, holdings, family);
  if (wholes?.length === 0) return null;
  return (
    <Panel title={translator.text('allocationCards', family)} loading={!wholes} empty={false}>
      {/* Under 320px of panel width (a phone), the donut sits above its legend. */}
      <div className="@container flex flex-col gap-4">
        {wholes?.map(({ currency, total, shares }) => (
          <div key={currency} className="flex flex-col items-center gap-4 @xs:flex-row">
            <Donut shares={shares} total={total} currency={currency} caption={currency} />
            <ShareLegend shares={shares} currency={currency} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Renders one currency's asset types: its total, the bar and the legend.
 *
 * @param props - The currency's whole.
 * @returns The block.
 */
function TypeBlock({ whole }: { readonly whole: CurrencyShares }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between type-micro uppercase text-muted">
        <span>{whole.currency}</span>
        <Amount amount={whole.total} currency={whole.currency} />
      </div>
      <ShareBar shares={whole.shares} total={whole.total} />
      <ShareLegend shares={whole.shares} currency={whole.currency} percent={false} />
    </div>
  );
}

/**
 * Renders the Holdings by asset type: a bar per currency.
 *
 * @param props - The slices.
 * @returns The panel.
 */
export function TypeAllocation({ slices }: Pick<AllocationSources, 'slices'>) {
  const translator = useI18n();
  const wholes = slices && typeSharesOf(slices, (code) => assetTypeName(translator, code));
  return (
    <Panel
      title={translator.text('allocationCards', 'byType')}
      loading={!wholes}
      empty={wholes?.length === 0}
    >
      <div className="flex flex-col gap-4">
        {wholes?.map((whole) => <TypeBlock key={whole.currency} whole={whole} />)}
      </div>
    </Panel>
  );
}

/**
 * Renders one Goal's funding: its percent, and its progress or that nothing funds it.
 *
 * @param props - The Goal with its progress.
 * @returns The row.
 */
function GoalRow({ goal }: { readonly goal: GoalWithProgress }) {
  const translator = useI18n();
  const formatter = useFormatter();
  const { funded, unfunded } = ownFundingOf(goal);
  const status = goalStatus(funded, goal.targetAmount);
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 type-body-sm">
        <span className="min-w-0 truncate font-semibold text-ink">{goal.name}</span>
        {unfunded ? (
          <span className="shrink-0 italic text-muted">
            {translator.text('railCard', 'goal.unfunded')}
          </span>
        ) : (
          <span className="shrink-0 text-muted tabular-nums">
            {formatter.percent(status.percent)}
          </span>
        )}
      </div>
      {!unfunded && (
        <ProgressBar
          value={status.percent}
          tone={status.reached ? 'mint' : 'sky'}
          label={translator.text('allocationCards', 'goalAmounts', {
            funded: formatter.money(funded, goal.targetCurrency),
            target: formatter.money(goal.targetAmount, goal.targetCurrency),
          })}
          ariaLabel={translator.text('allocationCards', 'goalProgress', { name: goal.name })}
        />
      )}
    </li>
  );
}

/**
 * Renders what the Holdings fund: each active Goal's progress.
 *
 * @param props - The active Goals with their progress; unknown while they load.
 * @returns The panel.
 */
export function GoalFunding({ goals }: {
  readonly goals: readonly GoalWithProgress[] | undefined;
}) {
  const translator = useI18n();
  return (
    <Panel
      title={translator.text('allocationCards', 'goals')}
      hint={translator.text('allocationCards', 'goals.hint')}
      loading={!goals}
      empty={goals?.length === 0}
    >
      <ul className="flex flex-col gap-4">
        {goals?.map((goal) => <GoalRow key={goal.id} goal={goal} />)}
      </ul>
    </Panel>
  );
}

/**
 * Renders the Holdings by Account: each Account's value and how many it holds.
 *
 * @param props - The slices, the Holdings and the accounts.
 * @returns The panel.
 */
export function AccountAllocation({ slices, holdings, accounts }: AllocationSources & {
  readonly accounts: readonly Account[];
}) {
  const translator = useI18n();
  const rows = slices && accountRowsOf(slices, accounts, holdings);
  return (
    <Panel
      title={translator.text('allocationCards', 'byAccount')}
      loading={!rows}
      empty={rows?.length === 0}
    >
      <ul className="flex flex-col gap-3">
        {rows?.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate type-body-sm font-semibold text-ink">{row.name}</p>
              <p className="type-caption text-muted">
                {translator.text('allocationCards', 'holdings', { count: row.holdings })}
              </p>
            </div>
            <Amount
              amount={row.amount}
              currency={row.currency}
              className="type-body-sm font-bold"
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
