import { fireEvent, screen, within } from '@testing-library/react';
import type { Budget, Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  CoverPicker, type CoverPickerProps,
} from '../../../../../../../src/experiences/accountSetup/flows/budgetManagement/interactions/CoverPicker';
import type { PickerGroup } from '../../../../../../../src/experiences/accountSetup/budgetClaims';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The claim-aware picker (BDT: Interaction, unit — the drawer's handlers
// mocked; the kit and the translator real). It renders the standings it is
// given and emits toggles; which groups are open is its only state.

const FUN_MONEY = { id: 'b1', name: 'Fun Money' } as Budget;

/**
 * Builds a category with subcategories by name.
 *
 * @param id - Its id, also its name.
 * @param subs - Its subcategories' ids, also their names.
 * @param archivedAt - When it was archived, if it was.
 * @returns The category.
 */
const category = (id: string, subs: string[] = [], archivedAt: string | null = null): Category => ({
  id,
  householdId: 'doe',
  name: id,
  icon: 'home-outline',
  color: 'mint',
  archivedAt,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: subs.map((sub) => ({
    id: sub, categoryId: id, name: sub, archivedAt: null, createdAt: '2026-10-01T00:00:00Z',
  })),
});

const HEALTH = category('Healthcare', ['Pharmacy']);
const DINING = category('Dining', ['Restaurants', 'Streaming']);
const GROCERIES = category('Groceries');

/**
 * Renders the picker with its toggles spied.
 *
 * @param groups - The groups to show.
 * @param over - The props over the defaults.
 * @returns The spies.
 */
const renderPicker = (groups: PickerGroup[], over: Partial<CoverPickerProps> = {}) => {
  const onToggleCategory = vi.fn();
  const onToggleSubcategory = vi.fn();
  renderInLocale(
    <CoverPicker
      groups={groups}
      disabled={false}
      onToggleCategory={onToggleCategory}
      onToggleSubcategory={onToggleSubcategory}
      {...over}
    />,
  );
  return { onToggleCategory, onToggleSubcategory };
};

/**
 * Builds a group whose subcategories are all free.
 *
 * @param of - The category.
 * @param standing - The whole-category row's standing.
 * @returns The group.
 */
const freeGroup = (of: Category, standing: PickerGroup['standing'] = { kind: 'free' }) => ({
  category: of,
  standing,
  subcategories: of.subcategories.map((subcategory) => ({
    subcategory, standing: { kind: 'free' } as const,
  })),
});

describe('CoverPicker', () => {
  it('labels its group and says how claims work', () => {
    renderPicker([freeGroup(GROCERIES)]);
    expect(screen.getByRole('group', { name: 'Covers' })).toBeTruthy();
    expect(screen.getByText('Whole categories or single subcategories')).toBeTruthy();
    expect(screen.getByText(/Each category or subcategory can belong to only one budget/))
      .toBeTruthy();
  });

  it('says there is nothing to pick without categories', () => {
    renderPicker([]);
    expect(screen.getByText('No categories to pick yet. Add some on the Categories tab.'))
      .toBeTruthy();
  });

  it('emits a whole category\'s toggle', () => {
    const { onToggleCategory } = renderPicker([freeGroup(GROCERIES)]);
    fireEvent.click(screen.getByRole('checkbox', { name: /Groceries/ }));
    expect(onToggleCategory).toHaveBeenCalledWith(GROCERIES);
  });

  it('shows a picked category with all its subcategories, and no chevron without any', () => {
    renderPicker([freeGroup(GROCERIES, { kind: 'picked' })]);
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: /Groceries/ });
    expect(box.checked).toBe(true);
    expect(screen.getByText('all subcategories')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables a category claimed elsewhere or partly, naming where it lives', () => {
    renderPicker([
      freeGroup(HEALTH, { kind: 'claimed', budget: FUN_MONEY }),
      freeGroup(DINING, { kind: 'partly', budget: FUN_MONEY }),
    ]);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Healthcare/ }).disabled)
      .toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Dining/ }).disabled).toBe(true);
    expect(screen.getByText('in Fun Money')).toBeTruthy();
    expect(screen.getByText('partly in Fun Money')).toBeTruthy();
  });

  it('marks an archived category, and disables it when it is only listed for a subcategory', () => {
    const gone = category('Old', ['Thing'], '2026-09-01T00:00:00Z');
    renderPicker([freeGroup(gone, { kind: 'archived' })]);
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Old/ });
    expect(box.disabled).toBe(true);
    expect(screen.getByText('archived')).toBeTruthy();
  });

  it('adds the archived mark to a held archived pick\'s note', () => {
    const gone = category('Old', [], '2026-09-01T00:00:00Z');
    renderPicker([freeGroup(gone, { kind: 'picked' })]);
    expect(screen.getByText('all subcategories · archived')).toBeTruthy();
  });

  it('opens a group on its chevron, emits a subcategory\'s toggle, and closes it again', () => {
    const { onToggleSubcategory } = renderPicker([freeGroup(DINING)]);
    const chevron = screen.getByRole('button', { name: 'Subcategories of Dining' });
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    expect(chevron.hasAttribute('aria-controls')).toBe(false);
    expect(screen.queryByRole('checkbox', { name: 'Streaming' })).toBeNull();

    fireEvent.click(chevron);
    expect(chevron.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(chevron.getAttribute('aria-controls')!)!;
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Streaming' }));
    expect(onToggleSubcategory).toHaveBeenCalledWith('Streaming');

    fireEvent.click(chevron);
    expect(screen.queryByRole('checkbox', { name: 'Streaming' })).toBeNull();
    expect(chevron.hasAttribute('aria-controls')).toBe(false);
  });

  it('opens a group by itself for a claimed subcategory, and shows each standing', () => {
    const [restaurants, streaming] = DINING.subcategories as [
      Category['subcategories'][number], Category['subcategories'][number],
    ];
    renderPicker([{
      category: DINING,
      standing: { kind: 'partly', budget: FUN_MONEY },
      subcategories: [
        { subcategory: restaurants, standing: { kind: 'claimed', budget: FUN_MONEY } },
        { subcategory: streaming, standing: { kind: 'picked' } },
      ],
    }]);
    const claimed = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Restaurants/ });
    const picked = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Streaming/ });
    expect(claimed.disabled).toBe(true);
    expect(claimed.checked).toBe(false);
    expect(picked.disabled).toBe(false);
    expect(picked.checked).toBe(true);
    expect(screen.getAllByText('in Fun Money')).toHaveLength(1);
  });

  it('shows subcategories covered with their category, or by another budget', () => {
    const [restaurants, streaming] = DINING.subcategories as [
      Category['subcategories'][number], Category['subcategories'][number],
    ];
    renderPicker([{
      category: DINING,
      standing: { kind: 'picked' },
      subcategories: [
        { subcategory: restaurants, standing: { kind: 'withCategory' } },
        { subcategory: streaming, standing: { kind: 'coveredBy', budget: FUN_MONEY } },
      ],
    }]);
    fireEvent.click(screen.getByRole('button', { name: 'Subcategories of Dining' }));
    const withIt = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Restaurants/ });
    const covered = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Streaming/ });
    expect(withIt.checked).toBe(true);
    expect(withIt.disabled).toBe(true);
    expect(covered.checked).toBe(false);
    expect(covered.disabled).toBe(true);
    expect(screen.getByText('with the whole category')).toBeTruthy();
    expect(screen.getByText('covered by Fun Money')).toBeTruthy();
  });

  it('marks an archived subcategory the budget keeps', () => {
    const [pharmacy] = HEALTH.subcategories as [Category['subcategories'][number]];
    renderPicker([{
      category: HEALTH,
      standing: { kind: 'free' },
      subcategories: [{
        subcategory: { ...pharmacy, archivedAt: '2026-09-01T00:00:00Z' },
        standing: { kind: 'picked' },
      }],
    }]);
    expect(screen.getByText('archived')).toBeTruthy();
  });

  it('waits while a request is out', () => {
    renderPicker([freeGroup(GROCERIES)], { disabled: true });
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Groceries/ }).disabled)
      .toBe(true);
  });

  it('shows its error and marks every row invalid', () => {
    renderPicker([freeGroup(GROCERIES)], { error: 'Pick at least one.' });
    expect(screen.getByText('Pick at least one.')).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: /Groceries/ });
    expect(box.getAttribute('aria-invalid')).toBe('true');
  });
});
