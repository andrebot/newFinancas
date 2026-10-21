import type { Category, Subcategory } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_CATEGORIES, afterAction, archiveConfirmCancelled, archiveConfirmOpened,
  archivingTarget, formClosed, formOpened, isFormRequest, liveSubcategoriesOf, mayCreateCategory,
  mayManageCategories, splitCategories, started, type CategoriesView,
} from '../../../../../../src/experiences/accountSetup/flows/categoryManagement/categoryManagementState';

// The Flow's state (BDT: pure transitions → unit, nothing mocked). The list
// is the Experience's; the state only tracks what is out and what is open. A
// form's failure stays for its banner, a card's goes to a toast.

/**
 * Builds a subcategory with sensible defaults for its id and name.
 *
 * @param id - Its id.
 * @param over - What to set besides the defaults.
 * @returns The subcategory.
 */
const sub = (id: string, over: Partial<Subcategory> = {}): Subcategory => ({
  id,
  categoryId: 'cat',
  name: `Sub ${id}`,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

/**
 * Builds a category with sensible defaults for its id and name.
 *
 * @param id - Its id.
 * @param over - What to set besides the defaults.
 * @returns The category.
 */
const category = (id: string, over: Partial<Category> = {}): Category => ({
  id,
  householdId: 'doe',
  name: `Category ${id}`,
  icon: 'pets',
  color: 'mint',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [],
  ...over,
});

const HOUSING = category('cat', { name: 'Housing', subcategories: [sub('s1'), sub('s2')] });
const GROCERIES = category('gro');
const OLD = category('old', { archivedAt: '2026-09-01T00:00:00Z' });
const LOADED: CategoriesView = { status: 'loaded', categories: [HOUSING, GROCERIES, OLD] };
const FORBIDDEN = { ok: false, error: { code: 'auth.forbidden' } } as const;

describe('the list’s halves', () => {
  it('splits a list into its live and archived categories', () => {
    expect(splitCategories([HOUSING, OLD, GROCERIES])).toEqual({
      active: [HOUSING, GROCERIES], archived: [OLD],
    });
  });

  it('lists only the subcategories that are not archived', () => {
    const mixed = category('cat', {
      subcategories: [sub('s1'), sub('s2', { archivedAt: '2026-09-01T00:00:00Z' })],
    });
    expect(liveSubcategoriesOf(mixed)).toEqual([mixed.subcategories[0]]);
  });
});

describe('the form card and the archive confirm', () => {
  it('opens with nothing out and nothing open', () => {
    expect(INITIAL_CATEGORIES).toEqual({});
  });

  it('opens a form with no confirm and no stale failure', () => {
    const state = formOpened({ lastError: { code: 'x' } }, { mode: 'create' });
    expect(state).toEqual({ form: { mode: 'create' }, archiving: undefined, lastError: undefined });
  });

  it('closes the form and its confirm', () => {
    const state = archiveConfirmOpened(formOpened({}, { mode: 'edit', categoryId: 'cat' }), 'cat');
    expect(formClosed(state)).toEqual({
      form: undefined, archiving: undefined, lastError: undefined,
    });
  });

  it('opens a card’s confirm and closes any form with it, and its stale failure', () => {
    const state = archiveConfirmOpened(
      { form: { mode: 'create' }, lastError: { code: 'x' } },
      'gro',
    );
    expect(state.archiving).toBe('gro');
    expect(state.form).toBeUndefined();
    expect(state.lastError).toBeUndefined();
  });

  it('closes the confirm', () => {
    expect(archiveConfirmCancelled({ archiving: 'cat' }).archiving).toBeUndefined();
  });
});

describe('the archive target lookup', () => {
  it('is undefined while no confirm is open', () => {
    expect(archivingTarget(LOADED, undefined)).toBeUndefined();
  });

  it('finds its category in a loaded list', () => {
    expect(archivingTarget(LOADED, 'cat')).toBe(HOUSING);
  });

  it('is undefined while the list isn’t loaded', () => {
    expect(archivingTarget({ status: 'loading' }, 'cat')).toBeUndefined();
  });
});

describe('the request that is out', () => {
  it('tells a form’s request from a card’s', () => {
    expect(isFormRequest({ kind: 'create' })).toBe(true);
    expect(isFormRequest({ kind: 'edit', categoryId: 'cat' })).toBe(true);
    expect(isFormRequest({ kind: 'addSubcategory', categoryId: 'cat' })).toBe(false);
    expect(isFormRequest({ kind: 'archiveCategory', categoryId: 'cat' })).toBe(false);
  });

  it('marks a request as out and drops the stale failure', () => {
    const state = started({ lastError: { code: 'internal.unexpected' } }, { kind: 'create' });
    expect(state).toEqual({ out: { kind: 'create' }, lastError: undefined });
  });

  it('leaves the state alone when nothing is out', () => {
    const state = { form: { mode: 'create' } } as const;
    expect(afterAction(state, { ok: true })).toBe(state);
  });

  it('keeps a form and what was typed on its failure, for its banner', () => {
    const creating = started(formOpened({}, { mode: 'create' }), { kind: 'create' });
    const state = afterAction(creating, FORBIDDEN);
    expect(state.out).toBeUndefined();
    expect(state.lastError).toEqual({ code: 'auth.forbidden' });
    expect(state.form).toEqual({ mode: 'create' });
  });

  it('keeps no banner failure for a card’s request, and its confirm stays', () => {
    const open = archiveConfirmOpened({}, 'cat');
    const archiving = started(open, { kind: 'archiveCategory', categoryId: 'cat' });
    const state = afterAction(archiving, FORBIDDEN);
    expect(state.lastError).toBeUndefined();
    expect(state.archiving).toBe('cat');
  });

  it('closes a form on its success', () => {
    const editing = formOpened({}, { mode: 'edit', categoryId: 'cat' });
    const state = afterAction(started(editing, { kind: 'edit', categoryId: 'cat' }), { ok: true });
    expect(state.form).toBeUndefined();
    expect(state.out).toBeUndefined();
  });

  it('closes the confirm when its archive succeeds', () => {
    const open = archiveConfirmOpened({}, 'cat');
    const archiving = started(open, { kind: 'archiveCategory', categoryId: 'cat' });
    const state = afterAction(archiving, { ok: true });
    expect(state.archiving).toBeUndefined();
  });

  it('keeps an open form when a card’s request succeeds', () => {
    const creating = formOpened({}, { mode: 'create' });
    const state = afterAction(
      started(creating, { kind: 'archiveSubcategory', categoryId: 'cat', subcategoryId: 's1' }),
      { ok: true },
    );
    expect(state.form).toEqual({ mode: 'create' });
  });
});

describe('the role’s reach (FR-1.7)', () => {
  it('lets everyone but a Viewer create', () => {
    expect(mayCreateCategory('Owner')).toBe(true);
    expect(mayCreateCategory('Admin')).toBe(true);
    expect(mayCreateCategory('Member')).toBe(true);
    expect(mayCreateCategory('Viewer')).toBe(false);
    expect(mayCreateCategory(undefined)).toBe(false);
  });

  it('lets only an Owner or Admin manage', () => {
    expect(mayManageCategories('Owner')).toBe(true);
    expect(mayManageCategories('Admin')).toBe(true);
    expect(mayManageCategories('Member')).toBe(false);
    expect(mayManageCategories('Viewer')).toBe(false);
    expect(mayManageCategories(undefined)).toBe(false);
  });
});
