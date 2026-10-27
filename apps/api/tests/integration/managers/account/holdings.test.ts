import { captureLogs, type LogEvent } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import { expectAudited } from '../audit';
import {
  ACCOUNT, ANA_ID, BEA_ID, CONTEXT, fakeDeps, GOAL, HOLDING, HOUSEHOLD_ID, NOW, TODAY,
} from './fakes';

const HOLDING_ID = HOLDING.id;
const UNKNOWN_ID = '0199c5a0-0000-7000-8000-0000000000ff';
/** Bea's personal Goal: Ana can't see it (FR-8.1). */
const BEAS_GOAL = {
  ...GOAL, id: '0199c5a0-0000-7000-8000-0000000000f2', ownerUserId: BEA_ID, visibility: 'personal',
} as typeof GOAL;
const COMPLETED_GOAL = { ...GOAL, completedAt: NOW };
/** A CDB past its due date (2026-10-12, today 2026-10-13) with a position. */
const CDB = { ...HOLDING, assetType: 'cdb', ticker: null };
const REDEMPTION = {
  id: 'r1',
  holdingId: HOLDING_ID,
  kind: 'redemption',
  amount: 110000,
  date: '2026-10-12',
  postedAt: null,
  createdAt: NOW,
};
const HOUSEHOLD_NOT_FOUND = { domainError: { code: 'household.not_found' } };
const FORBIDDEN = { domainError: { code: 'auth.forbidden' } };
const HOLDING_NOT_FOUND = { domainError: { code: 'holding.not_found' } };
const GOAL_NOT_FOUND = { domainError: { code: 'goal.not_found' } };
/** What AuthorizationUtility decides on when there is no Holding to look at. */
const MEMBERS_ONLY = { action: 'data.view', visibility: 'shared', ownerUserId: null };

/**
 * An allocation row as GoalAccessor lists it.
 *
 * @param goalId - The Goal.
 * @param percentage - Its share.
 * @returns The row.
 */
const allocation = (goalId: string, percentage: number) => ({
  id: `${goalId}-${percentage}`, holdingId: HOLDING_ID, goalId, percentage, createdAt: NOW,
});

/**
 * The access request for an action on a Holding of the default (shared, Ana's) Account.
 *
 * @param action - The data action.
 * @returns What AuthorizationUtility decides on.
 */
const onAccount = (action: string) => ({ action, visibility: 'shared', ownerUserId: ANA_ID });

/**
 * The audit entry a Holding action leaves.
 *
 * @param action - The audited action.
 * @returns The expected entry.
 */
const audit = (action: string) => ({
  action,
  actorId: ANA_ID,
  entityType: 'InvestmentHolding',
  entityId: HOLDING_ID,
  householdId: HOUSEHOLD_ID,
});

/**
 * The audit actions logged.
 *
 * @param events - The captured log events.
 * @returns Their messages, in order.
 */
const auditedActions = (events: readonly LogEvent[]) => (
  events.filter(({ level }) => level === 'audit').map(({ message }) => message)
);

/**
 * Lists a Holding's schedule as Ana — the simplest read, to probe the access rule.
 *
 * @param deps - The mocked tier below.
 * @param holdingId - The Holding.
 * @returns The Manager's answer.
 */
const listSchedule = (deps: ReturnType<typeof fakeDeps>['deps'], holdingId: string) => (
  createAccountManager(deps).listScheduleEntries(CONTEXT, HOUSEHOLD_ID, holdingId)
);

describe('AccountManager — who may act on a Holding (OQ-178)', () => {
  it('decides on its Account\'s scope and owner', async () => {
    const {
      deps, holdings, accounts, authorization,
    } = fakeDeps();

    await createAccountManager(deps).listScheduleEntries(CONTEXT, HOUSEHOLD_ID, HOLDING_ID);

    expect(holdings.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, HOLDING_ID);
    expect(accounts.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, ACCOUNT.id);
    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onAccount('data.view'),
    );
  });

  it('answers a missing Holding 404 holding.not_found, after the membership check', async () => {
    const {
      deps, holdings, accounts, authorization,
    } = fakeDeps();
    holdings.findById.mockResolvedValueOnce(undefined);

    await expect(listSchedule(deps, UNKNOWN_ID)).rejects.toMatchObject(HOLDING_NOT_FOUND);
    expect(accounts.findById).not.toHaveBeenCalled();
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
  });

  it('answers a Holding whose Account is gone 404 holding.not_found', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    accounts.findById.mockResolvedValueOnce(undefined);

    await expect(listSchedule(deps, HOLDING_ID)).rejects.toMatchObject(HOLDING_NOT_FOUND);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
  });

  it('answers a Holding in someone else\'s personal Account 404 holding.not_found', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    accounts.findById.mockResolvedValueOnce({
      ...ACCOUNT, visibility: 'personal', ownerUserId: BEA_ID,
    });
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_visible' });

    await expect(listSchedule(deps, HOLDING_ID)).rejects.toMatchObject(HOLDING_NOT_FOUND);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'personal', ownerUserId: BEA_ID,
    });
  });

  it('answers a non-member 404 household.not_found', async () => {
    const { deps, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(listSchedule(deps, HOLDING_ID)).rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
  });
});

describe('AccountManager — a Holding\'s schedule (FR-11.2)', () => {
  it('lists the Holding\'s entries', async () => {
    const { deps, holdings } = fakeDeps();
    holdings.listSchedule.mockResolvedValueOnce([REDEMPTION]);

    const entries = await createAccountManager(deps)
      .listScheduleEntries(CONTEXT, HOUSEHOLD_ID, HOLDING_ID);

    expect(entries).toEqual([REDEMPTION]);
    expect(holdings.listSchedule).toHaveBeenCalledWith([HOLDING_ID]);
  });
});

describe('AccountManager — a Holding\'s Goal split (OQ-178)', () => {
  it('lists the shares of the Goals the caller can see, leaving the others out', async () => {
    const { deps, goals, authorization } = fakeDeps();
    goals.listAllocations.mockResolvedValueOnce([
      allocation(BEAS_GOAL.id, 30), allocation(GOAL.id, 20),
    ]);
    goals.findByIds.mockResolvedValueOnce([GOAL, BEAS_GOAL]);

    const split = await createAccountManager(deps)
      .listHoldingAllocations(CONTEXT, HOUSEHOLD_ID, HOLDING_ID);

    expect(split).toEqual([{ goalId: GOAL.id, percentage: 20 }]);
    expect(goals.listAllocations).toHaveBeenCalledWith({ holdingId: HOLDING_ID });
    expect(goals.findByIds).toHaveBeenCalledWith(HOUSEHOLD_ID, [BEAS_GOAL.id, GOAL.id]);
    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onAccount('data.view'),
    );
  });
});

describe('AccountManager — edit a Holding\'s Goal split (uc-02, FR-8.2/8.3, OQ-168)', () => {
  it('replaces the visible split, keeps the hidden shares, audits it', async () => {
    const { deps, goals, authorization } = fakeDeps();
    goals.listAllocations.mockResolvedValueOnce([
      allocation(BEAS_GOAL.id, 30), allocation(GOAL.id, 20),
    ]);
    goals.findByIds.mockResolvedValueOnce([GOAL, BEAS_GOAL]);
    const logs = captureLogs(onTestFinished);

    const split = await createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, [
      { goalId: GOAL.id, percentage: 50 },
    ]);

    expect(split).toEqual([{ goalId: GOAL.id, percentage: 50 }]);
    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onAccount('data.edit'),
    );
    expect(goals.listAllocations).toHaveBeenCalledWith({ holdingId: HOLDING_ID });
    expect(goals.findByIds).toHaveBeenCalledWith(HOUSEHOLD_ID, [BEAS_GOAL.id, GOAL.id]);
    expect(goals.replaceAllocations).toHaveBeenCalledWith(HOUSEHOLD_ID, HOLDING_ID, [
      { goalId: BEAS_GOAL.id, percentage: 30 }, { goalId: GOAL.id, percentage: 50 },
    ], TODAY);
    expectAudited(logs.events, audit('EditHoldingAllocations'));
  });

  it('removes the visible split when given none', async () => {
    const { deps, goals } = fakeDeps();
    goals.listAllocations.mockResolvedValueOnce([allocation(GOAL.id, 20)]);

    expect(await createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, []))
      .toEqual([]);
    expect(goals.replaceAllocations).toHaveBeenCalledWith(HOUSEHOLD_ID, HOLDING_ID, [], TODAY);
  });

  it('refuses an archived Holding 409 holding.archived, reading no split', async () => {
    const { deps, holdings, goals } = fakeDeps();
    holdings.findById.mockResolvedValueOnce({ ...HOLDING, archivedAt: NOW, archivedBy: 'system' });

    await expect(createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, []))
      .rejects.toMatchObject({ domainError: { code: 'holding.archived' } });
    expect(goals.listAllocations).not.toHaveBeenCalled();
  });

  it('refuses a caller without the role 403, reading no split', async () => {
    const { deps, goals, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, []))
      .rejects.toMatchObject(FORBIDDEN);
    expect(goals.listAllocations).not.toHaveBeenCalled();
  });

  it('refuses a Goal listed twice 422, naming the repeat', async () => {
    const { deps, goals } = fakeDeps();

    await expect(createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, [
      { goalId: GOAL.id, percentage: 10 }, { goalId: GOAL.id, percentage: 20 },
    ])).rejects.toMatchObject({
      domainError: {
        code: 'validation.failed',
        details: [{ field: 'allocations[1].goalId', code: 'array.duplicate' }],
      },
    });
    expect(goals.replaceAllocations).not.toHaveBeenCalled();
  });

  it.each([
    ['someone else\'s personal Goal', [GOAL, BEAS_GOAL]],
    ['a Goal of another household, or none', [GOAL]],
  ])('answers %s 404 goal.not_found, writing nothing', async (_, found) => {
    const { deps, goals } = fakeDeps();
    goals.findByIds.mockResolvedValueOnce(found);

    await expect(createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, [
      { goalId: BEAS_GOAL.id, percentage: 10 },
    ])).rejects.toMatchObject(GOAL_NOT_FOUND);
    expect(goals.replaceAllocations).not.toHaveBeenCalled();
  });

  it('refuses a completed Goal grown or added 409 goal.completed (FR-8.9)', async () => {
    const { deps, goals } = fakeDeps();
    goals.listAllocations.mockResolvedValueOnce([allocation(GOAL.id, 20)]);
    goals.findByIds.mockResolvedValueOnce([COMPLETED_GOAL]);

    await expect(createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, [
      { goalId: GOAL.id, percentage: 25 },
    ])).rejects.toMatchObject({ domainError: { code: 'goal.completed' } });
    expect(goals.replaceAllocations).not.toHaveBeenCalled();
  });

  it('keeps a completed Goal\'s unchanged share', async () => {
    const { deps, goals } = fakeDeps();
    goals.listAllocations.mockResolvedValueOnce([allocation(GOAL.id, 20)]);
    goals.findByIds.mockResolvedValueOnce([COMPLETED_GOAL]);

    await createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, [
      { goalId: GOAL.id, percentage: 20 },
    ]);

    expect(goals.replaceAllocations).toHaveBeenCalledWith(HOUSEHOLD_ID, HOLDING_ID, [
      { goalId: GOAL.id, percentage: 20 },
    ], TODAY);
  });

  it.each([
    [{
      ok: false, reason: 'allocation_exceeds_100', current: 30, requested: 130,
    }, {
      code: 'goal.allocation_exceeds_100', params: { current: 30, requested: 130 },
    }],
    [{ ok: false, reason: 'holding_not_found' }, { code: 'holding.not_found' }],
    [{ ok: false, reason: 'goal_not_found', goalId: GOAL.id }, {
      code: 'goal.not_found',
    }],
  ])('answers GoalAccessor\'s %j as the API does, unaudited', async (result, domainError) => {
    const { deps, goals } = fakeDeps();
    goals.replaceAllocations.mockResolvedValueOnce(result);
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps).editHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, [
      { goalId: GOAL.id, percentage: 100 },
    ])).rejects.toMatchObject({ domainError });

    expect(auditedActions(logs.events)).toEqual([]);
  });
});

describe('AccountManager — archive a matured Holding (uc-03, FR-5.8, OQ-178)', () => {
  it('archives it as the user\'s and audits it', async () => {
    const {
      deps, holdings, authorization,
    } = fakeDeps();
    holdings.findById.mockResolvedValueOnce(CDB);
    holdings.listSchedule.mockResolvedValueOnce([REDEMPTION]);
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps).archiveHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID);

    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onAccount('data.delete'),
    );
    expect(holdings.listSchedule).toHaveBeenCalledWith([HOLDING_ID]);
    expect(holdings.archive).toHaveBeenCalledWith(HOLDING_ID, 'user');
    expectAudited(logs.events, audit('ArchiveHolding'));
  });

  it('leaves an archived Holding as it is, unaudited', async () => {
    const { deps, holdings } = fakeDeps();
    holdings.findById.mockResolvedValueOnce({ ...CDB, archivedAt: NOW, archivedBy: 'system' });
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps).archiveHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID);

    expect(holdings.listSchedule).not.toHaveBeenCalled();
    expect(holdings.archive).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('leaves it unaudited when it was archived meanwhile', async () => {
    const { deps, holdings } = fakeDeps();
    holdings.findById.mockResolvedValueOnce(CDB);
    holdings.listSchedule.mockResolvedValueOnce([REDEMPTION]);
    holdings.archive.mockResolvedValueOnce(false);
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps).archiveHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID);

    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('refuses a Holding that hasn\'t matured 409 holding.not_matured', async () => {
    const { deps, holdings } = fakeDeps();
    holdings.listSchedule.mockResolvedValueOnce([]);

    await expect(createAccountManager(deps).archiveHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID))
      .rejects.toMatchObject({ domainError: { code: 'holding.not_matured' } });
    expect(holdings.archive).not.toHaveBeenCalled();
  });

  it('refuses a caller without the role 403', async () => {
    const { deps, holdings, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).archiveHolding(CONTEXT, HOUSEHOLD_ID, HOLDING_ID))
      .rejects.toMatchObject(FORBIDDEN);
    expect(holdings.archive).not.toHaveBeenCalled();
  });
});
