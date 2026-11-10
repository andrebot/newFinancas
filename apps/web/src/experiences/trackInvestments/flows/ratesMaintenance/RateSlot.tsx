import type { IndexCode, IndexRateSeries, InvestmentHolding } from '@financas/api-types';
import type { Catalog } from '@financas/i18n';
import { useMemo } from 'react';
import { ratesMaintenance as settings } from '../../../../config/constants';
import type { HistorySubmission } from '../../../../kit/historyEditor/historyModel';
import type { LineTone } from '../../../../kit/lineChart/LineChart';
import { useAlerts } from '../../../../utilities/AlertProvider';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { Translator } from '../../../../utilities/i18n';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import useToday from '../../../../utilities/useToday';
import { holdingIdOf, indexName } from '../../../holdingNames';
import answerOf from '../../historyAnswer';
import { RateCard } from './interactions/RateCard';
import { RateHistoryDrawer } from './interactions/RateHistoryDrawer';
import { RateUpdateEntry } from './interactions/RateUpdateEntry';
import {
  holdingsTrackingOf, mayRecordRates, rateEntriesOf, recorderOf, type RateRecorder,
  type RateViewer,
} from './ratesMaintenance';

// One index on Rates Maintenance (FL20; mockup 53; OQ-235): its card, the
// Update form the Flow lets it open, and its history drawer. It words what
// the card shows, locks each value the viewer may not change with who
// recorded it, and turns each of the Experience's answers into K46's `done`
// / `refused` and a toast. Which form or drawer is open is the Flow's, so
// only one form is open on the page.

/** An index value as the requests send it. */
export interface RateValueInput {
  /** Percent × 10,000 (OQ-86). */
  readonly value: number;
  readonly asOf: string;
}

/** The requests Rates Maintenance makes; each answers how it went. */
export interface RateRequests {
  readonly onRecord: (index: IndexCode, input: RateValueInput) => Promise<RequestOutcome>;
  readonly onEdit: (
    index: IndexCode,
    valueId: string,
    input: RateValueInput,
  ) => Promise<RequestOutcome>;
  readonly onDelete: (index: IndexCode, valueId: string) => Promise<RequestOutcome>;
}

/** Whether a form or a drawer is open, and how to open or close it. */
export interface RateSlotToggle {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}

/** Rate Slot's props. */
export interface RateSlotProps {
  readonly series: IndexRateSeries;
  /** The household's Holdings, archived ones included; unknown while they load. */
  readonly holdings: readonly InvestmentHolding[] | undefined;
  /**
   * The household's members, who name a locked value's recorder; unknown
   * while they load or after the read failed. Pass the query's data: a new
   * array re-lists the values, which ends K46's wait for a refetch (OQ-232).
   */
  readonly recorders: readonly RateRecorder[] | undefined;
  readonly viewer: RateViewer;
  readonly requests: RateRequests;
  /** Whether this index's Update form is open, and its handlers. */
  readonly form: RateSlotToggle;
  /** Whether this index's history drawer is open, and its handlers. */
  readonly history: RateSlotToggle;
}

/**
 * Writes one of the section's texts.
 *
 * @param translator - The texts.
 * @param key - The key.
 * @param params - Its ICU params.
 * @returns The text.
 */
const say = (
  translator: Translator,
  key: string,
  params?: Record<string, string | number>,
) => translator.text('ratesMaintenance', key as keyof Catalog['ratesMaintenance'], params);

/**
 * Words why a value is locked: who recorded it, or only that it can't be
 * changed while the members are unknown.
 *
 * @param translator - The texts.
 * @param userId - Who recorded it.
 * @param recorders - The household's members; unknown while they load.
 * @returns The reason.
 */
const lockedReasonOf = (
  translator: Translator,
  userId: string | null,
  recorders: readonly RateRecorder[] | undefined,
) => {
  const recorder = recorderOf(userId, recorders);
  if (recorder.kind === 'member') return say(translator, 'locked.by', { name: recorder.name });
  return say(translator, recorder.kind === 'former' ? 'locked.former' : 'locked.unknown');
};

/**
 * Words what the index's card, form and drawer show.
 *
 * @param translator - The texts.
 * @param series - The index with its values.
 * @param holdings - The household's Holdings; unknown while they load.
 * @param today - Today, `YYYY-MM-DD`: a matured Holding feeds nothing.
 * @returns Its name, what it measures, its unit, its labels, its Holdings and the hint.
 */
const textsOf = (
  translator: Translator,
  series: IndexRateSeries,
  holdings: readonly InvestmentHolding[] | undefined,
  today: string,
) => {
  const tracking = holdings && holdingsTrackingOf(holdings, series.index, today);
  const unit = { unit: series.unit };
  return {
    name: indexName(translator, series.index),
    about: say(translator, `about.${series.index}`),
    unit: say(translator, 'unit', unit),
    formValue: say(translator, 'form.value', unit),
    historyValue: say(translator, 'history.value', unit),
    usedBy: tracking?.map((holding) => ({
      id: holdingIdOf(holding),
      name: holding.ticker ?? translator.text('holdingNames', 'unknown'),
    })),
    // While the Holdings load, what the index feeds is unknown: no hint yet.
    hint: tracking ? say(translator, 'hint', { count: tracking.length }) : '',
  };
};

/**
 * Builds the index's handlers: each request, answered for K46 and toasted.
 *
 * @param index - The index.
 * @param requests - The Experience's requests.
 * @param onRecorded - Called once a new value is saved, to close the form.
 * @returns The handlers.
 */
const useRateHandlers = (index: IndexCode, requests: RateRequests, onRecorded: () => void) => {
  const translator = useI18n();
  const alerts = useAlerts();
  const errorText = ({ code, params }: RequestFailure) => translator.error(code, params);
  const inputOf = ({ date, value }: HistorySubmission): RateValueInput => ({ value, asOf: date });
  const save = (submission: HistorySubmission) => answerOf(
    submission.key
      ? requests.onEdit(index, submission.key, inputOf(submission))
      : requests.onRecord(index, inputOf(submission)),
    say(translator, 'saved'),
    alerts,
    errorText,
  );
  return {
    save,
    record: async (submission: HistorySubmission) => {
      const outcome = await save(submission);
      if (outcome === 'done') onRecorded();
      return outcome;
    },
    remove: (key: string) => answerOf(
      requests.onDelete(index, key),
      say(translator, 'deleted'),
      alerts,
      errorText,
    ),
  };
};

/**
 * Renders one index: its card, its Update form when open, and its history drawer.
 *
 * @param props - The index, the Holdings, the members, the viewer, the
 *   requests and what is open.
 * @returns The card and the drawer.
 */
export function RateSlot({
  series, holdings, recorders, viewer, requests, form, history,
}: RateSlotProps) {
  const translator = useI18n();
  const today = useToday();
  const { selfUserId, role } = viewer;
  // Memoized on the query's data, so K46 sees a new list only on a refetch (OQ-232).
  const entries = useMemo(() => rateEntriesOf(
    series.values,
    { selfUserId, role },
    (userId) => lockedReasonOf(translator, userId, recorders),
  ), [series.values, selfUserId, role, recorders, translator]);
  const texts = textsOf(translator, series, holdings, today);
  const tone: LineTone = (settings.indexTones as Partial<Record<string, LineTone>>)[series.index]
    ?? 'sky';
  const handlers = useRateHandlers(series.index, requests, form.onClose);
  const mayRecord = mayRecordRates(role);

  return (
    <>
      <RateCard
        name={texts.name}
        about={texts.about}
        unit={texts.unit}
        tone={tone}
        entries={entries}
        usedBy={texts.usedBy}
        mayRecord={mayRecord}
        historyReadOnly={!mayRecord}
        updateForm={form.open ? (
          <RateUpdateEntry
            name={say(translator, 'form.name', { index: texts.name })}
            valueLabel={texts.formValue}
            entries={entries}
            today={today}
            hint={texts.hint}
            onSave={handlers.record}
            onCancel={form.onClose}
          />
        ) : undefined}
        onUpdate={form.onOpen}
        onOpenHistory={history.onOpen}
      />
      <RateHistoryDrawer
        open={history.open}
        indexName={texts.name}
        valueLabel={texts.historyValue}
        tone={tone}
        entries={entries}
        hint={texts.hint}
        readOnly={!mayRecord}
        onSave={handlers.save}
        onDelete={handlers.remove}
        onClose={history.onClose}
      />
    </>
  );
}
