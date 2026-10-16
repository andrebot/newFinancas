import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  AuthenticateExperience, type AuthenticateEntry,
} from '../../../../src/experiences/authenticate/AuthenticateExperience';
import type {
  AccountRecoveryFlowProps,
} from '../../../../src/experiences/authenticate/flows/accountRecovery/AccountRecoveryFlow';
import type { SignInFlowProps } from '../../../../src/experiences/authenticate/flows/signIn/SignInFlow';
import type {
  MfaEnrollmentFlowProps,
} from '../../../../src/experiences/onboard/flows/mfaEnrollment/MfaEnrollmentFlow';
import { selectSession } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import type { RequestOutcome } from '../../../../src/utilities/requestOutcome';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// Experience (BDT: integration). The Flows it composes are stubs: plain
// buttons that make each request with fixed input and show the outcome they
// got back. Beneath it, the real store and API client; only `fetch` is fake.

vi.mock('../../../../src/experiences/authenticate/flows/signIn/SignInFlow', () => ({
  /**
   * Sign In's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  SignInFlow: ({
    onSubmitCredentials, onSubmitCode, onSubmitBackupCode, onForgotPassword, onCreateAccount,
  }: SignInFlowProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <FlowStub
      name="signIn"
      requests={{
        credentials: () => onSubmitCredentials({ email: 'jane@example.com', password: 'pw' }),
        code: () => onSubmitCode('123456'),
        backupCode: () => onSubmitBackupCode('ABCD-EFGH'),
      }}
      events={{ forgot: onForgotPassword, create: onCreateAccount }}
    />
  ),
}));

vi.mock('../../../../src/experiences/onboard/flows/mfaEnrollment/MfaEnrollmentFlow', () => ({
  /**
   * MFA Enrollment's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  MfaEnrollmentFlow: ({ enrollment, onConfirm, onComplete }: MfaEnrollmentFlowProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <FlowStub
      name="enrollment"
      shows={enrollment}
      requests={{ confirm: () => onConfirm('654321') }}
      events={{ complete: onComplete }}
    />
  ),
}));

vi.mock('../../../../src/experiences/authenticate/flows/accountRecovery/AccountRecoveryFlow', () => ({
  /**
   * Account Recovery's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  AccountRecoveryFlow: ({
    token, onRequestReset, onConfirmReset, onBackToSignIn,
  }: AccountRecoveryFlowProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <FlowStub
      name="recovery"
      shows={{ token: token ?? null }}
      requests={{
        request: () => onRequestReset('jane@example.com'),
        confirm: () => onConfirmReset(token ?? 'none', 'a-long-new-password'),
      }}
      events={{ back: onBackToSignIn }}
    />
  ),
}));

/** A Flow stub's props. */
interface FlowStubProps {
  readonly name: string;
  /** Props worth asserting on, shown as JSON. */
  readonly shows?: unknown;
  /** Buttons that make a request and show its outcome. */
  readonly requests: Readonly<Record<string, () => Promise<RequestOutcome>>>;
  /** Buttons that only emit. */
  readonly events: Readonly<Record<string, () => void>>;
}

/**
 * Stands in for a Flow: one button per request or event, and the last
 * outcome the Experience answered.
 *
 * @param props - The stub's name, what it shows and its buttons.
 * @returns The stub.
 */
function FlowStub({
  name, shows, requests, events,
}: FlowStubProps) {
  const [outcome, setOutcome] = useState<RequestOutcome>();
  return (
    <div data-testid={name} data-shows={JSON.stringify(shows)}>
      {Object.entries(requests).map(([label, request]) => (
        <button key={label} type="button" onClick={async () => setOutcome(await request())}>
          {label}
        </button>
      ))}
      {Object.entries(events).map(([label, emit]) => (
        <button key={label} type="button" onClick={emit}>{label}</button>
      ))}
      <output data-testid="outcome">{outcome ? JSON.stringify(outcome) : ''}</output>
    </div>
  );
}

/** A canned answer per API path; a function so each call gets a fresh body. */
type Answers = Readonly<Record<string, () => Response | Promise<Response>>>;

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1' };

const CHALLENGE = { step: 'mfa', challengeToken: 'challenge-1' };

const ENROLLMENT = {
  step: 'enroll',
  enrollmentToken: 'enrollment-1',
  totpSecret: 'JBSWY3DPEHPK3PXP',
  otpauthUri: 'otpauth://totp/Financas:jane@example.com?secret=JBSWY3DPEHPK3PXP',
  recoveryCodes: ['code-1', 'code-2'],
};

/**
 * Builds a fake `fetch` answering each path from a table.
 *
 * @param answers - The answer per path (after `/api/v1`).
 * @returns The fake.
 */
const fakeFetch = (answers: Answers) => vi.fn<typeof fetch>(async (input) => {
  const { pathname } = new URL((input as Request).url);
  const answer = answers[pathname.replace('/api/v1', '')];
  if (!answer) throw new Error(`No answer for ${pathname}`);
  return answer();
});

/**
 * Reads the JSON body a call sent.
 *
 * @param fetchFn - The fake `fetch`.
 * @param index - Which call.
 * @returns The path and the parsed body.
 */
const sent = async (fetchFn: ReturnType<typeof fakeFetch>, index: number) => {
  const request = fetchFn.mock.calls[index]?.[0] as Request;
  return { path: new URL(request.url).pathname, body: await request.clone().json() as unknown };
};

/**
 * Renders the Experience over the real store with a fake `fetch`.
 *
 * @param entry - Which journey.
 * @param answers - The API's answers.
 * @param path - The starting address.
 * @returns The store, its fakes and the fake `fetch`.
 */
const renderExperience = (entry: AuthenticateEntry, answers: Answers, path = '/sign-in') => {
  const fetchFn = fakeFetch(answers);
  const fakes = fakeStore({ fetchFn });
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <AuthenticateExperience entry={entry} />
    </AlertProvider>,
    fakes.store,
    { path, state: { from: '/transactions' } },
  );
  return { ...fakes, fetchFn };
};

/**
 * Presses a stub's button and waits for what it started.
 *
 * @param label - The button's label.
 */
const press = async (label: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }));
  });
};

/**
 * Reads the last outcome a stub got.
 *
 * @returns The outcome.
 */
const lastOutcome = () => JSON.parse(screen.getByTestId('outcome').textContent ?? '') as unknown;

/**
 * Reads what a stub was given.
 *
 * @param name - The stub.
 * @returns Its shown props.
 */
const shownBy = (name: string) => (
  JSON.parse(screen.getByTestId(name).dataset.shows ?? '') as unknown
);

describe('AuthenticateExperience — Sign In', () => {
  it('keeps the challenge, sends it with the code and starts the session', async () => {
    const { store, fetchFn, tokenStorage } = renderExperience('signIn', {
      '/auth/login': () => jsonResponse(200, CHALLENGE),
      '/auth/mfa/verify': () => jsonResponse(200, TOKENS),
    });

    await press('credentials');
    expect(lastOutcome()).toEqual({ ok: true });
    expect(selectSession(store.getState())).toBe('signedOut');
    await press('code');

    expect(lastOutcome()).toEqual({ ok: true });
    expect(await sent(fetchFn, 0)).toEqual({
      path: '/api/v1/auth/login', body: { email: 'jane@example.com', password: 'pw' },
    });
    expect(await sent(fetchFn, 1)).toEqual({
      path: '/api/v1/auth/mfa/verify', body: { challengeToken: 'challenge-1', mfaCode: '123456' },
    });
    expect(selectSession(store.getState())).toBe('signedIn');
    expect(tokenStorage.value).toBe('refresh-1');
  });

  it('signs in with a backup code instead', async () => {
    const { store, fetchFn } = renderExperience('signIn', {
      '/auth/login': () => jsonResponse(200, CHALLENGE),
      '/auth/mfa/recover': () => jsonResponse(200, TOKENS),
    });

    await press('credentials');
    await press('backupCode');

    expect(await sent(fetchFn, 1)).toEqual({
      path: '/api/v1/auth/mfa/recover',
      body: { challengeToken: 'challenge-1', recoveryCode: 'ABCD-EFGH' },
    });
    expect(selectSession(store.getState())).toBe('signedIn');
  });

  it.each([
    ['auth.invalid_credentials', 401, {}],
    ['auth.too_many_attempts', 429, { retryAfterMinutes: 15 }],
  ])('answers the password step’s %s with its code and params', async (code, status, params) => {
    const { store } = renderExperience('signIn', {
      '/auth/login': () => jsonResponse(status, envelope(code, { params })),
    });

    await press('credentials');

    expect(lastOutcome()).toEqual({ ok: false, error: { code, params } });
    expect(selectSession(store.getState())).toBe('signedOut');
  });

  it.each([
    'auth.mfa_invalid', 'auth.challenge_expired',
  ])('answers the code step’s %s and stays signed out', async (code) => {
    const { store, tokenStorage } = renderExperience('signIn', {
      '/auth/login': () => jsonResponse(200, CHALLENGE),
      '/auth/mfa/verify': () => jsonResponse(401, envelope(code)),
    });

    await press('credentials');
    await press('code');

    expect(lastOutcome()).toEqual({ ok: false, error: { code, params: {} } });
    expect(selectSession(store.getState())).toBe('signedOut');
    expect(tokenStorage.value).toBeNull();
  });

  it('answers an unreachable API with network.unavailable', async () => {
    renderExperience('signIn', {
      '/auth/login': () => Promise.reject(new TypeError('Failed to fetch')),
    });

    await press('credentials');

    expect(lastOutcome()).toEqual({
      ok: false, error: { code: 'network.unavailable', params: {} },
    });
  });

  it('opens Forgot password and Create account, keeping where to go back to', async () => {
    renderExperience('signIn', {});

    await press('forgot');
    expect(screen.getByTestId('location').textContent).toBe('/forgot-password');
    expect(screen.getByTestId('location').dataset.state).toBe('{"from":"/transactions"}');
    await press('create');
    expect(screen.getByTestId('location').textContent).toBe('/register');
    expect(screen.getByTestId('location').dataset.state).toBe('{"from":"/transactions"}');
  });
});

describe('AuthenticateExperience — resuming an MFA enrollment', () => {
  it('hosts the enrollment, and starts the session only once the codes are saved', async () => {
    const { store, fetchFn, tokenStorage } = renderExperience('signIn', {
      '/auth/login': () => jsonResponse(200, ENROLLMENT),
      '/auth/mfa/enrollment/confirm': () => jsonResponse(200, TOKENS),
    });

    await press('credentials');
    expect(shownBy('enrollment')).toEqual({
      otpauthUri: ENROLLMENT.otpauthUri,
      totpSecret: ENROLLMENT.totpSecret,
      recoveryCodes: ENROLLMENT.recoveryCodes,
      accountEmail: 'jane@example.com',
    });
    await press('confirm');

    expect(lastOutcome()).toEqual({ ok: true });
    expect(await sent(fetchFn, 1)).toEqual({
      path: '/api/v1/auth/mfa/enrollment/confirm',
      body: { enrollmentToken: 'enrollment-1', mfaCode: '654321' },
    });
    expect(selectSession(store.getState())).toBe('signedOut');
    expect(tokenStorage.value).toBeNull();

    await press('complete');
    expect(selectSession(store.getState())).toBe('signedIn');
    expect(tokenStorage.value).toBe('refresh-1');
  });

  it('leaves a wrong code to the Flow', async () => {
    const { store } = renderExperience('signIn', {
      '/auth/login': () => jsonResponse(200, ENROLLMENT),
      '/auth/mfa/enrollment/confirm': () => jsonResponse(401, envelope('auth.mfa_invalid')),
    });

    await press('credentials');
    await press('confirm');

    expect(lastOutcome()).toEqual({ ok: false, error: { code: 'auth.mfa_invalid', params: {} } });
    expect(screen.getByTestId('enrollment')).toBeTruthy();
    await press('complete');
    expect(selectSession(store.getState())).toBe('signedOut');
  });

  it('goes back to Sign In with a toast when the enrollment lapsed', async () => {
    renderExperience('signIn', {
      '/auth/login': () => jsonResponse(200, ENROLLMENT),
      '/auth/mfa/enrollment/confirm': () => jsonResponse(401, envelope('auth.enrollment_expired')),
    });

    await press('credentials');
    await press('confirm');

    expect(screen.getByTestId('signIn')).toBeTruthy();
    expect(screen.queryByTestId('enrollment')).toBeNull();
    expect(screen.getByText(
      'Your setup took too long. Please sign in again to get a new code.',
    )).toBeTruthy();
  });
});

describe('AuthenticateExperience — Account Recovery', () => {
  it('asks for a reset link', async () => {
    const { fetchFn } = renderExperience('recovery', {
      '/auth/password-reset/request': () => jsonResponse(202),
    }, '/forgot-password');

    expect(shownBy('recovery')).toEqual({ token: null });
    await press('request');

    expect(lastOutcome()).toEqual({ ok: true });
    expect(await sent(fetchFn, 0)).toEqual({
      path: '/api/v1/auth/password-reset/request', body: { email: 'jane@example.com' },
    });
  });

  it('takes the link’s token out of the address bar and resets with it', async () => {
    const { fetchFn, store } = renderExperience('recovery', {
      '/auth/password-reset/confirm': () => jsonResponse(200),
    }, '/reset-password?token=reset-1');

    expect(shownBy('recovery')).toEqual({ token: 'reset-1' });
    expect(screen.getByTestId('location').textContent).toBe('/reset-password');
    await press('confirm');

    expect(lastOutcome()).toEqual({ ok: true });
    expect(await sent(fetchFn, 0)).toEqual({
      path: '/api/v1/auth/password-reset/confirm',
      body: { token: 'reset-1', newPassword: 'a-long-new-password' },
    });
    expect(selectSession(store.getState())).toBe('signedOut');
  });

  it.each([
    ['password_reset.token_invalid', 400],
    ['password.too_short', 422],
  ])('answers %s with its code', async (code, status) => {
    renderExperience('recovery', {
      '/auth/password-reset/confirm': () => jsonResponse(
        status,
        envelope(code, { params: { min: 12 } }),
      ),
    }, '/reset-password?token=reset-1');

    await press('confirm');

    expect(lastOutcome()).toEqual({ ok: false, error: { code, params: { min: 12 } } });
  });

  it('goes back to Sign In, keeping where to go back to', async () => {
    renderExperience('recovery', {}, '/forgot-password');

    await press('back');

    expect(screen.getByTestId('location').textContent).toBe('/sign-in');
    expect(screen.getByTestId('location').dataset.state).toBe('{"from":"/transactions"}');
  });
});
