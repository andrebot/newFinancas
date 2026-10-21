import type { Category, Subcategory } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_CATEGORIES, afterAction, afterLoad, archiveConfirmCancelled, archiveConfirmOpened,
  formClosed, formOpened, liveSubcategoriesOf, loadingCategories, mayCreateCategory,
  mayManageCategories, splitCategories, started, type CategoryManagementState,
} from '../../../../../../src/experiences/accountSetup/flows/categoryManagement/categoryManagementState';

// The Flow's state (BDT: pure transitions → unit, nothing mocked). A success
// moves the list the way the API did; a failure keeps what was typed.

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
const OLD = category(
  'old',
  {
    archivedAt: '2026-09-01T00:00:00Z',
    subcategories: [sub('s3', { archivedAt: '2026-09-01T00:00:00Z' })],
  },
);
const LOADED: CategoryManagementState = {
  view: { status: 'loaded', categories: [HOUSING, GROCERIES, OLD] },
};

describe('the list and its load', () => {
  it('opens loading the list, nothing else', () => {
    expect(INITIAL_CATEGORIES).toEqual({ view: { status: 'loading' } });
  });

  it('marks a retry as loading again, closing whatever was open', () => {
    const state = formOpened(LOADED, { mode: 'edit', categoryId: 'cat' });
    expect(loadingCategories(state)).toEqual({ view: { status: 'loading' } });
  });

  it('applies a loaded list', () => {
    expect(afterLoad(INITIAL_CATEGORIES, { ok: true, categories: [HOUSING] })).toEqual({
      view: { status: 'loaded', categories: [HOUSING] },
    });
  });

  it('keeps the failure for its retry', () => {
    const failed = { ok: false as const, error: { code: 'internal.unexpected' } };
    const state = afterLoad(INITIAL_CATEGORIES, failed);
    expect(state.view).toEqual({ status: 'failed', error: { code: 'internal.unexpected' } });
  });

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
  it('opens a form with no confirm and no stale failure', () => {
    const state = formOpened(LOADED, { mode: 'create' });
    expect(state.form).toEqual({ mode: 'create' });
    expect(state.archiving).toBeUndefined();
    expect(state.lastError).toBeUndefined();
  });

  it('closes the form and its confirm', () => {
    const editing = formOpened(LOADED, { mode: 'edit', categoryId: 'cat' });
    const state = archiveConfirmOpened(editing, 'cat');
    expect(formClosed(state)).toEqual({ ...LOADED, lastError: undefined });
  });

  it('opens a card’s confirm and closes any form with it', () => {
    const state = archiveConfirmOpened(formOpened(LOADED, { mode: 'create' }), 'gro');
    expect(state.archiving).toBe('gro');
    expect(state.form).toBeUndefined();
  });

  it('closes the confirm and keeps its card', () => {
    const state = archiveConfirmCancelled(archiveConfirmOpened(LOADED, 'cat'));
    expect(state.archiving).toBeUndefined();
    expect(state.view).toEqual(LOADED.view);
  });
});

describe('the request that is out', () => {
  it('marks a request as out and drops the stale failure', () => {
    const failing = { ...LOADED, lastError: { code: 'internal.unexpected' } };
    const state = started(failing, { kind: 'create' });
    expect(state.out).toEqual({ kind: 'create' });
    expect(state.lastError).toBeUndefined();
  });

  it('leaves the state alone when nothing is out', () => {
    const state = afterAction(LOADED, { ok: true, category: GROCERIES });
    expect(state).toEqual(LOADED);
  });

  it('keeps what was typed on a failure and shows why', () => {
    const withForm = formOpened(LOADED, { mode: 'create' });
    const state = afterAction(started(withForm, { kind: 'create' }), {
      ok: false, error: { code: 'auth.forbidden' },
    });
    expect(state.out).toBeUndefined();
    expect(state.lastError).toEqual({ code: 'auth.forbidden' });
    expect(state.form).toEqual({ mode: 'create' });
    expect(state.view).toEqual(LOADED.view);
  });

  it('appends a created category and closes its form', () => {
    const withForm = formOpened(LOADED, { mode: 'create' });
    const written = category('new');
    const outgoing = started(withForm, { kind: 'create' });
    const state = afterAction(outgoing, { ok: true, category: written });
    expect(state.view).toEqual({
      status: 'loaded', categories: [HOUSING, GROCERIES, OLD, written],
    });
    expect(state.form).toBeUndefined();
  });

  it('keeps the list when a create answers without its category', () => {
    const withForm = formOpened(LOADED, { mode: 'create' });
    const state = afterAction(started(withForm, { kind: 'create' }), { ok: true });
    expect(state.view).toEqual(LOADED.view);
    expect(state.form).toBeUndefined();
  });

  it('replaces an edited category with the server’s copy and closes its form', () => {
    const edited = { ...HOUSING, name: 'Roof' };
    const withForm = formOpened(LOADED, { mode: 'edit', categoryId: 'cat' });
    const state = afterAction(started(withForm, { kind: 'edit', categoryId: 'cat' }), {
      ok: true, category: edited,
    });
    expect(state.view).toEqual({ status: 'loaded', categories: [edited, GROCERIES, OLD] });
    expect(state.form).toBeUndefined();
  });

  it('keeps the list when an edit answers without its category', () => {
    const withForm = formOpened(LOADED, { mode: 'edit', categoryId: 'cat' });
    const state = afterAction(started(withForm, { kind: 'edit', categoryId: 'cat' }), { ok: true });
    expect(state.view).toEqual(LOADED.view);
    expect(state.form).toBeUndefined();
  });

  it('applies a subcategory add as the server’s copy of its category', () => {
    const grown = { ...HOUSING, subcategories: [sub('s1'), sub('s2'), sub('parking')] };
    const state = afterAction(started(LOADED, { kind: 'addSubcategory', categoryId: 'cat' }), {
      ok: true, category: grown,
    });
    expect(state.view).toEqual({ status: 'loaded', categories: [grown, GROCERIES, OLD] });
  });

  it('archives a category and its live subcategories at once', () => {
    const state = afterAction(
      started(archiveConfirmOpened(LOADED, 'cat'), { kind: 'archiveCategory', categoryId: 'cat' }),
      { ok: true },
    );
    const { categories } = (state.view as Extract<typeof LOADED.view, { status: 'loaded' }>);
    const archivedHousing = categories[0];
    if (!archivedHousing) throw new Error('the first category is missing');
    expect(archivedHousing.archivedAt).not.toBeNull();
    const allGone = archivedHousing.subcategories.every((item) => item.archivedAt !== null);
    expect(allGone).toBe(true);
    expect(state.archiving).toBeUndefined();
  });

  it('leaves an already-archived subcategory untouched when its parent goes', () => {
    const halfGone = category(
      'cat',
      {
        name: 'Housing',
        subcategories: [sub('s1'), sub('s2', { archivedAt: '2026-09-01T00:00:00Z' })],
      },
    );
    const withHalfGone: CategoryManagementState = {
      view: { status: 'loaded', categories: [halfGone, GROCERIES, OLD] },
    };
    const outgoing = started(archiveConfirmOpened(withHalfGone, 'cat'), {
      kind: 'archiveCategory', categoryId: 'cat',
    });
    const state = afterAction(outgoing, { ok: true });
    const { categories } = (state.view as Extract<typeof LOADED.view, { status: 'loaded' }>);
    const gone = categories[0];
    if (!gone) throw new Error('the first category is missing');
    expect(gone.archivedAt).not.toBeNull();
    expect(gone.subcategories[0]?.archivedAt).not.toBeNull();
    expect(gone.subcategories[1]).toEqual(sub('s2', { archivedAt: '2026-09-01T00:00:00Z' }));
  });

  it('archives one subcategory and leaves its siblings', () => {
    const state = afterAction(started(LOADED, {
      kind: 'archiveSubcategory', categoryId: 'cat', subcategoryId: 's1',
    }), { ok: true });
    const housing = (state.view as Extract<typeof LOADED.view, { status: 'loaded' }>).categories[0];
    if (!housing) throw new Error('the first category is missing');
    expect(housing.archivedAt).toBeNull();
    expect(housing.subcategories.map((subcategory) => subcategory.archivedAt)).toEqual([
      expect.any(String), null,
    ]);
  });

  it('drops an answer that lands while the list is still loading', () => {
    const state = afterAction(started(INITIAL_CATEGORIES, { kind: 'create' }), { ok: true });
    expect(state.view).toEqual({ status: 'loading' });
    expect(state.out).toBeUndefined();
  });
});

describe('the role’s reach (FR-1.7, OQ-174)', () => {
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
