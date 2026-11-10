import type { IndexRateValue, InvestmentHolding } from '@financas/api-types';
import type { HistoryEntry } from '../../../../kit/historyEditor/historyModel';
import type { DateStyle } from '../../../../utilities/formatting';
import { mayManageOwned } from '../../../ownership';

// Rates Maintenance's arithmetic (FL20; mockup 53; FR-11.6, OQ-178, OQ-235):
// who may record or change an index's values, each value as K46 lists it,
// the months a card's chart shows, the change the latest value made and the
// Holdings that track an index. Pure — no React, no translation.

/** Who is looking: what the "may change" rule reads (OQ-178). */
export interface RateViewer {
  readonly selfUserId: string;
  /** Their role in the household. */
  readonly role: string | undefined;
}

/** A household member as a locked value names its recorder ("Added by Ana"). */
export interface RateRecorder {
  readonly userId: string;
  readonly firstName: string;
}

/** The change an index's latest value made against the value before it. */
export interface LatestChange {
  /** Percent × 10,000, signed; 0 when unchanged. */
  readonly points: number;
  /** The previous value's day, `YYYY-MM-DD`. */
  readonly previousDate: string;
  /** How to write that day: its month, or the day itself when both fall in one month. */
  readonly style: DateStyle;
}

/**
 * Tells whether a role may record an index value (OQ-178): any member but a Viewer.
 *
 * @param role - The viewer's role in the household.
 * @returns Whether Update shows.
 */
export const mayRecordRates = (role: string | undefined) => (
  role !== undefined && role !== 'Viewer'
);

/**
 * Tells whether the viewer may edit or delete an index value (OQ-178): an
 * Owner or Admin any value; a Member the values they recorded; a Viewer none.
 * An index value is shared data, so the owned-item rule reads its recorder as
 * its owner.
 *
 * @param value - The value.
 * @param viewer - Who is looking.
 * @returns Whether its edit and delete show.
 */
export const mayChangeRate = (value: IndexRateValue, viewer: RateViewer) => mayManageOwned(
  { visibility: 'shared', ownerUserId: value.createdByUserId },
  viewer.selfUserId,
  viewer.role,
);

/**
 * Finds the name a locked value shows for who recorded it.
 *
 * @param userId - The recorder; none once their account is gone (FR-1.17).
 * @param recorders - The household's members.
 * @returns Their first name, or none for a former member.
 */
export const recorderNameOf = (
  userId: string | null,
  recorders: readonly RateRecorder[],
): string | undefined => recorders.find((recorder) => recorder.userId === userId)?.firstName;

/**
 * Lists an index's values as K46 takes them, newest first: one the viewer
 * may not change carries why ("Added by Ana").
 *
 * @param values - The index's values, newest first, as the API sends them.
 * @param viewer - Who is looking.
 * @param lockedReasonOf - Writes why a value recorded by someone is locked.
 * @returns The entries.
 */
export const rateEntriesOf = (
  values: readonly IndexRateValue[],
  viewer: RateViewer,
  lockedReasonOf: (createdByUserId: string | null) => string,
): HistoryEntry[] => values.map((value) => ({
  key: value.id,
  date: value.asOf,
  value: value.value,
  lockedReason: mayChangeRate(value, viewer) ? undefined : lockedReasonOf(value.createdByUserId),
}));

/**
 * Works out the first day of the month a window of whole months starts on.
 *
 * @param latestDate - The newest day, `YYYY-MM-DD`.
 * @param months - How many months the window holds, the newest's included.
 * @returns The window's first day, `YYYY-MM-01`.
 */
export const windowStartOf = (latestDate: string, months: number): string => {
  const year = Number(latestDate.slice(0, 4));
  const month = Number(latestDate.slice(5, 7));
  const index = year * 12 + (month - 1) - (months - 1);
  const startYear = Math.floor(index / 12);
  const startMonth = (index % 12) + 1;
  return `${String(startYear).padStart(4, '0')}-${String(startMonth).padStart(2, '0')}-01`;
};

/**
 * Keeps the values a card's chart shows: the last `months` months counted
 * back from the latest value's month, so an index nobody updated lately
 * still draws its line.
 *
 * @param entries - The values, newest first.
 * @param months - How many months to show.
 * @returns The values in the window, newest first.
 */
export const chartWindowOf = (
  entries: readonly HistoryEntry[],
  months: number,
): HistoryEntry[] => {
  const latest = entries[0];
  if (!latest) return [];
  const start = windowStartOf(latest.date, months);
  return entries.filter((entry) => entry.date >= start);
};

/**
 * Works out what the latest value changed against the one before it, as the
 * card's "+0.18 pp vs Aug" reads it.
 *
 * @param entries - The values, newest first.
 * @returns The change, or none with fewer than two values.
 */
export const latestChangeOf = (entries: readonly HistoryEntry[]): LatestChange | undefined => {
  const [latest, previous] = entries;
  if (!latest || !previous) return undefined;
  const sameMonth = latest.date.slice(0, 7) === previous.date.slice(0, 7);
  return {
    points: latest.value - previous.value,
    previousDate: previous.date,
    style: sameMonth ? 'dayMonth' : 'monthShort',
  };
};

/**
 * Lists the Holdings an index's latest value is projected into (FR-11.2):
 * the active ones whose rate tracks it.
 *
 * @param holdings - The household's Holdings, archived ones included.
 * @param index - The index's code.
 * @returns Those Holdings, as listed.
 */
export const holdingsTrackingOf = (
  holdings: readonly InvestmentHolding[],
  index: string,
): InvestmentHolding[] => holdings.filter((holding) => (
  !holding.archivedAt && holding.rate?.type === index
));
