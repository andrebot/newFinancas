import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSignInText } from '../../../../../../../src/experiences/authenticate/flows/signIn/interactions/signInText';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Sign In's text hook (BDT: unit): the real translator, nothing mocked.

/**
 * Shows one `signIn` text, to exercise the hook.
 *
 * @returns The back label.
 */
function BackLabel() {
  const text = useSignInText();
  return <span>{text('back')}</span>;
}

describe('useSignInText', () => {
  it('reads the signIn section in the current locale', () => {
    renderInLocale(<BackLabel />, 'pt-BR');

    expect(screen.getByText('Voltar')).toBeTruthy();
  });
});
