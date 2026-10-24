import { describe, expect, it } from 'vitest';
import {
  budgetChangesOf, claimableIds, parseTargets, rejectionError, targetOf, uniqueTargets,
} from '../../../../src/managers/account/budgets';

const FOOD = { categoryId: 'c1' };
const MARKET = { subcategoryId: 's1' };

describe('targetOf', () => {
  it('reads a whole Category or one Subcategory', () => {
    expect(targetOf({ categoryId: 'c1' })).toEqual(FOOD);
    expect(targetOf({ subcategoryId: 's1', categoryId: undefined })).toEqual(MARKET);
  });

  it('refuses both ids or neither', () => {
    expect(targetOf({ categoryId: 'c1', subcategoryId: 's1' })).toBeUndefined();
    expect(targetOf({})).toBeUndefined();
  });
});

describe('parseTargets', () => {
  it('keeps the claims in order and names each malformed one by its position', () => {
    expect(parseTargets([FOOD, {}, MARKET, { categoryId: 'c2', subcategoryId: 's2' }])).toEqual({
      targets: [FOOD, MARKET],
      problems: [
        { field: 'targets[1]', code: 'field.invalid' },
        { field: 'targets[3]', code: 'field.invalid' },
      ],
    });
  });

  it('reports no problems for well-formed targets', () => {
    expect(parseTargets([FOOD])).toEqual({ targets: [FOOD], problems: [] });
  });
});

describe('claimableIds', () => {
  it('collects every Category and Subcategory id', () => {
    const ids = claimableIds([
      { id: 'c1', subcategories: [{ id: 's1' }, { id: 's2' }] },
      { id: 'c2', subcategories: [] },
    ] as never);

    expect([...ids]).toEqual(['c1', 's1', 's2', 'c2']);
  });
});

describe('uniqueTargets', () => {
  it('keeps each claim once, in first-seen order', () => {
    expect(uniqueTargets([MARKET, FOOD, MARKET, FOOD])).toEqual([MARKET, FOOD]);
  });
});

describe('rejectionError', () => {
  it('answers a claimed target 409, naming it and its Budget', () => {
    const rejection = {
      reason: 'target_claimed', target: MARKET, claimedByBudgetId: 'b9',
    } as const;

    expect(rejectionError(rejection, [FOOD, MARKET]).domainError).toMatchObject({
      code: 'budget.target_already_claimed',
      params: { subcategoryId: 's1', budgetId: 'b9' },
    });
  });

  it('answers a target gone meanwhile on its field', () => {
    const rejection = { reason: 'target_not_found', target: MARKET } as const;

    expect(rejectionError(rejection, [FOOD, MARKET]).domainError).toMatchObject({
      code: 'validation.failed',
      details: [{ field: 'targets[1].subcategoryId', code: 'field.invalid_option' }],
    });
  });

  it('names a Category target by its categoryId', () => {
    const rejection = { reason: 'target_not_found', target: FOOD } as const;

    expect(rejectionError(rejection, [FOOD]).domainError.details)
      .toEqual([{ field: 'targets[0].categoryId', code: 'field.invalid_option' }]);
  });
});

describe('budgetChangesOf', () => {
  it('trims the name and leaves out fields not sent', () => {
    expect(budgetChangesOf({ name: ' Food ', targetAmount: undefined, targets: [FOOD] }))
      .toEqual({ name: 'Food' });
  });

  it('keeps a new target amount', () => {
    expect(budgetChangesOf({ targetAmount: 900 })).toEqual({ targetAmount: 900 });
  });

  it('is empty for an empty edit', () => {
    expect(budgetChangesOf({})).toEqual({});
  });
});
