import { describe, expect, it } from 'vitest';
import {
  afterDelete, cancelled, continued, INITIAL_HOUSEHOLD_DELETION, submitting, typed,
  type HouseholdDeletionState,
} from '../../../../../../src/experiences/manageHousehold/flows/householdDeletion/householdDeletionState';

// Household Deletion Flow's transitions (BDT: Flow tier → unit): pure, nothing mocked.

const FORBIDDEN = { code: 'auth.forbidden' };

/** The confirm open with the name typed and a failure showing. */
const failedConfirm: HouseholdDeletionState = {
  step: 'confirm', confirmation: 'Casa Silva', busy: false, error: FORBIDDEN, returning: false,
};

describe('householdDeletionState', () => {
  it('opens on the consequences, nothing typed, nothing out', () => {
    expect(INITIAL_HOUSEHOLD_DELETION).toEqual({
      step: 'review', confirmation: '', busy: false, error: undefined, returning: false,
    });
  });

  it('continued opens the confirm with nothing typed', () => {
    const back = { ...INITIAL_HOUSEHOLD_DELETION, returning: true };

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

  it('afterDelete stops and keeps the failure and the typed name on an error', () => {
    const out = submitting(failedConfirm);
    const notFound = { code: 'household.not_found' };

    expect(afterDelete(out, { ok: false, error: notFound })).toEqual({
      ...out, busy: false, error: notFound,
    });
  });
});
