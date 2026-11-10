import { investmentsReports } from '../../config/constants';
import { monthOf } from '../../utilities/calendarMonth';
import type {
  InvestmentsOverview, MonthOverview, PayoutSeries, Viewer,
} from '../../engines/reporting';
import { memberOnly, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import { todayOf, type InsightsDeps } from './context';

// The reports (FR-6.11, FR-5.3, FR-5.9) on
// `GET /households/:householdId/reports/:reportType`: the Month Overview
// (slice 3, OQ-201), the Investments overview and the payouts series (task
// 133, OQ-236). Every member may read a report — what each sees is
// ReportingEngine's to narrow, from the viewer it is handed; the Manager only
// decides the day, and which month or window was asked for.

/** The report types the contract's v1 enum names (OQ-208). */
export type ReportType = 'month-overview' | 'investments-overview' | 'payouts';

/** A served report, tagged with its type. */
export type TaggedReport = | MonthOverview & { readonly reportType: 'month-overview' }
  | InvestmentsOverview & { readonly reportType: 'investments-overview' }
  | { readonly reportType: 'payouts'; readonly series: readonly PayoutSeries[] };

/** The parts a Month Overview query may ask for — each absent when the query omits it. */
export interface MonthAsked {
  readonly year?: number | undefined;
  readonly month?: number | undefined;
}

/** What a report query may ask for: a month, or the payouts' Holdings and window. */
export interface ReportAsked extends MonthAsked {
  /** Payouts — the Holdings; every visible one when absent. */
  readonly holdingIds?: readonly string[] | undefined;
  /** Payouts — how many months back, this one included (the contract defaults it). */
  readonly months?: number | undefined;
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
 * Builds each report type from the Engine, by type.
 *
 * @param deps - The tier below.
 * @param viewer - The household and member.
 * @param asked - The query parts.
 * @returns The builders, by report type.
 */
const buildersOf = (deps: InsightsDeps, viewer: Viewer, asked: ReportAsked) => ({
  'month-overview': async (): Promise<TaggedReport> => ({
    reportType: 'month-overview',
    ...await deps.reporting.monthOverview(viewer, monthAskedFor(deps, asked)),
  }),
  'investments-overview': async (): Promise<TaggedReport> => ({
    reportType: 'investments-overview',
    ...await deps.reporting.investmentsOverview(
      viewer,
      todayOf(deps),
      investmentsReports.netWorthMonths,
    ),
  }),
  payouts: async (): Promise<TaggedReport> => ({
    reportType: 'payouts',
    series: await deps.reporting.payouts(viewer, {
      holdingIds: asked.holdingIds,
      months: asked.months ?? investmentsReports.defaultPayoutMonths,
      today: todayOf(deps),
    }),
  }),
});

/**
 * Builds the report use cases.
 *
 * @param deps - The tier below.
 * @returns `report`.
 */
export const createReports = (deps: InsightsDeps) => ({
  /**
   * A report as the member sees it (FR-6.11, FR-5.3, FR-5.9).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param reportType - The type asked for.
   * @param asked - The month (Month Overview) or the Holdings and window
   *   (payouts); today's month and every visible Holding when absent.
   * @returns The report, tagged with its type.
   * @throws {DomainError} `household.not_found`.
   */
  report: async (
    context: SignedInContext,
    householdId: string,
    reportType: ReportType,
    asked: ReportAsked = {},
  ): Promise<TaggedReport> => {
    const viewerUserId = context.actor.userId;
    await requireAccess(deps.authorization, viewerUserId, householdId, memberOnly);
    return buildersOf(deps, { householdId, viewerUserId }, asked)[reportType]();
  },
});

export type Reports = ReturnType<typeof createReports>;
