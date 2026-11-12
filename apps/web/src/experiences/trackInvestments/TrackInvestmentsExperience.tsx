import type { InvestmentHolding } from '@financas/api-types';
import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useListGoalProgressQuery } from '../../api/goalsApi';
import { useListMembersQuery } from '../../api/identityApi';
import { toSourceState } from '../../api/sourceState';
import { useListAccountsQuery } from '../../api/setupApi';
import { shell } from '../../config/constants';
import { Button } from '../../kit/button/Button';
import { EmptyState } from '../../kit/emptyState/EmptyState';
import { PageHeader } from '../../kit/pageHeader/PageHeader';
import { SegmentedControl } from '../../kit/segmentedControl/SegmentedControl';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import { Tag } from '../../kit/tag/Tag';
import { useActiveHousehold } from '../../shell/activeHousehold';
import type { ShellHousehold } from '../../shell/shellConfig';
import { useI18n } from '../../utilities/I18nProvider';
import { splitGoalsOf } from '../goalFunding';
import { useListHouseholdHoldingsQuery } from '../../api/investmentsApi';
import { useListIndexRatesQuery } from './api';
import { HoldingMaintenanceFlow } from './flows/holdingMaintenance/HoldingMaintenanceFlow';
import { PortfolioOverviewFlow } from './flows/portfolioOverview/PortfolioOverviewFlow';
import { RatesMaintenanceFlow } from './flows/ratesMaintenance/RatesMaintenanceFlow';
import type { HoldingDetails } from './flows/holdingMaintenance/HoldingPanel';
import { HoldingDetailsReader } from './HoldingDetailsReader';
import { TABS, tabOf, type InvestmentsTab } from './trackInvestments';
import { useHoldingRequests, useRateRequests } from './useInvestmentRequests';
import usePayoutChart from '../usePayoutChart';
import { useOverview } from './useInvestmentReads';

// The Track Investments Experience (X7, EBD; mockups 50–53; OQ-233..236):
// the Investments page — its header, with the disabled v2 Portfolio Builders,
// and a tab per Flow: Portfolio Overview, Holding Maintenance and Rates
// Maintenance. It is the only tier here that calls the backend: it reads the
// overview with the household's Holdings and accounts once for the first two
// tabs, holds the payout chart's choice of Holdings (the payouts query's
// argument), reads an open Holding's details through Holding Maintenance's
// `details` slot, and answers every write; the cache tags refresh what a write
// changed, so no Flow refreshes another. The open tab lives in the address
// (`?tab=rates`), and so does a Holding the Holdings tab opens on
// (`?tab=holdings&holding=…`, the bell's "View holding", OQ-243); only the
// open tab is mounted, so a drawer of a hidden tab
// never sits over the shown one, and RTK Query's cache makes a switch back
// immediate (OQ-236). The page is keyed on the household, so a switch starts
// it afresh.

/** The household an Investments page works in, and who is looking. */
interface InvestmentsPageProps {
  readonly household: ShellHousehold;
  readonly userId: string;
}

/**
 * Renders the Overview tab: Portfolio Overview with the overview, the payout
 * chart's question and the active Goals' progress.
 *
 * @param props - The household.
 * @returns The Flow.
 */
function OverviewTab({ household }: { readonly household: ShellHousehold }) {
  const { overview, onRetry } = useOverview(household.id);
  const payouts = usePayoutChart(household.id);
  const accounts = useListAccountsQuery(household.id);
  const goals = useListGoalProgressQuery({ householdId: household.id, status: 'active' });
  return (
    <PortfolioOverviewFlow
      overview={overview}
      onRetry={onRetry}
      accounts={accounts.data ?? []}
      goals={goals.data}
      payouts={payouts}
    />
  );
}

/**
 * Builds Holding Maintenance's `details` slot for a household: an open row's
 * reads, mounted for as long as the row is open (OQ-234).
 *
 * @param householdId - The household.
 * @returns The slot.
 */
const detailsSlotOf = (householdId: string) => function holdingDetails(
  holding: InvestmentHolding,
  render: (details: HoldingDetails) => ReactNode,
) {
  return <HoldingDetailsReader householdId={householdId} holding={holding} render={render} />;
};

/**
 * Renders the Holdings by account tab: Holding Maintenance with the
 * overview, the Goals a split names, the index rates and the open row's reads,
 * opened on the Holding the address names, if any (OQ-243).
 *
 * @param props - The household and the signed-in user.
 * @returns The Flow.
 */
function HoldingsTab({ household, userId }: InvestmentsPageProps) {
  const [searchParams] = useSearchParams();
  const { overview, onRetry } = useOverview(household.id);
  const accounts = useListAccountsQuery(household.id);
  const active = useListGoalProgressQuery({ householdId: household.id, status: 'active' });
  const completed = useListGoalProgressQuery({ householdId: household.id, status: 'completed' });
  const indexRates = useListIndexRatesQuery(household.id);
  const requests = useHoldingRequests(household.id);
  const details = useMemo(() => detailsSlotOf(household.id), [household.id]);
  return (
    <HoldingMaintenanceFlow
      overview={overview}
      onRetry={onRetry}
      accounts={accounts.data ?? []}
      goals={splitGoalsOf(active.data ?? [], completed.data ?? [])}
      indexRates={indexRates.data}
      viewer={{ selfUserId: userId, role: household.role }}
      details={details}
      requests={requests}
      openHoldingId={searchParams.get(shell.holdingParam) ?? undefined}
    />
  );
}

/**
 * Renders the Rates tab: Rates Maintenance with the rates, the Holdings that
 * use them and the members who recorded them.
 *
 * @param props - The household and the signed-in user.
 * @returns The Flow.
 */
function RatesTab({ household, userId }: InvestmentsPageProps) {
  const rates = useListIndexRatesQuery(household.id);
  const holdings = useListHouseholdHoldingsQuery(household.id);
  const members = useListMembersQuery(household.id);
  const requests = useRateRequests(household.id);
  return (
    <RatesMaintenanceFlow
      rates={toSourceState(rates)}
      holdings={holdings.data}
      recorders={members.data}
      viewer={{ selfUserId: userId, role: household.role }}
      requests={requests}
    />
  );
}

/**
 * Renders the Portfolio Builders, disabled until v2 (mockup 50). A phone
 * leaves them out: they do nothing yet, and mockup 50 has no phone layout to
 * fit them into (OQ-236).
 *
 * @returns The two buttons.
 */
function PortfolioBuilders() {
  const translator = useI18n();
  const comingLater = translator.text('trackInvestments', 'builders.comingLater');
  return (
    <div className="flex flex-wrap items-center gap-3 max-md:hidden">
      {(['fii', 'stock'] as const).map((family) => (
        <Button
          key={family}
          disabled
          title={comingLater}
          leadingIcon={family === 'fii' ? 'apartment' : 'candlestick-chart-outline'}
        >
          {translator.text('trackInvestments', `builders.${family}`)}
          <Tag size="micro">{translator.text('trackInvestments', 'builders.version')}</Tag>
        </Button>
      ))}
    </div>
  );
}

/**
 * Holds the open tab in the address, replacing the entry on a switch so tab
 * clicks don't fill the history; the address's other parameters stay.
 *
 * @returns The open tab and the switch.
 */
const useInvestmentsTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOf(searchParams.get(shell.tabParam));

  /**
   * Opens a tab.
   *
   * @param next - The tab to open.
   */
  const openTab = (next: InvestmentsTab) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set(shell.tabParam, next);
      return params;
    }, { replace: true });
  };

  return { tab, openTab };
};

/**
 * Renders a tab's Flow.
 *
 * @param props - The tab, the household and the signed-in user.
 * @returns The Flow.
 */
function TabContent({ tab, household, userId }: InvestmentsPageProps & {
  readonly tab: InvestmentsTab;
}) {
  if (tab === 'holdings') return <HoldingsTab household={household} userId={userId} />;
  if (tab === 'rates') return <RatesTab household={household} userId={userId} />;
  return <OverviewTab household={household} />;
}

/**
 * Renders the Investments page: its header — the open tab's description,
 * the tabs and the Portfolio Builders — and the open tab's Flow.
 *
 * @param props - The household and the signed-in user.
 * @returns The page.
 */
function InvestmentsPage({ household, userId }: InvestmentsPageProps) {
  const translator = useI18n();
  const { tab, openTab } = useInvestmentsTab();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={translator.text('trackInvestments', 'title')}
        description={translator.text('trackInvestments', `description.${tab}`)}
        actions={<PortfolioBuilders />}
        tabs={(
          <SegmentedControl
            label={translator.text('trackInvestments', 'tabs.label')}
            options={TABS.map((value) => ({
              value, label: translator.text('trackInvestments', `tab.${value}`),
            }))}
            value={tab}
            onChange={openTab}
          />
        )}
      />
      <TabContent tab={tab} household={household} userId={userId} />
    </div>
  );
}

/**
 * Renders the active household's Investments page once the user and the
 * household are known: a skeleton until then, a retry if they can't be loaded.
 *
 * @returns The page.
 */
export default function TrackInvestmentsExperience() {
  const translator = useI18n();
  const active = useActiveHousehold();

  if (active.status === 'ready') {
    const { household, userId } = active.data;
    return <InvestmentsPage key={household.id} household={household} userId={userId} />;
  }
  if (active.status === 'failed') {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('trackInvestments', 'failed')}
        action={(
          <Button onClick={active.retry}>{translator.text('trackInvestments', 'retry')}</Button>
        )}
      />
    );
  }
  return <SkeletonRows label={translator.text('trackInvestments', 'loading')} />;
}
