import type { Currency } from '@financas/api-types';
import { useRef, useState, type FormEvent } from 'react';
import { holdingMaintenance as settings } from '../../../../../config/constants';
import { Amount } from '../../../../../kit/amount/Amount';
import { Button } from '../../../../../kit/button/Button';
import { DateInput } from '../../../../../kit/dateInput/DateInput';
import {
  chartPointsOf, draftErrorsOf, isDraftValid, pendingOf,
  type HistoryDraft, type HistoryDraftErrors, type HistoryEntry, type HistoryOutcome,
  type HistorySubmission,
} from '../../../../../kit/historyEditor/historyModel';
import { Icon } from '../../../../../kit/icons/Icon';
import { LineChart } from '../../../../../kit/lineChart/LineChart';
import { MoneyInput } from '../../../../../kit/moneyInput/MoneyInput';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { moneyConventions } from '../../../../../utilities/formatting';
import type { Translator } from '../../../../../utilities/i18n';
import useFocusFirstInvalid from '../../../../../utilities/useFocusFirstInvalid';
import useFormatter from '../../../../../utilities/useFormatter';
import { valueChangeOf } from '../holdingMaintenance';
import { DetailCard } from './DetailCard';

// Market Value Entry (FL19; mockup 51; FR-5.2, OQ-56, OQ-232, OQ-234): a
// market-priced Holding's latest value and its date, its history drawn by
// K38 with the value being typed as a dashed ring, and a quick form — a new
// value, its date (today unless changed) and the change it makes — that
// saves a manual Valuation Snapshot. "Edit history" asks for the drawer. It
// holds only what is typed; the caller runs the request and answers `done`
// (the form empties) or `refused` (it keeps what was typed). Read-only for an
// archived Holding or a user who may not change it.

/** Market Value Entry's props. */
export interface MarketValueEntryProps {
  readonly ticker: string;
  readonly currency: Currency;
  /** The saved values, newest first, as the API sends them. */
  readonly entries: readonly HistoryEntry[];
  /** Today, `YYYY-MM-DD`: the form's date at first, and the latest it accepts. */
  readonly today: string;
  /** No form: an archived Holding, or a user who may not change it. */
  readonly readOnly: boolean;
  /** Why it's read-only, already translated; shown in the form's place. */
  readonly readOnlyNote?: string | undefined;
  /** Saves a new value. */
  readonly onSave: (submission: HistorySubmission) => Promise<HistoryOutcome>;
  /** Asks for the value history drawer. */
  readonly onOpenHistory: () => void;
}

/** "Edit history": a small mint link (mockup 51). */
const LINK = 'font-medium text-mint hover:underline';

/**
 * Writes one of the card's texts.
 *
 * @param translator - The texts.
 * @param key - The key.
 * @param params - Its ICU params.
 * @returns The text.
 */
const say = (translator: Translator, key: string, params?: Record<string, string | number>) => (
  translator.text('holdingMaintenance', key as 'value.title', params)
);

/**
 * Colours a change by its sign: mint up, coral down, muted unchanged.
 *
 * @param amount - The change.
 * @returns The text colour.
 */
const toneOf = (amount: number) => {
  if (amount === 0) return 'text-muted';
  return amount > 0 ? 'text-mint' : 'text-coral';
};

/**
 * Draws the change a new value makes against the current one: the amount and
 * the percent, mint up, coral down.
 *
 * @param props - The current value, the new one and the currency.
 * @returns The line, or nothing while no value is typed.
 */
function ChangePreview({ current, next, currency }: {
  readonly current: number | undefined;
  readonly next: number | null;
  readonly currency: Currency;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  if (next === null) return <span />;
  const change = valueChangeOf(current, next);
  const tone = toneOf(change.amount);
  return (
    <span className={`inline-flex items-center gap-1 type-caption tabular-nums ${tone}`}>
      {/* A generic span can't carry a name, so the label is hidden text (review round 1). */}
      <span className="sr-only">{`${say(translator, 'value.changeLabel')}: `}</span>
      {change.amount !== 0 && (
        <Icon name={change.amount > 0 ? 'arrow-upward' : 'arrow-downward'} className="size-3.5" />
      )}
      <Amount amount={change.amount} currency={currency} sign="always" />
      {change.ratio !== null && <span>{`(${formatter.change(change.ratio)})`}</span>}
    </span>
  );
}

/** The form's part of the props. */
type FormProps = Pick<MarketValueEntryProps, 'currency' | 'entries' | 'today' | 'onSave'> & {
  readonly draft: HistoryDraft;
  readonly onDraft: (draft: HistoryDraft) => void;
};

/**
 * Draws the quick form: the new value, its date, the change and Save value.
 *
 * @param props - The draft, the saved values, today and the handlers.
 * @returns The form.
 */
function ValueForm({
  currency, entries, today, onSave, draft, onDraft,
}: FormProps) {
  const translator = useI18n();
  const [busy, setBusy] = useState(false);
  // Problems show once Save was refused; each refusal moves the focus to the first (OQ-192).
  const [refusals, setRefusals] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(refusals, formRef);
  const showErrors = refusals > 0;
  const errors = draftErrorsOf(draft, {
    today, valueKind: { kind: 'money', currency }, entries, uniqueDays: false,
  });
  const fieldError = (error: HistoryDraftErrors['date']) => (
    // A day already taken can't come up: market values allow several a day.
    showErrors && typeof error === 'object' ? translator.field(error.code, error.params) : undefined
  );

  /**
   * Saves the typed value when it passes its checks.
   *
   * @param event - The form's submit.
   */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isDraftValid(errors) || draft.value === null) {
      setRefusals((count) => count + 1);
      return;
    }
    setBusy(true);
    const outcome = await onSave({ date: draft.date, value: draft.value }).catch(() => 'refused');
    setBusy(false);
    if (outcome === 'done') {
      setRefusals(0);
      onDraft({ date: today, value: null });
    }
  };

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        submit(event);
      }}
    >
      <div className="grid grid-cols-1 gap-3 @xs:grid-cols-[minmax(0,1fr)_8.75rem]">
        <MoneyInput
          label={say(translator, 'value.newValue', { symbol: moneyConventions(currency).symbol })}
          currency={currency}
          value={draft.value}
          error={fieldError(errors.value)}
          onChange={(value) => onDraft({ ...draft, value })}
        />
        <DateInput
          label={say(translator, 'value.asOfField')}
          value={draft.date}
          error={fieldError(errors.date)}
          onChange={(date) => onDraft({ ...draft, date })}
        />
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <ChangePreview current={entries[0]?.value} next={draft.value} currency={currency} />
        <Button type="submit" variant="primary" size="sm" busy={busy}>
          {say(translator, 'value.save')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Draws the latest value, its date and "Edit history".
 *
 * @param props - The latest value, its currency, whether it reads only and the drawer's handler.
 * @returns The line.
 */
function LatestValue({
  latest, currency, readOnly, onOpenHistory,
}: {
  readonly latest: HistoryEntry | undefined;
  readonly currency: Currency;
  /** Whether the drawer only reads: the link says "View history" (review round 1). */
  readonly readOnly: boolean;
  readonly onOpenHistory: () => void;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      {latest
        ? <Amount amount={latest.value} currency={currency} className="type-heading-md" />
        : <span className="type-body-sm text-muted">{say(translator, 'value.none')}</span>}
      <span className="type-caption text-muted tabular-nums">
        {latest && `${say(translator, 'value.asOf', { date: formatter.date(latest.date) })} · `}
        <button type="button" className={LINK} onClick={onOpenHistory}>
          {say(translator, readOnly ? 'value.viewHistory' : 'value.editHistory')}
        </button>
      </span>
    </div>
  );
}

/**
 * Draws the values' history, with the value being typed as a dashed ring.
 *
 * @param props - The values, the draft, the Holding's ticker and currency, and
 *   whether it reads only.
 * @returns The chart and its hint, or nothing without values.
 */
function ValueChart({
  entries, draft, ticker, currency, readOnly,
}: Pick<MarketValueEntryProps, 'entries' | 'ticker' | 'currency' | 'readOnly'> & {
  readonly draft: HistoryDraft;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <LineChart
        points={chartPointsOf(entries, { kind: 'money', currency }, formatter)}
        ariaLabel={say(translator, 'value.chart', { ticker })}
        shape="history"
        heightPx={settings.valueChartHeightPx}
        pending={readOnly ? undefined : pendingOf(draft, undefined)}
      />
      {!readOnly && <p className="type-caption text-muted">{say(translator, 'value.chartHint')}</p>}
    </div>
  );
}

/**
 * Renders a market-priced Holding's value, its history and the quick form.
 *
 * @param props - The Holding's ticker and currency, its values, today, and the handlers.
 * @returns The card.
 */
export function MarketValueEntry({
  ticker, currency, entries, today, readOnly, readOnlyNote, onSave, onOpenHistory,
}: MarketValueEntryProps) {
  const translator = useI18n();
  const [draft, setDraft] = useState<HistoryDraft>({ date: today, value: null });
  return (
    <DetailCard
      icon="sell-outline"
      title={say(translator, 'value.title')}
      mode={readOnly ? 'readOnly' : 'editable'}
    >
      <LatestValue
        latest={entries[0]}
        currency={currency}
        readOnly={readOnly}
        onOpenHistory={onOpenHistory}
      />
      <ValueChart
        entries={entries}
        draft={draft}
        ticker={ticker}
        currency={currency}
        readOnly={readOnly}
      />
      {readOnly
        ? readOnlyNote && <p className="mt-auto type-caption text-muted">{readOnlyNote}</p>
        : (
          <ValueForm
            currency={currency}
            entries={entries}
            today={today}
            onSave={onSave}
            draft={draft}
            onDraft={setDraft}
          />
        )}
    </DetailCard>
  );
}
