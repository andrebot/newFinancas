import { describe, expect, it } from 'vitest';
import {
  afterLoad, afterPasswordChange, afterRevoke, INITIAL_SECURITY, loadingSessions,
  othersConfirmCancelled, othersConfirmOpened, passwordSubmitting, revokeStarted, sortSessions,
  type SecuritySession, type SecurityState,
} from '../../../../../../src/experiences/manageProfile/flows/security/securityState';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';

// Flow state (BDT: unit, pure — nothing mocked).

/**
 * Builds a session.
 *
 * @param id - Its id.
 * @param lastUsedAt - When it was last used.
 * @param current - Whether it is this device.
 * @returns The session.
 */
const session = (id: string, lastUsedAt: string, current = false): SecuritySession => ({
  id, deviceInfo: null, createdAt: '2026-06-01T12:00:00Z', lastUsedAt, current,
});

const THIS = session('this', '2026-10-15T12:00:00Z', true);
const PHONE = session('phone', '2026-09-20T12:00:00Z');
const OLD = session('old', '2026-08-10T12:00:00Z');
const FAILURE = { code: 'network.unavailable' };
const OK: RequestOutcome = { ok: true };
const FAILED: RequestOutcome = { ok: false, error: FAILURE };

const LOADED: SecurityState = {
  ...INITIAL_SECURITY, sessions: { status: 'loaded', sessions: [THIS, PHONE, OLD] },
};

describe('securityState — the sessions', () => {
  it('opens loading, nothing out', () => {
    expect(INITIAL_SECURITY).toMatchObject({
      sessions: { status: 'loading' },
      confirmingOthers: false,
      passwordBusy: false,
      passwordForm: 0,
    });
  });

  it('sorts this device first, then the most recently used', () => {
    expect(sortSessions([OLD, PHONE, THIS])).toEqual([THIS, PHONE, OLD]);
    expect(sortSessions([PHONE, OLD])).toEqual([PHONE, OLD]);
  });

  it('keeps a loaded list sorted, or the failure', () => {
    expect(afterLoad(INITIAL_SECURITY, { ok: true, sessions: [OLD, THIS, PHONE] }).sessions)
      .toEqual({ status: 'loaded', sessions: [THIS, PHONE, OLD] });
    expect(afterLoad(INITIAL_SECURITY, { ok: false, error: FAILURE }).sessions)
      .toEqual({ status: 'failed', error: FAILURE });
  });

  it('a retry loads again and drops the last revoke failure', () => {
    const failed: SecurityState = {
      ...INITIAL_SECURITY, sessions: { status: 'failed', error: FAILURE }, revokeError: FAILURE,
    };

    expect(loadingSessions(failed)).toMatchObject({
      sessions: { status: 'loading' }, revokeError: undefined,
    });
  });
});

describe('securityState — revoking', () => {
  it('drops the one session revoked', () => {
    const out = revokeStarted(LOADED, { scope: 'one', sessionId: 'phone' });
    expect(out.revoking).toEqual({ scope: 'one', sessionId: 'phone' });

    expect(afterRevoke(out, OK)).toMatchObject({
      sessions: { status: 'loaded', sessions: [THIS, OLD] }, revoking: undefined,
    });
  });

  it('opens and cancels the "all others" confirm, forgetting its failure', () => {
    const opened = othersConfirmOpened({ ...LOADED, revokeError: FAILURE });
    expect(opened).toMatchObject({ confirmingOthers: true, revokeError: undefined });

    expect(othersConfirmCancelled({ ...opened, revokeError: FAILURE }))
      .toMatchObject({ confirmingOthers: false, revokeError: undefined });
  });

  it('keeps only this device after "all others", closing the confirm', () => {
    const out = revokeStarted(othersConfirmOpened(LOADED), { scope: 'others' });

    expect(afterRevoke(out, OK)).toMatchObject({
      sessions: { status: 'loaded', sessions: [THIS] },
      confirmingOthers: false,
      revoking: undefined,
    });
  });

  it('keeps the list and the confirm on a failure, showing why', () => {
    const out = revokeStarted(othersConfirmOpened(LOADED), { scope: 'others' });

    expect(afterRevoke(out, FAILED)).toMatchObject({
      sessions: LOADED.sessions, confirmingOthers: true, revoking: undefined, revokeError: FAILURE,
    });
  });

  it('a revoke drops the last failure as it starts', () => {
    expect(revokeStarted({ ...LOADED, revokeError: FAILURE }, { scope: 'others' }).revokeError)
      .toBeUndefined();
  });

  it('leaves a list that is not loaded alone, and an answer with nothing out', () => {
    expect(afterRevoke(revokeStarted(INITIAL_SECURITY, { scope: 'others' }), OK).sessions)
      .toEqual({ status: 'loading' });
    expect(afterRevoke(LOADED, OK).sessions).toBe(LOADED.sessions);
  });
});

describe('securityState — the password', () => {
  it('marks the change as out, dropping the last failure', () => {
    expect(passwordSubmitting({ ...LOADED, passwordError: FAILURE }))
      .toMatchObject({ passwordBusy: true, passwordError: undefined });
  });

  it('on success empties the form and keeps only this device', () => {
    const out = passwordSubmitting({ ...LOADED, confirmingOthers: true });

    expect(afterPasswordChange(out, OK)).toMatchObject({
      sessions: { status: 'loaded', sessions: [THIS] },
      passwordBusy: false,
      passwordForm: 1,
      confirmingOthers: false,
    });
  });

  it('on a failure keeps the form and shows why', () => {
    expect(afterPasswordChange(passwordSubmitting(LOADED), FAILED)).toMatchObject({
      sessions: LOADED.sessions, passwordBusy: false, passwordError: FAILURE, passwordForm: 0,
    });
  });
});
