import { fireEvent, screen } from '@testing-library/react';
import type { Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  ArchivedCategory, CategoryCard,
} from '../../../../../../../src/experiences/accountSetup/flows/categoryManagement/interactions/CategoryCard';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// A category's card (BDT: one boundary — the Flow's handlers — mocked; the kit
// and the translator are real). Manage controls belong to Owner/Admin only.

const HOUSING: Category = {
  id: 'cat',
  householdId: 'doe',
  name: 'Housing',
  icon: 'home-outline',
  color: 'sky',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [
    {
      id: 's1',
      categoryId: 'cat',
      name: 'Rent / Mortgage',
      archivedAt: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 's2',
      categoryId: 'cat',
      name: 'Utilities',
      archivedAt: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 's3',
      categoryId: 'cat',
      name: 'Old sub',
      archivedAt: '2026-09-01T00:00:00Z',
      createdAt: '2026-09-01T00:00:00Z',
    },
  ],
};

/** Renders the card with its handlers spied. */
const renderCard = (over: Partial<Parameters<typeof CategoryCard>[0]> = {}) => {
  const onEdit = vi.fn();
  const onArchiveRequest = vi.fn();
  const onConfirmArchive = vi.fn();
  const onCancelArchive = vi.fn();
  const onAddSubcategory = vi.fn();
  const onArchiveSubcategory = vi.fn();
  /**
   * Builds the card with the handlers above.
   *
   * @param props - The props over the defaults.
   * @returns The card.
   */
  const card = (props: Partial<Parameters<typeof CategoryCard>[0]>) => (
    <CategoryCard
      category={HOUSING}
      canManage
      busy={false}
      archivingOpen={false}
      onEdit={onEdit}
      onArchiveRequest={onArchiveRequest}
      onConfirmArchive={onConfirmArchive}
      onCancelArchive={onCancelArchive}
      onAddSubcategory={onAddSubcategory}
      onArchiveSubcategory={onArchiveSubcategory}
      {...props}
    />
  );
  const view = renderInLocale(card(over));
  return {
    /**
     * Renders the card again with new props, keeping its state.
     *
     * @param props - The props over the defaults.
     */
    rerender: (props: Partial<Parameters<typeof CategoryCard>[0]>) => {
      view.rerenderInLocale(card({ ...over, ...props }));
    },
    onEdit,
    onArchiveRequest,
    onConfirmArchive,
    onCancelArchive,
    onAddSubcategory,
    onArchiveSubcategory,
  };
};

describe('the card', () => {
  it('shows its name and its live subcategories only', () => {
    renderCard();
    expect(screen.getByText('Housing')).toBeTruthy();
    expect(screen.getByText('2 subcategories')).toBeTruthy();
    expect(screen.getByText('Rent / Mortgage')).toBeTruthy();
    expect(screen.getByText('Utilities')).toBeTruthy();
    expect(screen.queryByText('Old sub')).toBeNull();
  });

  it('says so when it has no live subcategories', () => {
    renderCard({ category: { ...HOUSING, subcategories: [] } });
    expect(screen.getByText('No subcategories')).toBeTruthy();
  });

  it('hides every manage control from a Viewer', () => {
    renderCard({ canManage: false });
    expect(screen.queryByRole('button', { name: 'Edit Housing' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive Housing' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'New subcategory' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add subcategory' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive Rent / Mortgage' })).toBeNull();
  });

  it('offers its manage controls to an Owner', () => {
    const { onEdit, onArchiveRequest } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Housing' }));
    expect(onEdit).toHaveBeenCalledWith('cat');
    fireEvent.click(screen.getByRole('button', { name: 'Archive Housing' }));
    expect(onArchiveRequest).toHaveBeenCalledWith('cat');
  });

  it('adds a subcategory and clears the field once it is listed', () => {
    const { onAddSubcategory, rerender } = renderCard();
    const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'New subcategory' });
    fireEvent.change(input(), { target: { value: 'Parking' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add subcategory' }));
    expect(onAddSubcategory).toHaveBeenCalledWith('cat', 'Parking');
    expect(input().value).toBe('Parking');

    const parking = { ...HOUSING.subcategories[0]!, id: 's4', name: 'Parking' };
    rerender({ category: { ...HOUSING, subcategories: [...HOUSING.subcategories, parking] } });
    expect(input().value).toBe('');
  });

  it('keeps the typed name when the add is refused', () => {
    const { rerender } = renderCard();
    const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'New subcategory' });
    fireEvent.change(input(), { target: { value: 'Parking' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add subcategory' }));
    rerender({ busy: true });
    rerender({ busy: false });
    expect(input().value).toBe('Parking');
  });

  it('keeps the typed name when a sibling is archived', () => {
    const { rerender } = renderCard();
    const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'New subcategory' });
    fireEvent.change(input(), { target: { value: 'Parking' } });
    rerender({ category: { ...HOUSING, subcategories: HOUSING.subcategories.slice(1) } });
    expect(input().value).toBe('Parking');
  });

  it('waits while a request is out: no add, no subcategory archive', () => {
    const { onAddSubcategory, onArchiveSubcategory } = renderCard({ busy: true });
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'New subcategory' });
    expect(input.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Parking' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddSubcategory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Archive Rent / Mortgage' }));
    expect(onArchiveSubcategory).not.toHaveBeenCalled();
  });

  it('adds on Enter and refuses an empty field', () => {
    const { onAddSubcategory } = renderCard();
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'New subcategory' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddSubcategory).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '  Garage  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddSubcategory).toHaveBeenCalledWith('cat', 'Garage');
  });

  it('ignores other keys in its subcategory field', () => {
    const { onAddSubcategory } = renderCard();
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'New subcategory' });
    fireEvent.change(input, { target: { value: 'Parking' } });
    fireEvent.keyDown(input, { key: 'a' });
    expect(onAddSubcategory).not.toHaveBeenCalled();
  });

  it('archives one of its subcategories on its own', () => {
    const { onArchiveSubcategory } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Archive Rent / Mortgage' }));
    expect(onArchiveSubcategory).toHaveBeenCalledWith('cat', 's1', 'Rent / Mortgage');
  });
});

describe('the archive confirm', () => {
  it('takes the card’s place, naming it and counting its subcategories', () => {
    const { onConfirmArchive, onCancelArchive } = renderCard({ archivingOpen: true });
    expect(screen.getByText(/Archive Housing and its 2 subcategories\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancelArchive).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onConfirmArchive).toHaveBeenCalledOnce();
  });

  it('asks plainly when it has no subcategories left', () => {
    renderCard({ archivingOpen: true, category: { ...HOUSING, subcategories: [] } });
    expect(screen.getByText(/Archive Housing\?/)).toBeTruthy();
  });
});

describe('the archived row', () => {
  it('shows its name read-only', () => {
    renderInLocale(<ArchivedCategory category={HOUSING} />);
    expect(screen.getByText('Housing')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
