import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  CredentialEntry, type CredentialEntryProps,
} from '../../../../../../../src/experiences/authenticate/flows/signIn/interactions/CredentialEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handlers are stand-ins.

/**
 * Renders the entry with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderEntry = (props: Partial<CredentialEntryProps> = {}) => {
  const handlers = {
    onSubmit: vi.fn(), onForgotPassword: vi.fn(), onCreateAccount: vi.fn(),
  };
  renderInLocale(<CredentialEntry defaultEmail="" busy={false} {...handlers} {...props} />);
  return handlers;
};

const emailInput = () => screen.getByLabelText<HTMLInputElement>('Email');
const passwordInput = () => screen.getByLabelText<HTMLInputElement>('Password');
const signIn = () => screen.getByRole('button', { name: 'Sign in' });

/**
 * Types into both fields.
 *
 * @param email - The address.
 * @param password - The password.
 */
const typeCredentials = (email: string, password: string) => {
  fireEvent.change(emailInput(), { target: { value: email } });
  fireEvent.change(passwordInput(), { target: { value: password } });
};

describe('CredentialEntry', () => {
  it("renders mockup 01's heading and fields, focusing the empty email", () => {
    renderEntry();

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeTruthy();
    expect(emailInput().value).toBe('');
    expect(emailInput().autocomplete).toBe('username');
    expect(passwordInput().type).toBe('password');
    expect(passwordInput().autocomplete).toBe('current-password');
    expect(document.activeElement).toBe(emailInput());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('starts from the email given and then focuses the password', () => {
    renderEntry({ defaultEmail: 'ana@example.com' });

    expect(emailInput().value).toBe('ana@example.com');
    expect(document.activeElement).toBe(passwordInput());
  });

  it('emits the trimmed email and the password', () => {
    const { onSubmit } = renderEntry();
    typeCredentials('  ana@example.com ', 'correct horse');

    fireEvent.click(signIn());

    expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'correct horse' });
  });

  it('shows what is missing or malformed, and emits nothing', () => {
    const { onSubmit } = renderEntry();

    fireEvent.click(signIn());
    expect(screen.getAllByText('Required.')).toHaveLength(2);

    typeCredentials('ana@', 'x');
    fireEvent.click(signIn());
    expect(screen.getByText('Enter a valid email.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("drops a field's error once it is typed in", () => {
    renderEntry();
    fireEvent.click(signIn());

    fireEvent.change(passwordInput(), { target: { value: 'x' } });

    expect(screen.getAllByText('Required.')).toHaveLength(1);
    expect(passwordInput().getAttribute('aria-invalid')).toBeNull();
  });

  it('shows the last failure in an error banner', () => {
    renderEntry({ alert: 'Invalid email or password.' });

    expect(screen.getByRole('alert').textContent).toContain('Invalid email or password.');
  });

  it('spins and emits nothing while a request is out', () => {
    const { onSubmit } = renderEntry({ busy: true });
    typeCredentials('ana@example.com', 'correct horse');

    fireEvent.click(signIn());
    fireEvent.submit(signIn().closest('form') as HTMLFormElement);

    expect(signIn().getAttribute('aria-busy')).toBe('true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('emits the ways out', () => {
    const { onForgotPassword, onCreateAccount } = renderEntry();

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });

  it('speaks pt-BR', () => {
    renderInLocale(
      <CredentialEntry
        defaultEmail=""
        busy={false}
        onSubmit={vi.fn()}
        onForgotPassword={vi.fn()}
        onCreateAccount={vi.fn()}
      />,
      'pt-BR',
    );

    expect(screen.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });
});
