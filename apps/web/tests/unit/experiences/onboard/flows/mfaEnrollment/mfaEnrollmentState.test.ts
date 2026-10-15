import { describe, expect, it } from 'vitest';
import {
  afterConfirm, backToMethod, INITIAL_MFA_ENROLLMENT, methodChosen, submitting,
  type MfaEnrollmentState,
} from '../../../../../../src/experiences/onboard/flows/mfaEnrollment/mfaEnrollmentState';

// The Flow's pure transitions (BDT: unit, nothing to mock).

const SETUP: MfaEnrollmentState = { ...INITIAL_MFA_ENROLLMENT, step: 'setup' };
const WRONG_CODE = { code: 'auth.mfa_invalid' };

describe('mfaEnrollmentState', () => {
  it('opens on the method step with the first configured method', () => {
    expect(INITIAL_MFA_ENROLLMENT).toEqual({
      step: 'method', method: 'authenticator', busy: false, error: undefined, attempt: 0,
    });
  });

  it('moves to setup with the method chosen, and back keeping it, banner cleared', () => {
    const chosen = methodChosen(INITIAL_MFA_ENROLLMENT, 'authenticator');
    expect(chosen).toMatchObject({ step: 'setup', method: 'authenticator' });

    expect(backToMethod({ ...chosen, error: WRONG_CODE }))
      .toMatchObject({ step: 'method', method: 'authenticator', error: undefined });
  });

  it('is busy while the confirmation is out, with the last failure cleared', () => {
    expect(submitting({ ...SETUP, error: WRONG_CODE }))
      .toMatchObject({ busy: true, error: undefined });
  });

  it('shows the backup codes once confirmed', () => {
    expect(afterConfirm(submitting(SETUP), { ok: true }))
      .toMatchObject({ step: 'codes', busy: false });
  });

  it('keeps the setup step on a failure, with the reason, for a fresh code', () => {
    expect(afterConfirm(submitting(SETUP), { ok: false, error: WRONG_CODE })).toEqual({
      ...SETUP, busy: false, error: WRONG_CODE, attempt: 1,
    });
  });
});
