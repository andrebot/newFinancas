import { monthOf } from '../../utilities/calendarMonth';
import type { MonthOverview, Viewer } from '../../engines/reporting';
import { memberOnly, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import { todayOf, type InsightsDeps } from './context';
import { reportNotServed } from './errors';

// The reports (FR-6.11) on `GET /households/:householdId/reports/:reportType`:
// slice 3 serves the Month Overview alone (OQ-201); the other v1 types answer
// `report.unknown_type_or_range` until task 133 (OQ-208) — the Manager decides
// which types exist, after the membership check, so a non-member learns
// nothing either way. Every member may read a report — what each sees is
// ReportingEngine's to narrow, from the viewer it is handed; the Manager only
// decides which month was asked for.

/** The report types the contract's v1 enum names (OQ-208). */
export type ReportType = 'month-overview' | 'investments-overview' | 'payouts';

/** A served report, tagged with its type — the Month Overview, for now. */
export type TaggedReport = MonthOverview & { readonly reportType: 'month-overview' };

/** The parts a report query may ask for — each absent when the query omits it. */
export interface MonthAsked {
  readonly year?: number | undefined;
  readonly month?: number | undefined;
}

/**
 * The month a report asks for: each part defaults to today's (OQ-104).
 *
 * @param deps - The clock.
 * @param asked - The query parts, if any.
 * @returns The month.
 */
export const monthAskedFor = (deps: Pick<InsightsDeps, 'now'>, asked?: MonthAsked) => {
  const today = monthOf(todayOf(deps));
  return { year: asked?.year ?? today.year, month: asked?.month ?? today.month };
};

/**
 * Builds the report use cases.
 *
 * @param deps - The tier below.
 * @returns `report`.
 */
export const createReports = (deps: InsightsDeps) => ({
  /**
   * A report as the member sees it (FR-6.11, FR-6.6) — the Month Overview;
   * the other v1 types are refused until task 133 (OQ-208).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param reportType - The type asked for.
   * @param asked - The year and/or month; today's when absent.
   * @returns The report, tagged with its type.
   * @throws {DomainError} `household.not_found`; `report.unknown_type_or_range`.
   */
  report: async (
    context: SignedInContext,
    householdId: string,
    reportType: ReportType,
    asked?: MonthAsked,
  ): Promise<TaggedReport> => {
    const viewerUserId = context.actor.userId;
    await requireAccess(deps.authorization, viewerUserId, householdId, memberOnly);
    if (reportType !== 'month-overview') throw reportNotServed();
    const viewer: Viewer = { householdId, viewerUserId };
    const overview = await deps.reporting.monthOverview(viewer, monthAskedFor(deps, asked));
    return { reportType, ...overview };
  },
});

export type Reports = ReturnType<typeof createReports>;
