import { describe, expect, it } from 'vitest';
import {
  afterConfirm, afterRequest, initialAccountRecovery, submitting, type AccountRecoveryState,
} from '../../../../../../src/experiences/authenticate/flows/accountRecovery/accountRecoveryState';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';

// The Flow's pure rules (BDT: Flow tier → unit): nothing to mock.

const OK: RequestOutcome = { ok: true };

/**
 * A failed outcome.
 *
 * @param code - The error code.
 * @returns The outcome.
 */
const failed = (code: string): RequestOutcome => ({ ok: false, error: { code } });

const REQUEST = initialAccountRecovery();
const NEW_PASSWORD = initialAccountRecovery('reset-token');

describe('initialAccountRecovery', () => {
  it('asks for a link when opened without a token', () => {
    expect(REQUEST).toEqual({
      step: 'request', token: '', linkRequested: false, busy: false, error: undefined,
    });
  });

  it('takes the new password when opened from the link, keeping its token', () => {
    expect(NEW_PASSWORD).toMatchObject({ step: 'newPassword', token: 'reset-token' });
  });
});

describe('submitting', () => {
  it('marks the request out and clears the last failure', () => {
    const failedBefore: AccountRecoveryState = {
      ...REQUEST, error: { code: 'network.unavailable' },
    };

    expect(submitting(failedBefore)).toMatchObject({ busy: true, error: undefined });
  });
});

describe('afterRequest', () => {
  it('shows the inbox note on success', () => {
    expect(afterRequest(submitting(REQUEST), OK))
      .toMatchObject({
        step: 'request', linkRequested: true, busy: false, error: undefined,
      });
  });

  it('keeps the inbox note when asking again fails, and shows the failure', () => {
    const sent = afterRequest(REQUEST, OK);

    expect(afterRequest(submitting(sent), failed('network.unavailable'))).toMatchObject({
      linkRequested: true, busy: false, error: { code: 'network.unavailable' },
    });
  });

  it('shows no inbox note when the first request fails', () => {
    expect(afterRequest(submitting(REQUEST), failed('network.unavailable')))
      .toMatchObject({ linkRequested: false, busy: false });
  });
});

describe('afterConfirm', () => {
  it('moves to the done step on success', () => {
    expect(afterConfirm(submitting(NEW_PASSWORD), OK))
      .toMatchObject({ step: 'done', busy: false, error: undefined });
  });

  it('goes back to asking for a link when the link is dead', () => {
    expect(afterConfirm(submitting(NEW_PASSWORD), failed('password_reset.token_invalid')))
      .toMatchObject({
        step: 'request', busy: false, error: { code: 'password_reset.token_invalid' },
      });
  });

  it.each(['password.too_short', 'network.unavailable'])(
    'stays on the new password with %s',
    (code) => {
      expect(afterConfirm(submitting(NEW_PASSWORD), failed(code)))
        .toMatchObject({ step: 'newPassword', busy: false, error: { code } });
    },
  );
});
