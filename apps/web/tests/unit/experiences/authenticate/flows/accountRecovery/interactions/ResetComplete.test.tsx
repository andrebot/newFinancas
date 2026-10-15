import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { ResetComplete } from '../../../../../../../src/experiences/authenticate/flows/accountRecovery/interactions/ResetComplete';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handler is a stand-in.

describe('ResetComplete', () => {
  it('says the password changed and focuses the way on', () => {
    renderInLocale(<ResetComplete onSignIn={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Password updated' })).toBeTruthy();
    expect(screen.getByText('Sign in with your new password.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sign in' }));
  });

  it('emits signing in', () => {
    const onSignIn = vi.fn();
    renderInLocale(<ResetComplete onSignIn={onSignIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('speaks pt-BR', () => {
    renderInLocale(<ResetComplete onSignIn={vi.fn()} />, 'pt-BR');

    expect(screen.getByRole('heading', { name: 'Senha atualizada' })).toBeTruthy();
  });
});
