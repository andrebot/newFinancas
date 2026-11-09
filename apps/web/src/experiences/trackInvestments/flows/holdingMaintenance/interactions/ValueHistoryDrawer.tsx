import type { Currency } from '@financas/api-types';
import { Button } from '../../../../../kit/button/Button';
import { Drawer } from '../../../../../kit/drawer/Drawer';
import { HistoryEditor } from '../../../../../kit/historyEditor/HistoryEditor';
import type {
  HistoryEntry, HistoryOutcome, HistorySubmission,
} from '../../../../../kit/historyEditor/historyModel';
import { useI18n } from '../../../../../utilities/I18nProvider';
import useFormatter from '../../../../../utilities/useFormatter';

// Value History Editor (FL19; mockup 52; FR-5.2, OQ-56, OQ-232, OQ-234): a
// market-priced Holding's saved values in a drawer, on K46 — the chart with
// what was invested as a dashed level, each value editable in place or
// deleted behind a confirm, a past one added, and what a save recalculates
// (net worth from that month on). A trade's value is locked with its reason;
// an archived Holding, or a user who may not change it, only reads. The
// caller runs the requests.

/** Value History Editor's props. */
export interface ValueHistoryDrawerProps {
  readonly open: boolean;
  readonly ticker: string;
  readonly currency: Currency;
  /** The saved values, newest first, as the API sends them; locked ones carry their reason. */
  readonly entries: readonly HistoryEntry[];
  /** What the position cost, drawn as a dashed level. */
  readonly invested: number;
  readonly readOnly: boolean;
  readonly onSave: (submission: HistorySubmission) => Promise<HistoryOutcome>;
  readonly onDelete: (key: string) => Promise<HistoryOutcome>;
  readonly onClose: () => void;
}

/**
 * Renders a Holding's value history in a drawer.
 *
 * @param props - The drawer's state, the Holding's values and the handlers.
 * @returns The drawer.
 */
export function ValueHistoryDrawer({
  open, ticker, currency, entries, invested, readOnly, onSave, onDelete, onClose,
}: ValueHistoryDrawerProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      caption={translator.text('holdingMaintenance', 'history.title')}
      title={ticker}
      size="wide"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="max-w-md type-caption text-muted">
            {translator.text('holdingMaintenance', 'history.footnote')}
          </p>
          <Button variant="primary" onClick={onClose}>
            {translator.text('holdingMaintenance', 'history.done')}
          </Button>
        </div>
      )}
    >
      <HistoryEditor
        entries={entries}
        valueKind={{ kind: 'money', currency }}
        chartLabel={translator.text('holdingMaintenance', 'history.chart', { ticker })}
        reference={invested > 0 ? {
          value: invested,
          label: translator.text('holdingMaintenance', 'history.reference', {
            amount: formatter.money(invested, currency, { compact: true }),
          }),
        } : undefined}
        impactHint={(fromDate) => translator.text('holdingMaintenance', 'history.impact', {
          month: formatter.date(fromDate, 'monthYear'),
        })}
        readOnly={readOnly}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Drawer>
  );
}
