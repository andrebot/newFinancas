import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  PasswordChange, type PasswordChangeProps,
} from '../../../../../../../src/experiences/manageProfile/flows/security/interactions/PasswordChange';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit,
// translator and strength estimator (a Utility, not a boundary); only the
// Flow's handler is a stand-in.

/**
 * Renders the form with a stand-in handler, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handler.
 */
const renderForm = (props: Partial<PasswordChangeProps> = {}) => {
  const onSubmit = vi.fn();
  renderInLocale(<PasswordChange busy={false} onSubmit={onSubmit} {...props} />);
  return onSubmit;
};

const currentInput = () => screen.getByLabelText<HTMLInputElement>('Current password');
const newInput = () => screen.getByLabelText<HTMLInputElement>('New password');
const confirmInput = () => screen.getByLabelText<HTMLInputElement>('Confirm new password');
const submitButton = () => screen.getByRole('button', { name: 'Change Password' });

/**
 * Types into the three fields.
 *
 * @param current - The current password.
 * @param password - The new one.
 * @param confirmation - Its repeat.
 */
const typeAll = (current: string, password: string, confirmation: string) => {
  fireEvent.change(currentInput(), { target: { value: current } });
  fireEvent.change(newInput(), { target: { value: password } });
  fireEvent.change(confirmInput(), { target: { value: confirmation } });
};

const STRONG = 'velvet-orbit-cactus-71';

describe('PasswordChange', () => {
  it("renders mockup 70's panel: heading, three fields, note and button", () => {
    renderForm();

    expect(screen.getByRole('heading', { level: 2, name: 'Change password' })).toBeTruthy();
    expect(currentInput().autocomplete).toBe('current-password');
    expect(newInput().autocomplete).toBe('new-password');
    expect(confirmInput().autocomplete).toBe('new-password');
    expect(screen.getByText('Signs you out of every other session — not this one.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show current password' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show new password' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show confirmation' })).toBeTruthy();
  });

  it('emits the change when every field passes', () => {
    const onSubmit = renderForm();
    typeAll('old-password-1', STRONG, STRONG);

    fireEvent.click(submitButton());

    expect(onSubmit).toHaveBeenCalledWith({
      currentPassword: 'old-password-1', newPassword: STRONG,
    });
  });

  it('flags each field that fails, emitting nothing, and clears a flag on typing', () => {
    const onSubmit = renderForm();
    typeAll('', 'short', 'other');

    fireEvent.click(submitButton());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();
    expect(screen.getByText('Use at least 12 characters.')).toBeTruthy();
    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    fireEvent.change(currentInput(), { target: { value: 'x' } });
    expect(screen.queryByText('Required.')).toBeNull();
  });

  it("shows the server's objections under their fields and other failures in a banner", () => {
    renderForm({
      currentError: 'Your current password is incorrect.',
      passwordError: 'Too short.',
      alert: "Couldn't connect.",
    });

    expect(screen.getByText('Your current password is incorrect.')).toBeTruthy();
    expect(screen.getByText('Too short.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain("Couldn't connect.");
  });

  it('ignores a submit while the change is out', () => {
    const onSubmit = renderForm({ busy: true });
    typeAll('old-password-1', STRONG, STRONG);

    fireEvent.submit(submitButton().closest('form') as HTMLFormElement);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(submitButton().getAttribute('aria-busy')).toBe('true');
  });

  it('shows the strength meter once something is typed and the estimator has loaded', async () => {
    renderForm();
    expect(screen.queryByText(/at least 12 characters/)).toBeNull();

    fireEvent.change(newInput(), { target: { value: 'short' } });

    expect(await screen.findByText('Too short · at least 12 characters', {}, { timeout: 5000 }))
      .toBeTruthy();
  });
});
