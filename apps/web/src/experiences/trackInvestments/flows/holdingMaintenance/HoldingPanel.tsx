import type {
  Currency, HoldingAllocation, IndexRateSeries, LedgerItem, ValuationSnapshot,
} from '@financas/api-types';
import { useState } from 'react';
import type { HistorySubmission } from '../../../../kit/historyEditor/historyModel';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { SkeletonRows } from '../../../../kit/skeleton/Skeleton';
import { useAlerts } from '../../../../utilities/AlertProvider';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import type { SourceState } from '../../../../utilities/sourceState';
import useToday from '../../../../utilities/useToday';
import { holdingIdOf } from '../../../holdingNames';
import answerOf from '../../historyAnswer';
import {
  historyEntriesOf, isFixedTermHolding, latestIndexOf, type HoldingGoal, type HoldingRow,
} from './holdingMaintenance';
import { ActivityCard } from './interactions/ActivityCard';
import { ContractCard } from './interactions/ContractCard';
import { DetailCard } from './interactions/DetailCard';
import { GoalAllocationCard } from './interactions/GoalAllocationCard';
import { MarketValueEntry } from './interactions/MarketValueEntry';
import { PositionCard } from './interactions/PositionCard';
import { ValueHistoryDrawer } from './interactions/ValueHistoryDrawer';

// An open holding row (FL19; mockup 51; OQ-234): a fixed-term Holding's
// Contract and goal split; a market-priced one's Position, Market value,
// Activity and goal split, with the value history drawer it opens. Mounted
// only while the row is open, so a closed row reads nothing: the
// Experience's queries for this Holding live in the `details` slot it
// renders through. Every request is the Experience's; this turns each answer
// into K46's `done` / `refused` and a toast.

/** What the Experience reads for an open Holding. */
export interface HoldingDetails {
  /** Its split over the Goals the user can see. */
  readonly allocations: SourceState<readonly HoldingAllocation[]>;
  /** Its value history, newest first — market-priced only; a fixed-term one has none. */
  readonly snapshots: SourceState<readonly ValuationSnapshot[]>;
  /** Its latest transactions, newest first — market-priced only. */
  readonly activity: SourceState<readonly LedgerItem[]>;
}

/** A market value as the requests send it. */
export interface MarketValue {
  readonly asOfDate: string;
  /** Minor units. */
  readonly valuation: number;
}

/** The requests an open row makes; each answers how it went. */
export interface HoldingRequests {
  readonly onSaveAllocations: (
    holdingId: string,
    allocations: HoldingAllocation[],
  ) => Promise<RequestOutcome>;
  readonly onRecordValue: (holdingId: string, value: MarketValue) => Promise<RequestOutcome>;
  readonly onEditValue: (
    holdingId: string,
    snapshotId: string,
    value: MarketValue,
  ) => Promise<RequestOutcome>;
  readonly onDeleteValue: (holdingId: string, snapshotId: string) => Promise<RequestOutcome>;
  /** Asks for the ledger filtered by this Holding (OQ-222). */
  readonly onSeeTransactions: (holdingId: string) => void;
}

/** Holding Panel's props. */
export interface HoldingPanelProps {
  readonly row: HoldingRow;
  readonly currency: Currency;
  readonly details: HoldingDetails;
  readonly goals: readonly HoldingGoal[];
  /** Every index with its values; unknown while they load. */
  readonly indexRates: readonly IndexRateSeries[] | undefined;
  /** What it paid this month. */
  readonly payout: number;
  /** Whether the user may change it (its account's rule) — an archived one never. */
  readonly mayChange: boolean;
  readonly requests: HoldingRequests;
}

/**
 * Builds the open row's handlers: each request, answered for K46/K47 and toasted.
 *
 * @param holdingId - The Holding.
 * @param requests - The Experience's requests.
 * @returns The handlers.
 */
const useHandlers = (holdingId: string, requests: HoldingRequests) => {
  const translator = useI18n();
  const alerts = useAlerts();
  const say = (key: string) => translator.text('holdingMaintenance', key as 'value.saved');
  const errorText = ({ code, params }: RequestFailure) => translator.error(code, params);
  const valueOf = ({ date, value }: HistorySubmission): MarketValue => ({
    asOfDate: date, valuation: value,
  });
  return {
    saveSplit: (allocations: HoldingAllocation[]) => answerOf(
      requests.onSaveAllocations(holdingId, allocations),
      say('goals.saved'),
      alerts,
      errorText,
    ),
    saveValue: (submission: HistorySubmission) => answerOf(
      submission.key
        ? requests.onEditValue(holdingId, submission.key, valueOf(submission))
        : requests.onRecordValue(holdingId, valueOf(submission)),
      say('value.saved'),
      alerts,
      errorText,
    ),
    deleteValue: (key: string) => answerOf(
      requests.onDeleteValue(holdingId, key),
      say('history.deleted'),
      alerts,
      errorText,
    ),
  };
};

/**
 * Stands in for the value card while its values load or after they failed.
 *
 * @param props - The read, not yet ready.
 * @returns The card with its placeholder, or the failure with Try again.
 */
function PendingValue({ snapshots }: {
  readonly snapshots: Exclude<HoldingDetails['snapshots'], { status: 'ready' }>;
}) {
  const translator = useI18n();
  return (
    <DetailCard icon="sell-outline" title={translator.text('holdingMaintenance', 'value.title')}>
      {snapshots.status === 'loading'
        ? <SkeletonRows label={translator.text('holdingMaintenance', 'loading')} count={3} />
        : (
          <InlineBanner
            tone="error"
            message={translator.text('holdingMaintenance', 'details.failed')}
            action={(
              <Button variant="ghost" onClick={snapshots.retry}>
                {translator.text('holdingMaintenance', 'retry')}
              </Button>
            )}
          />
        )}
    </DetailCard>
  );
}

/**
 * Draws a market-priced Holding's value card and its history drawer, once the
 * values are read.
 *
 * @param props - The row, its currency, its values, whether it can change and the handlers.
 * @returns The card and the drawer, or the card's stand-in.
 */
function MarketValue({
  row, currency, snapshots, mayChange, handlers,
}: Pick<HoldingPanelProps, 'row' | 'currency' | 'mayChange'> & {
  readonly snapshots: HoldingDetails['snapshots'];
  readonly handlers: ReturnType<typeof useHandlers>;
}) {
  const translator = useI18n();
  const today = useToday();
  const [historyOpen, setHistoryOpen] = useState(false);
  if (snapshots.status !== 'ready') return <PendingValue snapshots={snapshots} />;
  const say = (key: 'history.trade' | 'value.archivedNote') => (
    translator.text('holdingMaintenance', key)
  );
  const entries = historyEntriesOf(snapshots.data, say('history.trade'));
  const { holding } = row;
  const ticker = holding.ticker ?? '';
  return (
    <>
      <MarketValueEntry
        ticker={ticker}
        currency={currency}
        entries={entries}
        today={today}
        readOnly={!mayChange}
        readOnlyNote={row.archived ? say('value.archivedNote') : undefined}
        onSave={handlers.saveValue}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <ValueHistoryDrawer
        open={historyOpen}
        ticker={ticker}
        currency={currency}
        entries={entries}
        invested={holding.costBasis ?? 0}
        readOnly={!mayChange}
        onSave={handlers.saveValue}
        onDelete={handlers.deleteValue}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}

/**
 * Renders an open holding row.
 *
 * @param props - The row, its currency, its details, the Goals, the index rates,
 *   this month's payout, whether it can change, and the requests.
 * @returns The row's cards: two columns from `md`, one below.
 */
export function HoldingPanel({
  row, currency, details, goals, indexRates, payout, mayChange, requests,
}: HoldingPanelProps) {
  const today = useToday();
  const { holding } = row;
  const holdingId = holdingIdOf(holding);
  const handlers = useHandlers(holdingId, requests);
  const fixedTerm = isFixedTermHolding(holding);
  const rateType = holding.rate?.type;
  return (
    <div className="grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2 md:pl-[95px]">
      {fixedTerm ? (
        <ContractCard
          holding={holding}
          currency={currency}
          today={today}
          latestIndex={rateType && indexRates ? latestIndexOf(indexRates, rateType) : undefined}
        />
      ) : (
        <>
          <PositionCard holding={holding} currency={currency} value={row.value} payout={payout} />
          <MarketValue
            row={row}
            currency={currency}
            snapshots={details.snapshots}
            mayChange={mayChange}
            handlers={handlers}
          />
          <ActivityCard
            read={details.activity}
            currency={currency}
            onSeeAll={() => requests.onSeeTransactions(holdingId)}
          />
        </>
      )}
      <GoalAllocationCard
        read={details.allocations}
        goals={goals}
        readOnly={!mayChange}
        onSave={handlers.saveSplit}
      />
    </div>
  );
}
