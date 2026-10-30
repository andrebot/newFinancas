import { fireEvent, screen } from '@testing-library/react';
import type { Budget, Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import { NO_PICKS } from '../../../../../../../src/experiences/accountSetup/budgetClaims';
import {
  BudgetEntry, isUnsaved, type BudgetEntryProps,
} from '../../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/BudgetEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Budget Entry (BDT: Interaction, unit): the real kit, picker and translator;
// only the Flow's handlers are stand-ins. Mockup 13 (OQ-196): one budget at a
// time, a new one or one loaded back for editing; finishing with something
// typed and not saved asks first.

/**
 * Builds a category with subcategories by name.
 *
 * @param id - Its id, also its name.
 * @param subs - Its subcategories' ids, also their names.
 * @returns The category.
 */
const category = (id: string, subs: string[] = []): Category => ({
  id,
  householdId: 'doe',
  name: id,
  icon: 'home-outline',
  color: 'mint',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: subs.map((sub) => ({
    id: sub, categoryId: id, name: sub, archivedAt: null, createdAt: '2026-10-01T00:00:00Z',
  })),
});

const CATEGORIES = [category('Groceries'), category('Dining', ['Restaurants'])];

const FUN: Budget = {
  id: 'b1',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Fun Money',
  targetAmount: 30000,
  currency: 'BRL',
  visibility: 'shared',
  targets: [{ categoryId: 'Dining' }],
  createdAt: '2026-10-01T00:00:00Z',
};

const INITIAL = {
  name: '', currency: 'BRL', visibility: 'shared', target: null, held: NO_PICKS,
} as const;

/**
 * Renders the entry with stand-in handlers.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderEntry = (props: Partial<BudgetEntryProps> = {}) => {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onBack: vi.fn(),
    onFinish: vi.fn(),
    onDiscard: vi.fn(),
    onKeepEditing: vi.fn(),
  };
  renderInLocale(
    <BudgetEntry
      categories={CATEGORIES}
      budgets={[]}
      selfUserId="jane"
      personalOnly={false}
      busy={false}
      discardConfirmOpen={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

/**
 * Types an amount into the monthly target, digits filling from the right.
 *
 * @param digits - The digits, cents last.
 */
const typeTarget = (digits: string) => {
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Monthly target' });
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, digits);
  input.setSelectionRange(digits.length, digits.length);
  fireEvent.input(input);
};

/**
 * Types the name.
 *
 * @param name - The text.
 */
const typeName = (name: string) => {
  const field = screen.getByRole('textbox', { name: 'Budget name' });
  fireEvent.change(field, { target: { value: name } });
};

/**
 * Ticks a row by the start of its name.
 *
 * @param name - The row's category or subcategory.
 */
const tick = (name: string) => {
  fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`^${name}`) }));
};

describe('isUnsaved', () => {
  it('finds nothing to lose in an untouched form', () => {
    expect(isUnsaved(INITIAL, { name: '  ', target: null, picks: NO_PICKS })).toBe(false);
  });

  it('finds a typed name, a target or a tick', () => {
    expect(isUnsaved(INITIAL, { name: 'Fun', target: null, picks: NO_PICKS })).toBe(true);
    expect(isUnsaved(INITIAL, { name: '', target: 100, picks: NO_PICKS })).toBe(true);
    expect(isUnsaved(INITIAL, {
      name: '', target: null, picks: { categoryIds: ['Groceries'], subcategoryIds: [] },
    })).toBe(true);
    expect(isUnsaved(INITIAL, {
      name: '', target: null, picks: { categoryIds: [], subcategoryIds: ['Restaurants'] },
    })).toBe(true);
  });

  it('finds a tick dropped from what the budget held', () => {
    const held = { categoryIds: ['A', 'B'], subcategoryIds: [] };
    expect(isUnsaved({ ...INITIAL, held }, {
      name: '', target: null, picks: { categoryIds: ['A'], subcategoryIds: [] },
    })).toBe(true);
  });

  it('reads the same ticks in another order as unchanged', () => {
    const held = { categoryIds: ['A', 'B'], subcategoryIds: [] };
    expect(isUnsaved({ ...INITIAL, held }, {
      name: '', target: null, picks: { categoryIds: ['B', 'A'], subcategoryIds: [] },
    })).toBe(false);
  });
});

describe('a new budget', () => {
  it('opens empty, BRL and personal, without the edit header (OQ-222)', () => {
    renderEntry();
    expect(screen.getByRole('radio', { name: 'BRL' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Personal' })).toHaveProperty('checked', true);
    expect(screen.queryByText(/^Editing/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is personal for an actor who can’t share', () => {
    renderEntry({ personalOnly: true });
    expect(screen.queryByRole('radio', { name: 'Shared' })).toBeNull();
  });

  it('refuses a form with nothing in it, each field saying why', () => {
    const handlers = renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    expect(handlers.onCreate).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();
    expect(screen.getByText('Enter a monthly target above zero.')).toBeTruthy();
    expect(screen.getByText('Pick at least one category or subcategory.')).toBeTruthy();
  });

  it('refuses a form with only its categories missing, refocusing on every refusal', () => {
    const handlers = renderEntry();
    typeName('Food');
    typeTarget('50000');
    const create = () => fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    create();
    expect(handlers.onCreate).not.toHaveBeenCalled();
    expect(screen.getByText('Pick at least one category or subcategory.')).toBeTruthy();
    const name = screen.getByRole('textbox', { name: 'Budget name' });
    name.focus();
    create();
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: /^Groceries/ }));
  });

  it('clears only the refusal of the field changed', () => {
    renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    tick('Groceries');
    expect(screen.getByText('Required.')).toBeTruthy();
    expect(screen.getByText('Enter a monthly target above zero.')).toBeTruthy();
    typeName('Food');
    expect(screen.getByText('Enter a monthly target above zero.')).toBeTruthy();
    expect(screen.queryByText('Required.')).toBeNull();
  });

  it('keeps the name and covers refusals when only the target changes', () => {
    renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    typeTarget('100');
    expect(screen.getByText('Required.')).toBeTruthy();
    expect(screen.getByText('Pick at least one category or subcategory.')).toBeTruthy();
  });

  it('clears each field’s refusal as it changes', () => {
    renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    typeName('Food');
    typeTarget('50000');
    tick('Groceries');
    expect(screen.queryByText('Required.')).toBeNull();
    expect(screen.queryByText('Enter a monthly target above zero.')).toBeNull();
    expect(screen.queryByText('Pick at least one category or subcategory.')).toBeNull();
  });

  it('emits the typed budget, trimmed, in the picked scope', () => {
    const handlers = renderEntry();
    typeName('  Food ');
    typeTarget('50000');
    fireEvent.click(screen.getByRole('radio', { name: 'USD' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Personal' }));
    tick('Groceries');
    fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    expect(handlers.onCreate).toHaveBeenCalledWith({
      name: 'Food',
      targetAmount: 50000,
      currency: 'USD',
      visibility: 'personal',
      targets: [{ categoryId: 'Groceries' }],
    });
  });

  it('emits a single subcategory ticked under its category', () => {
    const handlers = renderEntry();
    typeName('Eating out');
    typeTarget('20000');
    fireEvent.click(screen.getByRole('button', { name: 'Subcategories of Dining' }));
    tick('Restaurants');
    fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    expect(handlers.onCreate).toHaveBeenCalledWith(expect.objectContaining({
      targets: [{ subcategoryId: 'Restaurants' }],
    }));
  });

  it('names the budget a category already lives in, and won’t tick it', () => {
    renderEntry({ budgets: [FUN] });
    fireEvent.click(screen.getByRole('radio', { name: 'Shared' }));
    expect(screen.getByText('in Fun Money')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Dining/ }).disabled).toBe(true);
  });

  it('shows the server’s objection in its banner', () => {
    renderEntry({ alert: 'Something went wrong. Please try again.' });
    expect(screen.getAllByText('Something went wrong. Please try again.').length)
      .toBeGreaterThan(0);
  });
});

describe('a budget loaded back for editing', () => {
  it('opens with its fields, its scope locked, under its header', () => {
    const handlers = renderEntry({ budget: FUN, budgets: [FUN] });
    expect(screen.getByText('Editing Fun Money')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Budget name' }).value)
      .toBe('Fun Money');
    expect(screen.queryByRole('radio', { name: 'USD' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handlers.onCancelEdit).toHaveBeenCalledOnce();
  });

  it('emits the edit with the budget’s id', () => {
    const handlers = renderEntry({ budget: FUN, budgets: [FUN] });
    typeName('Fun');
    tick('Groceries');
    fireEvent.click(screen.getByRole('button', { name: 'Save budget' }));
    expect(handlers.onEdit).toHaveBeenCalledWith({
      budgetId: 'b1',
      name: 'Fun',
      targetAmount: 30000,
      targets: [{ categoryId: 'Groceries' }, { categoryId: 'Dining' }],
    });
    expect(handlers.onCreate).not.toHaveBeenCalled();
  });
});

describe('its foot', () => {
  it('goes back', () => {
    const handlers = renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(handlers.onBack).toHaveBeenCalledOnce();
  });

  it('finishes saying nothing is lost while the form is untouched', () => {
    const handlers = renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(handlers.onFinish).toHaveBeenCalledWith(false);
  });

  it('finishes saying a budget would be lost once something is typed', () => {
    const handlers = renderEntry();
    typeName('Food');
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(handlers.onFinish).toHaveBeenCalledWith(true);
  });

  it('asks before discarding, and emits either answer', () => {
    const handlers = renderEntry({ discardConfirmOpen: true });
    expect(screen.getByText("You started a budget that isn't saved. Finish without it?"))
      .toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard and finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(handlers.onDiscard).toHaveBeenCalledOnce();
    expect(handlers.onKeepEditing).toHaveBeenCalledOnce();
  });

  it('waits while the save is out, its button spinning', () => {
    renderEntry({ busy: true });
    expect(screen.getByRole('button', { name: 'Create budget' }).getAttribute('aria-busy'))
      .toBe('true');
    expect(screen.getByRole('button', { name: 'Back' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Finish setup' })).toHaveProperty('disabled', true);
  });
});
