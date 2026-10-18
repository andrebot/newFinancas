import { captureLogs, type LogEvent } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import { expectAudited } from '../audit';
import {
  ANA_ID, BEA_ID, CONTEXT, fakeDeps, GOAL, HOUSEHOLD_ID, NOW,
} from './fakes';

const GOAL_ID = GOAL.id;
const UNKNOWN_ID = '0199c5a0-0000-7000-8000-0000000000ff';
const NEW_GOAL = {
  name: 'House',
  targetAmount: 15000000,
  targetCurrency: 'BRL',
  dueDate: '2030-12-31',
  visibility: 'shared' as const,
};
const COMPLETED_GOAL = { ...GOAL, completedAt: NOW };
const HOUSEHOLD_NOT_FOUND = { apiError: { status: 404, code: 'household.not_found' } };
const FORBIDDEN = { apiError: { status: 403, code: 'auth.forbidden' } };
const GOAL_NOT_FOUND = { apiError: { status: 404, code: 'goal.not_found' } };
/** What AuthorizationUtility decides on when there is no Goal to look at. */
const MEMBERS_ONLY = { action: 'data.view', visibility: 'shared', ownerUserId: null };
const BLANK_NAME = {
  apiError: {
    status: 422,
    code: 'validation.failed',
    details: [{ field: 'name', code: 'string.min' }],
  },
};

/**
 * The audit entry a Goal action leaves.
 *
 * @param action - The audited action.
 * @returns The expected entry.
 */
const audit = (action: string) => ({
  action, actorId: ANA_ID, entityType: 'Goal', entityId: GOAL_ID, householdId: HOUSEHOLD_ID,
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
 * The access request for an action on the default (shared, Ana's) Goal.
 *
 * @param action - The data action.
 * @returns What AuthorizationUtility decides on.
 */
const onGoal = (action: string) => ({ action, visibility: 'shared', ownerUserId: ANA_ID });

describe('AccountManager — view Goals (FR-8.1, OQ-177)', () => {
  it('lists the Goals the caller can see in one status, checking membership only', async () => {
    const { deps, goals, authorization } = fakeDeps();

    const listed = await createAccountManager(deps).listGoals(CONTEXT, HOUSEHOLD_ID, 'completed');

    expect(listed).toEqual([GOAL]);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
    expect(goals.list).toHaveBeenCalledWith(HOUSEHOLD_ID, ANA_ID, 'completed');
  });

  it('answers a non-member 404 household.not_found, reading nothing', async () => {
    const { deps, goals, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).listGoals(CONTEXT, HOUSEHOLD_ID, 'active'))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
    expect(goals.list).not.toHaveBeenCalled();
  });

  it('gets one Goal, checking data.view on its visibility and owner', async () => {
    const { deps, goals, authorization } = fakeDeps();

    expect(await createAccountManager(deps).getGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .toEqual(GOAL);
    expect(goals.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, GOAL_ID);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, onGoal('data.view'));
  });

  it('answers someone else\'s personal Goal 404 goal.not_found', async () => {
    const { deps, goals, authorization } = fakeDeps();
    goals.findById.mockResolvedValueOnce({ ...GOAL, visibility: 'personal', ownerUserId: BEA_ID });
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_visible' });

    await expect(createAccountManager(deps).getGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .rejects.toMatchObject(GOAL_NOT_FOUND);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'personal', ownerUserId: BEA_ID,
    });
  });

  it('answers a missing Goal 404 goal.not_found, after the membership check', async () => {
    const { deps, goals, authorization } = fakeDeps();
    goals.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).getGoal(CONTEXT, HOUSEHOLD_ID, UNKNOWN_ID))
      .rejects.toMatchObject(GOAL_NOT_FOUND);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
  });

  it('answers a non-member 404 household.not_found for one Goal', async () => {
    const { deps, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).getGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
  });
});

describe('AccountManager — create a Goal (uc-01, FR-8.1)', () => {
  it('creates it, unfunded, owned by its creator, and audits it', async () => {
    const { deps, goals, authorization } = fakeDeps();
    const logs = captureLogs();

    const created = await createAccountManager(deps).createGoal(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_GOAL, name: '  House ',
    });
    logs.stop();

    expect(created).toEqual(GOAL);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.create', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(goals.insert).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_ID,
      ownerUserId: ANA_ID,
      visibility: 'shared',
      name: 'House',
      targetAmount: 15000000,
      targetCurrency: 'BRL',
      dueDate: '2030-12-31',
    });
    expect(goals.replaceAllocations).not.toHaveBeenCalled();
    expectAudited(logs.events, audit('CreateGoal'));
  });

  it('asks for data.create on a personal Goal with the creator as owner', async () => {
    const { deps, authorization } = fakeDeps();

    await createAccountManager(deps).createGoal(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_GOAL, visibility: 'personal',
    });

    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.create', visibility: 'personal', ownerUserId: ANA_ID,
    });
  });

  it('refuses a blank name 422, writing nothing', async () => {
    const { deps, goals } = fakeDeps();

    await expect(createAccountManager(deps).createGoal(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_GOAL, name: '   ',
    })).rejects.toMatchObject(BLANK_NAME);
    expect(goals.insert).not.toHaveBeenCalled();
  });

  it('answers a role that may not create a shared Goal 403, before validating', async () => {
    const { deps, goals, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).createGoal(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_GOAL, name: '',
    })).rejects.toMatchObject(FORBIDDEN);
    expect(goals.insert).not.toHaveBeenCalled();
  });

  it('answers a non-member 404 household.not_found', async () => {
    const { deps, goals, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).createGoal(CONTEXT, HOUSEHOLD_ID, NEW_GOAL))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
    expect(goals.insert).not.toHaveBeenCalled();
  });
});

describe('AccountManager — edit a Goal (uc-02, FR-8.1, OQ-177)', () => {
  it('writes the changes, the name trimmed, and audits it', async () => {
    const { deps, goals, authorization } = fakeDeps();
    const edited = { ...GOAL, name: 'Home', targetCurrency: 'USD' };
    goals.update.mockResolvedValueOnce(edited);
    const logs = captureLogs();

    const result = await createAccountManager(deps).editGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID, {
      name: ' Home ', targetCurrency: 'USD', targetAmount: undefined,
    });
    logs.stop();

    expect(result).toEqual(edited);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, onGoal('data.edit'));
    expect(goals.update).toHaveBeenCalledWith(HOUSEHOLD_ID, GOAL_ID, {
      name: 'Home', targetCurrency: 'USD',
    });
    expectAudited(logs.events, audit('EditGoal'));
  });

  it('edits a completed Goal too: only new funding is closed to it', async () => {
    const { deps, goals } = fakeDeps();
    goals.findById.mockResolvedValueOnce(COMPLETED_GOAL);

    await createAccountManager(deps).editGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID, {
      dueDate: '2031-06-30',
    });

    expect(goals.update).toHaveBeenCalledWith(HOUSEHOLD_ID, GOAL_ID, { dueDate: '2031-06-30' });
  });

  it('reads an empty edit back, unaudited', async () => {
    const { deps, goals } = fakeDeps();
    const logs = captureLogs();

    const result = await createAccountManager(deps).editGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID, {});
    logs.stop();

    expect(result).toEqual(GOAL);
    expect(goals.update).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('refuses a blank name 422, writing nothing', async () => {
    const { deps, goals } = fakeDeps();

    await expect(createAccountManager(deps).editGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID, {
      name: ' ',
    })).rejects.toMatchObject(BLANK_NAME);
    expect(goals.update).not.toHaveBeenCalled();
  });

  it('answers one deleted meanwhile 404, unaudited', async () => {
    const { deps, goals } = fakeDeps();
    goals.update.mockResolvedValueOnce(undefined);
    const logs = captureLogs();

    await expect(createAccountManager(deps).editGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID, {
      name: 'Home',
    })).rejects.toMatchObject(GOAL_NOT_FOUND);
    logs.stop();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers a member without the role 403, writing nothing', async () => {
    const { deps, goals, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).editGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID, {
      name: 'Home',
    })).rejects.toMatchObject(FORBIDDEN);
    expect(goals.update).not.toHaveBeenCalled();
  });

  it('answers a missing Goal 404, writing nothing', async () => {
    const { deps, goals } = fakeDeps();
    goals.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).editGoal(CONTEXT, HOUSEHOLD_ID, UNKNOWN_ID, {
      name: 'Home',
    })).rejects.toMatchObject(GOAL_NOT_FOUND);
    expect(goals.update).not.toHaveBeenCalled();
  });
});

describe('AccountManager — complete a Goal (uc-03, FR-8.8)', () => {
  it('completes an active Goal, audited, checking data.edit', async () => {
    const { deps, goals, authorization } = fakeDeps();
    const logs = captureLogs();

    await createAccountManager(deps).completeGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID);
    logs.stop();

    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, onGoal('data.edit'));
    expect(goals.complete).toHaveBeenCalledWith(HOUSEHOLD_ID, GOAL_ID);
    expect(goals.reopen).not.toHaveBeenCalled();
    expectAudited(logs.events, audit('CompleteGoal'));
  });

  it('leaves a completed Goal as it is, unaudited (OQ-177)', async () => {
    const { deps, goals } = fakeDeps();
    goals.findById.mockResolvedValueOnce(COMPLETED_GOAL);
    const logs = captureLogs();

    await createAccountManager(deps).completeGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID);
    logs.stop();

    expect(goals.complete).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers one deleted meanwhile 404, unaudited', async () => {
    const { deps, goals } = fakeDeps();
    goals.complete.mockResolvedValueOnce(false);
    const logs = captureLogs();

    await expect(createAccountManager(deps).completeGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .rejects.toMatchObject(GOAL_NOT_FOUND);
    logs.stop();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers a member without the role 403, writing nothing', async () => {
    const { deps, goals, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).completeGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .rejects.toMatchObject(FORBIDDEN);
    expect(goals.complete).not.toHaveBeenCalled();
  });

  it('answers a missing Goal 404, writing nothing', async () => {
    const { deps, goals } = fakeDeps();
    goals.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).completeGoal(CONTEXT, HOUSEHOLD_ID, UNKNOWN_ID))
      .rejects.toMatchObject(GOAL_NOT_FOUND);
    expect(goals.complete).not.toHaveBeenCalled();
  });
});

describe('AccountManager — reopen a Goal (uc-04, FR-8.9)', () => {
  it('reopens a completed Goal, audited, checking data.edit', async () => {
    const { deps, goals, authorization } = fakeDeps();
    goals.findById.mockResolvedValueOnce(COMPLETED_GOAL);
    const logs = captureLogs();

    await createAccountManager(deps).reopenGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID);
    logs.stop();

    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, onGoal('data.edit'));
    expect(goals.reopen).toHaveBeenCalledWith(HOUSEHOLD_ID, GOAL_ID);
    expect(goals.complete).not.toHaveBeenCalled();
    expectAudited(logs.events, audit('ReopenGoal'));
  });

  it('leaves an active Goal as it is, unaudited (OQ-177)', async () => {
    const { deps, goals } = fakeDeps();
    const logs = captureLogs();

    await createAccountManager(deps).reopenGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID);
    logs.stop();

    expect(goals.reopen).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers one deleted meanwhile 404, unaudited', async () => {
    const { deps, goals } = fakeDeps();
    goals.findById.mockResolvedValueOnce(COMPLETED_GOAL);
    goals.reopen.mockResolvedValueOnce(false);
    const logs = captureLogs();

    await expect(createAccountManager(deps).reopenGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .rejects.toMatchObject(GOAL_NOT_FOUND);
    logs.stop();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers someone else\'s personal Goal 404, writing nothing', async () => {
    const { deps, goals, authorization } = fakeDeps();
    goals.findById.mockResolvedValueOnce({
      ...COMPLETED_GOAL, visibility: 'personal', ownerUserId: BEA_ID,
    });
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_visible' });

    await expect(createAccountManager(deps).reopenGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .rejects.toMatchObject(GOAL_NOT_FOUND);
    expect(goals.reopen).not.toHaveBeenCalled();
  });
});

describe('AccountManager — delete a Goal (uc-05, FR-8.6, OQ-47)', () => {
  it('deletes it, audited, checking data.delete on the Goal', async () => {
    const { deps, goals, authorization } = fakeDeps();
    const logs = captureLogs();

    await createAccountManager(deps).deleteGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID);
    logs.stop();

    expect(authorization.authorize)
      .toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, onGoal('data.delete'));
    expect(goals.delete).toHaveBeenCalledWith(HOUSEHOLD_ID, GOAL_ID);
    expectAudited(logs.events, audit('DeleteGoal'));
  });

  it('answers one deleted meanwhile 404, unaudited', async () => {
    const { deps, goals } = fakeDeps();
    goals.delete.mockResolvedValueOnce(false);
    const logs = captureLogs();

    await expect(createAccountManager(deps).deleteGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .rejects.toMatchObject(GOAL_NOT_FOUND);
    logs.stop();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers a member without the role 403, deleting nothing', async () => {
    const { deps, goals, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).deleteGoal(CONTEXT, HOUSEHOLD_ID, GOAL_ID))
      .rejects.toMatchObject(FORBIDDEN);
    expect(goals.delete).not.toHaveBeenCalled();
  });

  it('answers a missing Goal 404, deleting nothing', async () => {
    const { deps, goals } = fakeDeps();
    goals.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).deleteGoal(CONTEXT, HOUSEHOLD_ID, UNKNOWN_ID))
      .rejects.toMatchObject(GOAL_NOT_FOUND);
    expect(goals.delete).not.toHaveBeenCalled();
  });
});
