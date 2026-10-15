import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAccountRecoveryText } from '../../../../../../../src/experiences/authenticate/flows/accountRecovery/interactions/accountRecoveryText';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Account Recovery's text hook (BDT: unit): the real translator, nothing mocked.

/**
 * Shows one `accountRecovery` text, to exercise the hook.
 *
 * @returns The request title.
 */
function RequestTitle() {
  const text = useAccountRecoveryText();
  return <span>{text('request.title')}</span>;
}

describe('useAccountRecoveryText', () => {
  it('reads the accountRecovery section in the current locale', () => {
    renderInLocale(<RequestTitle />, 'pt-BR');

    expect(screen.getByText('Redefina sua senha')).toBeTruthy();
  });
});
