import { describe, expect, it } from 'vitest';
import { createReportingEngine } from '../../../../src/engines/reporting';
import auditLogCsv from '../../../../src/engines/reporting/auditLogReport';
import {
  aGoal, aHolding, anAccount, anAllocation, aSnapshot, fakeDeps, HOUSEHOLD_ID, VIEWER,
} from './fakes';

describe('createReportingEngine', () => {
  it('names funding in the viewer\'s Accounts, and elsewhere not (OQ-206)', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.listAllocations.mockResolvedValue([
      anAllocation('trip', 'petr4', 50),
      anAllocation('trip', 'bea-stock', 50),
    ]);
    deps.findHoldings.mockResolvedValue([
      aHolding(),
      aHolding({ id: 'bea-stock', accountId: 'bea-personal', ticker: 'VALE3' }),
    ]);
    deps.latestSnapshots.mockResolvedValue([
      aSnapshot('petr4', 2_000),
      aSnapshot('bea-stock', 4_000),
    ]);

    const [progress] = await createReportingEngine(deps)
      .goalProgress(VIEWER, [aGoal()], '2026-10-13');

    expect(progress?.fundedBy).toEqual([
      {
        holdingId: 'petr4',
        name: 'PETR4',
        percentage: 50,
        contribution: { currency: 'BRL', amount: 1_000 },
      },
      {
        holdingId: null,
        name: null,
        percentage: 50,
        contribution: { currency: 'BRL', amount: 2_000 },
      },
    ]);
    expect(deps.listAccounts).toHaveBeenCalledWith(HOUSEHOLD_ID, 'ana');
    expect(deps.latestSnapshots).toHaveBeenCalledWith(['petr4', 'bea-stock'], '2026-10-13');
  });

  it('builds the Month Overview through the Accessor reads', async () => {
    const deps = fakeDeps();

    const overview = await createReportingEngine(deps)
      .monthOverview(VIEWER, { year: 2026, month: 3 });

    expect(overview.summary).toEqual([]);
    expect(deps.listAccounts).toHaveBeenCalledWith(HOUSEHOLD_ID, 'ana');
  });

  it('builds the Investments overview over the asked window (task 133)', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.listHoldings.mockResolvedValue([aHolding()]);

    const overview = await createReportingEngine(deps)
      .investmentsOverview(VIEWER, '2026-10-13', 6);

    expect(overview.netWorth).toEqual([]);
    // Six month ends but today's, plus today for the series and for the slices.
    expect(deps.latestSnapshots).toHaveBeenCalledTimes(7);
  });

  it('builds the Dashboard for today\'s month through the Accessor reads (task 139)', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([anAccount()]);

    const panels = await createReportingEngine(deps).dashboard(VIEWER, '2026-10-13', 6);

    expect(panels.month).toBe('2026-10');
    expect(deps.listAccounts).toHaveBeenCalledWith(HOUSEHOLD_ID, 'ana');
  });

  it('builds the payouts series through the Accessor reads (task 133)', async () => {
    const deps = fakeDeps();
    deps.listAccounts.mockResolvedValue([anAccount()]);
    deps.listHoldings.mockResolvedValue([aHolding()]);

    const series = await createReportingEngine(deps)
      .payouts(VIEWER, { months: 2, today: '2026-10-13' });

    expect(series).toEqual([]);
    expect(deps.listPayouts).toHaveBeenCalledWith(['petr4'], '2026-09-01', '2026-10-31');
  });

  it('keeps the audit-log CSV (OQ-104)', () => {
    expect(createReportingEngine(fakeDeps()).auditLogCsv).toBe(auditLogCsv);
  });
});
