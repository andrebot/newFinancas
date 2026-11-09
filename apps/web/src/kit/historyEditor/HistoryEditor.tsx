import {
  useId, useMemo, useRef, type ReactNode,
} from 'react';
import type { Formatter } from '../../utilities/formatting';
import type { Translator } from '../../utilities/i18n';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { InlineConfirm } from '../confirm/InlineConfirm';
import { Icon } from '../icons/Icon';
import {
  LineChart, type LineReference, type LineTone,
} from '../lineChart/LineChart';
import {
  chartPointsOf, impactDateOf, pendingOf, withChanges, type HistoryEntry, type HistoryOutcome,
  type HistorySubmission, type HistoryValueKind,
} from './historyModel';
import {
  DATE_VALUE, HistoryForm, HistoryRow, ROW_GRID,
} from './HistoryEditorParts';
import useHistoryEditing, {
  editingKeyOf, type HistoryEditing, type HistoryOpen,
} from './useHistoryEditing';

// The kit's History editor (K46, OQ-232): a list of dated values with its
// chart — a Holding's market values (mockup 52, FL19) and an index's rates
// (FL20), one component. Each value can be edited in place or deleted behind
// an inline confirm; "Add a past value" opens the same form empty. The chart
// shows the value being edited and the one about to be saved, and a pick on
// it opens that value. A value the user can't change (a trade's snapshot,
// another Member's rate) wears a lock and the caller's reason.
//
// The editor holds what is open and what is typed. The caller runs each
// request and answers `done` (the form closes) or `refused` (it stays, and
// the caller shows why); it owns the frame — the drawer, its heading, the
// footnote and Done.

export type {
  HistoryEntry, HistoryOutcome, HistorySubmission, HistoryValueKind,
} from './historyModel';

/** The History editor's props. */
export interface HistoryEditorProps {
  /** The saved values, newest first, as the API sends them. */
  readonly entries: readonly HistoryEntry[];
  readonly valueKind: HistoryValueKind;
  /** The chart's accessible name, already translated. */
  readonly chartLabel: string;
  /** The line's colour. Defaults to `sky`. */
  readonly tone?: LineTone | undefined;
  /** A dashed level on the chart, e.g., "invested R$110k" (mockup 52). */
  readonly reference?: LineReference | undefined;
  /** The value field's label, e.g., "Value (% a.a.)"; defaults to "Value (R$)" or "Value (%)". */
  readonly valueLabel?: string | undefined;
  /**
   * What a save or a delete recalculates, from the first day it changes,
   * already translated, e.g., "Net worth for July onward is recalculated on save."
   */
  readonly impactHint: (fromDate: string) => string;
  /** One value per day, as a rate has (OQ-172). */
  readonly uniqueDays?: boolean | undefined;
  /**
   * Nothing can be changed — a Viewer's rates, an archived Holding's values:
   * no buttons, no "Add a past value", and the chart only reads.
   */
  readonly readOnly?: boolean | undefined;
  /**
   * Saves a new value (no key) or an edited one; answers how it ended. On
   * `done`, an edited value stays dimmed, as loading, until a new `entries`
   * list arrives — so pass the query's data, which changes only on a refetch.
   */
  readonly onSave: (submission: HistorySubmission) => Promise<HistoryOutcome>;
  /**
   * Deletes a value; answers how it ended. On `done`, it stays dimmed until a
   * new `entries` list arrives.
   */
  readonly onDelete: (key: string) => Promise<HistoryOutcome>;
}

/** The dashed button that adds a value (mockup 52). */
const ADD_BUTTON = [
  'flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed',
  'border-line text-muted outline-none transition-colors duration-150',
  'enabled:hover:border-mint/50 enabled:hover:text-mint disabled:opacity-50',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
].join(' ');

/**
 * Finds the value whose form is open.
 *
 * @param open - What is open.
 * @param entries - The saved values.
 * @returns The value, or none when no value is edited.
 */
const editedEntryOf = (
  open: HistoryOpen,
  entries: readonly HistoryEntry[],
): HistoryEntry | undefined => {
  const key = editingKeyOf(open);
  return key === undefined ? undefined : entries.find((entry) => entry.key === key);
};

/**
 * Writes the hint under the form: what a save recalculates, from the earlier
 * of the value's old day and its new one.
 *
 * @param editing - The editor's state.
 * @param entries - The saved values.
 * @param impactHint - The caller's wording.
 * @returns The hint, or none while no day is known.
 */
const formHintOf = (
  editing: HistoryEditing,
  entries: readonly HistoryEntry[],
  impactHint: (fromDate: string) => string,
): string | undefined => {
  const from = impactDateOf(editing.draft.date, editedEntryOf(editing.open, entries)?.date);
  return from && impactHint(from);
};

/**
 * Names the open form for assistive tech: which value it edits, or a new one.
 *
 * @param open - What is open.
 * @param entries - The saved values.
 * @param translator - The interface language's translator.
 * @param formatter - The interface language's formatters.
 * @returns E.g. "Edit value of 07/31/2026" or "New value".
 */
const formNameOf = (
  open: HistoryOpen,
  entries: readonly HistoryEntry[],
  translator: Translator,
  formatter: Formatter,
): string => {
  const original = editedEntryOf(open, entries);
  return original
    ? translator.text('historyEditor', 'edit', { date: formatter.date(original.date) })
    : translator.text('historyEditor', 'newValue');
};

/** The chart's props: the editor's look and its state. */
type HistoryChartProps = Pick<
  HistoryEditorProps, 'entries' | 'valueKind' | 'chartLabel' | 'tone' | 'reference'
> & { readonly editing: HistoryEditing; readonly readOnly: boolean };

/**
 * Draws the chart with what is being edited: the value's crosshair and pill,
 * and the value about to be saved. A pick opens that value's form.
 *
 * @param props - The values, the chart's look and the editor's state.
 * @returns The chart.
 */
function HistoryChart({
  entries, valueKind, chartLabel, tone, reference, editing, readOnly,
}: HistoryChartProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const { open, draft } = editing;
  const points = useMemo(
    () => chartPointsOf(entries, valueKind, formatter),
    [entries, valueKind, formatter],
  );
  const original = editedEntryOf(open, entries);
  const formOpen = open !== null && open.mode !== 'delete';
  return (
    <div className="rounded-2xl border border-line bg-bg p-4">
      <LineChart
        points={points}
        ariaLabel={chartLabel}
        tone={tone}
        surface="bg"
        reference={reference}
        selectedKey={original?.key}
        selectedLabel={original && translator.text('historyEditor', 'editing', {
          month: formatter.date(original.date, 'monthShort'),
        })}
        pending={formOpen ? pendingOf(draft, original) : undefined}
        onSelect={readOnly ? undefined : (key) => editing.startEdit('', key)}
      />
    </div>
  );
}

/**
 * Draws a value's delete confirm: the question with what the delete recalculates.
 *
 * @param props - The value, the caller's wording and the editor's state.
 * @returns The confirm.
 */
function DeleteConfirm({ entry, impactHint, editing }: {
  readonly entry: HistoryEntry;
  readonly impactHint: (fromDate: string) => string;
  readonly editing: HistoryEditing;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  const question = translator.text('historyEditor', 'deleteMessage', {
    date: formatter.date(entry.date),
  });
  return (
    <InlineConfirm
      tone="destructive"
      message={`${question} ${impactHint(entry.date)}`}
      confirmLabel={translator.text('historyEditor', 'deleteConfirm')}
      cancelLabel={translator.text('historyEditor', 'cancel')}
      busy={editing.busy}
      onConfirm={() => editing.confirmDelete(entry.key)}
      onCancel={editing.cancel}
    />
  );
}

/**
 * Draws the foot of the editor: the new value's form while it is open, else
 * the dashed "Add a past value" button, or nothing when read-only.
 *
 * @param props - The button's id, the open form, the state and the handler.
 * @returns The form, the button or nothing.
 */
function AddValue({
  id, form, readOnly, busy, onAdd,
}: {
  readonly id: string;
  readonly form: ReactNode;
  readonly readOnly: boolean;
  readonly busy: boolean;
  readonly onAdd: () => void;
}) {
  const translator = useI18n();
  if (form) return form;
  if (readOnly) return null;
  return (
    <button id={id} type="button" className={ADD_BUTTON} disabled={busy} onClick={onAdd}>
      <Icon name="add" className="size-4.5" />
      {translator.text('historyEditor', 'add')}
    </button>
  );
}

/**
 * Renders the History editor.
 *
 * @param props - The values, their kind, the chart's look, the wording and the requests.
 * @returns The editor.
 */
export function HistoryEditor({
  entries, valueKind, chartLabel, tone, reference, valueLabel, impactHint, uniqueDays = false,
  readOnly = false, onSave, onDelete,
}: HistoryEditorProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const editorId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const editing = useHistoryEditing({
    entries, valueKind, uniqueDays, onSave, onDelete, listRef,
  });
  const { open, busy } = editing;
  const addId = `${editorId}-add`;

  const form = (
    <HistoryForm
      name={formNameOf(open, entries, translator, formatter)}
      draft={editing.draft}
      errors={editing.errors}
      refusals={editing.refusals}
      valueKind={valueKind}
      valueLabel={valueLabel}
      hint={formHintOf(editing, entries, impactHint)}
      busy={busy}
      onChange={editing.setDraft}
      onSubmit={editing.submit}
      onCancel={editing.cancel}
    />
  );

  return (
    <div className="@container flex flex-col gap-5">
      {entries.length > 0 && (
        <HistoryChart
          entries={entries}
          valueKind={valueKind}
          chartLabel={chartLabel}
          tone={tone}
          reference={reference}
          editing={editing}
          readOnly={readOnly}
        />
      )}
      <div className="flex flex-col gap-1">
        <div aria-hidden className={`${ROW_GRID} hidden pb-1 type-label text-muted @md:grid`}>
          <span className={DATE_VALUE}>
            <span>{translator.text('historyEditor', 'date')}</span>
            <span>{translator.text('historyEditor', 'value')}</span>
          </span>
          <span className="text-right">{translator.text('historyEditor', 'change')}</span>
          <span />
        </div>
        <ul
          ref={listRef}
          tabIndex={-1}
          aria-label={translator.text('historyEditor', 'list')}
          className="flex flex-col gap-1 outline-none"
        >
          {withChanges(entries, valueKind).map(({ entry, change }) => {
            const editId = `${editorId}-edit-${entry.key}`;
            const deleteId = `${editorId}-delete-${entry.key}`;
            if (open?.mode === 'edit' && open.key === entry.key) {
              return <li key={entry.key}>{form}</li>;
            }
            if (open?.mode === 'delete' && open.key === entry.key) {
              return (
                <li key={entry.key}>
                  <DeleteConfirm entry={entry} impactHint={impactHint} editing={editing} />
                </li>
              );
            }
            return (
              <HistoryRow
                key={entry.key}
                entry={entry}
                change={change}
                valueKind={valueKind}
                editId={editId}
                deleteId={deleteId}
                disabled={busy}
                settling={editing.settlingKey === entry.key}
                readOnly={readOnly}
                onEdit={() => editing.startEdit(editId, entry.key)}
                onDelete={() => editing.startDelete(deleteId, entry.key)}
              />
            );
          })}
        </ul>
      </div>
      <AddValue
        id={addId}
        form={open?.mode === 'add' ? form : undefined}
        readOnly={readOnly}
        busy={busy}
        onAdd={() => editing.startEdit(addId)}
      />
    </div>
  );
}
