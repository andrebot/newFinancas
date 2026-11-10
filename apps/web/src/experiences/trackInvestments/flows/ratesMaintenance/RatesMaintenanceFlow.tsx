import type { IndexCode, IndexRateSeries, InvestmentHolding } from '@financas/api-types';
import { useState } from 'react';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { SkeletonRows } from '../../../../kit/skeleton/Skeleton';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { SourceState } from '../../../../utilities/sourceState';
import { RateSlot, type RateRequests } from './RateSlot';
import type { RateRecorder, RateViewer } from './ratesMaintenance';

// The Rates Maintenance Flow (FL20; mockup 53; FR-11.6, OQ-172, OQ-178,
// OQ-232, OQ-235): what the rates are for, then one card per index — Selic,
// CDI, IPCA, IGP-M, in the API's order — each with its latest value, its last
// months, the Holdings it is projected into, an Update form and its history
// drawer. The Experience reads the rates, the household's Holdings and its
// members, and runs every write, refreshing by tag. The Flow holds which form
// and which drawer are open — one form on the page at a time. It never calls
// the backend.

export type { RateRequests, RateValueInput } from './RateSlot';
export type { RateRecorder, RateViewer } from './ratesMaintenance';

/** What the Flow asks of the Experience. */
export interface RatesMaintenanceFlowProps {
  /** Every index with its values, newest first. */
  readonly rates: SourceState<readonly IndexRateSeries[]>;
  /** The household's Holdings, archived ones included; unknown while they load. */
  readonly holdings: readonly InvestmentHolding[] | undefined;
  /**
   * The household's members, who name a locked value's recorder; unknown
   * while they load or after the read failed. Pass the query's data (OQ-232).
   */
  readonly recorders: readonly RateRecorder[] | undefined;
  readonly viewer: RateViewer;
  readonly requests: RateRequests;
}

/**
 * Renders the failed read's banner, with Try again.
 *
 * @param props - The retry.
 * @returns The banner.
 */
function FailedRates({ retry }: { readonly retry: () => void }) {
  const translator = useI18n();
  return (
    <InlineBanner
      tone="error"
      message={translator.text('ratesMaintenance', 'failed')}
      action={(
        <Button variant="ghost" onClick={retry}>
          {translator.text('ratesMaintenance', 'retry')}
        </Button>
      )}
    />
  );
}

/**
 * Renders the cards, holding which form and which drawer are open.
 *
 * @param props - The indexes and the Flow's other props.
 * @returns The grid of cards.
 */
function RateCards({
  series, ...rest
}: Omit<RatesMaintenanceFlowProps, 'rates'> & { readonly series: readonly IndexRateSeries[] }) {
  const [formIndex, setFormIndex] = useState<IndexCode>();
  const [historyIndex, setHistoryIndex] = useState<IndexCode>();
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {series.map((one) => (
        <RateSlot
          key={one.index}
          {...rest}
          series={one}
          form={{
            open: formIndex === one.index,
            onOpen: () => setFormIndex(one.index),
            // A save that ends late closes only its own form, never one opened since.
            onClose: () => setFormIndex((open) => (open === one.index ? undefined : open)),
          }}
          history={{
            open: historyIndex === one.index,
            onOpen: () => setHistoryIndex(one.index),
            onClose: () => setHistoryIndex((open) => (open === one.index ? undefined : open)),
          }}
        />
      ))}
    </div>
  );
}

/**
 * Renders Rates Maintenance.
 *
 * @param props - The rates, the Holdings, the members, the viewer and the requests.
 * @returns What the rates are for and their cards, or the placeholder or the failure.
 */
export function RatesMaintenanceFlow({ rates, ...rest }: RatesMaintenanceFlowProps) {
  const translator = useI18n();
  if (rates.status === 'loading') {
    return <SkeletonRows label={translator.text('ratesMaintenance', 'loading')} />;
  }
  if (rates.status === 'failed') return <FailedRates retry={rates.retry} />;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <InlineBanner
        tone="info"
        title={translator.text('ratesMaintenance', 'intro.title')}
        message={translator.text('ratesMaintenance', 'intro.body')}
      />
      <RateCards {...rest} series={rates.data} />
    </div>
  );
}
