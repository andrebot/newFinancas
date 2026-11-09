import type {
  Account, GoalWithProgress, InvestmentHolding, InvestmentsOverviewReport,
} from '@financas/api-types';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { EmptyState } from '../../../../kit/emptyState/EmptyState';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { PreferenceStorage } from '../../../../utilities/safeStorage';
import useFormatter from '../../../../utilities/useFormatter';
import useToday from '../../../../utilities/useToday';
import { ComingDue } from '../../../interactions/ComingDue';
import { periodLabelOf } from '../../../interactions/MonthRails';
import { NetWorthCards } from '../../../interactions/NetWorthCards';
import { PayoutPanel } from '../../../interactions/PayoutPanel';
import type { PayoutsRead } from '../../../payoutPanel';
import {
  AccountAllocation, FamilyAllocation, GoalFunding, TypeAllocation,
} from './interactions/allocationCards/AllocationCards';
import { PayoutThisMonth } from './interactions/PayoutThisMonth';

// The Portfolio Overview Flow (FL18; mockup 50; FR-5.3, FR-5.9, OQ-230,
// OQ-231, OQ-233): net worth per currency, this month's payouts beside the
// payout chart, the allocation panels, and what comes due. The Experience
// reads the investments overview, the household's Holdings, the accounts and
// the Goals, and holds the payout chart's choice of Holdings — the payouts
// query's argument — so a new choice refetches only the chart. The Flow never
// calls the backend.
//
// While the overview loads, every panel shows its placeholder; when it fails,
// one banner with Try again stands in for them all — the payout panel too,
// since the Holdings that name its choices come with the overview. A
// household with no Holding at all sees one empty state instead of a page of
// empty panels.

/** The overview, as the Experience's queries hold it. */
export type OverviewRead = | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
    readonly status: 'loaded';
    readonly report: InvestmentsOverviewReport;
    /** The household's Holdings, archived ones included: what names the report's ids. */
    readonly holdings: readonly InvestmentHolding[];
  };

/** The payout chart's part of the Flow's props. */
export interface PayoutsInput {
  /** The payouts report for the choice. */
  readonly read: PayoutsRead;
  /** The Holdings chosen, as the Experience resolved them. */
  readonly chosen: readonly string[];
  /** Emits a new choice. */
  readonly onChosenChange: (ids: readonly string[]) => void;
  /** Asks for the payouts again after they failed. */
  readonly onRetry: () => void;
  /** Where the chart's $ / R$ pick is remembered. */
  readonly currencyMemory: PreferenceStorage;
}

/** What the Flow asks of the Experience. */
export interface PortfolioOverviewFlowProps {
  readonly overview: OverviewRead;
  /** Asks for the overview again after it failed. */
  readonly onRetry: () => void;
  /** The accounts the user can see, to name By account's rows. */
  readonly accounts: readonly Account[];
  /** The active Goals with their progress; unknown while they load. */
  readonly goals: readonly GoalWithProgress[] | undefined;
  readonly payouts: PayoutsInput;
}

/**
 * Renders the failed overview's banner, with Try again.
 *
 * @param props - The retry.
 * @returns The banner.
 */
function FailedOverview({ onRetry }: { readonly onRetry: () => void }) {
  const translator = useI18n();
  return (
    <InlineBanner
      tone="error"
      message={translator.text('portfolioOverview', 'failed')}
      action={(
        <Button variant="ghost" onClick={onRetry}>
          {translator.text('portfolioOverview', 'retry')}
        </Button>
      )}
    />
  );
}

/** What the panels show: the report and its Holdings, both unknown while they load. */
interface LoadedParts {
  readonly report: InvestmentsOverviewReport | undefined;
  readonly holdings: readonly InvestmentHolding[];
}

/**
 * Renders this month's payouts beside the payout chart.
 *
 * @param props - The report, the Holdings and the chart's part of the props.
 * @returns The row.
 */
function PayoutsRow({ report, holdings, payouts }: LoadedParts & {
  readonly payouts: PayoutsInput;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  const today = useToday();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <PayoutThisMonth
        period={periodLabelOf(translator, formatter, {
          year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)),
        })}
        entries={report?.payoutThisMonth}
        holdings={holdings}
      />
      <PayoutPanel
        holdings={holdings}
        chosen={payouts.chosen}
        onChosenChange={payouts.onChosenChange}
        payouts={payouts.read}
        onRetry={payouts.onRetry}
        thisMonth={report?.payoutThisMonth}
        currencyMemory={payouts.currencyMemory}
      />
    </div>
  );
}

/**
 * Renders the allocation panels and what comes due, in the page's grid.
 *
 * @param props - The report, the Holdings, the accounts and the Goals.
 * @returns The grid.
 */
function AllocationGrid({
  report, holdings, accounts, goals,
}: LoadedParts & Pick<PortfolioOverviewFlowProps, 'accounts' | 'goals'>) {
  const slices = report?.allocations;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      <FamilyAllocation slices={slices} holdings={holdings} family="stock" />
      <FamilyAllocation slices={slices} holdings={holdings} family="fii" />
      <TypeAllocation slices={slices} />
      <GoalFunding goals={goals} />
      <AccountAllocation slices={slices} holdings={holdings} accounts={accounts} />
      <ComingDue entries={report?.comingDue} holdings={holdings} />
    </div>
  );
}

/**
 * Renders the Portfolio Overview.
 *
 * @param props - The overview, the accounts, the Goals, the payouts and the Experience's handlers.
 * @returns The overview, its failure banner, or its empty state.
 */
export function PortfolioOverviewFlow({
  overview, onRetry, accounts, goals, payouts,
}: PortfolioOverviewFlowProps) {
  const translator = useI18n();
  if (overview.status === 'loaded' && overview.holdings.length === 0) {
    return (
      <EmptyState
        icon="trending-up"
        title={translator.text('portfolioOverview', 'empty.title')}
        description={translator.text('portfolioOverview', 'empty.description')}
      />
    );
  }
  if (overview.status === 'failed') return <FailedOverview onRetry={onRetry} />;
  const parts: LoadedParts = overview.status === 'loaded'
    ? overview
    : { report: undefined, holdings: [] };
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <NetWorthCards entries={parts.report?.netWorth} />
      <PayoutsRow {...parts} payouts={payouts} />
      <AllocationGrid {...parts} accounts={accounts} goals={goals} />
    </div>
  );
}
