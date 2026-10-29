// The date range picker's presets (K10, OQ-213): each relative preset names a
// span ending today, resolved against today's local date (`useToday`). Pure —
// the picker turns a chosen preset or an edited date into the next value here.

/** A preset that resolves to dates by itself. */
export type RelativePreset = 'anyTime' | 'thisMonth' | 'last30Days' | 'last90Days' | 'thisYear';

/** Any preset, including Custom — the dates as typed. */
export type DateRangePreset = RelativePreset | 'custom';

/** A range in the contract's `YYYY-MM-DD`, both ends inclusive; `''` is an open end. */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

/** What the picker holds: the chosen preset and the dates it shows. */
export interface DateRangeValue extends DateRange {
  readonly preset: DateRangePreset;
}

/** Which end of the range a typed date edits. */
export type DateRangeSide = keyof DateRange;

const MS_PER_DAY = 86_400_000;

/**
 * Moves a calendar date by whole days.
 *
 * @param isoDate - The date, `YYYY-MM-DD`.
 * @param days - How many days to move; negative goes back.
 * @returns The moved date, `YYYY-MM-DD`.
 */
export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Date(date.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
};

/**
 * Builds the resolver of a "last N days" preset: N days counting today.
 *
 * @param count - How many days, today included.
 * @returns The resolver.
 */
const lastDays = (count: number) => (today: string): DateRange => (
  { from: addDays(today, 1 - count), to: today }
);

const RESOLVERS: Readonly<Record<RelativePreset, (today: string) => DateRange>> = {
  anyTime: () => ({ from: '', to: '' }),
  thisMonth: (today) => ({ from: `${today.slice(0, 7)}-01`, to: today }),
  last30Days: lastDays(30),
  last90Days: lastDays(90),
  thisYear: (today) => ({ from: `${today.slice(0, 4)}-01-01`, to: today }),
};

/**
 * Resolves a relative preset to its dates, ending today. Any time leaves both
 * ends open.
 *
 * @param preset - The preset.
 * @param today - Today's local date, `YYYY-MM-DD`.
 * @returns The range.
 */
export const resolvePreset = (preset: RelativePreset, today: string): DateRange => (
  RESOLVERS[preset](today)
);

/**
 * Builds the value after a preset is chosen: a relative one brings its dates;
 * Custom keeps the dates shown, ready to edit.
 *
 * @param current - The value before.
 * @param preset - The chosen preset.
 * @param today - Today's local date, `YYYY-MM-DD`.
 * @returns The next value.
 */
export const choosePreset = (
  current: DateRangeValue,
  preset: DateRangePreset,
  today: string,
): DateRangeValue => (
  preset === 'custom'
    ? { ...current, preset }
    : { preset, ...resolvePreset(preset, today) }
);

/**
 * Builds the value after one end is typed: the date changes and the preset
 * becomes Custom.
 *
 * @param current - The value before.
 * @param side - The end typed into.
 * @param date - What the date input gave: `YYYY-MM-DD`, `''` or the pieces so far.
 * @returns The next value.
 */
export const editDate = (
  current: DateRangeValue,
  side: DateRangeSide,
  date: string,
): DateRangeValue => ({ ...current, [side]: date, preset: 'custom' });
