import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHouseholdSetupText } from '../../../../../../../src/experiences/onboard/flows/householdSetup/interactions/householdSetupText';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Household Setup's text hook (BDT: unit): the real translator, nothing mocked.

/**
 * Shows one `householdSetup` text, to exercise the hook.
 *
 * @returns The title.
 */
function Title() {
  const text = useHouseholdSetupText();
  return <span>{text('title')}</span>;
}

describe('useHouseholdSetupText', () => {
  it('reads the householdSetup section in the current locale', () => {
    renderInLocale(<Title />, 'pt-BR');

    expect(screen.getByText('Dê um nome à sua casa')).toBeTruthy();
  });
});
