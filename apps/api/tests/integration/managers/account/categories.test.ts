import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import { expectAudited } from '../audit';
import {
  ANA_ID, CATEGORY, CONTEXT, fakeDeps, HOUSEHOLD_ID, SUBCATEGORY,
} from './fakes';

const CATEGORY_ID = CATEGORY.id;
const SUBCATEGORY_ID = SUBCATEGORY.id;
const NEW_CATEGORY = { name: 'Pets', icon: 'pets', color: 'sky' };
const HOUSEHOLD_NOT_FOUND = { domainError: { code: 'household.not_found' } };
const FORBIDDEN = { domainError: { code: 'auth.forbidden' } };
const CATEGORY_NOT_FOUND = { domainError: { code: 'category.not_found' } };
const SUBCATEGORY_NOT_FOUND = { domainError: { code: 'subcategory.not_found' } };

/**
 * The rejection for blank names (ValidationUtility, OQ-165).
 *
 * @param fields - The failing fields, in order.
 * @returns A matcher for `rejects.toMatchObject`.
 */
const blank = (...fields: string[]) => ({
  domainError: {
    code: 'validation.failed',
    details: fields.map((field) => ({ field, code: 'string.min', params: { min: 1 } })),
  },
});

/**
 * The access request a Category action makes: shared data nobody owns (OQ-174).
 *
 * @param action - The data action.
 * @returns The request AuthorizationUtility receives.
 */
const sharedData = (action: string) => ({ action, visibility: 'shared', ownerUserId: null });

describe('AccountManager — Category access (FR-1.7, OQ-174)', () => {
  it.each([
    ['listCategories', 'data.view', [{}]],
    ['getCategory', 'data.view', [CATEGORY_ID]],
    ['createCategory', 'data.create', [NEW_CATEGORY]],
    ['editCategory', 'data.edit', [CATEGORY_ID, { name: 'Groceries' }]],
    ['archiveCategory', 'data.delete', [CATEGORY_ID]],
    ['archiveSubcategory', 'data.delete', [CATEGORY_ID, SUBCATEGORY_ID]],
  ] as const)('%s checks %s on shared data nobody owns', async (useCase, action, args) => {
    const { deps, authorization } = fakeDeps();
    const account = createAccountManager(deps);

    await (account[useCase] as (...input: unknown[]) => Promise<unknown>)(
      CONTEXT,
      HOUSEHOLD_ID,
      ...args,
    );

    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, sharedData(action));
  });

  it('answers a non-member 404 household.not_found and touches nothing', async () => {
    const { deps, authorization, categories } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).listCategories(CONTEXT, HOUSEHOLD_ID, {}))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
    expect(categories.list).not.toHaveBeenCalled();
  });

  it('answers a member without the role 403 before validating', async () => {
    const { deps, authorization, categories } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).editCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID, {
      name: ' ',
    })).rejects.toMatchObject(FORBIDDEN);
    expect(categories.update).not.toHaveBeenCalled();
  });
});

describe('AccountManager — view Categories', () => {
  it('lists the household\'s Categories with the filter as given', async () => {
    const { deps, categories } = fakeDeps();

    const listed = await createAccountManager(deps)
      .listCategories(CONTEXT, HOUSEHOLD_ID, { includeArchived: true });

    expect(listed).toEqual([CATEGORY]);
    expect(categories.list).toHaveBeenCalledWith(HOUSEHOLD_ID, { includeArchived: true });
  });

  it('gets one Category; a missing one is 404 category.not_found', async () => {
    const { deps, categories } = fakeDeps();
    const account = createAccountManager(deps);

    await expect(account.getCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID))
      .resolves.toEqual(CATEGORY);
    expect(categories.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, CATEGORY_ID);

    categories.findById.mockResolvedValueOnce(undefined);
    await expect(account.getCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID))
      .rejects.toMatchObject(CATEGORY_NOT_FOUND);
  });
});

describe('AccountManager — Create Category (categories/uc-01, FR-10.1)', () => {
  it('creates it with a trimmed name, audited', async () => {
    const { deps, categories } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const created = await createAccountManager(deps).createCategory(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_CATEGORY, name: '  Pets ',
    });

    expect(created).toEqual(CATEGORY);
    expect(categories.insert).toHaveBeenCalledWith(HOUSEHOLD_ID, NEW_CATEGORY);
    expectAudited(logs.events, {
      action: 'CreateCategory',
      actorId: ANA_ID,
      entityType: 'Category',
      entityId: CATEGORY_ID,
      householdId: HOUSEHOLD_ID,
    });
  });

  it('refuses a blank name with 422, creating nothing', async () => {
    const { deps, categories } = fakeDeps();

    await expect(createAccountManager(deps).createCategory(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_CATEGORY, name: '   ',
    })).rejects.toMatchObject(blank('name'));
    expect(categories.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_icon', 'icon'],
    ['invalid_color', 'color'],
  ])('answers the Accessor\'s %s with 422 on %s, unaudited (OQ-173)', async (refusal, field) => {
    const { deps, categories } = fakeDeps();
    categories.insert.mockResolvedValueOnce(refusal);
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps).createCategory(CONTEXT, HOUSEHOLD_ID, NEW_CATEGORY))
      .rejects.toMatchObject({
        domainError: {
          code: 'validation.failed',
          details: [{ field, code: 'field.invalid_option' }],
        },
      });

    expect(logs.events.filter((event) => event.level === 'audit')).toEqual([]);
  });
});

describe('AccountManager — Edit Category (categories/uc-02, FR-10.2, OQ-173)', () => {
  it('writes the whole edit at once, names trimmed, audited', async () => {
    const { deps, categories } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const edited = await createAccountManager(deps).editCategory(
      CONTEXT,
      HOUSEHOLD_ID,
      CATEGORY_ID,
      {
        name: ' Groceries ',
        icon: 'shopping-cart-outline',
        color: undefined,
        subcategories: [{ id: SUBCATEGORY_ID, name: 'Market ' }, { name: ' Bakery' }],
      },
    );

    expect(edited).toEqual(CATEGORY);
    expect(categories.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CATEGORY_ID, {
      name: 'Groceries',
      icon: 'shopping-cart-outline',
      subcategories: [{ id: SUBCATEGORY_ID, name: 'Market' }, { name: 'Bakery' }],
    });
    expectAudited(logs.events, {
      action: 'EditCategory',
      actorId: ANA_ID,
      entityType: 'Category',
      entityId: CATEGORY_ID,
      householdId: HOUSEHOLD_ID,
    });
  });

  it('reads an empty edit back without auditing it', async () => {
    const { deps, categories } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps).editCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID, {});

    expect(categories.update).toHaveBeenCalledWith(HOUSEHOLD_ID, CATEGORY_ID, {});
    expect(logs.events.filter((event) => event.level === 'audit')).toEqual([]);
  });

  it('refuses blank names, the Category\'s and each Subcategory\'s, writing nothing', async () => {
    const { deps, categories } = fakeDeps();

    await expect(createAccountManager(deps).editCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID, {
      name: '',
      subcategories: [{ name: 'Market' }, { id: SUBCATEGORY_ID, name: '  ' }],
    })).rejects.toMatchObject(blank('name', 'subcategories[1].name'));
    expect(categories.update).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', CATEGORY_NOT_FOUND],
    ['subcategory_not_found', SUBCATEGORY_NOT_FOUND],
    ['invalid_color', {
      domainError: { code: 'validation.failed', details: [{ field: 'color' }] },
    }],
  ])('answers the Accessor\'s %s, unaudited', async (refusal, expected) => {
    const { deps, categories } = fakeDeps();
    categories.update.mockResolvedValueOnce(refusal);
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps).editCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID, {
      name: 'Groceries',
    })).rejects.toMatchObject(expected);

    expect(logs.events.filter((event) => event.level === 'audit')).toEqual([]);
  });
});

describe('AccountManager — Archive Category or Subcategory (categories/uc-03, FR-10.4)', () => {
  it('archives a Category (the cascade is the Accessor\'s), audited', async () => {
    const { deps, categories } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps).archiveCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID);

    expect(categories.archive).toHaveBeenCalledWith(HOUSEHOLD_ID, CATEGORY_ID);
    expectAudited(logs.events, {
      action: 'ArchiveCategory',
      actorId: ANA_ID,
      entityType: 'Category',
      entityId: CATEGORY_ID,
      householdId: HOUSEHOLD_ID,
    });
  });

  it('answers 404 category.not_found for a Category not in the household', async () => {
    const { deps, categories } = fakeDeps();
    categories.archive.mockResolvedValueOnce(false);

    await expect(createAccountManager(deps).archiveCategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID))
      .rejects.toMatchObject(CATEGORY_NOT_FOUND);
  });

  it('archives one Subcategory, scoped by its Category, audited', async () => {
    const { deps, categories } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps)
      .archiveSubcategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID, SUBCATEGORY_ID);

    expect(categories.archiveSubcategory)
      .toHaveBeenCalledWith(HOUSEHOLD_ID, CATEGORY_ID, SUBCATEGORY_ID);
    expectAudited(logs.events, {
      action: 'ArchiveSubcategory',
      actorId: ANA_ID,
      entityType: 'Subcategory',
      entityId: SUBCATEGORY_ID,
      householdId: HOUSEHOLD_ID,
    });
  });

  it('answers 404 subcategory.not_found for one not under that Category', async () => {
    const { deps, categories } = fakeDeps();
    categories.archiveSubcategory.mockResolvedValueOnce(false);

    await expect(createAccountManager(deps)
      .archiveSubcategory(CONTEXT, HOUSEHOLD_ID, CATEGORY_ID, SUBCATEGORY_ID))
      .rejects.toMatchObject(SUBCATEGORY_NOT_FOUND);
  });
});
