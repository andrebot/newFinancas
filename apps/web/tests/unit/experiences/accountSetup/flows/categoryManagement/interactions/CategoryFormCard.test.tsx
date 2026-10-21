import { fireEvent, screen } from '@testing-library/react';
import type { Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  CategoryFormCard, DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON,
} from '../../../../../../../src/experiences/accountSetup/flows/categoryManagement/interactions/CategoryFormCard';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The form card (BDT: one boundary — the Flow's handlers — mocked; the kit and
// the translator are real). It checks its name before emitting.

const HOUSING: Category = {
  id: 'cat',
  householdId: 'doe',
  name: 'Housing',
  icon: 'home-outline',
  color: 'sky',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [],
};

/** The name field's current text. */
const nameValue = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Name' }).value;

/** Whether a radio by its accessible name is checked. */
const isChecked = (label: string): boolean => {
  const radio = screen.getByRole<HTMLInputElement>('radio', { name: label });
  return radio.checked;
};

/** Renders the card with its handlers spied. */
const renderCard = (over: Partial<Parameters<typeof CategoryFormCard>[0]> = {}) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  renderInLocale(
    <CategoryFormCard
      mode="create"
      busy={false}
      disabled={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { onSubmit, onCancel };
};

describe('the create card', () => {
  it('opens empty with its defaults and its caption', () => {
    renderCard();
    expect(screen.getByText('New category')).toBeTruthy();
    expect(nameValue()).toBe('');
    // The default icon is not a quick pick, so the row shows it first.
    expect(isChecked('Other')).toBe(true);
    expect(isChecked('Mint')).toBe(true);
  });

  it('refuses an empty name and shows the field’s error', () => {
    const { onSubmit } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();
  });

  it('clears the objection when its name passes again', () => {
    const { onSubmit } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Required.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Pets' } });
    expect(screen.queryByText('Required.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalledWith('Pets', DEFAULT_CATEGORY_ICON, DEFAULT_CATEGORY_COLOR);
  });

  it('emits its fields trimmed with the picked icon and colour', () => {
    const { onSubmit } = renderCard();
    const nameField = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(nameField, { target: { value: '  Pets  ' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Pets' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalledWith('Pets', 'pets', 'sky');
  });

  it('waits while a request is out', () => {
    const { onSubmit } = renderCard({ busy: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Pets' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the server’s objection in its banner', () => {
    renderCard({ alert: 'Something went wrong.' });
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
  });
});

describe('the edit card', () => {
  it('starts pre-filled with its category and saves the changes', () => {
    const onSubmit = vi.fn();
    renderInLocale(
      <CategoryFormCard
        mode="edit"
        initial={{ name: HOUSING.name, icon: HOUSING.icon, color: HOUSING.color }}
        busy={false}
        disabled={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('Edit category')).toBeTruthy();
    expect(nameValue()).toBe('Housing');
    expect(isChecked('Home')).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Roof' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit).toHaveBeenCalledWith('Roof', 'home-outline', 'sky');
  });

  it('closes on a cancel without emitting', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderInLocale(
      <CategoryFormCard
        mode="create"
        busy={false}
        disabled={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
