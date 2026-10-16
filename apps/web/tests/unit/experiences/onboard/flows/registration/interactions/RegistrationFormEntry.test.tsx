import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  RegistrationFormEntry, type RegistrationFormEntryProps,
} from '../../../../../../../src/experiences/onboard/flows/registration/interactions/RegistrationFormEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import submitForm from '../../../../../../support/submitForm';

// Interaction (BDT: unit, display state in, events out): the real kit,
// translator and strength estimator (a Utility, not a boundary); only the
// Flow's handlers are stand-ins.

/**
 * Renders the entry with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers and the render result.
 */
const renderEntry = (props: Partial<RegistrationFormEntryProps> = {}) => {
  const onSubmit = vi.fn();
  const onSignIn = vi.fn();
  const view = renderInLocale(
    <RegistrationFormEntry busy={false} onSubmit={onSubmit} onSignIn={onSignIn} {...props} />,
  );
  return { onSubmit, onSignIn, ...view };
};

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const createAccount = () => screen.getByRole('button', { name: 'Create account' });

/**
 * Types into a field.
 *
 * @param label - The field's label.
 * @param value - What to type.
 */
const type = (label: string, value: string) => {
  fireEvent.change(input(label), { target: { value } });
};

const STRONG = 'velvet-orbit-cactus-71';

/**
 * Fills every field with a valid value; the names and email padded with spaces.
 */
const fillValid = () => {
  type('First name', ' Ana ');
  type('Last name', ' Silva ');
  type('Email', ' ana@example.com ');
  type('Password', STRONG);
  type('Confirm password', STRONG);
};

describe('RegistrationFormEntry', () => {
  it("renders mockup 02's heading and fields, focusing the first name", () => {
    renderEntry();

    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeTruthy();
    expect(input('First name').autocomplete).toBe('given-name');
    expect(input('Last name').autocomplete).toBe('family-name');
    expect(input('Email').type).toBe('email');
    expect(input('Password').autocomplete).toBe('new-password');
    expect(input('Confirm password').autocomplete).toBe('new-password');
    expect(document.activeElement).toBe(input('First name'));
  });

  it('has no terms box (OQ-148)', () => {
    renderEntry();

    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('names each eye button after its field', () => {
    renderEntry();

    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show confirmation' })).toBeTruthy();
  });

  it('emits the registration with names and email trimmed', () => {
    const { onSubmit } = renderEntry();
    fillValid();

    fireEvent.click(createAccount());

    expect(onSubmit).toHaveBeenCalledWith({
      firstName: 'Ana', lastName: 'Silva', email: 'ana@example.com', password: STRONG,
    });
  });

  it('requires every field; a name of only spaces counts as empty', () => {
    const { onSubmit } = renderEntry();
    type('First name', '   ');

    fireEvent.click(createAccount());

    expect(screen.getAllByText('Required.')).toHaveLength(5);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a malformed email, a short password and a confirmation that differs', () => {
    const { onSubmit } = renderEntry();
    type('First name', 'Ana');
    type('Last name', 'Silva');
    type('Email', 'ana@');
    type('Password', 'short');
    type('Confirm password', 'shorter');

    fireEvent.click(createAccount());

    expect(screen.getByText('Enter a valid email.')).toBeTruthy();
    expect(screen.getByText('Use at least 12 characters.')).toBeTruthy();
    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("drops a field's error once it is typed in", () => {
    renderEntry();
    fireEvent.click(createAccount());

    type('Last name', 'Silva');

    expect(screen.getAllByText('Required.')).toHaveLength(4);
  });

  it("shows the server's objections under the email and password", () => {
    renderEntry({
      emailError: 'An account with this email already exists.',
      passwordError: 'Password must be at least 12 characters.',
    });

    expect(screen.getByText('An account with this email already exists.')).toBeTruthy();
    expect(screen.getByText('Password must be at least 12 characters.')).toBeTruthy();
  });

  it("lets the field's own check replace the server's objection", () => {
    renderEntry({ emailError: 'An account with this email already exists.' });

    fireEvent.click(createAccount());

    expect(screen.queryByText('An account with this email already exists.')).toBeNull();
  });

  it('shows the last failure in an error banner', () => {
    renderEntry({ alert: "Couldn't connect. Check your connection and try again." });

    expect(screen.getByRole('alert').textContent).toContain("Couldn't connect.");
  });

  it('spins and emits nothing while a request is out', () => {
    const { onSubmit } = renderEntry({ busy: true });
    fillValid();

    submitForm(createAccount());

    expect(createAccount().getAttribute('aria-busy')).toBe('true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rates the password against the name and email typed, once rated', async () => {
    renderEntry();
    type('First name', 'Marcelina');
    type('Email', 'marcelina@example.com');

    type('Password', 'marcelina2026');

    expect(await screen.findByText(/^Weak · /, {}, { timeout: 5000 })).toBeTruthy();
  });

  it('goes to sign in instead', () => {
    const { onSignIn } = renderEntry();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('speaks pt-BR', () => {
    renderInLocale(
      <RegistrationFormEntry busy={false} onSubmit={vi.fn()} onSignIn={vi.fn()} />,
      'pt-BR',
    );

    expect(screen.getByRole('heading', { name: 'Crie sua conta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeTruthy();
  });
});
