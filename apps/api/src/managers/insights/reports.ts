import { monthOf } from '../../accessors/calendarMonth';
import type { MonthOverview, Viewer } from '../../engines/reporting';
import { memberOnly, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import { todayOf, type InsightsDeps } from './context';

// The Month Overview (FR-6.11): the one report slice 3 serves on
// `GET /households/:householdId/reports/month-overview` (OQ-201). Every member
// may read it — what each sees is ReportingEngine's to narrow, from the viewer
// it is handed; the Manager only decides which month was asked for.

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
 * @returns `monthOverview`.
 */
export const createReports = (deps: InsightsDeps) => ({
  /**
   * A month's overview as the member sees it (FR-6.11, FR-6.6).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param asked - The year and/or month; today's when absent.
   * @returns The overview, as the Engine shapes it (`MonthOverviewReport` less its tag).
   * @throws {DomainError} `household.not_found`.
   */
  monthOverview: async (
    context: SignedInContext,
    householdId: string,
    asked?: MonthAsked,
  ): Promise<MonthOverview> => {
    const viewerUserId = context.actor.userId;
    await requireAccess(deps.authorization, viewerUserId, householdId, memberOnly);
    const viewer: Viewer = { householdId, viewerUserId };
    return deps.reporting.monthOverview(viewer, monthAskedFor(deps, asked));
  },
});

export type Reports = ReturnType<typeof createReports>;
