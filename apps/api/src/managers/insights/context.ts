import type { AccountAccessor } from '../../accessors/accountAccessor';
import type { AccountTransactionAccessor } from '../../accessors/accountTransactionAccessor';
import type { AuditLogAccessor } from '../../accessors/auditLogAccessor';
import type { GoalAccessor } from '../../accessors/goalAccessor';
import type { InvestmentHoldingAccessor } from '../../accessors/investmentHoldingAccessor';
import type { NotificationInboxAccessor } from '../../accessors/notificationInboxAccessor';
import { calendar } from '../../config/constants';
import type { InvestmentProductEngine } from '../../engines/investmentProduct';
import type { ReportingEngine } from '../../engines/reporting';
import type { AuthorizationUtility } from '../../utilities/authorization';
import calendarDate from '../../utilities/calendar';

// What every InsightsManager use case shares (VBD §2.1, OQ-201): the two
// Engines it composes — ReportingEngine for the reshaped reads and
// InvestmentProductEngine's `project` for a Holding's expected payout — plus
// the Accessor reads its own decisions need: which Goals the viewer sees, one
// Account or Holding's access facts, and the buys that opened fixed-term
// Holdings (OQ-205); and, in slice 5 (OQ-243), the user's inbox and the
// household's audit log. Reads never audit (VBD §3.0); there is no logger here.

/** The components InsightsManager calls, and the clock. */
export interface InsightsDeps {
  /** The read-side reports (E2 — this Manager is its sole caller). */
  readonly reporting: ReportingEngine;
  /** A fixed-term contract's expected payout (E1 — `project` only). */
  readonly investmentProducts: Pick<InvestmentProductEngine, 'project'>;
  readonly goals: GoalAccessor;
  readonly accounts: AccountAccessor;
  readonly holdings: InvestmentHoldingAccessor;
  readonly accountTransactions: Pick<AccountTransactionAccessor, 'findBuys'>;
  /** The user's inbox (FR-6.10) — no `insert`: producers write through NotificationEngine. */
  readonly notifications: Pick<
    NotificationInboxAccessor, 'listByUser' | 'markSeen' | 'deleteForUser'
  >;
  /** The audit log's one read (FR-7.2). */
  readonly auditLog: Pick<AuditLogAccessor, 'listForExport'>;
  readonly authorization: Pick<AuthorizationUtility, 'authorize'>;
  /** The app-timezone clock (OQ-104). */
  readonly now: () => Date;
}

/**
 * Today in the app's time zone (OQ-104) — "the current view" reads this day.
 *
 * @param deps - The clock.
 * @returns `YYYY-MM-DD`.
 */
export const todayOf = (deps: Pick<InsightsDeps, 'now'>): string => (
  calendarDate(deps.now(), calendar.timeZone)
);
