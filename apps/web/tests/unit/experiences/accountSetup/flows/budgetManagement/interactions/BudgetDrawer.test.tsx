import {
  cleanup, fireEvent, screen, within,
} from '@testing-library/react';
import type { Budget, Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  BudgetDrawer, type BudgetDrawerProps,
} from '../../../../../../../src/experiences/accountSetup/flows/budgetManagement/interactions/BudgetDrawer';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The budget drawer (BDT: Interaction, unit): the real kit, picker and
// translator; only the Flow's handlers are stand-ins. One form for Add and
// Edit (OQ-194): currency and visibility pick on Add, lock on Edit; the
// visibility picks the scope the picker's claims are weighed in.

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

const GROCERIES = category('Groceries');
const DINING = category('Dining', ['Restaurants', 'Streaming']);
const CATEGORIES = [GROCERIES, DINING];

/**
 * Builds a budget.
 *
 * @param over - The fields to override.
 * @returns The budget.
 */
const budget = (over: Partial<Budget> = {}): Budget => ({
  id: 'b1',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Fun Money',
  targetAmount: 30000,
  currency: 'USD',
  visibility: 'personal',
  targets: [{ subcategoryId: 'Streaming' }],
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

/**
 * Renders the drawer with stand-in handlers.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderDrawer = (props: Partial<BudgetDrawerProps> = {}) => {
  const handlers = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onOpenDelete: vi.fn(),
    onDelete: vi.fn(),
    onCloseDelete: vi.fn(),
  };
  renderInLocale(
    <BudgetDrawer
      categories={CATEGORIES}
      budgets={[]}
      selfUserId="jane"
      personalOnly={false}
      busy={false}
      disabled={false}
      deleteConfirmOpen={false}
      deleteBusy={false}
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

/** Presses the drawer's submit, whatever its mode. */
const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: /Create budget|Save changes/ }));
};

describe('adding a budget', () => {
  it('opens as Add, with currency and visibility to pick', () => {
    renderDrawer();
    expect(screen.getByRole('dialog', { name: 'Add budget' })).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Currency' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Visibility' })).toBeTruthy();
    expect(screen.getAllByText('Currency').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Visibility').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'BRL' }).checked).toBe(true);
    // Personal by default — sharing is a choice (OQ-222).
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Personal' }).checked).toBe(true);
    const note = "Currency and visibility can't be changed after the budget is created.";
    expect(screen.getByText(note))
      .toBeTruthy();
  });

  it('emits the typed budget, trimmed, with what is ticked', () => {
    const { onSubmit } = renderDrawer();
    typeName('  Household  ');
    fireEvent.click(screen.getByRole('radio', { name: 'USD' }));
    typeTarget('80000');
    tick('Groceries');
    fireEvent.click(screen.getByRole('button', { name: 'Subcategories of Dining' }));
    tick('Streaming');
    submit();
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Household',
      targetAmount: 80000,
      currency: 'USD',
      visibility: 'personal',
      targets: [{ categoryId: 'Groceries' }, { subcategoryId: 'Streaming' }],
    });
  });

  it('refuses an empty form field by field, and clears each refusal as it is fixed', () => {
    const { onSubmit } = renderDrawer();
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();
    expect(screen.getByText('Enter a monthly target above zero.')).toBeTruthy();
    expect(screen.getByText('Pick at least one category or subcategory.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Budget name' }));

    typeName('Fun');
    typeTarget('100');
    tick('Groceries');
    expect(screen.queryByText('Required.')).toBeNull();
    expect(screen.queryByText('Enter a monthly target above zero.')).toBeNull();
    expect(screen.queryByText('Pick at least one category or subcategory.')).toBeNull();
  });

  it('clears only the refusal of the field changed, refocusing on every refusal', () => {
    renderDrawer();
    submit();
    const name = screen.getByRole('textbox', { name: 'Budget name' });
    screen.getByRole('button', { name: 'Cancel' }).focus();
    submit();
    expect(document.activeElement).toBe(name);
    typeName('Fun');
    expect(screen.getByText('Enter a monthly target above zero.')).toBeTruthy();
    expect(screen.getByText('Pick at least one category or subcategory.')).toBeTruthy();
    typeTarget('100');
    expect(screen.getByText('Pick at least one category or subcategory.')).toBeTruthy();
    tick('Groceries');
    expect(screen.queryByText('Pick at least one category or subcategory.')).toBeNull();
  });

  it('keeps the name and target refusals when only a category is ticked', () => {
    renderDrawer();
    submit();
    tick('Groceries');
    expect(screen.getByText('Required.')).toBeTruthy();
    expect(screen.getByText('Enter a monthly target above zero.')).toBeTruthy();
    expect(screen.queryByText('Pick at least one category or subcategory.')).toBeNull();
  });

  it('refuses a zero target', () => {
    const { onSubmit } = renderDrawer();
    typeName('Fun');
    typeTarget('0');
    tick('Groceries');
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a monthly target above zero.')).toBeTruthy();
  });

  it('weighs claims in the scope its visibility picks, and drops a tick taken there', () => {
    const shared = budget({
      id: 's1', name: 'Home', visibility: 'shared', targets: [{ categoryId: 'Groceries' }],
    });
    const { onSubmit } = renderDrawer({ budgets: [shared] });
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Groceries/ }).disabled)
      .toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'Shared' }));
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Groceries/ }).disabled)
      .toBe(true);
    expect(screen.getByText('in Home')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Personal' }));
    tick('Groceries');
    fireEvent.click(screen.getByRole('radio', { name: 'Shared' }));
    typeName('Mine');
    typeTarget('100');
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Pick at least one category or subcategory.')).toBeTruthy();
  });

  it('locks the visibility at Personal for an actor who can\'t share', () => {
    renderDrawer({ personalOnly: true });
    expect(screen.queryByRole('radio', { name: 'Shared' })).toBeNull();
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('stops the name at 40 characters (OQ-194)', () => {
    renderDrawer();
    const field = screen.getByRole('textbox', { name: 'Budget name' });
    expect(field.getAttribute('maxlength')).toBe('40');
  });
});

describe('editing a budget', () => {
  it('opens as Edit with its fields, currency and visibility locked', () => {
    renderDrawer({ budget: budget() });
    expect(screen.getByRole('dialog', { name: 'Edit budget' })).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Currency')).toBeTruthy();
    expect(screen.getByText('Visibility')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Budget name' }).value)
      .toBe('Fun Money');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
    const held = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Streaming/ });
    expect(held.checked).toBe(true);
  });

  it('emits its fields with the currency and visibility it has', () => {
    const { onSubmit } = renderDrawer({ budget: budget() });
    typeName('Fun');
    tick('Groceries');
    submit();
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Fun',
      targetAmount: 30000,
      currency: 'USD',
      visibility: 'personal',
      targets: [{ categoryId: 'Groceries' }, { subcategoryId: 'Streaming' }],
    });
  });

  it('keeps an archived category it holds, which can be let go', () => {
    const gone = category('Old', [], '2026-09-01T00:00:00Z');
    const { onSubmit } = renderDrawer({
      budget: budget({ targets: [{ categoryId: 'Old' }] }),
      categories: [...CATEGORIES, gone],
    });
    expect(screen.getByText('all subcategories · archived')).toBeTruthy();
    tick('Old');
    tick('Groceries');
    submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      targets: [{ categoryId: 'Groceries' }],
    }));
  });
});

describe('its frame', () => {
  it('shows the server\'s objection in its banner', () => {
    renderDrawer({ alert: 'Groceries was just added to Home.' });
    expect(screen.getByText('Groceries was just added to Home.')).toBeTruthy();
  });

  it('closes on Cancel', () => {
    const { onCancel } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('spins its own submit while out, and only waits for another request', () => {
    renderDrawer({ busy: true, disabled: true });
    const own = screen.getByRole<HTMLButtonElement>('button', { name: 'Create budget' });
    expect(own.getAttribute('aria-busy')).toBe('true');
    expect(own.disabled).toBe(false);
    cleanup();
    renderDrawer({ disabled: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create budget' }).disabled)
      .toBe(true);
  });

  it('waits while a request is out: Cancel and the rows too', () => {
    renderDrawer({ disabled: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Groceries/ }).disabled)
      .toBe(true);
  });
});

describe('its delete zone (OQ-194)', () => {
  /**
   * Finds the danger zone.
   *
   * @returns The zone.
   */
  const zone = () => screen.getByRole('region', { name: 'Delete this budget' });

  it('is only on an edit', () => {
    renderDrawer();
    expect(screen.queryByRole('region', { name: 'Delete this budget' })).toBeNull();
  });

  it('asks for the confirm, then deletes or steps back', () => {
    const closed = renderDrawer({ budget: budget() });
    fireEvent.click(within(zone()).getByRole('button', { name: 'Delete' }));
    expect(closed.onOpenDelete).toHaveBeenCalled();
    cleanup();

    const open = renderDrawer({ budget: budget(), deleteConfirmOpen: true });
    expect(within(zone()).getByText("Delete Fun Money? This can't be undone.")).toBeTruthy();
    expect(within(zone()).getByText(/Its categories become free/)).toBeTruthy();
    fireEvent.click(within(zone()).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(zone()).getByRole('button', { name: 'Cancel' }));
    expect(open.onDelete).toHaveBeenCalled();
    expect(open.onCloseDelete).toHaveBeenCalled();
  });

  it('spins its confirm while the delete is out, and waits while another request is', () => {
    renderDrawer({
      budget: budget(), deleteConfirmOpen: true, deleteBusy: true, disabled: true,
    });
    expect(within(zone()).getByRole('button', { name: 'Delete' }).getAttribute('aria-busy'))
      .toBe('true');
    cleanup();

    renderDrawer({ budget: budget(), disabled: true });
    expect(within(zone()).getByRole<HTMLButtonElement>('button', { name: 'Delete' }).disabled)
      .toBe(true);
  });
});
