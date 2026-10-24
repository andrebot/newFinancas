import type { Budget, Category } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import { NO_PICKS } from '../../../../src/experiences/accountSetup/budgetClaims';
import {
  alertOf, coverChipsOf, initialFieldsOf, jointViewOf, objectionsOf, passes,
} from '../../../../src/experiences/accountSetup/budgetForm';
import type { BudgetsView, CategoriesView } from '../../../../src/experiences/accountSetup/sharedLists';
import { createTranslator } from '../../../../src/utilities/i18n';

// A budget's form and how it reads (BDT: Flow-tier pure logic, unit; nothing
// mocked, the translator real). Budget Management's drawer and Guided Setup's
// budget step both read these (OQ-196).

const translator = createTranslator('en-US');

const DINING: Category = {
  id: 'dining',
  householdId: 'doe',
  name: 'Dining',
  icon: 'restaurant',
  color: 'sun',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [{
    id: 'streaming',
    categoryId: 'dining',
    name: 'Streaming',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
  }],
};
const FOOD: Category = {
  ...DINING, id: 'food', name: 'Food', subcategories: [],
};

/**
 * Builds a budget.
 *
 * @param id - Its id.
 * @param over - The fields to override.
 * @returns The budget.
 */
const budget = (id: string, over: Partial<Budget> = {}): Budget => ({
  id,
  householdId: 'doe',
  ownerUserId: 'jane',
  name: id,
  targetAmount: 1000,
  currency: 'BRL',
  visibility: 'shared',
  targets: [],
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

const BUDGETS: BudgetsView = { status: 'loaded', budgets: [budget('fun'), budget('home')] };
const CATEGORIES: CategoriesView = { status: 'loaded', categories: [FOOD] };

describe('initialFieldsOf', () => {
  it('opens a create empty, in BRL, shared — or personal for an actor who can\'t share', () => {
    expect(initialFieldsOf(undefined, false)).toEqual({
      name: '',
      currency: 'BRL',
      visibility: 'shared',
      target: null,
      held: { categoryIds: [], subcategoryIds: [] },
    });
    expect(initialFieldsOf(undefined, true).visibility).toBe('personal');
  });

  it('opens an edit with the budget\'s fields and what it holds', () => {
    const fun = budget('b1', {
      name: 'Fun Money',
      targetAmount: 30000,
      currency: 'USD',
      visibility: 'personal',
      targets: [{ subcategoryId: 'Streaming' }],
    });
    expect(initialFieldsOf(fun, true)).toEqual({
      name: 'Fun Money',
      currency: 'USD',
      visibility: 'personal',
      target: 30000,
      held: { categoryIds: [], subcategoryIds: ['Streaming'] },
    });
  });
});

describe('objectionsOf', () => {
  it('refuses a blank name, a missing or zero target, and nothing ticked', () => {
    const refused = {
      name: 'Required.',
      target: translator.text('budgetManagement', 'error.target'),
      covers: translator.text('budgetManagement', 'error.covers'),
    };
    expect(objectionsOf(' ', null, NO_PICKS, translator)).toEqual(refused);
    expect(objectionsOf(' ', 0, NO_PICKS, translator).target).toBe(refused.target);
  });

  it('passes a named budget with a target and a tick', () => {
    const picks = { categoryIds: ['food'], subcategoryIds: [] };
    const found = objectionsOf('Home', 1, picks, translator);
    expect(found).toEqual({ name: undefined, target: undefined, covers: undefined });
    expect(passes(found)).toBe(true);
    expect(passes({ name: 'Required.' })).toBe(false);
  });
});

describe('alertOf', () => {
  const lists = {
    budgets: [budget('home', { name: 'Home', targets: [{ categoryId: 'food' }] })],
    categories: [FOOD],
  };

  it('names the target and the budget that took it (409)', () => {
    const failure = {
      code: 'budget.target_already_claimed', params: { categoryId: 'food', budgetId: 'home' },
    };
    expect(alertOf(failure, lists, translator))
      .toBe('Food was just added to Home. The list is up to date: pick again.');
  });

  it('says when the budget took part of the category, or its whole category (FR-4.7)', () => {
    const snacks = {
      id: 'snacks', categoryId: 'food', name: 'Snacks', archivedAt: null, createdAt: FOOD.createdAt,
    };
    const categories = [{ ...FOOD, subcategories: [snacks] }];
    const conflict = (target: object, held: Budget['targets']) => alertOf(
      { code: 'budget.target_already_claimed', params: { ...target, budgetId: 'home' } },
      { budgets: [budget('home', { name: 'Home', targets: held })], categories },
      translator,
    );
    expect(conflict({ categoryId: 'food' }, [{ subcategoryId: 'snacks' }]))
      .toBe('Part of Food was just added to Home. The list is up to date: pick again.');
    expect(conflict({ subcategoryId: 'snacks' }, [{ categoryId: 'food' }])).toBe(
      'Food › Snacks was just covered by Home, which took its whole category. '
      + 'The list is up to date: pick again.',
    );
  });

  it('falls back to the code\'s own message when either can\'t be named', () => {
    const unknownBudget = {
      code: 'budget.target_already_claimed', params: { categoryId: 'food', budgetId: 'x' },
    };
    const unknownTarget = { code: 'budget.target_already_claimed', params: { budgetId: 'home' } };
    const fallback = 'This category already belongs to another budget.';
    expect(alertOf(unknownBudget, lists, translator)).toBe(fallback);
    expect(alertOf(unknownTarget, lists, translator)).toBe(fallback);
  });

  it('writes any other failure from its code, and nothing without one', () => {
    expect(alertOf({ code: 'budget.not_found' }, lists, translator)).toBe('Budget not found.');
    expect(alertOf(
      { code: 'budget.not_found', params: { categoryId: 'food', budgetId: 'home' } },
      lists,
      translator,
    )).toBe('Budget not found.');
    expect(alertOf(undefined, lists, translator)).toBeUndefined();
  });
});

describe('jointViewOf', () => {
  it('fails if either list\'s first load failed, else loads until both are in', () => {
    const failed = { status: 'failed', error: { code: 'x' } } as const;
    expect(jointViewOf(failed, CATEGORIES)).toEqual({ status: 'failed' });
    expect(jointViewOf(BUDGETS, failed)).toEqual({ status: 'failed' });
    expect(jointViewOf({ status: 'loading' }, CATEGORIES)).toEqual({ status: 'loading' });
    expect(jointViewOf(BUDGETS, { status: 'loading' })).toEqual({ status: 'loading' });
  });

  it('is stale when either list\'s latest fetch failed', () => {
    const refreshError = { code: 'internal.unexpected' };
    expect(jointViewOf(BUDGETS, CATEGORIES)).toEqual(expect.objectContaining({ stale: false }));
    expect(jointViewOf({ ...BUDGETS, refreshError }, CATEGORIES))
      .toEqual(expect.objectContaining({ stale: true }));
    expect(jointViewOf(BUDGETS, { ...CATEGORIES, refreshError }))
      .toEqual(expect.objectContaining({ stale: true }));
  });
});

describe('coverChipsOf', () => {
  const shopping: Category = {
    ...DINING, id: 'shopping', name: 'Shopping', subcategories: [],
  };

  it('names each target, a subcategory under its category, with its category\'s look', () => {
    const targets = [{ categoryId: 'shopping' }, { subcategoryId: 'streaming' }];
    expect(coverChipsOf(targets, [DINING, shopping])).toEqual([
      { key: 'shopping', name: 'Shopping', category: shopping },
      { key: 'streaming', name: 'Dining › Streaming', category: DINING },
    ]);
  });

  it('finds a subcategory among its category\'s several', () => {
    const music = { ...DINING.subcategories[0]!, id: 'music', name: 'Music' };
    const dining = { ...DINING, subcategories: [music, ...DINING.subcategories] };
    expect(coverChipsOf([{ subcategoryId: 'streaming' }], [dining])).toEqual([
      { key: 'streaming', name: 'Dining › Streaming', category: dining },
    ]);
  });

  it('leaves out a target it can\'t find', () => {
    expect(coverChipsOf([{ categoryId: 'gone' }, { subcategoryId: 'gone' }], [DINING])).toEqual([]);
  });
});
