import { useNavigate } from 'react-router';
import { useListHouseholdHoldingsQuery } from '../../api/investmentsApi';
import { useListAccountsQuery } from '../../api/setupApi';
import { shell } from '../../config/constants';
import { Button } from '../../kit/button/Button';
import { EmptyState } from '../../kit/emptyState/EmptyState';
import { PageHeader } from '../../kit/pageHeader/PageHeader';
import { periodClasses } from '../../kit/sectionHeader/SectionHeader';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import { useActiveHousehold } from '../../shell/activeHousehold';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { periodLabelOf } from '../interactions/MonthRails';
import usePayoutChart from '../usePayoutChart';
import { useGetDashboardQuery } from './api';
import { DashboardFlow } from './flows/dashboard/DashboardFlow';
import { dashboardReadOf, periodOfMonth } from './reviewInsights';

// The Review Insights Experience (X8, EBD; mockup 20; FR-6.0, OQ-242, OQ-243):
// the Dashboard page — its header, titled with the report's month, and the
// Dashboard Flow. It is the only tier here that calls the backend: it reads
// the Dashboard with the household's Holdings and accounts, and holds the
// payout chart's choice of Holdings, shared with Track Investments
// (`usePayoutChart`); the cache tags refresh the panels after any write
// elsewhere. The bell's inbox and the audit-log export, the Experience's other
// parts, live in the App Shell's chrome (`chrome.tsx`). The page is keyed on
// the household, so a switch starts it afresh.

/**
 * Renders the Dashboard page for one household.
 *
 * @param props - The household.
 * @returns The page.
 */
function DashboardPage({ householdId }: { readonly householdId: string }) {
  const translator = useI18n();
  const formatter = useFormatter();
  const navigate = useNavigate();
  const report = useGetDashboardQuery(householdId);
  const holdings = useListHouseholdHoldingsQuery(householdId);
  const accounts = useListAccountsQuery(householdId);
  const payouts = usePayoutChart(householdId);
  const month = report.data?.month;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={translator.text('reviewInsights', 'title')}
        description={translator.text('reviewInsights', 'description')}
        actions={month && (
          <span className={periodClasses()}>
            {periodLabelOf(translator, formatter, periodOfMonth(month))}
          </span>
        )}
      />
      <DashboardFlow
        dashboard={dashboardReadOf({ report, holdings, accounts })}
        onRetry={() => {
          [report, holdings, accounts].forEach((query) => {
            if (query.isError) query.refetch();
          });
        }}
        onGoToTransactions={() => navigate(shell.paths.transactions)}
        payouts={payouts}
      />
    </div>
  );
}

/**
 * Renders the active household's Dashboard once the household is known: a
 * skeleton until then, a retry if it can't be loaded.
 *
 * @returns The page.
 */
export default function ReviewInsightsExperience() {
  const translator = useI18n();
  const active = useActiveHousehold();

  if (active.status === 'ready') {
    const { household } = active.data;
    return <DashboardPage key={household.id} householdId={household.id} />;
  }
  if (active.status === 'failed') {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('reviewInsights', 'failed')}
        action={(
          <Button onClick={active.retry}>{translator.text('reviewInsights', 'retry')}</Button>
        )}
      />
    );
  }
  return <SkeletonRows label={translator.text('reviewInsights', 'loading')} />;
}
