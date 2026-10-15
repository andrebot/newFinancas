import { describe, expect, it } from 'vitest';
import {
  afterRegister, initialRegistration, submitting,
} from '../../../../../../src/experiences/onboard/flows/registration/registrationState';

// Registration Flow's rules (BDT: Flow tier → unit, pure, nothing mocked).

const FAILURE = { code: 'user.email_taken' };

describe('registrationState', () => {
  it('opens idle with no failure', () => {
    expect(initialRegistration).toEqual({ busy: false, error: undefined });
  });

  it('marks the request as out and clears the last failure', () => {
    expect(submitting({ busy: false, error: FAILURE })).toEqual({ busy: true, error: undefined });
  });

  it('stays busy on success, while the Experience moves on', () => {
    const sent = submitting(initialRegistration);

    expect(afterRegister(sent, { ok: true })).toBe(sent);
  });

  it('keeps a failure and stops being busy', () => {
    const sent = submitting(initialRegistration);

    expect(afterRegister(sent, { ok: false, error: FAILURE }))
      .toEqual({ busy: false, error: FAILURE });
  });
});
