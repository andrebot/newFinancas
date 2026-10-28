import { describe, expect, it } from 'vitest';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import { createInsightsManager } from '../../../../src/managers/insights';
import {
  ANA_ID, BUY, GOAL, HOLDING, OVERVIEW, STOCK, fakeDeps,
} from './fakes';

const context: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};
/** The household the fakes know. */
const HOME = '0199c5a0-0000-7000-8000-0000000000bb';
/** The viewer every Engine call is handed. */
const VIEWER = { householdId: HOME, viewerUserId: ANA_ID };

describe('createInsightsManager', () => {
  it('exposes every slice-3 use case on one object (VBD §2.1)', () => {
    const manager = createInsightsManager(fakeDeps().deps);
    for (const name of ['monthOverview', 'goalProgressList', 'goalProgressFor',
      'listHoldings', 'getHolding']) {
      expect(typeof (manager as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

describe('monthOverview (FR-6.11)', () => {
  it('answers with the Engine\'s overview for today when no month is asked', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    const overview = await manager.monthOverview(context, HOME);

    expect(overview).toEqual(OVERVIEW);
    expect(tier.reporting.monthOverview)
      .toHaveBeenCalledWith(VIEWER, { year: 2026, month: 10 });
  });

  it('passes the asked year and month through', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    await manager.monthOverview(context, HOME, { year: 2025, month: 3 });

    expect(tier.reporting.monthOverview)
      .toHaveBeenCalledWith(VIEWER, { year: 2025, month: 3 });
  });

  it('defaults each absent part to today\'s (OQ-104)', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    await manager.monthOverview(context, HOME, { year: 2025 });
    await manager.monthOverview(context, HOME, { month: 2 });

    expect(tier.reporting.monthOverview)
      .toHaveBeenNthCalledWith(1, VIEWER, { year: 2025, month: 10 });
    expect(tier.reporting.monthOverview)
      .toHaveBeenNthCalledWith(2, VIEWER, { year: 2026, month: 2 });
  });

  it('a non-member learns nothing (OQ-117)', async () => {
    const tier = fakeDeps();
    tier.authorization.authorize.mockResolvedValue({ outcome: 'not_member' });
    const manager = createInsightsManager(tier.deps);

    await expect(manager.monthOverview(context, HOME)).rejects.toMatchObject({
      domainError: { code: 'household.not_found' },
    });
    expect(tier.reporting.monthOverview).not.toHaveBeenCalled();
  });
});

describe('goalProgressList (FR-8.5)', () => {
  it('lists the viewer\'s Goals and answers with what funds them today', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    const progress = await manager.goalProgressList(context, HOME, 'active');

    expect(progress).toEqual([{ goal: GOAL, fundedBy: [] }]);
    expect(tier.goals.list).toHaveBeenCalledWith(HOME, ANA_ID, 'active');
    expect(tier.reporting.goalProgress)
      .toHaveBeenCalledWith(VIEWER, [GOAL], '2026-10-13');
  });

  it('a non-member learns nothing (OQ-117)', async () => {
    const tier = fakeDeps();
    tier.authorization.authorize.mockResolvedValue({ outcome: 'not_member' });
    const manager = createInsightsManager(tier.deps);

    await expect(manager.goalProgressList(context, HOME, 'active'))
      .rejects.toMatchObject({ domainError: { code: 'household.not_found' } });
    expect(tier.goals.list).not.toHaveBeenCalled();
  });
});

describe('goalProgressFor (FR-8.5/8.7)', () => {
  it('answers for today when no month is asked', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    const progress = await manager.goalProgressFor(context, HOME, GOAL.id);

    expect(progress).toEqual({ goal: GOAL, fundedBy: [] });
    expect(tier.goals.findById).toHaveBeenCalledWith(HOME, GOAL.id);
    expect(tier.reporting.goalProgress)
      .toHaveBeenCalledWith(VIEWER, [GOAL], '2026-10-13');
  });

  it('answers on the asked month\'s last day (FR-8.7)', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    await manager.goalProgressFor(context, HOME, GOAL.id, { year: 2026, month: 10 });

    expect(tier.reporting.goalProgress)
      .toHaveBeenCalledWith(VIEWER, [GOAL], '2026-10-31');
  });

  it('defaults each absent part to today\'s before taking the month end (OQ-104)', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    await manager.goalProgressFor(context, HOME, GOAL.id, { year: 2025 });
    await manager.goalProgressFor(context, HOME, GOAL.id, { month: 2 });

    expect(tier.reporting.goalProgress)
      .toHaveBeenNthCalledWith(1, VIEWER, [GOAL], '2025-10-31');
    expect(tier.reporting.goalProgress)
      .toHaveBeenNthCalledWith(2, VIEWER, [GOAL], '2026-02-28');
  });

  it('a Goal that is not there answers goal.not_found', async () => {
    const tier = fakeDeps();
    tier.goals.findById.mockResolvedValue(undefined);
    const manager = createInsightsManager(tier.deps);

    await expect(manager.goalProgressFor(context, HOME, GOAL.id))
      .rejects.toMatchObject({ domainError: { code: 'goal.not_found' } });
    expect(tier.reporting.goalProgress).not.toHaveBeenCalled();
  });

  it('someone else\'s personal Goal answers goal.not_found (OQ-111)', async () => {
    const tier = fakeDeps();
    tier.authorization.authorize.mockResolvedValue({ outcome: 'not_visible' });
    const manager = createInsightsManager(tier.deps);

    await expect(manager.goalProgressFor(context, HOME, GOAL.id))
      .rejects.toMatchObject({ domainError: { code: 'goal.not_found' } });
  });

  it('a non-member learns nothing (OQ-117)', async () => {
    const tier = fakeDeps();
    tier.authorization.authorize.mockResolvedValue({ outcome: 'not_member' });
    const manager = createInsightsManager(tier.deps);

    await expect(manager.goalProgressFor(context, HOME, GOAL.id))
      .rejects.toMatchObject({ domainError: { code: 'household.not_found' } });
  });

  it('answers goal.not_found if the Engine returns no progress for the Goal', async () => {
    const tier = fakeDeps();
    tier.reporting.goalProgress.mockResolvedValue([]);
    const manager = createInsightsManager(tier.deps);

    await expect(manager.goalProgressFor(context, HOME, GOAL.id))
      .rejects.toMatchObject({ domainError: { code: 'goal.not_found' } });
  });
});

describe('listHoldings (FR-5.3)', () => {
  it('projects each fixed-term Holding and leaves market-priced ones unprojected', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    const holdings = await manager.listHoldings(context, HOME, HOLDING.accountId, false);

    expect(holdings).toEqual([
      {
        ...HOLDING,
        expectedPayout: 1105000,
        expectedTaxes: { estimated: true, amount: 26112 },
        projectionUnavailable: null,
      },
      {
        ...STOCK, expectedPayout: null, expectedTaxes: null, projectionUnavailable: null,
      },
    ]);
    expect(tier.holdings.listByAccounts)
      .toHaveBeenCalledWith([HOLDING.accountId], { includeArchived: false });
    // Only the fixed-term one reaches the Engine — with its buy's date and amount (OQ-205).
    expect(tier.investmentProducts.project).toHaveBeenCalledTimes(1);
    expect(tier.investmentProducts.project)
      .toHaveBeenCalledWith(HOME, expect.objectContaining({ date: BUY.date, amount: BUY.amount }));
  });

  it('an Account that is not there answers account.not_found', async () => {
    const tier = fakeDeps();
    tier.accounts.findById.mockResolvedValue(undefined);
    const manager = createInsightsManager(tier.deps);

    await expect(manager.listHoldings(context, HOME, HOLDING.accountId, false))
      .rejects.toMatchObject({ domainError: { code: 'account.not_found' } });
    expect(tier.holdings.listByAccounts).not.toHaveBeenCalled();
  });

  it('someone else\'s personal Account answers account.not_found (OQ-111)', async () => {
    const tier = fakeDeps();
    tier.authorization.authorize.mockResolvedValue({ outcome: 'not_visible' });
    const manager = createInsightsManager(tier.deps);

    await expect(manager.listHoldings(context, HOME, HOLDING.accountId, false))
      .rejects.toMatchObject({ domainError: { code: 'account.not_found' } });
  });

  it('a non-member learns nothing (OQ-117)', async () => {
    const tier = fakeDeps();
    tier.authorization.authorize.mockResolvedValue({ outcome: 'not_member' });
    const manager = createInsightsManager(tier.deps);

    await expect(manager.listHoldings(context, HOME, HOLDING.accountId, false))
      .rejects.toMatchObject({ domainError: { code: 'household.not_found' } });
  });
});

describe('getHolding (FR-5.4)', () => {
  it('answers a fixed-term Holding with its expected payout', async () => {
    const tier = fakeDeps();
    const manager = createInsightsManager(tier.deps);

    const holding = await manager.getHolding(context, HOME, HOLDING.id);

    expect(holding).toEqual({
      ...HOLDING,
      expectedPayout: 1105000,
      expectedTaxes: { estimated: true, amount: 26112 },
      projectionUnavailable: null,
    });
    expect(tier.accountTransactions.findBuy).toHaveBeenCalledWith(HOME, HOLDING.id);
  });

  it('carries a CDI spread into the terms it projects from', async () => {
    const tier = fakeDeps();
    const lci = {
      ...HOLDING,
      assetType: 'lci' as const,
      rateType: 'cdi' as const,
      rateSpread: 200,
      interestPayment: null,
    };
    tier.holdings.findById.mockResolvedValue(lci);
    const manager = createInsightsManager(tier.deps);

    await manager.getHolding(context, HOME, lci.id);

    expect(tier.investmentProducts.project).toHaveBeenCalledWith(HOME, {
      assetType: 'lci',
      incentivised: null,
      date: BUY.date,
      amount: BUY.amount,
      dueDate: HOLDING.dueDate,
      rate: { type: 'cdi', value: 105000, spread: 200 },
      interestPayment: 'at_maturity',
    });
  });

  it('leaves a market-priced Holding unprojected and never reaches the Engine', async () => {
    const tier = fakeDeps();
    tier.holdings.findById.mockResolvedValue(STOCK);
    const manager = createInsightsManager(tier.deps);

    const holding = await manager.getHolding(context, HOME, STOCK.id);

    expect(holding).toEqual({
      ...STOCK, expectedPayout: null, expectedTaxes: null, projectionUnavailable: null,
    });
    expect(tier.accountTransactions.findBuy).not.toHaveBeenCalled();
    expect(tier.investmentProducts.project).not.toHaveBeenCalled();
  });

  it('a fixed-term Holding with no buy on record stays unprojected', async () => {
    const tier = fakeDeps();
    tier.accountTransactions.findBuy.mockResolvedValue(undefined);
    const manager = createInsightsManager(tier.deps);

    const holding = await manager.getHolding(context, HOME, HOLDING.id);

    expect(holding).toEqual({
      ...HOLDING, expectedPayout: null, expectedTaxes: null, projectionUnavailable: null,
    });
    expect(tier.investmentProducts.project).not.toHaveBeenCalled();
  });

  it('names why an index-linked Holding cannot be projected (OQ-205)', async () => {
    const tier = fakeDeps();
    tier.investmentProducts.project.mockResolvedValue({
      ok: false, reason: 'index_missing', indexCode: 'ipca',
    });
    const manager = createInsightsManager(tier.deps);

    const holding = await manager.getHolding(context, HOME, HOLDING.id);

    expect(holding).toEqual({
      ...HOLDING,
      expectedPayout: null,
      expectedTaxes: null,
      projectionUnavailable: { reason: 'index_missing', indexCode: 'ipca' },
    });
  });

  it('a Holding that is not there answers holding.not_found', async () => {
    const tier = fakeDeps();
    tier.holdings.findById.mockResolvedValue(undefined);
    const manager = createInsightsManager(tier.deps);

    await expect(manager.getHolding(context, HOME, HOLDING.id))
      .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    expect(tier.accounts.findById).not.toHaveBeenCalled();
  });

  it('a Holding whose Account is not there answers holding.not_found', async () => {
    const tier = fakeDeps();
    tier.accounts.findById.mockResolvedValue(undefined);
    const manager = createInsightsManager(tier.deps);

    await expect(manager.getHolding(context, HOME, HOLDING.id))
      .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
  });

  it('someone else\'s personal Account answers holding.not_found (OQ-111)', async () => {
    const tier = fakeDeps();
    tier.authorization.authorize.mockResolvedValue({ outcome: 'not_visible' });
    const manager = createInsightsManager(tier.deps);

    await expect(manager.getHolding(context, HOME, HOLDING.id))
      .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
  });
});
