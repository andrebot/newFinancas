import type { Account, DashboardReport, InvestmentHolding } from '@financas/api-types';
import { dashboard as dashboardSettings } from '../../../../config/constants';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { Card } from '../../../../kit/card/Card';
import { EmptyState } from '../../../../kit/emptyState/EmptyState';
import { useI18n } from '../../../../utilities/I18nProvider';
import useFormatter from '../../../../utilities/useFormatter';
import useToday from '../../../../utilities/useToday';
import { balanceCardsOf } from '../../../balanceCards';
import { ComingDue } from '../../../interactions/ComingDue';
import { MonthRails, periodLabelOf } from '../../../interactions/MonthRails';
import { NetWorthCards } from '../../../interactions/NetWorthCards';
import { PayoutPanel } from '../../../interactions/PayoutPanel';
import type { PayoutsInput } from '../../../payoutPanel';

// The Dashboard Flow (FL21; mockup 20; FR-6.0, OQ-231, OQ-242): the v1
// Dashboard's fixed panels for the current month — net worth per currency
// beside what comes due, the payout chart, and the month's Balance, Budget
// and Goal rails (budgets over-budget first, the report's order). Every
// panel is an Interaction shared with Track Investments' and Manage
// Finances' overviews. The Experience reads the Dashboard, the household's
// Holdings and the accounts, and holds the payout chart's choice of
// Holdings — the payouts query's argument — so a new choice refetches only
// the chart. The Flow never calls the backend.
//
// While the Dashboard loads every panel shows its placeholder; when it
// fails, one banner with Try again stands in for them all, since one request
// brings them. A household with no Holding sees one card in place of the
// investment panels, pointing to Transactions, where a buy creates one
// (FR-5.1); the rails show as always.

/** The Dashboard, as the Experience's queries hold it. */
export type DashboardRead = | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
    readonly status: 'loaded';
    readonly report: DashboardReport;
    /** The household's Holdings, archived ones included: what names the report's ids. */
    readonly holdings: readonly InvestmentHolding[];
    /** The accounts the user can see, archived ones included, with their cards. */
    readonly accounts: readonly Account[];
  };

/** What the Flow asks of the Experience. */
export interface DashboardFlowProps {
  /** The Dashboard; `loaded` only once the report, the Holdings and the accounts are all in. */
  readonly dashboard: DashboardRead;
  /** Asks for the Dashboard again after it failed. */
  readonly onRetry: () => void;
  /** Opens Transactions, from the card a household with no Holding sees. */
  readonly onGoToTransactions: () => void;
  readonly payouts: PayoutsInput;
}

/** What the panels show: the report and its Holdings, the report unknown while it loads. */
interface LoadedParts {
  readonly report: DashboardReport | undefined;
  readonly holdings: readonly InvestmentHolding[];
}

/**
 * Renders the failed Dashboard's banner, with Try again.
 *
 * @param props - The retry.
 * @returns The banner.
 */
function FailedDashboard({ onRetry }: { readonly onRetry: () => void }) {
  const translator = useI18n();
  return (
    <InlineBanner
      tone="error"
      message={translator.text('dashboard', 'failed')}
      action={(
        <Button variant="ghost" onClick={onRetry}>
          {translator.text('dashboard', 'retry')}
        </Button>
      )}
    />
  );
}

/**
 * Renders the card a household with no Holding sees in place of the investment panels.
 *
 * @param props - The way to Transactions.
 * @returns The card.
 */
function NoInvestments({ onGoToTransactions }: Pick<DashboardFlowProps, 'onGoToTransactions'>) {
  const translator = useI18n();
  return (
    <Card as="section">
      <EmptyState
        icon="trending-up"
        title={translator.text('dashboard', 'empty.title')}
        description={translator.text('dashboard', 'empty.description')}
        action={(
          <Button variant="secondary" onClick={onGoToTransactions}>
            {translator.text('dashboard', 'empty.action')}
          </Button>
        )}
      />
    </Card>
  );
}

/**
 * Renders net worth beside what comes due, then the payout chart.
 *
 * @param props - The report, the Holdings and the chart's part of the props.
 * @returns The investment panels.
 */
function InvestmentPanels({ report, holdings, payouts }: LoadedParts & {
  readonly payouts: PayoutsInput;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <NetWorthCards
          entries={report?.netWorth}
          chartHeightPx={dashboardSettings.netWorthChartHeightPx}
          grid
        />
        <ComingDue entries={report?.comingDue} holdings={holdings} />
      </div>
      <PayoutPanel
        holdings={holdings}
        chosen={payouts.chosen}
        onChosenChange={payouts.onChosenChange}
        // Until the Dashboard brings the Holdings, the panel can only wait.
        payouts={report ? payouts.read : { status: 'loading' }}
        onRetry={payouts.onRetry}
        currencyMemory={payouts.currencyMemory}
      />
    </>
  );
}

/** The loaded Dashboard. */
type LoadedDashboard = Extract<DashboardRead, { readonly status: 'loaded' }>;

/**
 * Renders this month's rails: the balances across the page, the budgets
 * beside the Goals from `xl` (mockup 20).
 *
 * @param props - The loaded Dashboard; none while it loads.
 * @returns The rails.
 */
function DashboardRails({ loaded }: { readonly loaded: LoadedDashboard | undefined }) {
  const translator = useI18n();
  const formatter = useFormatter();
  const today = useToday();
  return (
    <div className="grid grid-cols-1 gap-6 *:min-w-0 xl:grid-cols-2 xl:*:first:col-span-2">
      <MonthRails
        period={periodLabelOf(translator, formatter, {
          year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)),
        })}
        content={loaded && {
          balances: balanceCardsOf(loaded.report.balances, loaded.accounts, translator),
          budgets: loaded.report.budgets,
          goals: loaded.report.goals,
        }}
      />
    </div>
  );
}

/**
 * Renders the investment panels, or the card in their place when the
 * household has no Holding.
 *
 * @param props - The loaded Dashboard (none while it loads), the way to
 *   Transactions and the payouts.
 * @returns The panels or the card.
 */
function Investments({ loaded, onGoToTransactions, payouts }: {
  readonly loaded: LoadedDashboard | undefined;
} & Pick<DashboardFlowProps, 'onGoToTransactions' | 'payouts'>) {
  if (loaded?.holdings.length === 0) {
    return <NoInvestments onGoToTransactions={onGoToTransactions} />;
  }
  return (
    <InvestmentPanels
      report={loaded?.report}
      holdings={loaded?.holdings ?? []}
      payouts={payouts}
    />
  );
}

/**
 * Renders the Dashboard.
 *
 * @param props - The Dashboard, the payouts and the Experience's handlers.
 * @returns The panels, or the failure banner.
 */
export function DashboardFlow({
  dashboard, onRetry, onGoToTransactions, payouts,
}: DashboardFlowProps) {
  if (dashboard.status === 'failed') return <FailedDashboard onRetry={onRetry} />;
  const loaded = dashboard.status === 'loaded' ? dashboard : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Investments loaded={loaded} onGoToTransactions={onGoToTransactions} payouts={payouts} />
      <DashboardRails loaded={loaded} />
    </div>
  );
}
