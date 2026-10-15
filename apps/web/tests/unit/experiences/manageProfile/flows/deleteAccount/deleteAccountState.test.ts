import { describe, expect, it } from 'vitest';
import {
  afterDelete, cancelled, continued, INITIAL_DELETE_ACCOUNT, submitting, typed,
  type DeleteAccountState,
} from '../../../../../../src/experiences/manageProfile/flows/deleteAccount/deleteAccountState';

// Delete Account Flow's transitions (BDT: Flow tier → unit): pure, nothing mocked.

const UNAVAILABLE = { code: 'network.unavailable' };

/** The confirm open with the email typed and a failure showing. */
const failedConfirm: DeleteAccountState = {
  step: 'confirm',
  confirmation: 'ana@example.com',
  busy: false,
  error: UNAVAILABLE,
  returning: false,
};

describe('deleteAccountState', () => {
  it('opens on the consequences, nothing typed, nothing out', () => {
    expect(INITIAL_DELETE_ACCOUNT).toEqual({
      step: 'review', confirmation: '', busy: false, error: undefined, returning: false,
    });
  });

  it('continued opens the confirm with nothing typed', () => {
    const back = { ...INITIAL_DELETE_ACCOUNT, returning: true };

    expect(continued(back)).toEqual({
      step: 'confirm', confirmation: '', busy: false, error: undefined, returning: false,
    });
  });

  it('typed keeps the text', () => {
    expect(typed(failedConfirm, 'Casa')).toEqual({ ...failedConfirm, confirmation: 'Casa' });
  });

  it('cancelled goes back to the review, text and failure dropped, the button to refocus', () => {
    expect(cancelled(failedConfirm)).toEqual({
      step: 'review', confirmation: '', busy: false, error: undefined, returning: true,
    });
  });

  it('submitting marks the request out and clears the failure', () => {
    expect(submitting(failedConfirm)).toEqual({ ...failedConfirm, busy: true, error: undefined });
  });

  it('afterDelete leaves the Flow busy on ok: the Experience takes over', () => {
    const out = submitting(failedConfirm);

    expect(afterDelete(out, { ok: true })).toBe(out);
  });

  it('afterDelete stops and keeps the failure and the typed email on an error', () => {
    const out = submitting(failedConfirm);
    const rejected = { code: 'auth.unauthorized' };

    expect(afterDelete(out, { ok: false, error: rejected })).toEqual({
      ...out, busy: false, error: rejected,
    });
  });
});
