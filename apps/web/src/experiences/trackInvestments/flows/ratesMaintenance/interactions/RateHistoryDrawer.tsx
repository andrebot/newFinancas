import { Button } from '../../../../../kit/button/Button';
import { Drawer } from '../../../../../kit/drawer/Drawer';
import { HistoryEditor } from '../../../../../kit/historyEditor/HistoryEditor';
import type {
  HistoryEntry, HistoryOutcome, HistorySubmission,
} from '../../../../../kit/historyEditor/historyModel';
import type { LineTone } from '../../../../../kit/lineChart/LineChart';
import { useI18n } from '../../../../../utilities/I18nProvider';

// Rate History Editor (FL20; mockup 53; FR-11.6, OQ-172, OQ-178, OQ-232,
// OQ-235): an index's saved values in a drawer, on K46 — the chart in the
// index's colour, each value editable in place or deleted behind a confirm,
// a past one added, one value per day. A value another Member recorded is
// locked with who did; a Viewer only reads. The hint says what the index
// feeds, true of any save: only its latest value is projected. The caller
// runs the requests.

/** Rate History Editor's props. */
export interface RateHistoryDrawerProps {
  readonly open: boolean;
  /** The index's name, e.g. "Selic". */
  readonly indexName: string;
  /** The value field's label, already translated, e.g. "Value (% a year)". */
  readonly valueLabel: string;
  readonly tone: LineTone;
  /** The saved values, newest first, as the API sends them; locked ones carry their reason. */
  readonly entries: readonly HistoryEntry[];
  /** What the index feeds, already translated. */
  readonly hint: string;
  readonly readOnly: boolean;
  readonly onSave: (submission: HistorySubmission) => Promise<HistoryOutcome>;
  readonly onDelete: (key: string) => Promise<HistoryOutcome>;
  readonly onClose: () => void;
}

/**
 * Renders an index's value history in a drawer.
 *
 * @param props - The drawer's state, the index's values and the handlers.
 * @returns The drawer.
 */
export function RateHistoryDrawer({
  open, indexName, valueLabel, tone, entries, hint, readOnly, onSave, onDelete, onClose,
}: RateHistoryDrawerProps) {
  const translator = useI18n();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      caption={translator.text('ratesMaintenance', 'history.title')}
      title={indexName}
      size="wide"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="max-w-md type-caption text-muted">
            {translator.text('ratesMaintenance', 'history.footnote')}
          </p>
          <Button variant="primary" onClick={onClose}>
            {translator.text('ratesMaintenance', 'history.done')}
          </Button>
        </div>
      )}
    >
      <HistoryEditor
        entries={entries}
        valueKind={{ kind: 'rate' }}
        chartLabel={translator.text('ratesMaintenance', 'history.chart', { index: indexName })}
        tone={tone}
        valueLabel={valueLabel}
        impactHint={() => hint}
        uniqueDays
        readOnly={readOnly}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Drawer>
  );
}
