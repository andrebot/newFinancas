import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { Button } from '../../../../../kit/button/Button';
import { cancelOnEscape } from '../../../../../kit/confirm/InlineConfirm';
import { DateInput } from '../../../../../kit/dateInput/DateInput';
import { dateErrorText } from '../../../../../kit/historyEditor/HistoryEditorParts';
import {
  draftErrorsOf, isDraftValid, type HistoryDraft, type HistoryEntry, type HistoryOutcome,
  type HistorySubmission,
} from '../../../../../kit/historyEditor/historyModel';
import { NumberInput } from '../../../../../kit/numberInput/NumberInput';
import { useI18n } from '../../../../../utilities/I18nProvider';

// Rate Update Entry (FL20; mockup 53; FR-11.6, OQ-172, OQ-235): the inline
// form a rate card opens on Update — the new value, the day it is for (today
// unless changed) and what the index feeds — with Cancel and Save. It checks
// the draft as K46 does: a whole day not after today, a value, and a day no
// other value holds (`uniqueDays`); problems show once a save is refused,
// focus on the first. It holds only what is typed; the caller runs the
// request and answers `done` (it closes the form) or `refused` (what was
// typed stays). Escape cancels, except while a request runs.

/** Rate Update Entry's props. */
export interface RateUpdateEntryProps {
  /** The form's accessible name, already translated, e.g. "Update Selic". */
  readonly name: string;
  /** The value field's label, already translated, e.g. "New value (% a year)". */
  readonly valueLabel: string;
  /** The index's saved values, newest first: a day one of them holds is refused. */
  readonly entries: readonly HistoryEntry[];
  /** Today, `YYYY-MM-DD`: the form's day at first, and the latest it accepts. */
  readonly today: string;
  /** What the index feeds, already translated, e.g. "Payouts for 1 holding are …". */
  readonly hint: string;
  /** Saves the new value. */
  readonly onSave: (submission: HistorySubmission) => Promise<HistoryOutcome>;
  readonly onCancel: () => void;
}

/**
 * Renders the inline form that records an index value.
 *
 * @param props - Its name and labels, the saved values, today, the hint and the handlers.
 * @returns The form.
 */
export function RateUpdateEntry({
  name, valueLabel, entries, today, hint, onSave, onCancel,
}: RateUpdateEntryProps) {
  const translator = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<HistoryDraft>({ date: today, value: null });
  const [busy, setBusy] = useState(false);
  const [refusals, setRefusals] = useState(0);
  const errors = draftErrorsOf(draft, {
    today, valueKind: { kind: 'rate' }, entries, uniqueDays: true,
  });
  const shown = refusals > 0 ? errors : {};

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, []);

  useEffect(() => {
    if (refusals > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [refusals]);

  /**
   * Saves the typed value when it passes its checks; otherwise shows the problems.
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
    if (outcome === 'refused') setBusy(false);
  };

  return (
    // Escape reaches the form from its fields and buttons; it isn't itself interactive.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form
      ref={formRef}
      noValidate
      aria-label={name}
      className="flex flex-col gap-3 rounded-xl border border-mint/40 bg-raised p-3"
      onKeyDown={cancelOnEscape(busy, onCancel)}
      onSubmit={(event) => {
        submit(event);
      }}
    >
      <div className="grid grid-cols-1 gap-3 @xs:grid-cols-[minmax(0,1fr)_8.75rem]">
        <NumberInput
          label={valueLabel}
          kind="rate"
          allowNegative
          value={draft.value}
          error={shown.value && translator.field(shown.value.code, shown.value.params)}
          onChange={(value) => setDraft({ ...draft, value })}
        />
        <DateInput
          label={translator.text('ratesMaintenance', 'form.asOf')}
          value={draft.date}
          error={dateErrorText(shown.date, translator)}
          onChange={(date) => setDraft({ ...draft, date })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="type-caption text-muted">{hint}</span>
        <span className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            {translator.text('ratesMaintenance', 'form.cancel')}
          </Button>
          <Button type="submit" variant="primary" size="sm" busy={busy}>
            {translator.text('ratesMaintenance', 'form.save')}
          </Button>
        </span>
      </div>
    </form>
  );
}
