import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  NewPasswordEntry, type NewPasswordEntryProps,
} from '../../../../../../../src/experiences/authenticate/flows/accountRecovery/interactions/NewPasswordEntry';
import { loadPasswordStrengthEstimator } from '../../../../../../../src/utilities/passwordStrength';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import submitForm from '../../../../../../support/submitForm';

// Interaction (BDT: unit, display state in, events out): the real kit,
// translator and strength estimator (a Utility, not a boundary); only the
// Flow's handler is a stand-in.

/**
 * Renders the entry with a stand-in handler, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handler and the render result.
 */
const renderEntry = (props: Partial<NewPasswordEntryProps> = {}) => {
  const onSubmit = vi.fn();
  const view = renderInLocale(<NewPasswordEntry busy={false} onSubmit={onSubmit} {...props} />);
  return { onSubmit, ...view };
};

const passwordInput = () => screen.getByLabelText<HTMLInputElement>('New password');
const confirmationInput = () => screen.getByLabelText<HTMLInputElement>('Confirm new password');
const reset = () => screen.getByRole('button', { name: 'Reset password' });

/**
 * Types into both fields.
 *
 * @param password - The new password.
 * @param confirmation - Its repeat.
 */
const typePasswords = (password: string, confirmation: string) => {
  fireEvent.change(passwordInput(), { target: { value: password } });
  fireEvent.change(confirmationInput(), { target: { value: confirmation } });
};

const STRONG = 'velvet-orbit-cactus-71';

describe('NewPasswordEntry', () => {
  it("renders mockup 04's heading, fields and notice, focusing the new password", () => {
    renderEntry();

    expect(screen.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeTruthy();
    expect(passwordInput().type).toBe('password');
    expect(passwordInput().autocomplete).toBe('new-password');
    expect(confirmationInput().autocomplete).toBe('new-password');
    expect(document.activeElement).toBe(passwordInput());
    expect(screen.getByText("You'll be signed out on every device.")).toBeTruthy();
  });

  it('names each eye button after its field', () => {
    renderEntry();

    expect(screen.getByRole('button', { name: 'Show new password' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show confirmation' })).toBeTruthy();
  });

  it('emits the password when both fields agree', () => {
    const { onSubmit } = renderEntry();
    typePasswords(STRONG, STRONG);

    fireEvent.click(reset());

    expect(onSubmit).toHaveBeenCalledWith(STRONG);
  });

  it('requires both fields', () => {
    const { onSubmit } = renderEntry();

    fireEvent.click(reset());

    expect(screen.getAllByText('Required.')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a password under 12 characters and a confirmation that differs', () => {
    const { onSubmit } = renderEntry();
    typePasswords('short', 'shorter');

    fireEvent.click(reset());

    expect(screen.getByText('Use at least 12 characters.')).toBeTruthy();
    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("drops a field's error once it is typed in", () => {
    renderEntry();
    fireEvent.click(reset());

    fireEvent.change(confirmationInput(), { target: { value: 'x' } });

    expect(screen.getAllByText('Required.')).toHaveLength(1);
  });

  it("shows the server's objection under the password until its own check replaces it", () => {
    renderEntry({ passwordError: 'Password must be at least 12 characters.' });
    expect(screen.getByText('Password must be at least 12 characters.')).toBeTruthy();

    fireEvent.click(reset());

    expect(screen.queryByText('Password must be at least 12 characters.')).toBeNull();
    expect(screen.getAllByText('Required.')).toHaveLength(2);
  });

  it('shows the last failure in an error banner', () => {
    renderEntry({ alert: "Couldn't connect. Check your connection and try again." });

    expect(screen.getByRole('alert').textContent).toContain("Couldn't connect.");
  });

  it('spins and emits nothing while a request is out', () => {
    const { onSubmit } = renderEntry({ busy: true });
    typePasswords(STRONG, STRONG);

    submitForm(reset());

    expect(reset().getAttribute('aria-busy')).toBe('true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the strength meter once something is typed and the estimator has loaded', async () => {
    renderEntry();
    expect(screen.queryByText(/at least 12 characters/)).toBeNull();

    fireEvent.change(passwordInput(), { target: { value: 'short' } });

    expect(await screen.findByText('Too short · at least 12 characters', {}, { timeout: 5000 }))
      .toBeTruthy();
  });

  it('drops the estimator when unmounted before it has loaded', async () => {
    const { unmount } = renderEntry();

    unmount();
    await act(async () => {
      await loadPasswordStrengthEstimator();
    });

    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('speaks pt-BR', () => {
    renderInLocale(<NewPasswordEntry busy={false} onSubmit={vi.fn()} />, 'pt-BR');

    expect(screen.getByRole('heading', { name: 'Escolha uma nova senha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeTruthy();
  });
});
