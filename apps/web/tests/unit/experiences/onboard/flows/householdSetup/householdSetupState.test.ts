import { describe, expect, it } from 'vitest';
import {
  afterCreate, initialHouseholdSetup, submitting,
} from '../../../../../../src/experiences/onboard/flows/householdSetup/householdSetupState';

// Household Setup Flow's rules (BDT: Flow tier → unit, pure, nothing mocked).

const FAILURE = { code: 'network.unavailable' };

describe('householdSetupState', () => {
  it('opens idle with no failure', () => {
    expect(initialHouseholdSetup).toEqual({ busy: false, error: undefined });
  });

  it('marks the request as out and clears the last failure', () => {
    expect(submitting({ busy: false, error: FAILURE })).toEqual({ busy: true, error: undefined });
  });

  it('stays busy on success, while the Experience moves on', () => {
    const sent = submitting(initialHouseholdSetup);

    expect(afterCreate(sent, { ok: true })).toBe(sent);
  });

  it('keeps a failure and stops being busy', () => {
    const sent = submitting(initialHouseholdSetup);

    expect(afterCreate(sent, { ok: false, error: FAILURE }))
      .toEqual({ busy: false, error: FAILURE });
  });
});
