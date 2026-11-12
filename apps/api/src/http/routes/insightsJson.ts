import type { InboxNotification } from '../../accessors/notificationInboxAccessor';
import type { Dashboard } from '../../engines/reporting';
import type {
  Funding, GoalWithProgress, ProjectedHolding, TaggedReport,
} from '../../managers/insights';
import { toGoalJson } from './accountJson';

// The JSON shapes InsightsManager's reads answer with (the contract's
// `GoalFundingRow`, `GoalWithProgress`, `GoalProgress`, `InvestmentHolding`,
// the reports, `DashboardReport` and `Notification`).

/**
 * One Holding funding a Goal, as the contract shows it (`GoalFundingRow`).
 *
 * @param row - The Engine's funding row.
 * @returns The JSON shape — `holdingId` and `name` null when the viewer can't see it (OQ-206).
 */
export const toFundingRowJson = (row: Funding) => ({
  holdingId: row.holdingId,
  name: row.name,
  percentage: row.percentage,
  contribution: row.contribution,
});

/**
 * A Goal with its progress (`GoalWithProgress`): the definition plus `fundedBy`.
 *
 * @param withProgress - The Engine's result.
 * @returns The JSON shape.
 */
export const toGoalWithProgressJson = (withProgress: GoalWithProgress) => ({
  ...toGoalJson(withProgress.goal),
  fundedBy: withProgress.fundedBy.map(toFundingRowJson),
});

/**
 * One Goal's progress, current or by month (`GoalProgress`): the target and its
 * funding on that day — not the whole definition.
 *
 * @param withProgress - The Engine's result for the one Goal.
 * @returns The JSON shape.
 */
export const toGoalProgressJson = (withProgress: GoalWithProgress) => ({
  goalId: withProgress.goal.id,
  targetAmount: withProgress.goal.targetAmount,
  targetCurrency: withProgress.goal.targetCurrency,
  fundedBy: withProgress.fundedBy.map(toFundingRowJson),
});

/** The Holding's own rate as the contract shows it — fixed-term only. */
const rateOf = (holding: ProjectedHolding) => {
  if (holding.rateType === null || holding.rateValue === null) return null;
  return { type: holding.rateType, value: holding.rateValue, spread: holding.rateSpread };
};

/**
 * A Holding with its expected payout (`InvestmentHolding`): the row's fields,
 * its rate and what InvestmentProductEngine projected on read (FR-11.2, OQ-205).
 *
 * @param holding - The Manager's result.
 * @returns The JSON shape — `expectedPayout`, `expectedTaxes`,
 *   `projectionUnavailable` and `boughtOn` null for a market-priced Holding.
 */
export const toInvestmentHoldingJson = (holding: ProjectedHolding) => ({
  id: holding.id,
  accountId: holding.accountId,
  assetType: holding.assetType,
  ticker: holding.ticker,
  quantity: holding.quantity,
  costBasis: holding.costBasis,
  rate: rateOf(holding),
  archivedAt: holding.archivedAt?.toISOString() ?? null,
  createdAt: holding.createdAt.toISOString(),
  incentivised: holding.incentivised,
  interestPayment: holding.interestPayment,
  dueDate: holding.dueDate,
  archivedBy: holding.archivedBy,
  expectedPayout: holding.expectedPayout,
  expectedTaxes: holding.expectedTaxes,
  projectionUnavailable: holding.projectionUnavailable,
  boughtOn: holding.boughtOn,
});

/**
 * Shapes a report as the contract shows it: the Month Overview's Goals
 * through their JSON form, the other types as they are.
 *
 * @param report - The served report.
 * @returns Its JSON body.
 */
export const toReportJson = (report: TaggedReport) => (
  report.reportType === 'month-overview'
    ? { ...report, goals: report.goals.map(toGoalWithProgressJson) }
    : report
);

/**
 * Shapes the Dashboard as the contract shows it (`DashboardReport`): its Goals
 * through their JSON form, the other panels as they are.
 *
 * @param panels - The Engine's Dashboard.
 * @returns Its JSON body.
 */
export const toDashboardJson = (panels: Dashboard) => ({
  ...panels,
  goals: panels.goals.map(toGoalWithProgressJson),
});

/**
 * Shapes a stored notification as the contract shows it (`Notification`): type
 * and raw params, never text (OQ-82).
 *
 * @param notification - The Accessor's row.
 * @returns The JSON shape, with ISO 8601 instants.
 */
export const toNotificationJson = (notification: InboxNotification) => ({
  id: notification.id,
  type: notification.type,
  params: notification.params,
  seenAt: notification.seenAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
});
