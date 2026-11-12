import type {
  Account, IndexRateSeries, InvestmentHolding, InvestmentsOverviewReport,
} from '@financas/api-types';
import { useState, type ReactNode } from 'react';
import { holdingMaintenance as settings } from '../../../../config/constants';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { EmptyState } from '../../../../kit/emptyState/EmptyState';
import { SkeletonRows } from '../../../../kit/skeleton/Skeleton';
import { useI18n } from '../../../../utilities/I18nProvider';
import useMediaQuery from '../../../../utilities/useMediaQuery';
import { holdingIdOf } from '../../../holdingNames';
import { mayManageOwned } from '../../../ownership';
import type { OverviewRead } from '../../overviewRead';
import {
  accountCardsOf, holdingGroupsOf, payoutThisMonthOf, type AccountCard, type HoldingGoal,
  type HoldingRow,
} from './holdingMaintenance';
import { HoldingPanel, type HoldingDetails, type HoldingRequests } from './HoldingPanel';
import { AccountPicker } from './interactions/AccountPicker';
import { HoldingsTable } from './interactions/HoldingsTable';

// The Holding Maintenance Flow (FL19; mockups 51, 52; FR-5.1, FR-5.2, FR-5.9,
// FR-8.2, OQ-232, OQ-234): the household's investment accounts as cards, the
// chosen one's Holdings in a table — today's values from the overview's
// slices — and an open row's cards: a fixed-term contract, or a position, its
// market value and history, its latest activity; and the goal split. The
// Experience reads the overview with the household's Holdings (shared with
// Portfolio Overview), the accounts, the Goals and the index rates, and, for
// an open row only, that Holding's details through the `details` slot; it
// runs every write and refreshes by tag. The Flow holds the chosen account;
// each open row holds its own drafts. A Holding a link pointed at — the
// bell's "View holding", OQ-243 — opens with its account chosen and its row
// open. It never calls the backend.

/** Who is looking: what the "may change" rule reads (OQ-178, OQ-223). */
export interface HoldingViewer {
  readonly selfUserId: string;
  /** Their role in the household. */
  readonly role: string | undefined;
}

/** What the Flow asks of the Experience. */
export interface HoldingMaintenanceFlowProps {
  /** The overview and the household's Holdings, archived ones included. */
  readonly overview: OverviewRead;
  /** Asks for the overview again after it failed. */
  readonly onRetry: () => void;
  /** The accounts the user can see, archived ones included. */
  readonly accounts: readonly Account[];
  /** The Goals the user can see, completed ones included, with their progress. */
  readonly goals: readonly HoldingGoal[];
  /** Every index with its values; unknown while they load. */
  readonly indexRates: readonly IndexRateSeries[] | undefined;
  readonly viewer: HoldingViewer;
  /**
   * Renders an open Holding's details: the Experience reads them for as long
   * as what it returns is mounted, handing them to `render`.
   */
  readonly details: (
    holding: InvestmentHolding,
    render: (details: HoldingDetails) => ReactNode,
  ) => ReactNode;
  readonly requests: HoldingRequests;
  /** The Holding to show first — its account chosen, its row open (OQ-243). */
  readonly openHoldingId?: string | undefined;
}

/**
 * Renders the failed overview's banner, with Try again.
 *
 * @param props - The retry.
 * @returns The banner.
 */
function FailedHoldings({ onRetry }: { readonly onRetry: () => void }) {
  const translator = useI18n();
  return (
    <InlineBanner
      tone="error"
      message={translator.text('holdingMaintenance', 'failed')}
      action={(
        <Button variant="ghost" onClick={onRetry}>
          {translator.text('holdingMaintenance', 'retry')}
        </Button>
      )}
    />
  );
}

/** What the loaded page needs beyond the Flow's props. */
interface LoadedProps extends Omit<HoldingMaintenanceFlowProps, 'overview' | 'onRetry'> {
  readonly report: InvestmentsOverviewReport;
  readonly holdings: readonly InvestmentHolding[];
  readonly cards: readonly AccountCard[];
}

/**
 * Renders the picker and the chosen account's table.
 *
 * @param props - The report, the Holdings, the cards and the Flow's props.
 * @returns The page's content.
 */
function LoadedHoldings({
  report, holdings, cards, goals, indexRates, viewer, details, requests, openHoldingId,
}: LoadedProps) {
  const [chosenId, setChosenId] = useState(() => (
    holdings.find((holding) => holding.id === openHoldingId)?.accountId
  ));
  const wide = useMediaQuery(settings.wideQuery, true);
  // A chosen account that no longer holds anything gives way to the first.
  const card = cards.find(({ account }) => account.id === chosenId) ?? cards[0]!;
  const { account } = card;
  const { currency } = account;
  const own = holdings.filter((holding) => holding.accountId === account.id);
  const mayManage = mayManageOwned(account, viewer.selfUserId, viewer.role);

  /**
   * Renders an open row's cards through the Experience's details slot.
   *
   * @param row - The row.
   * @returns The panel.
   */
  const renderPanel = (row: HoldingRow) => details(row.holding, (read) => (
    <HoldingPanel
      row={row}
      currency={currency}
      details={read}
      goals={goals}
      indexRates={indexRates}
      payout={payoutThisMonthOf(report.payoutThisMonth, holdingIdOf(row.holding), currency)}
      mayChange={mayManage && !row.archived}
      requests={requests}
    />
  ));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountPicker cards={cards} selectedId={account.id} onSelect={setChosenId} />
      <HoldingsTable
        accountName={account.name}
        currency={currency}
        groups={holdingGroupsOf(own, report.allocations, currency)}
        wide={wide}
        renderPanel={renderPanel}
        openHoldingId={openHoldingId}
      />
    </div>
  );
}

/**
 * Renders Holding Maintenance.
 *
 * @param props - The overview, the accounts, the Goals, the index rates, the
 *   viewer, the details slot and the requests.
 * @returns The page's content, its placeholder, its failure or its empty state.
 */
export function HoldingMaintenanceFlow({
  overview, onRetry, ...rest
}: HoldingMaintenanceFlowProps) {
  const translator = useI18n();
  if (overview.status === 'loading') {
    return <SkeletonRows label={translator.text('holdingMaintenance', 'loading')} />;
  }
  if (overview.status === 'failed') return <FailedHoldings onRetry={onRetry} />;
  const cards = accountCardsOf(rest.accounts, overview.holdings, overview.report.allocations);
  if (cards.length === 0) {
    return (
      <EmptyState
        icon="trending-up"
        title={translator.text('holdingMaintenance', 'empty.title')}
        description={translator.text('holdingMaintenance', 'empty.description')}
      />
    );
  }
  return (
    <LoadedHoldings
      {...rest}
      report={overview.report}
      holdings={overview.holdings}
      cards={cards}
    />
  );
}
