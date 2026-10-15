import { describe, expect, it } from 'vitest';
import {
  afterCredentials, afterSecondFactor, INITIAL_SIGN_IN, submitting, switchedTo,
  type SignInState,
} from '../../../../../../src/experiences/authenticate/flows/signIn/signInState';

// Sign In Flow's transitions (BDT: Flow tier → unit): pure, nothing mocked.

const OK = { ok: true } as const;

/**
 * A failed outcome with an error code.
 *
 * @param code - The error code.
 * @returns The outcome.
 */
const failed = (code: string) => ({ ok: false, error: { code } } as const);

const ON_CODE: SignInState = {
  step: 'code', email: 'ana@example.com', busy: true, error: undefined, attempt: 3,
};

describe('submitting', () => {
  it('marks a request as out and clears the last failure', () => {
    const state = { ...INITIAL_SIGN_IN, error: { code: 'auth.invalid_credentials' } };

    expect(submitting(state)).toEqual({ ...INITIAL_SIGN_IN, busy: true, error: undefined });
  });
});

describe('afterCredentials', () => {
  it('moves to the code step, keeping the email, when a challenge is held', () => {
    const state = afterCredentials(submitting(INITIAL_SIGN_IN), 'ana@example.com', OK);

    expect(state).toEqual({
      step: 'code', email: 'ana@example.com', busy: false, error: undefined, attempt: 1,
    });
  });

  it('stays on the password step with the failure, remounting to clear the password', () => {
    const outcome = failed('auth.invalid_credentials');

    const state = afterCredentials(submitting(INITIAL_SIGN_IN), 'ana@example.com', outcome);

    expect(state).toEqual({
      step: 'credentials',
      email: 'ana@example.com',
      busy: false,
      error: { code: 'auth.invalid_credentials' },
      attempt: 1,
    });
  });
});

describe('afterSecondFactor', () => {
  it('stays busy once signed in: the Experience takes over', () => {
    expect(afterSecondFactor(ON_CODE, OK)).toBe(ON_CODE);
  });

  it('keeps the step after a wrong code, remounting to clear it (OQ-145)', () => {
    expect(afterSecondFactor(ON_CODE, failed('auth.mfa_invalid'))).toEqual({
      ...ON_CODE, busy: false, error: { code: 'auth.mfa_invalid' }, attempt: 4,
    });
  });

  it('keeps the backup code step after a wrong backup code', () => {
    const onBackup = { ...ON_CODE, step: 'backupCode' as const };

    expect(afterSecondFactor(onBackup, failed('auth.mfa_invalid')).step).toBe('backupCode');
  });

  it.each(['auth.challenge_expired', 'auth.too_many_attempts'])(
    'starts over from the password, email kept, after %s',
    (code) => {
      expect(afterSecondFactor(ON_CODE, failed(code))).toEqual({
        step: 'credentials', email: 'ana@example.com', busy: false, error: { code }, attempt: 4,
      });
    },
  );

  it('stays on the step after a failure that is no fault of the code', () => {
    expect(afterSecondFactor(ON_CODE, failed('network.unavailable')).step).toBe('code');
  });
});

describe('switchedTo', () => {
  it('shows the step asked for, with nothing typed and no banner', () => {
    const state = { ...ON_CODE, busy: false, error: { code: 'auth.mfa_invalid' } };

    expect(switchedTo(state, 'backupCode')).toEqual({
      ...state, step: 'backupCode', error: undefined, attempt: 4,
    });
  });
});
