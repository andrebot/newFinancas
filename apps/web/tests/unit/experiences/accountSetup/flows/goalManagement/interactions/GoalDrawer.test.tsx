import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { Goal } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  GoalDrawer, initialFieldsOf, objectionsOf, type GoalDrawerProps, type GoalSteps,
} from '../../../../../../../src/experiences/accountSetup/flows/goalManagement/interactions/GoalDrawer';
import { createTranslator } from '../../../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The goal drawer — the Goal Form (BDT: Interaction, unit): the real kit and
// translator; only the Flow's handlers are stand-ins. One form for Add and
// Edit (OQ-177): the visibility picks on Add and locks on Edit; the target
// currency stays editable; a past due date is allowed. On Edit it holds the
// goal's steps — complete or reopen, and delete — each behind its confirm (OQ-195).

const translator = createTranslator('en-US');

/**
 * Builds a goal.
 *
 * @param over - The fields to override.
 * @returns The goal.
 */
const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'trip',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Trip to Japan',
  targetAmount: 600000,
  targetCurrency: 'USD',
  dueDate: '2028-04-01',
  visibility: 'personal',
  createdAt: '2026-10-01T00:00:00Z',
  completedAt: null,
  ...over,
});

/**
 * Renders the drawer with stand-in handlers.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderDrawer = (props: Partial<GoalDrawerProps> = {}) => {
  const handlers = { onSubmit: vi.fn(), onCancel: vi.fn() };
  renderInLocale(
    <GoalDrawer personalOnly={false} busy={false} disabled={false} {...handlers} {...props} />,
  );
  return handlers;
};

/**
 * Types into a masked input as a user would: the whole new text, caret at the end.
 *
 * @param name - The field's label.
 * @param text - Its text after the edit.
 */
const typeMasked = (name: string, text: string) => {
  const input = screen.getByRole<HTMLInputElement>('textbox', { name });
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

/**
 * Types the name.
 *
 * @param name - The text.
 */
const typeName = (name: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Goal name' }), { target: { value: name } });
};

/** Presses the drawer's submit, whatever its mode. */
const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: /Create goal|Save changes/ }));
};

describe('objectionsOf', () => {
  it('refuses a blank name, a missing or zero target and a missing or malformed date', () => {
    expect(objectionsOf(' ', null, '', translator)).toEqual({
      name: 'Required.', target: 'Enter a target above zero.', dueDate: 'Required.',
    });
    expect(objectionsOf('Trip', 0, '2026-02-30', translator)).toEqual({
      name: undefined, target: 'Enter a target above zero.', dueDate: 'Enter a valid date.',
    });
  });

  it('passes a filled form, a past due date included (OQ-177)', () => {
    expect(objectionsOf('Trip', 1, '2001-01-01', translator)).toEqual({
      name: undefined, target: undefined, dueDate: undefined,
    });
  });
});

describe('initialFieldsOf', () => {
  it('opens a create empty, in BRL, shared — or personal for an actor who can\'t share', () => {
    expect(initialFieldsOf(undefined, false)).toEqual({
      name: '', currency: 'BRL', visibility: 'shared', target: null, dueDate: '',
    });
    expect(initialFieldsOf(undefined, true).visibility).toBe('personal');
  });

  it('opens an edit with the goal\'s fields', () => {
    expect(initialFieldsOf(goal(), false)).toEqual({
      name: 'Trip to Japan',
      currency: 'USD',
      visibility: 'personal',
      target: 600000,
      dueDate: '2028-04-01',
    });
  });
});

describe('adding a goal', () => {
  it('opens as Add, with currency and visibility to pick and the funding note', () => {
    renderDrawer();
    expect(screen.getByRole('dialog', { name: 'Add goal' })).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getAllByText('Target currency').length).toBeGreaterThan(0);
    expect(screen.getByRole('radiogroup', { name: 'Target currency' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Visibility' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'BRL' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Shared' }).checked).toBe(true);
    expect(screen.getByText(translator.text('goalManagement', 'fundNote'))).toBeTruthy();
    expect(screen.queryByText(translator.text('goalManagement', 'lockedNote'))).toBeNull();
  });

  it('emits the typed goal, its name trimmed', () => {
    const { onSubmit } = renderDrawer();
    typeName('  Trip  ');
    fireEvent.click(screen.getByRole('radio', { name: 'USD' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Personal' }));
    typeMasked('Target amount', '600000');
    typeMasked('Due date', '04/01/2028');
    submit();
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Trip',
      targetAmount: 600000,
      targetCurrency: 'USD',
      dueDate: '2028-04-01',
      visibility: 'personal',
    });
  });

  it('refuses an empty form field by field, and clears each refusal as it is fixed', () => {
    const { onSubmit } = renderDrawer();
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText('Required.')).toHaveLength(2);
    expect(screen.getByText('Enter a target above zero.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Goal name' }));

    typeName('Trip');
    typeMasked('Target amount', '100');
    typeMasked('Due date', '04/01/2028');
    expect(screen.queryByText('Required.')).toBeNull();
    expect(screen.queryByText('Enter a target above zero.')).toBeNull();
  });

  it('clears only the refusal of the field changed', () => {
    renderDrawer();
    submit();
    typeName('Trip');
    expect(screen.getAllByText('Required.')).toHaveLength(1);
    expect(screen.getByText('Enter a target above zero.')).toBeTruthy();
  });

  it('refuses a form with any single field wrong, refocusing it every time', () => {
    const { onSubmit } = renderDrawer();
    typeMasked('Target amount', '100');
    typeMasked('Due date', '04/01/2028');
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    const name = screen.getByRole('textbox', { name: 'Goal name' });
    expect(document.activeElement).toBe(name);
    screen.getByRole('button', { name: 'Cancel' }).focus();
    submit();
    expect(document.activeElement).toBe(name);
  });

  it('locks the visibility at Personal for an actor who can\'t share', () => {
    renderDrawer({ personalOnly: true });
    expect(screen.queryByRole('radio', { name: 'Shared' })).toBeNull();
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('stops the name at 40 characters (OQ-195)', () => {
    renderDrawer();
    expect(screen.getByRole('textbox', { name: 'Goal name' }).getAttribute('maxlength'))
      .toBe('40');
  });
});

describe('editing a goal', () => {
  it('opens as Edit with its fields, the visibility locked, the currency still to pick', () => {
    renderDrawer({ goal: goal() });
    expect(screen.getByRole('dialog', { name: 'Edit goal' })).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Goal name' }).value)
      .toBe('Trip to Japan');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'USD' }).checked).toBe(true);
    expect(screen.queryByRole('radio', { name: 'Personal' })).toBeNull();
    expect(screen.getByText(translator.text('goalManagement', 'lockedNote'))).toBeTruthy();
    expect(screen.queryByText(translator.text('goalManagement', 'fundNote'))).toBeNull();
  });

  it('emits its fields with a changed currency and the visibility it has', () => {
    const { onSubmit } = renderDrawer({ goal: goal() });
    fireEvent.click(screen.getByRole('radio', { name: 'BRL' }));
    submit();
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Trip to Japan',
      targetAmount: 600000,
      targetCurrency: 'BRL',
      dueDate: '2028-04-01',
      visibility: 'personal',
    });
  });
});

describe('the drawer', () => {
  it('shows the server\'s objection in its banner', () => {
    renderDrawer({ alert: 'Something broke.' });
    expect(screen.getByText('Something broke.')).toBeTruthy();
  });

  it('closes on Cancel', () => {
    const { onCancel } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('waits while a request is out, its own submit spinning', () => {
    renderDrawer({ busy: true, disabled: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    const own = screen.getByRole<HTMLButtonElement>('button', { name: 'Create goal' });
    expect(own.getAttribute('aria-busy')).toBe('true');
    expect(own.disabled).toBe(false);
  });

  it('waits, not spinning, while another request is out', () => {
    renderDrawer({ busy: false, disabled: true });
    const own = screen.getByRole<HTMLButtonElement>('button', { name: 'Create goal' });
    expect(own.disabled).toBe(true);
    expect(own.hasAttribute('aria-busy')).toBe(false);
  });
});

/**
 * Builds the edit drawer's steps with stand-in handlers.
 *
 * @param over - The fields to override.
 * @returns The steps.
 */
const steps = (over: Partial<GoalSteps> = {}): GoalSteps => ({
  busy: false, onAsk: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn(), ...over,
});

describe('its steps (OQ-195)', () => {
  it('are only on an edit', () => {
    renderDrawer({ steps: steps() });
    expect(screen.queryByRole('button', { name: 'Mark completed' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('offer Mark completed on an active goal and Reopen on a completed one', () => {
    const active = steps();
    renderDrawer({ goal: goal(), steps: active });
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));
    expect(active.onAsk).toHaveBeenCalledWith('complete');
    cleanup();

    const completed = steps();
    renderDrawer({ goal: goal({ completedAt: '2026-10-10T00:00:00Z' }), steps: completed });
    expect(screen.getByText('Reopen this goal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(completed.onAsk).toHaveBeenCalledWith('reopen');
  });

  it('asks before completing, then confirms or steps back', () => {
    const open = steps({ confirm: 'complete' });
    renderDrawer({ goal: goal(), steps: open });
    expect(screen.getByText(/Mark Trip to Japan as completed\?/)).toBeTruthy();
    expect(screen.getByText(/moves to the Completed list/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Mark completed' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Mark completed' }).className).toContain('bg-mint');
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));
    expect(open.onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]!);
    expect(open.onCancel).toHaveBeenCalled();
  });

  it('keeps Delete in the danger zone, behind its own confirm', () => {
    const closed = steps();
    renderDrawer({ goal: goal(), steps: closed });
    expect(screen.getByRole('region', { name: 'Delete this goal' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(closed.onAsk).toHaveBeenCalledWith('delete');
    cleanup();

    const open = steps({ confirm: 'delete' });
    renderDrawer({ goal: goal(), steps: open });
    expect(screen.getByText(/Delete Trip to Japan\? Its holdings stay/)).toBeTruthy();
    expect(screen.getByText(/No history is kept/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-coral');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(open.onConfirm).toHaveBeenCalled();
  });

  it('wait while a request is out', () => {
    renderDrawer({ goal: goal(), steps: steps(), disabled: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Mark completed' }).disabled)
      .toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Delete' }).disabled).toBe(true);
  });
});
