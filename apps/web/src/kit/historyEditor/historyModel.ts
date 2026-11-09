import type { Currency } from '@financas/api-types';
import type { Formatter } from '../../utilities/formatting';
import {
  firstError, isoDate, money, required, type FieldError, type Rule,
} from '../../utilities/validation';
import type { LinePending, LinePoint } from '../lineChart/LineChart';

// The History editor's arithmetic (K46, OQ-232): the change each value made,
// the chart's series, the value about to be saved and the checks a draft must
// pass before it is sent. Pure — no React, no translation.

/** What the values are: an amount of money in one currency, or a rate. */
export type HistoryValueKind = { readonly kind: 'money'; readonly currency: Currency }
  | { readonly kind: 'rate' };

/** One saved value. */
export interface HistoryEntry {
  /** Its stable key, e.g., the snapshot's or the rate value's id. */
  readonly key: string;
  /** The day it is for, `YYYY-MM-DD`. */
  readonly date: string;
  /** Minor units for money; percent × 10,000 for a rate (OQ-86). */
  readonly value: number;
  /**
   * Why it can't be changed, already translated, e.g., "From a buy"
   * (OQ-56) or "Added by Ana" (OQ-178). Without it, the value is editable.
   */
  readonly lockedReason?: string | undefined;
}

/** A value being typed: a date as K9 emits it, and the number, `null` while empty. */
export interface HistoryDraft {
  readonly date: string;
  readonly value: number | null;
}

/** What a save or a delete sent: the key of the value edited, absent for a new one. */
export interface HistorySubmission {
  readonly key?: string | undefined;
  readonly date: string;
  readonly value: number;
}

/** How the caller's request ended: `done` closes the form, `refused` keeps it. */
export type HistoryOutcome = 'done' | 'refused';

/** What a value changed against the one before it. */
export interface HistoryChange {
  /** `ratio` for money (−0.015 is −1.5%), `points` for a rate (percent × 10,000). */
  readonly unit: 'ratio' | 'points';
  readonly amount: number;
}

/** Why a draft's date can't be sent: a field rule's error, or a day already taken. */
export type HistoryDateError = FieldError | 'duplicateDay';

/** A draft's problems, by field. */
export interface HistoryDraftErrors {
  readonly date?: HistoryDateError | undefined;
  readonly value?: FieldError | undefined;
}

/** What a draft is checked against. */
export interface HistoryDraftContext {
  /** Today, `YYYY-MM-DD`: no value may be dated after it (`date.max`, OQ-178). */
  readonly today: string;
  readonly valueKind: HistoryValueKind;
  /** The saved values. */
  readonly entries: readonly HistoryEntry[];
  /** The value being edited; absent for a new one. */
  readonly editingKey?: string | undefined;
  /** One value per day, as a rate has (`index_rate.duplicate_day`, OQ-172). */
  readonly uniqueDays: boolean;
}

/** A money value is never below zero (`NonNegativeMoney`); a rate can be (deflation). */
const nonNegative = money({ min: 0 });

/**
 * Works out what a value changed against the one before it.
 *
 * @param value - The value.
 * @param previous - The value before it, if any.
 * @param valueKind - Money or rate.
 * @returns The change; none for the first value, or after a money value of zero.
 */
export const changeOf = (
  value: number,
  previous: number | undefined,
  valueKind: HistoryValueKind,
): HistoryChange | undefined => {
  if (previous === undefined) return undefined;
  if (valueKind.kind === 'rate') return { unit: 'points', amount: value - previous };
  if (previous === 0) return undefined;
  return { unit: 'ratio', amount: (value - previous) / previous };
};

/**
 * Lists the values with what each changed: newest first, as given, each
 * compared with the next one down (the one before it).
 *
 * @param entries - The saved values, newest first.
 * @param valueKind - Money or rate.
 * @returns Each value with its change.
 */
export const withChanges = (
  entries: readonly HistoryEntry[],
  valueKind: HistoryValueKind,
): { readonly entry: HistoryEntry; readonly change: HistoryChange | undefined }[] => (
  entries.map((entry, index) => ({
    entry,
    change: changeOf(entry.value, entries[index + 1]?.value, valueKind),
  }))
);

/**
 * Writes a value as the reader sees it.
 *
 * @param value - Minor units or percent × 10,000.
 * @param valueKind - Money or rate.
 * @param formatter - The interface language's formatters.
 * @returns E.g. `R$ 110.000,00` or `10.50%`.
 */
export const formatValueOf = (
  value: number,
  valueKind: HistoryValueKind,
  formatter: Formatter,
): string => (
  valueKind.kind === 'money' ? formatter.money(value, valueKind.currency) : formatter.rate(value)
);

/**
 * Builds the chart's series: oldest first, so within a day the newest saved
 * comes last and counts (OQ-167, OQ-229); a locked value can't be picked.
 *
 * @param entries - The saved values, newest first, as the API sends them.
 * @param valueKind - Money or rate.
 * @param formatter - The interface language's formatters.
 * @returns K38's points.
 */
export const chartPointsOf = (
  entries: readonly HistoryEntry[],
  valueKind: HistoryValueKind,
  formatter: Formatter,
): LinePoint[] => [...entries].reverse().map((entry) => ({
  key: entry.key,
  date: entry.date,
  value: entry.value,
  valueLabel: formatValueOf(entry.value, valueKind, formatter),
  dateLabel: formatter.date(entry.date),
  selectable: entry.lockedReason === undefined,
}));

/**
 * Tells whether text is a whole `YYYY-MM-DD` date that exists.
 *
 * @param date - What K9 emitted.
 * @returns `true` for a real day.
 */
export const isCompleteDate = (date: string): boolean => (
  date !== '' && isoDate()(date) === undefined
);

/**
 * Works out the value to draw as about to be saved: a complete draft that
 * differs from the value it edits.
 *
 * @param draft - What is typed.
 * @param original - The value being edited; absent for a new one.
 * @returns The pending value, or nothing to draw.
 */
export const pendingOf = (
  draft: HistoryDraft,
  original: HistoryEntry | undefined,
): LinePending | undefined => {
  if (draft.value === null || !isCompleteDate(draft.date)) return undefined;
  if (original && original.date === draft.date && original.value === draft.value) {
    return undefined;
  }
  return { date: draft.date, value: draft.value };
};

/**
 * Finds the first day a save changes: the earlier of the value's old day and
 * its new one, since moving a value back changes the months in between too.
 *
 * @param draftDate - The day typed.
 * @param originalDate - The day the value had; absent for a new one.
 * @returns The day, or none while nothing complete is typed and nothing was saved.
 */
export const impactDateOf = (
  draftDate: string,
  originalDate: string | undefined,
): string | undefined => {
  const typed = isCompleteDate(draftDate) ? draftDate : undefined;
  if (typed === undefined || originalDate === undefined) return typed ?? originalDate;
  return typed < originalDate ? typed : originalDate;
};

/**
 * Tells whether another saved value already holds a day.
 *
 * @param date - The day typed.
 * @param context - The saved values and the one being edited.
 * @returns `true` when the day is taken by another value.
 */
const isDayTaken = (date: string, context: HistoryDraftContext): boolean => (
  context.entries.some((entry) => entry.date === date && entry.key !== context.editingKey)
);

/**
 * Checks a draft's date: a real day, not after today, and — for a rate — not
 * one that already has a value.
 *
 * @param date - The day typed.
 * @param context - What the draft is checked against.
 * @returns The problem, if any.
 */
const dateErrorOf = (date: string, context: HistoryDraftContext): HistoryDateError | undefined => {
  const ruleError = firstError<string | undefined>(required, isoDate({ max: context.today }))(date);
  if (ruleError !== undefined) return ruleError;
  return context.uniqueDays && isDayTaken(date, context) ? 'duplicateDay' : undefined;
};

/**
 * Checks a draft's value: filled in, and never below zero for money.
 *
 * @param value - The number typed, `null` while empty.
 * @param valueKind - Money or rate.
 * @returns The problem, if any.
 */
const valueErrorOf = (
  value: number | null,
  valueKind: HistoryValueKind,
): FieldError | undefined => {
  const rule: Rule<number | undefined> = valueKind.kind === 'money'
    ? firstError<number | undefined>(required, nonNegative)
    : required;
  return rule(value ?? undefined);
};

/**
 * Checks a draft before it is sent.
 *
 * @param draft - What is typed.
 * @param context - What the draft is checked against.
 * @returns The problems; an empty object means it can be sent.
 */
export const draftErrorsOf = (
  draft: HistoryDraft,
  context: HistoryDraftContext,
): HistoryDraftErrors => {
  const dateError = dateErrorOf(draft.date, context);
  const valueError = valueErrorOf(draft.value, context.valueKind);
  return {
    ...(dateError && { date: dateError }),
    ...(valueError && { value: valueError }),
  };
};

/**
 * Tells whether a draft's checks found nothing.
 *
 * @param errors - The draft's problems.
 * @returns `true` when it can be sent.
 */
export const isDraftValid = (errors: HistoryDraftErrors): boolean => (
  errors.date === undefined && errors.value === undefined
);
