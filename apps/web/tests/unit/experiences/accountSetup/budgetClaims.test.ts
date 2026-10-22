import type { Budget, Category, Subcategory } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  availablePicks, categoryStanding, claimsIn, conflictKindOf, isEmptyPick, NO_PICKS, opensByItself,
  pickerGroupsOf, picksOf, subcategoryStanding, targetName, targetsOf, toggleCategory,
  toggleSubcategory, type Picks, type ScopeClaims,
} from '../../../../src/experiences/accountSetup/budgetClaims';

// The claim-aware picker's rules (BDT: Flow-tier pure logic, unit; nothing
// mocked). FR-4.6: a whole category covers its subcategories; FR-4.7: one
// claim per target per scope, a subcategory claimed elsewhere blocking its
// category; OQ-176: an archived target the budget holds stays listed.

/**
 * Builds a subcategory.
 *
 * @param id - Its id.
 * @param categoryId - Its category.
 * @param archivedAt - When it was archived, if it was.
 * @returns The subcategory.
 */
const sub = (id: string, categoryId: string, archivedAt: string | null = null): Subcategory => ({
  id, categoryId, name: `Sub ${id}`, archivedAt, createdAt: '2026-10-01T00:00:00Z',
});

/**
 * Builds a category.
 *
 * @param id - Its id.
 * @param subcategories - Its subcategories.
 * @param archivedAt - When it was archived, if it was.
 * @returns The category.
 */
const category = (
  id: string,
  subcategories: Subcategory[] = [],
  archivedAt: string | null = null,
): Category => ({
  id,
  householdId: 'doe',
  name: `Cat ${id}`,
  icon: 'home-outline',
  color: 'mint',
  archivedAt,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories,
});

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
  name: `Budget ${id}`,
  targetAmount: 1000,
  currency: 'BRL',
  visibility: 'shared',
  targets: [],
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

const FOOD = category('food', [sub('market', 'food'), sub('bakery', 'food')]);
const FUN = category('fun', [sub('cinema', 'fun'), sub('games', 'fun')]);
const NONE: ScopeClaims = { categories: new Map(), subcategories: new Map() };
const SHARED = { visibility: 'shared', selfUserId: 'jane' } as const;

describe('picks and targets', () => {
  it('reads a budget\'s targets as picks, and writes them back, categories first', () => {
    const picks = picksOf([{ subcategoryId: 'cinema' }, { categoryId: 'food' }]);
    expect(picks).toEqual({ categoryIds: ['food'], subcategoryIds: ['cinema'] });
    expect(targetsOf(picks)).toEqual([{ categoryId: 'food' }, { subcategoryId: 'cinema' }]);
  });

  it('tells an empty pick from one with either kind of target', () => {
    expect(isEmptyPick(NO_PICKS)).toBe(true);
    expect(isEmptyPick({ categoryIds: ['food'], subcategoryIds: [] })).toBe(false);
    expect(isEmptyPick({ categoryIds: [], subcategoryIds: ['cinema'] })).toBe(false);
  });
});

describe('claimsIn', () => {
  const sharedFood = budget('s1', {
    targets: [{ categoryId: 'food' }, { subcategoryId: 'cinema' }],
  });
  const janesFun = budget('p1', { visibility: 'personal', targets: [{ categoryId: 'fun' }] });
  const bensFun = budget('p2', {
    visibility: 'personal', ownerUserId: 'ben', targets: [{ subcategoryId: 'games' }],
  });

  it('collects the shared scope from the shared budgets only', () => {
    const claims = claimsIn([sharedFood, janesFun, bensFun], SHARED);
    expect([...claims.categories]).toEqual([['food', sharedFood]]);
    expect([...claims.subcategories]).toEqual([['cinema', sharedFood]]);
  });

  it('collects a personal scope from the caller\'s own personal budgets only', () => {
    const claims = claimsIn(
      [sharedFood, janesFun, bensFun],
      { visibility: 'personal', selfUserId: 'jane' },
    );
    expect([...claims.categories]).toEqual([['fun', janesFun]]);
    expect(claims.subcategories.size).toBe(0);
  });

  it('leaves the edited budget\'s own claims out', () => {
    const claims = claimsIn([sharedFood], { ...SHARED, exceptBudgetId: 's1' });
    expect(claims.categories.size).toBe(0);
    expect(claims.subcategories.size).toBe(0);
  });
});

describe('categoryStanding', () => {
  it('is free, or picked when ticked', () => {
    expect(categoryStanding(FOOD, NONE, NO_PICKS)).toEqual({ kind: 'free' });
    expect(categoryStanding(FOOD, NONE, { categoryIds: ['food'], subcategoryIds: [] }))
      .toEqual({ kind: 'picked' });
  });

  it('is claimed by the budget that holds it whole, over a stale tick', () => {
    const holder = budget('b1');
    const claims = { ...NONE, categories: new Map([['food', holder]]) };
    expect(categoryStanding(FOOD, claims, { categoryIds: ['food'], subcategoryIds: [] }))
      .toEqual({ kind: 'claimed', budget: holder });
  });

  it('is partly taken when another budget holds one of its subcategories', () => {
    const holder = budget('b1');
    const claims = { ...NONE, subcategories: new Map([['bakery', holder]]) };
    expect(categoryStanding(FOOD, claims, NO_PICKS)).toEqual({ kind: 'partly', budget: holder });
  });
});

describe('subcategoryStanding', () => {
  const [market] = FOOD.subcategories as [Subcategory];

  it('is free, or picked when ticked on its own', () => {
    expect(subcategoryStanding(market, FOOD, NONE, NO_PICKS)).toEqual({ kind: 'free' });
    expect(subcategoryStanding(market, FOOD, NONE, { categoryIds: [], subcategoryIds: ['market'] }))
      .toEqual({ kind: 'picked' });
  });

  it('goes with its category when the whole category is ticked (FR-4.6)', () => {
    expect(subcategoryStanding(market, FOOD, NONE, { categoryIds: ['food'], subcategoryIds: [] }))
      .toEqual({ kind: 'withCategory' });
  });

  it('is claimed by the budget that holds it', () => {
    const holder = budget('b1');
    const claims = { ...NONE, subcategories: new Map([['market', holder]]) };
    const ticked = { categoryIds: [], subcategoryIds: ['market'] };
    expect(subcategoryStanding(market, FOOD, claims, ticked))
      .toEqual({ kind: 'claimed', budget: holder });
  });

  it('is covered by the budget that holds its whole category, before its own claim', () => {
    const whole = budget('b1');
    const claims = {
      categories: new Map([['food', whole]]), subcategories: new Map([['market', budget('b2')]]),
    };
    expect(subcategoryStanding(market, FOOD, claims, NO_PICKS))
      .toEqual({ kind: 'coveredBy', budget: whole });
  });
});

describe('pickerGroupsOf', () => {
  it('lists the open categories in order, each with its open subcategories', () => {
    const withOldSub = category('food', [sub('market', 'food'), sub('old', 'food', '2026-09-01')]);
    const gone = category('gone', [], '2026-09-01');
    const groups = pickerGroupsOf([withOldSub, gone, FUN], NONE, NO_PICKS, NO_PICKS);
    expect(groups.map((group) => group.category.id)).toEqual(['food', 'fun']);
    expect(groups[0]?.subcategories.map((row) => row.subcategory.id)).toEqual(['market']);
    expect(groups[0]?.standing).toEqual({ kind: 'free' });
    expect(groups[1]?.subcategories.map((row) => row.standing)).toEqual([
      { kind: 'free' }, { kind: 'free' },
    ]);
  });

  it('keeps an archived category the budget holds whole (OQ-176)', () => {
    const gone = category('gone', [sub('x', 'gone', '2026-09-01')], '2026-09-01');
    const held: Picks = { categoryIds: ['gone'], subcategoryIds: [] };
    const groups = pickerGroupsOf([gone], NONE, held, held);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.standing).toEqual({ kind: 'picked' });
    expect(groups[0]?.subcategories).toEqual([]);
  });

  it('keeps an archived subcategory the budget holds, and its archived category with it', () => {
    const subs = [sub('x', 'gone', '2026-09-01'), sub('y', 'gone', '2026-09-01')];
    const gone = category('gone', subs, '2026-09-01');
    const held: Picks = { categoryIds: [], subcategoryIds: ['x'] };
    const groups = pickerGroupsOf([gone], NONE, held, held);
    expect(groups.map((group) => group.category.id)).toEqual(['gone']);
    expect(groups[0]?.standing).toEqual({ kind: 'archived' });
    expect(groups[0]?.subcategories.map((row) => row.subcategory.id)).toEqual(['x']);
    expect(groups[0]?.subcategories[0]?.standing).toEqual({ kind: 'picked' });
  });
});

describe('toggles', () => {
  it('ticks a whole category, dropping the subcategories it now covers', () => {
    const before: Picks = { categoryIds: ['fun'], subcategoryIds: ['market', 'cinema'] };
    expect(toggleCategory(before, FOOD)).toEqual({
      categoryIds: ['fun', 'food'], subcategoryIds: ['cinema'],
    });
  });

  it('unticks a whole category, keeping everything else', () => {
    const before: Picks = { categoryIds: ['fun', 'food'], subcategoryIds: ['x'] };
    expect(toggleCategory(before, FOOD)).toEqual({ categoryIds: ['fun'], subcategoryIds: ['x'] });
  });

  it('ticks and unticks a single subcategory', () => {
    const ticked = toggleSubcategory({ categoryIds: ['fun'], subcategoryIds: ['a'] }, 'b');
    expect(ticked).toEqual({ categoryIds: ['fun'], subcategoryIds: ['a', 'b'] });
    expect(toggleSubcategory(ticked, 'a')).toEqual({ categoryIds: ['fun'], subcategoryIds: ['b'] });
  });
});

describe('availablePicks', () => {
  it('keeps only what the groups show as picked: a pick taken meanwhile is dropped', () => {
    const picks: Picks = { categoryIds: ['food', 'fun'], subcategoryIds: ['games'] };
    const taken = { ...NONE, categories: new Map([['fun', budget('b1')]]) };
    const groups = pickerGroupsOf([FOOD, FUN], taken, picks, NO_PICKS);
    expect(availablePicks(groups)).toEqual({ categoryIds: ['food'], subcategoryIds: [] });
  });

  it('keeps a single subcategory picked on its own', () => {
    const picks: Picks = { categoryIds: [], subcategoryIds: ['cinema'] };
    const groups = pickerGroupsOf([FOOD, FUN], NONE, picks, NO_PICKS);
    expect(availablePicks(groups)).toEqual({ categoryIds: [], subcategoryIds: ['cinema'] });
  });
});

describe('opensByItself', () => {
  it('opens a group with a subcategory picked on its own or claimed elsewhere', () => {
    const alone = { categoryIds: [], subcategoryIds: ['cinema'] };
    const taken = { ...NONE, subcategories: new Map([['games', budget('b1')]]) };
    const picked = pickerGroupsOf([FUN], NONE, alone, NO_PICKS);
    const claimed = pickerGroupsOf([FUN], taken, NO_PICKS, NO_PICKS);
    expect(opensByItself(picked[0]!)).toBe(true);
    expect(opensByItself(claimed[0]!)).toBe(true);
  });

  it('keeps a free group, a whole pick and a group covered elsewhere closed', () => {
    const free = pickerGroupsOf([FUN], NONE, NO_PICKS, NO_PICKS);
    const all = { categoryIds: ['fun'], subcategoryIds: [] };
    const elsewhere = { ...NONE, categories: new Map([['fun', budget('b1')]]) };
    const whole = pickerGroupsOf([FUN], NONE, all, NO_PICKS);
    const covered = pickerGroupsOf([FUN], elsewhere, NO_PICKS, NO_PICKS);
    expect(opensByItself(free[0]!)).toBe(false);
    expect(opensByItself(whole[0]!)).toBe(false);
    expect(opensByItself(covered[0]!)).toBe(false);
  });
});

describe('targetName', () => {
  it('names a whole category, or a subcategory under its category', () => {
    expect(targetName([FOOD, FUN], { categoryId: 'fun' })).toBe('Cat fun');
    expect(targetName([FOOD, FUN], { subcategoryId: 'bakery' })).toBe('Cat food › Sub bakery');
  });

  it('names nothing it can\'t find', () => {
    expect(targetName([FOOD], { categoryId: 'nope' })).toBeUndefined();
    expect(targetName([FOOD], { subcategoryId: 'nope' })).toBeUndefined();
    expect(targetName([FOOD], {})).toBeUndefined();
  });
});

describe('conflictKindOf', () => {
  it('tells a claimer holding the very target sent', () => {
    expect(conflictKindOf(
      { categoryId: 'food' },
      budget('b', { targets: [{ categoryId: 'food' }] }),
    )).toBe('same');
    expect(conflictKindOf(
      { subcategoryId: 'bakery' },
      budget('b', { targets: [{ subcategoryId: 'bakery' }] }),
    )).toBe('same');
  });

  it('tells part of a whole category sent from all around a subcategory sent (FR-4.7)', () => {
    const holdsBakery = budget('b', { targets: [{ subcategoryId: 'bakery' }] });
    const holdsFood = budget('b', { targets: [{ categoryId: 'food' }] });
    expect(conflictKindOf({ categoryId: 'food' }, holdsBakery)).toBe('partly');
    expect(conflictKindOf({ subcategoryId: 'bakery' }, holdsFood)).toBe('covered');
  });
});
