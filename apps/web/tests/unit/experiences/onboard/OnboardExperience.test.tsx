import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  OnboardExperience, type OnboardEntry,
} from '../../../../src/experiences/onboard/OnboardExperience';
import type {
  HouseholdSetupFlowProps,
} from '../../../../src/experiences/onboard/flows/householdSetup/HouseholdSetupFlow';
import type {
  MfaEnrollmentFlowProps,
} from '../../../../src/experiences/onboard/flows/mfaEnrollment/MfaEnrollmentFlow';
import type {
  RegistrationFlowProps,
} from '../../../../src/experiences/onboard/flows/registration/RegistrationFlow';
import { selectActiveHouseholdId, selectSession } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import type { RequestOutcome } from '../../../../src/utilities/requestOutcome';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// Experience (BDT: integration). The Flows it composes are stubs: plain
// buttons that make each request with fixed input and show the outcome they
// got back. Beneath it, the real store and API client; only `fetch` is fake.

vi.mock('../../../../src/experiences/onboard/flows/registration/RegistrationFlow', () => ({
  /**
   * Registration's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  RegistrationFlow: ({ onRegister, onSignIn }: RegistrationFlowProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <FlowStub
      name="registration"
      requests={{
        register: () => onRegister({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          password: 'a-long-password',
        }),
      }}
      events={{ signIn: onSignIn }}
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

vi.mock('../../../../src/experiences/onboard/flows/householdSetup/HouseholdSetupFlow', () => ({
  /**
   * Household Setup's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  HouseholdSetupFlow: ({ onCreate, onCancel }: HouseholdSetupFlowProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <FlowStub
      name="household"
      shows={{ cancellable: onCancel !== undefined }}
      requests={{ create: () => onCreate('The Doe Household') }}
      events={onCancel ? { cancel: onCancel } : {}}
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

const REGISTERED = {
  userId: 'jane',
  enrollmentToken: 'enrollment-1',
  totpSecret: 'JBSWY3DPEHPK3PXP',
  otpauthUri: 'otpauth://totp/Financas:jane@example.com?secret=JBSWY3DPEHPK3PXP',
  recoveryCodes: ['code-1', 'code-2'],
};

const CREATED = {
  id: 'doe', name: 'The Doe Household', createdAt: '2026-10-15T12:00:00Z', role: 'Owner',
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

/** Each entry's address. */
const PATHS: Readonly<Record<OnboardEntry, string>> = {
  registration: '/register',
  household: '/setup',
  additionalHousehold: '/households/new',
  guidedSetup: '/setup/guided',
};

/**
 * Renders the Experience over the real store with a fake `fetch`.
 *
 * @param entry - Which stretch of the journey.
 * @param answers - The API's answers.
 * @returns The store, its fakes and the fake `fetch`.
 */
const renderExperience = (entry: OnboardEntry, answers: Answers) => {
  const fetchFn = fakeFetch(answers);
  const fakes = fakeStore({ fetchFn, refreshToken: entry === 'registration' ? undefined : 'r-0' });
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <OnboardExperience entry={entry} />
    </AlertProvider>,
    fakes.store,
    { path: PATHS[entry], state: { from: '/transactions' } },
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

/**
 * Reads the router's address.
 *
 * @returns The path, and the navigation's state as JSON.
 */
const location = () => {
  const probe = screen.getByTestId('location');
  return { path: probe.textContent, state: probe.dataset.state };
};

describe('OnboardExperience — registration', () => {
  it('registers, then starts the session once the enrollment’s codes are saved', async () => {
    const { store, fetchFn, tokenStorage } = renderExperience('registration', {
      '/auth/register': () => jsonResponse(201, REGISTERED),
      '/auth/mfa/enrollment/confirm': () => jsonResponse(200, TOKENS),
    });

    await press('register');
    expect(await sent(fetchFn, 0)).toEqual({
      path: '/api/v1/auth/register',
      body: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'a-long-password',
        // The locale the page shows: the account starts in it (OQ-161).
        language: 'en-US',
      },
    });
    expect(shownBy('enrollment')).toEqual({
      otpauthUri: REGISTERED.otpauthUri,
      totpSecret: REGISTERED.totpSecret,
      recoveryCodes: REGISTERED.recoveryCodes,
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

  it.each([
    ['user.email_taken', 409],
    ['password.too_short', 422],
  ])('answers %s with its code and stays on the form', async (code, status) => {
    renderExperience('registration', {
      '/auth/register': () => jsonResponse(status, envelope(code, { params: { min: 12 } })),
    });

    await press('register');

    expect(lastOutcome()).toEqual({ ok: false, error: { code, params: { min: 12 } } });
    expect(screen.getByTestId('registration')).toBeTruthy();
  });

  it('answers an unreachable API with network.unavailable', async () => {
    renderExperience('registration', {
      '/auth/register': () => Promise.reject(new TypeError('Failed to fetch')),
    });

    await press('register');

    expect(lastOutcome()).toEqual({
      ok: false, error: { code: 'network.unavailable', params: {} },
    });
  });

  it('leaves a wrong code to the Flow', async () => {
    const { store } = renderExperience('registration', {
      '/auth/register': () => jsonResponse(201, REGISTERED),
      '/auth/mfa/enrollment/confirm': () => jsonResponse(401, envelope('auth.mfa_invalid')),
    });

    await press('register');
    await press('confirm');

    expect(lastOutcome()).toEqual({ ok: false, error: { code: 'auth.mfa_invalid', params: {} } });
    await press('complete');
    expect(selectSession(store.getState())).toBe('signedOut');
  });

  it('goes to Sign In with a toast when the enrollment lapsed', async () => {
    renderExperience('registration', {
      '/auth/register': () => jsonResponse(201, REGISTERED),
      '/auth/mfa/enrollment/confirm': () => jsonResponse(401, envelope('auth.enrollment_expired')),
    });

    await press('register');
    await press('confirm');

    expect(location()).toEqual({ path: '/sign-in', state: '{"from":"/transactions"}' });
    expect(screen.getByText(
      'Your setup took too long. Please sign in again to get a new code.',
    )).toBeTruthy();
  });

  it('opens Sign In, keeping where to go back to', async () => {
    renderExperience('registration', {});

    await press('signIn');

    expect(location()).toEqual({ path: '/sign-in', state: '{"from":"/transactions"}' });
  });
});

describe('OnboardExperience — household setup', () => {
  it('offers no way out to a user without a household', () => {
    renderExperience('household', {});

    expect(shownBy('household')).toEqual({ cancellable: false });
  });

  it('creates the household, works in it and opens its Guided Setup in place', async () => {
    const { store, fetchFn, householdMemory } = renderExperience('household', {
      '/households': () => jsonResponse(201, CREATED),
    });

    await press('create');

    expect(await sent(fetchFn, 0)).toEqual({
      path: '/api/v1/households', body: { name: 'The Doe Household' },
    });
    expect(selectActiveHouseholdId(store.getState())).toBe('doe');
    expect(householdMemory.value).toBe('doe');
    expect(location().path).toBe('/setup/guided');
    expect(screen.getByTestId('location').dataset.navigation).toBe('REPLACE');
  });

  it('answers a failure with its code and stays', async () => {
    const { store } = renderExperience('household', {
      '/households': () => jsonResponse(422, envelope('validation.failed')),
    });

    await press('create');

    expect(lastOutcome()).toEqual({ ok: false, error: { code: 'validation.failed', params: {} } });
    expect(selectActiveHouseholdId(store.getState())).toBeNull();
    expect(location().path).toBe('/setup');
  });

  it('lets another household be cancelled, back to the Dashboard', async () => {
    renderExperience('additionalHousehold', {});

    expect(shownBy('household')).toEqual({ cancellable: true });
    await press('cancel');

    expect(location().path).toBe('/');
  });
});
