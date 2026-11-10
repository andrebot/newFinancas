import { useEffect, useRef, type FormEvent } from 'react';
import { formatting } from '../../config/constants';
import { moneyConventions } from '../../utilities/formatting';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { Button } from '../button/Button';
import { IconButton } from '../button/IconButton';
import { cancelOnEscape } from '../confirm/InlineConfirm';
import { DateInput } from '../dateInput/DateInput';
import { Icon } from '../icons/Icon';
import { MoneyInput } from '../moneyInput/MoneyInput';
import { NumberInput } from '../numberInput/NumberInput';
import {
  formatValueOf, type HistoryChange, type HistoryDateError, type HistoryDraft,
  type HistoryDraftErrors, type HistoryEntry, type HistoryValueKind,
} from './historyModel';

// The History editor's pieces (K46, OQ-232): a saved value's row, the change
// it made, and the inline form that edits a value or adds one (mockup 52).

/**
 * The row's grid: from 448px, date, value, change and actions in their own
 * columns (mockup 52); narrower, a phone's sheet, the date sits over the value.
 */
export const ROW_GRID = [
  'grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-3 px-3',
  '@md:grid-cols-[7.5rem_minmax(0,1fr)_4.5rem_4.5rem]',
].join(' ');

/** Date and value: stacked on a narrow editor, their own columns from 448px. */
export const DATE_VALUE = 'flex min-w-0 flex-col @md:contents';

/** How many hundredths of a percent the change shows: 10 for one decimal. */
const CHANGE_STEPS = 10 ** formatting.changeFractionDigits;

/**
 * Picks the colour of a change: mint for a rise and coral for a fall in a
 * market value; a rate's change, and one that rounds to 0.0%, stay muted
 * (mockup 53).
 *
 * @param change - The change, if any.
 * @returns The colour class.
 */
export const changeToneOf = (change: HistoryChange | undefined): string => {
  if (change?.unit !== 'ratio') return 'text-muted';
  // Rounded half away from zero, as `Intl` writes it: −0.05% shows as −0.1%.
  const shownSteps = Math.round(Math.abs(change.amount) * 100 * CHANGE_STEPS);
  if (shownSteps === 0) return 'text-muted';
  return change.amount > 0 ? 'text-mint' : 'text-coral';
};

/**
 * Writes what a value changed: a signed percent for money, signed points
 * for a rate, a dash when there is nothing to compare (the first value, or
 * money after a zero).
 *
 * @param props - The change.
 * @returns The change's text.
 */
export function ChangeText({ change }: { readonly change: HistoryChange | undefined }) {
  const translator = useI18n();
  const formatter = useFormatter();
  const className = `type-caption text-right tabular-nums ${changeToneOf(change)}`;
  if (change === undefined) {
    return (
      <span className={className}>
        <span aria-hidden>—</span>
        <span className="sr-only">{translator.text('historyEditor', 'noChange')}</span>
      </span>
    );
  }
  const text = change.unit === 'ratio'
    ? formatter.change(change.amount)
    : translator.text('historyEditor', 'points', { points: formatter.ratePoints(change.amount) });
  return <span className={className}>{text}</span>;
}

/** A row's props. */
export interface HistoryRowProps {
  readonly entry: HistoryEntry;
  readonly change: HistoryChange | undefined;
  readonly valueKind: HistoryValueKind;
  /** The ids of its edit and delete buttons, so focus can come back to them. */
  readonly editId: string;
  readonly deleteId: string;
  /** Another request runs: its buttons wait. */
  readonly disabled: boolean;
  /** Saved or deleted, the list not yet refetched: dimmed, as loading, its buttons waiting. */
  readonly settling: boolean;
  /** Nothing can be changed: no buttons and no lock. */
  readonly readOnly: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

/** A row's actions: what the last cell needs. */
type RowActionsProps = Pick<
  HistoryRowProps, 'editId' | 'deleteId' | 'disabled' | 'readOnly' | 'onEdit' | 'onDelete'
> & {
  readonly date: string;
  readonly locked: boolean;
};

/**
 * Draws a locked value's last cell: a lock instead of the buttons.
 *
 * @returns The lock.
 */
function LockedActions() {
  const translator = useI18n();
  return (
    <span
      className="flex justify-end pr-2 text-faint"
      title={translator.text('historyEditor', 'locked')}
    >
      <Icon name="lock-outline" className="size-4" />
    </span>
  );
}

/**
 * Draws a row's last cell: nothing when read-only, a lock on a value that
 * can't be changed, else the edit and delete buttons.
 *
 * @param props - The row's date, ids, state and handlers.
 * @returns The cell.
 */
function RowActions({
  date, editId, deleteId, disabled, readOnly, locked, onEdit, onDelete,
}: RowActionsProps) {
  const translator = useI18n();
  if (readOnly) return <span />;
  if (locked) return <LockedActions />;
  return (
    <span className="flex justify-end">
      <IconButton
        id={editId}
        icon="edit-outline"
        label={translator.text('historyEditor', 'edit', { date })}
        disabled={disabled}
        onClick={onEdit}
      />
      <IconButton
        id={deleteId}
        icon="delete-outline"
        label={translator.text('historyEditor', 'delete', { date })}
        disabled={disabled}
        onClick={onDelete}
      />
    </span>
  );
}

/**
 * Draws a saved value: its date, the value (with why it can't be changed,
 * when it can't), the change it made and its edit and delete buttons. While
 * a save or delete of it waits for the list to refetch, it is dimmed and busy.
 *
 * @param props - The value, its change, its state and its actions.
 * @returns The row.
 */
export function HistoryRow({
  entry, change, valueKind, editId, deleteId, disabled, settling, readOnly, onEdit, onDelete,
}: HistoryRowProps) {
  const formatter = useFormatter();
  const date = formatter.date(entry.date);
  const look = settling ? 'opacity-50' : 'hover:bg-ink/[.03]';
  return (
    <li aria-busy={settling} className={`${ROW_GRID} rounded-xl py-2.5 transition-opacity ${look}`}>
      <span className={DATE_VALUE}>
        <span className="type-body-sm tabular-nums text-muted">{date}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold tabular-nums">
            {formatValueOf(entry.value, valueKind, formatter)}
          </span>
          {entry.lockedReason && (
            <span className="type-caption text-muted">{entry.lockedReason}</span>
          )}
        </span>
      </span>
      <ChangeText change={change} />
      <RowActions
        date={date}
        editId={editId}
        deleteId={deleteId}
        disabled={disabled || settling}
        readOnly={readOnly}
        locked={entry.lockedReason !== undefined}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </li>
  );
}

/** The form's props. */
export interface HistoryFormProps {
  /** The form's name, already translated: "Edit value of 07/31/2026" or "New value". */
  readonly name: string;
  readonly draft: HistoryDraft;
  readonly errors: HistoryDraftErrors;
  /** Counts refused saves: each moves focus to the first problem. */
  readonly refusals: number;
  readonly valueKind: HistoryValueKind;
  /** The value field's label; defaults to "Value (R$)" or "Value (%)". */
  readonly valueLabel: string | undefined;
  /** What a save recalculates, already translated, e.g. "Net worth for July onward…". */
  readonly hint: string | undefined;
  readonly busy: boolean;
  readonly onChange: (draft: HistoryDraft) => void;
  readonly onSubmit: (event: FormEvent) => void;
  readonly onCancel: () => void;
}

/**
 * Writes the value field's label for its kind.
 *
 * @param valueKind - Money or rate.
 * @param translate - The section's translator.
 * @returns E.g. "Value (R$)".
 */
export const defaultValueLabelOf = (
  valueKind: HistoryValueKind,
  translate: (key: 'valueMoney' | 'valueRate', params?: Record<string, string>) => string,
): string => (
  valueKind.kind === 'money'
    ? translate('valueMoney', { symbol: moneyConventions(valueKind.currency).symbol })
    : translate('valueRate')
);

/**
 * Writes a date problem: a field rule's message, or the day already taken.
 *
 * @param error - The problem, if any.
 * @param translator - The interface language's translator.
 * @returns The message.
 */
export const dateErrorText = (
  error: HistoryDateError | undefined,
  translator: ReturnType<typeof useI18n>,
): string | undefined => {
  if (error === undefined) return undefined;
  if (error === 'duplicateDay') return translator.text('historyEditor', 'duplicateDay');
  return translator.field(error.code, error.params);
};

/**
 * Draws the value field: money in its currency, or a rate that may go below zero.
 *
 * @param props - The kind, the value, its label, its problem and its handler.
 * @returns The field.
 */
function ValueField({
  valueKind, value, label, error, onChange,
}: {
  readonly valueKind: HistoryValueKind;
  readonly value: number | null;
  readonly label: string;
  readonly error: string | undefined;
  readonly onChange: (value: number | null) => void;
}) {
  if (valueKind.kind === 'money') {
    return (
      <MoneyInput
        label={label}
        currency={valueKind.currency}
        value={value}
        error={error}
        onChange={onChange}
      />
    );
  }
  return (
    <NumberInput
      label={label}
      kind="rate"
      allowNegative
      value={value}
      error={error}
      onChange={onChange}
    />
  );
}

/**
 * Draws the inline form that edits a value or adds one: its date and value,
 * what a save recalculates, Cancel and Save. It takes focus on its first
 * field when it opens, and Escape cancels it without closing the drawer.
 *
 * @param props - The draft, its problems, the kind and the handlers.
 * @returns The form.
 */
export function HistoryForm({
  name, draft, errors, refusals, valueKind, valueLabel, hint, busy, onChange, onSubmit, onCancel,
}: HistoryFormProps) {
  const translator = useI18n();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, []);

  useEffect(() => {
    if (refusals > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [refusals]);

  return (
    // Escape reaches the form from its fields and buttons; it isn't itself interactive.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form
      ref={formRef}
      aria-label={name}
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-mint/40 bg-raised p-3"
      onSubmit={onSubmit}
      onKeyDown={cancelOnEscape(busy, onCancel)}
    >
      <div className="grid grid-cols-1 gap-3 @xs:grid-cols-[8.75rem_minmax(0,1fr)]">
        <DateInput
          label={translator.text('historyEditor', 'date')}
          value={draft.date}
          error={dateErrorText(errors.date, translator)}
          onChange={(date) => onChange({ ...draft, date })}
        />
        <ValueField
          valueKind={valueKind}
          value={draft.value}
          label={valueLabel ?? defaultValueLabelOf(
            valueKind,
            (key, params) => translator.text('historyEditor', key, params),
          )}
          error={errors.value && translator.field(errors.value.code, errors.value.params)}
          onChange={(value) => onChange({ ...draft, value })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="type-caption text-muted">{hint}</span>
        <span className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            {translator.text('historyEditor', 'cancel')}
          </Button>
          <Button type="submit" variant="primary" size="sm" busy={busy}>
            {translator.text('historyEditor', 'save')}
          </Button>
        </span>
      </div>
    </form>
  );
}
