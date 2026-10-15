import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRegistrationText } from '../../../../../../../src/experiences/onboard/flows/registration/interactions/registrationText';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Registration's text hook (BDT: unit): the real translator, nothing mocked.

/**
 * Shows one `registration` text, to exercise the hook.
 *
 * @returns The title.
 */
function Title() {
  const text = useRegistrationText();
  return <span>{text('title')}</span>;
}

describe('useRegistrationText', () => {
  it('reads the registration section in the current locale', () => {
    renderInLocale(<Title />, 'pt-BR');

    expect(screen.getByText('Crie sua conta')).toBeTruthy();
  });
});
