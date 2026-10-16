import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  RecoveryRequest, type RecoveryRequestProps,
} from '../../../../../../../src/experiences/authenticate/flows/accountRecovery/interactions/RecoveryRequest';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import submitForm from '../../../../../../support/submitForm';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handlers are stand-ins.

/**
 * Renders the entry with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderEntry = (props: Partial<RecoveryRequestProps> = {}) => {
  const handlers = { onSubmit: vi.fn(), onBackToSignIn: vi.fn() };
  renderInLocale(<RecoveryRequest busy={false} linkRequested={false} {...handlers} {...props} />);
  return handlers;
};

const emailInput = () => screen.getByLabelText<HTMLInputElement>('Email');
const send = () => screen.getByRole('button', { name: 'Send reset link' });

/**
 * Types an address.
 *
 * @param value - The address.
 */
const typeEmail = (value: string) => fireEvent.change(emailInput(), { target: { value } });

describe('RecoveryRequest', () => {
  it("renders mockup 03's heading and field, focusing the email, no note yet", () => {
    renderEntry();

    expect(screen.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeTruthy();
    expect(emailInput().autocomplete).toBe('username');
    expect(document.activeElement).toBe(emailInput());
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('emits the trimmed email', () => {
    const { onSubmit } = renderEntry();
    typeEmail('  ana@example.com ');

    fireEvent.click(send());

    expect(onSubmit).toHaveBeenCalledWith('ana@example.com');
  });

  it('shows what is missing or malformed, and emits nothing', () => {
    const { onSubmit } = renderEntry();

    fireEvent.click(send());
    expect(screen.getByText('Required.')).toBeTruthy();

    typeEmail('ana@');
    expect(screen.queryByText('Required.')).toBeNull();
    fireEvent.click(send());
    expect(screen.getByText('Enter a valid email.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the inbox note once a link was asked for, never naming the account', () => {
    renderEntry({ linkRequested: true });

    const note = screen.getByRole('status').textContent;
    expect(note).toContain('Check your inbox');
    expect(note).toContain('If an account exists for that email');
  });

  it('shows the last failure in an error banner', () => {
    renderEntry({ alert: 'This reset link is invalid or has expired.' });

    expect(screen.getByRole('alert').textContent)
      .toContain('This reset link is invalid or has expired.');
  });

  it('spins and emits nothing while a request is out', () => {
    const { onSubmit } = renderEntry({ busy: true });
    typeEmail('ana@example.com');

    submitForm(send());

    expect(send().getAttribute('aria-busy')).toBe('true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('goes back to sign in from the arrow and from the link', () => {
    const { onBackToSignIn } = renderEntry();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));

    expect(onBackToSignIn).toHaveBeenCalledTimes(2);
  });

  it('speaks pt-BR', () => {
    renderInLocale(
      <RecoveryRequest busy={false} linkRequested onSubmit={vi.fn()} onBackToSignIn={vi.fn()} />,
      'pt-BR',
    );

    expect(screen.getByRole('heading', { name: 'Redefina sua senha' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Confira sua caixa de entrada');
  });
});
