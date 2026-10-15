import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { PasswordChangeProps } from '../../../../../../src/experiences/manageProfile/flows/security/interactions/PasswordChange';
import type { SessionListProps } from '../../../../../../src/experiences/manageProfile/flows/security/interactions/SessionList';
import type {
  SignOutOthersButtonProps, SignOutOthersConfirmProps,
} from '../../../../../../src/experiences/manageProfile/flows/security/interactions/SignOutOthers';
import {
  SecurityFlow, type SecurityFlowProps,
} from '../../../../../../src/experiences/manageProfile/flows/security/SecurityFlow';
import type {
  SecuritySession, SessionsOutcome,
} from '../../../../../../src/experiences/manageProfile/flows/security/securityState';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interactions beneath mocked): each Interaction is a
// stub that shows what it was given and emits from plain buttons. The
// Experience is represented by stub requests; the toast queue and the
// translator are the real Utilities.

vi.mock('../../../../../../src/experiences/manageProfile/flows/security/interactions/PasswordChange', () => ({
  /**
   * Password Change's stand-in: an uncontrolled draft shows a remount.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  PasswordChange: ({
    busy, alert, currentError, passwordError, onSubmit,
  }: PasswordChangeProps) => (
    <div
      data-testid="password"
      data-busy={String(busy)}
      data-alert={alert ?? ''}
      data-current-error={currentError ?? ''}
      data-password-error={passwordError ?? ''}
    >
      <input aria-label="draft" />
      <button
        type="button"
        onClick={() => onSubmit({ currentPassword: 'old-password', newPassword: 'new-password-1' })}
      >
        change
      </button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/manageProfile/flows/security/interactions/SessionList', () => ({
  /**
   * Session List's stand-in: the status, the ids and the Flow's slots.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  SessionList: ({
    sessions, revokingId, revokeLocked, alert, headerAction, confirm, onRevoke, onRetry,
  }: SessionListProps) => (
    <div
      data-testid="sessions"
      data-status={sessions.status}
      data-ids={sessions.status === 'loaded' ? sessions.sessions.map(({ id }) => id).join('|') : ''}
      data-revoking={revokingId ?? ''}
      data-locked={String(revokeLocked)}
      data-alert={alert ?? ''}
    >
      {headerAction}
      {confirm}
      <button type="button" onClick={() => onRevoke('phone')}>revoke phone</button>
      <button type="button" onClick={onRetry}>retry</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/manageProfile/flows/security/interactions/SignOutOthers', () => ({
  /**
   * The header button's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  SignOutOthersButton: ({ disabled, onOpen }: SignOutOthersButtonProps) => (
    <button type="button" disabled={disabled} onClick={onOpen}>others</button>
  ),
  /**
   * The confirm's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  SignOutOthersConfirm: ({ busy, onConfirm, onCancel }: SignOutOthersConfirmProps) => (
    <div data-testid="confirm" data-busy={String(busy)}>
      <button type="button" onClick={onConfirm}>confirm others</button>
      <button type="button" onClick={onCancel}>cancel others</button>
    </div>
  ),
}));

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

const SESSIONS = [
  session('phone', '2026-09-20T12:00:00Z'),
  session('this', '2026-10-15T12:00:00Z', true),
  session('old', '2026-08-10T12:00:00Z'),
];
const LOADED: SessionsOutcome = { ok: true, sessions: SESSIONS };
const OK: RequestOutcome = { ok: true };
const UNAVAILABLE = { ok: false, error: { code: 'network.unavailable' } } as const;
const CONNECT = "Couldn't connect. Check your connection and try again.";

/** A request whose answer the test gives when it wants. */
interface Pending<T> {
  readonly request: () => Promise<T>;
  readonly answer: (value: T) => Promise<void>;
}

/**
 * Builds a request that waits until the test answers it.
 *
 * @returns The request and its answer.
 */
const pending = <T,>(): Pending<T> => {
  let resolve: (value: T) => void = () => {};
  return {
    request: vi.fn(() => new Promise<T>((settle) => {
      resolve = settle;
    })),
    answer: async (value) => {
      await act(async () => resolve(value));
    },
  };
};

/**
 * Renders the Flow inside a real toast queue, with stub requests that answer
 * at once.
 *
 * @param props - The requests to override.
 * @returns The requests, the queue and the render result.
 */
const renderFlow = async (props: Partial<SecurityFlowProps> = {}) => {
  const requests: SecurityFlowProps = {
    onLoadSessions: vi.fn(async () => LOADED),
    onRevokeSession: vi.fn(async () => OK),
    onRevokeOthers: vi.fn(async () => OK),
    onChangePassword: vi.fn(async () => OK),
    ...props,
  };
  const queue: AlertQueue = createAlertQueue(3);
  let view: ReturnType<typeof renderInLocale> | undefined;
  await act(async () => {
    view = renderInLocale(
      <AlertProvider queue={queue}><SecurityFlow {...requests} /></AlertProvider>,
    );
  });
  return { requests, queue, view: view! };
};

const sessionsPanel = () => screen.getByTestId('sessions');
const passwordPanel = () => screen.getByTestId('password');
const toasts = (queue: AlertQueue) => queue.visible().map(({ tone, message }) => ({
  tone, message,
}));

/**
 * Clicks a stub's button and lets the outcome land.
 *
 * @param name - The button's name.
 */
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

describe('SecurityFlow — the sessions', () => {
  it('fetches the sessions as it mounts and lists this device first', async () => {
    const load = pending<SessionsOutcome>();
    const { requests } = await renderFlow({ onLoadSessions: load.request });

    expect(sessionsPanel().dataset.status).toBe('loading');
    await load.answer(LOADED);

    expect(requests.onLoadSessions).toHaveBeenCalledTimes(1);
    expect(sessionsPanel().dataset).toMatchObject({ status: 'loaded', ids: 'this|phone|old' });
  });

  it('retries a failed load', async () => {
    const onLoadSessions = vi.fn<() => Promise<SessionsOutcome>>()
      .mockResolvedValueOnce(UNAVAILABLE)
      .mockResolvedValueOnce(LOADED);
    await renderFlow({ onLoadSessions });
    expect(sessionsPanel().dataset.status).toBe('failed');

    await click('retry');

    expect(onLoadSessions).toHaveBeenCalledTimes(2);
    expect(sessionsPanel().dataset.status).toBe('loaded');
  });

  it('drops an answer that lands after it unmounted', async () => {
    const load = pending<SessionsOutcome>();
    const { view } = await renderFlow({ onLoadSessions: load.request });

    view.unmount();
    await load.answer(LOADED);

    expect(screen.queryByTestId('sessions')).toBeNull();
  });

  it('offers "all others" only when another session is listed', async () => {
    const onlyThis: SessionsOutcome = { ok: true, sessions: [SESSIONS[1]!] };
    await renderFlow({ onLoadSessions: vi.fn(async () => onlyThis) });

    expect(screen.queryByRole('button', { name: 'others' })).toBeNull();
  });
});

describe('SecurityFlow — revoking one', () => {
  it('holds the others while out, drops the row and toasts', async () => {
    const revoke = pending<RequestOutcome>();
    const { requests, queue } = await renderFlow({ onRevokeSession: revoke.request });

    await click('revoke phone');
    expect(requests.onRevokeSession).toHaveBeenCalledWith('phone');
    expect(sessionsPanel().dataset).toMatchObject({ revoking: 'phone', locked: 'true' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'others' }).disabled).toBe(true);

    await revoke.answer(OK);
    expect(sessionsPanel().dataset)
      .toMatchObject({ ids: 'this|old', revoking: '', locked: 'false' });
    expect(toasts(queue)).toEqual([{ tone: 'success', message: 'Session signed out.' }]);
  });

  it('shows a failure translated, the row kept, no toast', async () => {
    const onRevokeSession = vi.fn(async () => UNAVAILABLE);
    const { queue } = await renderFlow({ onRevokeSession });

    await click('revoke phone');

    expect(sessionsPanel().dataset).toMatchObject({ ids: 'this|phone|old', alert: CONNECT });
    expect(toasts(queue)).toEqual([]);
  });
});

describe('SecurityFlow — signing out all others', () => {
  it('opens the confirm, spins it while out, keeps only this device and toasts', async () => {
    const revoke = pending<RequestOutcome>();
    const { requests, queue } = await renderFlow({ onRevokeOthers: revoke.request });
    expect(screen.queryByTestId('confirm')).toBeNull();

    await click('others');
    await click('confirm others');
    expect(requests.onRevokeOthers).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('confirm').dataset.busy).toBe('true');
    expect(sessionsPanel().dataset.revoking).toBe('');

    await revoke.answer(OK);
    expect(sessionsPanel().dataset.ids).toBe('this');
    expect(screen.queryByTestId('confirm')).toBeNull();
    expect(toasts(queue)).toEqual([{ tone: 'success', message: 'Other sessions signed out.' }]);
  });

  it('keeps the confirm open on a failure, and a cancel drops both', async () => {
    await renderFlow({ onRevokeOthers: vi.fn(async () => UNAVAILABLE) });
    await click('others');
    await click('confirm others');

    expect(screen.getByTestId('confirm').dataset.busy).toBe('false');
    expect(sessionsPanel().dataset.alert).toBe(CONNECT);

    await click('cancel others');
    expect(screen.queryByTestId('confirm')).toBeNull();
    expect(sessionsPanel().dataset.alert).toBe('');
  });
});

describe('SecurityFlow — changing the password', () => {
  it('spins while out, then empties the form, keeps only this device and toasts', async () => {
    const change = pending<RequestOutcome>();
    const { requests, queue } = await renderFlow({ onChangePassword: change.request });
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'typed' } });

    await click('change');
    expect(requests.onChangePassword).toHaveBeenCalledWith({
      currentPassword: 'old-password', newPassword: 'new-password-1',
    });
    expect(passwordPanel().dataset.busy).toBe('true');

    await change.answer(OK);
    expect(passwordPanel().dataset.busy).toBe('false');
    expect(screen.getByLabelText<HTMLInputElement>('draft').value).toBe('');
    expect(sessionsPanel().dataset.ids).toBe('this');
    expect(toasts(queue)).toEqual([{
      tone: 'success', message: 'Password changed. Your other sessions were signed out.',
    }]);
  });

  it.each([
    ['password.current_incorrect', 'currentError', 'Your current password is incorrect.'],
    ['password.too_short', 'passwordError', 'Password must be at least 12 characters.'],
    ['network.unavailable', 'alert', CONNECT],
  ])('places %s where it belongs, the form kept', async (code, place, message) => {
    const error = code === 'password.too_short' ? { code, params: { min: 12 } } : { code };
    const onChangePassword = vi.fn(async (): Promise<RequestOutcome> => ({ ok: false, error }));
    const { queue } = await renderFlow({ onChangePassword });
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'typed' } });

    await click('change');

    expect(passwordPanel().dataset).toMatchObject({
      currentError: '', passwordError: '', alert: '', [place]: message,
    });
    expect(screen.getByLabelText<HTMLInputElement>('draft').value).toBe('typed');
    expect(toasts(queue)).toEqual([]);
  });
});
