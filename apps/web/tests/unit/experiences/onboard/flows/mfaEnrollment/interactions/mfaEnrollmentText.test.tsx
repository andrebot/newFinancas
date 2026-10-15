import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMfaEnrollmentText } from '../../../../../../../src/experiences/onboard/flows/mfaEnrollment/interactions/mfaEnrollmentText';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// MFA Enrollment's text hook (BDT: unit): the real translator, nothing mocked.

/**
 * Shows two `mfaEnrollment` texts — one with a param — to exercise the hook.
 *
 * @returns The title and the account line.
 */
function Texts() {
  const text = useMfaEnrollmentText();
  return (
    <>
      <span>{text('method.title')}</span>
      <span>{text('setup.account', { email: 'ana@example.com' })}</span>
    </>
  );
}

describe('useMfaEnrollmentText', () => {
  it('reads the mfaEnrollment section in the current locale, with params', () => {
    renderInLocale(<Texts />, 'pt-BR');

    expect(screen.getByText('Proteja sua conta')).toBeTruthy();
    expect(screen.getByText('Conta: ana@example.com')).toBeTruthy();
  });
});
