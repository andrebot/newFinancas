import { captureLogs, type LogEvent } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import { expectAudited } from '../audit';
import {
  ANA_ID, BEA_ID, BUDGET, CATEGORY, CONTEXT, fakeDeps, HOUSEHOLD_ID, PERIOD, SUBCATEGORY,
} from './fakes';

const BUDGET_ID = BUDGET.id;
const OTHER_BUDGET_ID = '0199c5a0-0000-7000-8000-0000000000e9';
const UNKNOWN_ID = '0199c5a0-0000-7000-8000-0000000000ff';
const OCTOBER = { year: 2026, month: 10 };
const NEW_BUDGET = {
  name: 'Groceries',
  targetAmount: 150000,
  currency: 'BRL',
  visibility: 'shared' as const,
  targets: [{ categoryId: CATEGORY.id }],
};
const HOUSEHOLD_NOT_FOUND = { apiError: { status: 404, code: 'household.not_found' } };
const FORBIDDEN = { apiError: { status: 403, code: 'auth.forbidden' } };
const BUDGET_NOT_FOUND = { apiError: { status: 404, code: 'budget.not_found' } };
/** What AuthorizationUtility decides on when there is no Budget to look at. */
const MEMBERS_ONLY = { action: 'data.view', visibility: 'shared', ownerUserId: null };

/**
 * A 422 naming each failing field.
 *
 * @param details - The expected details.
 * @returns The expected error.
 */
const invalid = (...details: object[]) => ({
  apiError: { status: 422, code: 'validation.failed', details },
});

/**
 * The audit entry a Budget action leaves.
 *
 * @param action - The audited action.
 * @returns The expected entry.
 */
const audit = (action: string) => ({
  action, actorId: ANA_ID, entityType: 'Budget', entityId: BUDGET_ID, householdId: HOUSEHOLD_ID,
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

describe('AccountManager — view Budgets (FR-4.2, OQ-176)', () => {
  it('lists the Budgets the caller can see, checking membership only', async () => {
    const { deps, budgets, authorization } = fakeDeps();

    const listed = await createAccountManager(deps)
      .listBudgets(CONTEXT, HOUSEHOLD_ID, { visibility: 'personal' });

    expect(listed).toEqual([BUDGET]);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
    expect(budgets.list).toHaveBeenCalledWith(HOUSEHOLD_ID, ANA_ID, { visibility: 'personal' });
  });

  it('answers a non-member 404 household.not_found, reading nothing', async () => {
    const { deps, budgets, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).listBudgets(CONTEXT, HOUSEHOLD_ID, {}))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
    expect(budgets.list).not.toHaveBeenCalled();
  });

  it('gets one Budget, checking data.view on its visibility and owner', async () => {
    const { deps, budgets, authorization } = fakeDeps();

    expect(await createAccountManager(deps).getBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID))
      .toEqual(BUDGET);
    expect(budgets.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, BUDGET_ID);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'shared', ownerUserId: ANA_ID,
    });
  });

  it('answers someone else\'s personal Budget 404 budget.not_found', async () => {
    const { deps, budgets, authorization } = fakeDeps();
    budgets.findById.mockResolvedValueOnce({
      ...BUDGET, visibility: 'personal', ownerUserId: BEA_ID,
    });
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_visible' });

    await expect(createAccountManager(deps).getBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID))
      .rejects.toMatchObject(BUDGET_NOT_FOUND);
  });

  it('answers a missing Budget 404 budget.not_found, after the membership check', async () => {
    const { deps, budgets, authorization } = fakeDeps();
    budgets.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).getBudget(CONTEXT, HOUSEHOLD_ID, UNKNOWN_ID))
      .rejects.toMatchObject(BUDGET_NOT_FOUND);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
  });

  it('answers a non-member 404 household.not_found for one Budget', async () => {
    const { deps, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).getBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
  });
});

describe('AccountManager — create a Budget (uc-01, FR-4.1/4.7, OQ-176)', () => {
  it('creates it, owned by its creator, in this month, and audits it', async () => {
    const {
      deps, budgets, categories, authorization,
    } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const created = await createAccountManager(deps).createBudget(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_BUDGET, name: '  Groceries ',
    });

    expect(created).toEqual(BUDGET);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.create', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(categories.list).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(budgets.insert).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_ID,
      ownerUserId: ANA_ID,
      visibility: 'shared',
      name: 'Groceries',
      targetAmount: 150000,
      currency: 'BRL',
    }, [{ categoryId: CATEGORY.id }], OCTOBER);
    expectAudited(logs.events, audit('CreateBudget'));
  });

  it('claims a target sent twice once, and takes a Subcategory', async () => {
    const { deps, budgets } = fakeDeps();
    const market = { subcategoryId: SUBCATEGORY.id };

    await createAccountManager(deps).createBudget(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_BUDGET, targets: [market, { categoryId: CATEGORY.id }, market],
    });

    expect(budgets.insert).toHaveBeenCalledWith(
      expect.anything(),
      [market, { categoryId: CATEGORY.id }],
      OCTOBER,
    );
  });

  it('answers a member without the role 403, writing nothing', async () => {
    const { deps, budgets, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).createBudget(CONTEXT, HOUSEHOLD_ID, NEW_BUDGET))
      .rejects.toMatchObject(FORBIDDEN);
    expect(budgets.insert).not.toHaveBeenCalled();
  });

  it('refuses a blank name and a malformed target in one 422', async () => {
    const { deps, budgets, categories } = fakeDeps();

    await expect(createAccountManager(deps).createBudget(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_BUDGET,
      name: '   ',
      targets: [{ categoryId: CATEGORY.id, subcategoryId: SUBCATEGORY.id }],
    })).rejects.toMatchObject(invalid(
      { field: 'name', code: 'string.min', params: { min: 1 } },
      { field: 'targets[0]', code: 'field.invalid' },
    ));
    expect(categories.list).not.toHaveBeenCalled();
    expect(budgets.insert).not.toHaveBeenCalled();
  });

  it('refuses a target that is archived or not this household\'s, on its field', async () => {
    const { deps, budgets, categories } = fakeDeps();
    categories.list.mockResolvedValueOnce([{ ...CATEGORY, subcategories: [] }]);

    await expect(createAccountManager(deps).createBudget(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_BUDGET,
      targets: [{ categoryId: CATEGORY.id }, { subcategoryId: SUBCATEGORY.id }, {
        categoryId: UNKNOWN_ID,
      }],
    })).rejects.toMatchObject(invalid(
      { field: 'targets[1].subcategoryId', code: 'field.invalid_option' },
      { field: 'targets[2].categoryId', code: 'field.invalid_option' },
    ));
    expect(budgets.insert).not.toHaveBeenCalled();
  });

  it('answers a target claimed in the scope 409, naming its Budget, unaudited', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.insert.mockResolvedValueOnce({
      ok: false,
      reason: 'target_claimed',
      target: { categoryId: CATEGORY.id },
      claimedByBudgetId: OTHER_BUDGET_ID,
    });
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps).createBudget(CONTEXT, HOUSEHOLD_ID, NEW_BUDGET))
      .rejects.toMatchObject({
        apiError: {
          status: 409,
          code: 'budget.target_already_claimed',
          params: { categoryId: CATEGORY.id, budgetId: OTHER_BUDGET_ID },
        },
      });
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers a target gone since the check 422 on its field', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.insert.mockResolvedValueOnce({
      ok: false, reason: 'target_not_found', target: { categoryId: CATEGORY.id },
    });

    await expect(createAccountManager(deps).createBudget(CONTEXT, HOUSEHOLD_ID, NEW_BUDGET))
      .rejects.toMatchObject(invalid({
        field: 'targets[0].categoryId', code: 'field.invalid_option',
      }));
  });
});

describe('AccountManager — edit a Budget (uc-02, FR-4.7/4.9, OQ-176)', () => {
  it('writes the name, target and targets in one transaction, audited', async () => {
    const {
      deps, budgets, authorization, inTransaction,
    } = fakeDeps();
    const renamed = { ...BUDGET, name: 'Food' };
    budgets.findById.mockResolvedValueOnce(BUDGET).mockResolvedValueOnce(renamed);
    const logs = captureLogs(onTestFinished);

    const edited = await createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      name: ' Food ', targetAmount: 90000, targets: [{ subcategoryId: SUBCATEGORY.id }],
    });

    expect(edited).toEqual(renamed);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.edit', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(inTransaction).toHaveBeenCalledTimes(1);
    expect(budgets.update).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      BUDGET_ID,
      { name: 'Food', targetAmount: 90000 },
      OCTOBER,
    );
    expect(budgets.replaceTargets)
      .toHaveBeenCalledWith(HOUSEHOLD_ID, BUDGET_ID, [{ subcategoryId: SUBCATEGORY.id }]);
    expectAudited(logs.events, audit('EditBudget'));
  });

  it('only replaces the targets when only they are sent', async () => {
    const { deps, budgets } = fakeDeps();

    await createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      targets: [{ categoryId: CATEGORY.id }, { categoryId: CATEGORY.id }],
    });

    expect(budgets.update).not.toHaveBeenCalled();
    expect(budgets.replaceTargets)
      .toHaveBeenCalledWith(HOUSEHOLD_ID, BUDGET_ID, [{ categoryId: CATEGORY.id }]);
  });

  it('leaves the targets alone when none are sent', async () => {
    const { deps, budgets, categories } = fakeDeps();

    await createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      targetAmount: 1,
    });

    expect(budgets.update).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      BUDGET_ID,
      { targetAmount: 1 },
      OCTOBER,
    );
    expect(budgets.replaceTargets).not.toHaveBeenCalled();
    expect(categories.list).not.toHaveBeenCalled();
  });

  it('keeps a target the Budget holds even once its Category is archived', async () => {
    const { deps, budgets, categories } = fakeDeps();
    categories.list.mockResolvedValueOnce([]);

    await createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      targets: [{ categoryId: CATEGORY.id }],
    });

    expect(budgets.replaceTargets).toHaveBeenCalled();
  });

  it('refuses a new target that is archived, writing nothing', async () => {
    const { deps, categories, inTransaction } = fakeDeps();
    categories.list.mockResolvedValueOnce([]);

    await expect(createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      targets: [{ categoryId: CATEGORY.id }, { subcategoryId: SUBCATEGORY.id }],
    })).rejects.toMatchObject(invalid(
      { field: 'targets[1].subcategoryId', code: 'field.invalid_option' },
    ));
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('reads an empty edit back, unaudited and unwritten', async () => {
    const { deps, inTransaction } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    expect(await createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {}))
      .toEqual(BUDGET);
    expect(inTransaction).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('refuses a blank name, with or without targets', async () => {
    const { deps, inTransaction } = fakeDeps();
    const manager = createAccountManager(deps);
    const blank = invalid({ field: 'name', code: 'string.min', params: { min: 1 } });

    await expect(manager.editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, { name: ' ' }))
      .rejects.toMatchObject(blank);
    await expect(manager.editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      name: '', targets: [{}],
    })).rejects.toMatchObject(invalid(
      { field: 'name', code: 'string.min', params: { min: 1 } },
      { field: 'targets[0]', code: 'field.invalid' },
    ));
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('answers a member without the role 403', async () => {
    const { deps, authorization, inTransaction } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      name: 'Food',
    })).rejects.toMatchObject(FORBIDDEN);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('answers someone else\'s personal Budget 404 budget.not_found', async () => {
    const { deps, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_visible' });

    await expect(createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      name: 'Food',
    })).rejects.toMatchObject(BUDGET_NOT_FOUND);
  });

  it('answers a Budget deleted before its update 404, unaudited', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.update.mockResolvedValueOnce('not_found');
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      name: 'Food', targets: [{ categoryId: CATEGORY.id }],
    })).rejects.toMatchObject(BUDGET_NOT_FOUND);
    expect(budgets.replaceTargets).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers a Budget deleted before its targets 404', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.replaceTargets.mockResolvedValueOnce({ ok: false, reason: 'not_found' });

    await expect(createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      targets: [{ categoryId: CATEGORY.id }],
    })).rejects.toMatchObject(BUDGET_NOT_FOUND);
  });

  it('rolls the name back when a target is claimed elsewhere: 409, unaudited', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.replaceTargets.mockResolvedValueOnce({
      ok: false,
      reason: 'target_claimed',
      target: { subcategoryId: SUBCATEGORY.id },
      claimedByBudgetId: OTHER_BUDGET_ID,
    });
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      name: 'Food', targets: [{ subcategoryId: SUBCATEGORY.id }],
    })).rejects.toMatchObject({
      apiError: {
        status: 409,
        code: 'budget.target_already_claimed',
        params: { subcategoryId: SUBCATEGORY.id, budgetId: OTHER_BUDGET_ID },
      },
    });
    // The throw leaves the unit of work, which rolls the update back.
    expect(budgets.update).toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers a target gone since the check 422 on its field', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.replaceTargets.mockResolvedValueOnce({
      ok: false, reason: 'target_not_found', target: { subcategoryId: SUBCATEGORY.id },
    });

    await expect(createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      targets: [{ categoryId: CATEGORY.id }, { subcategoryId: SUBCATEGORY.id }],
    })).rejects.toMatchObject(invalid(
      { field: 'targets[1].subcategoryId', code: 'field.invalid_option' },
    ));
  });

  it('answers a Budget deleted before it is read back 404', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.findById.mockResolvedValueOnce(BUDGET).mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).editBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {
      name: 'Food',
    })).rejects.toMatchObject(BUDGET_NOT_FOUND);
  });
});

describe('AccountManager — delete a Budget (uc-03, FR-4.10, OQ-40)', () => {
  it('deletes it, audited, checking data.delete on the Budget', async () => {
    const { deps, budgets, authorization } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps).deleteBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID);

    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.delete', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(budgets.delete).toHaveBeenCalledWith(HOUSEHOLD_ID, BUDGET_ID);
    expectAudited(logs.events, audit('DeleteBudget'));
  });

  it('answers one deleted meanwhile 404, unaudited', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.delete.mockResolvedValueOnce(false);
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps).deleteBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID))
      .rejects.toMatchObject(BUDGET_NOT_FOUND);
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers a member without the role 403, deleting nothing', async () => {
    const { deps, budgets, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).deleteBudget(CONTEXT, HOUSEHOLD_ID, BUDGET_ID))
      .rejects.toMatchObject(FORBIDDEN);
    expect(budgets.delete).not.toHaveBeenCalled();
  });

  it('answers a missing Budget 404, deleting nothing', async () => {
    const { deps, budgets } = fakeDeps();
    budgets.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).deleteBudget(CONTEXT, HOUSEHOLD_ID, UNKNOWN_ID))
      .rejects.toMatchObject(BUDGET_NOT_FOUND);
    expect(budgets.delete).not.toHaveBeenCalled();
  });
});

describe('AccountManager — a Budget\'s periods (FR-4.3/4.9, OQ-176)', () => {
  it('lists them over the range, once the Budget is visible', async () => {
    const { deps, budgets, authorization } = fakeDeps();
    const range = { from: { year: 2026, month: 1 } };

    expect(await createAccountManager(deps)
      .listBudgetPeriods(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, range)).toEqual([PERIOD]);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(budgets.listPeriods).toHaveBeenCalledWith(HOUSEHOLD_ID, BUDGET_ID, range);
  });

  it('answers someone else\'s personal Budget 404, reading no periods', async () => {
    const { deps, budgets, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_visible' });

    await expect(createAccountManager(deps)
      .listBudgetPeriods(CONTEXT, HOUSEHOLD_ID, BUDGET_ID, {}))
      .rejects.toMatchObject(BUDGET_NOT_FOUND);
    expect(budgets.listPeriods).not.toHaveBeenCalled();
  });
});
