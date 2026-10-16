import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type {
  DeleteAccountFlowProps,
} from '../../../../src/experiences/manageProfile/flows/deleteAccount/DeleteAccountFlow';
import type {
  SecurityFlowProps,
} from '../../../../src/experiences/manageProfile/flows/security/SecurityFlow';
import type {
  EditPersonalInfoProps,
} from '../../../../src/experiences/manageProfile/interactions/EditPersonalInfo';
import type {
  EditPreferencesProps,
} from '../../../../src/experiences/manageProfile/interactions/EditPreferences';
import type {
  RespondToInvitationProps,
} from '../../../../src/experiences/manageProfile/interactions/RespondToInvitation';
import {
  ManageProfileExperience,
} from '../../../../src/experiences/manageProfile/ManageProfileExperience';
import { householdChosen, selectSession } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// Experience (BDT: integration). The Flows and standalone Interactions it
// composes are stubs: plain buttons that make each request with fixed input
// and show what they were given and the outcome they got back. Beneath it,
// the real store and API client; only `fetch` is fake.

vi.mock('../../../../src/experiences/manageProfile/flows/security/SecurityFlow', () => ({
  /**
   * Security's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  SecurityFlow: ({
    onLoadSessions, onRevokeSession, onRevokeOthers, onChangePassword,
  }: SecurityFlowProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <Stub
      name="security"
      requests={{
        load: onLoadSessions,
        revoke: () => onRevokeSession('s-2'),
        revokeOthers: onRevokeOthers,
        changePassword: () => onChangePassword({
          currentPassword: 'old-password-1', newPassword: 'velvet-orbit-cactus-71',
        }),
      }}
    />
  ),
}));

vi.mock('../../../../src/experiences/manageProfile/flows/deleteAccount/DeleteAccountFlow', () => ({
  /**
   * Delete Account's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  DeleteAccountFlow: ({ email, ownedHouseholds, onDelete }: DeleteAccountFlowProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <Stub name="deleteAccount" shows={{ email, ownedHouseholds }} requests={{ delete: onDelete }} />
  ),
}));

vi.mock('../../../../src/experiences/manageProfile/interactions/EditPersonalInfo', () => ({
  /**
   * Edit Personal Info's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  EditPersonalInfo: ({
    saved, email, busy, alert, onSave,
  }: EditPersonalInfoProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <Stub
      name="personalInfo"
      shows={{
        saved, email, busy, alert,
      }}
      events={{ save: () => onSave({ firstName: 'Janet', lastName: 'Doe' }) }}
    />
  ),
}));

vi.mock('../../../../src/experiences/manageProfile/interactions/EditPreferences', () => ({
  /**
   * Edit Preferences' stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  EditPreferences: ({
    theme, language, onTheme, onLanguage,
  }: EditPreferencesProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <Stub
      name="preferences"
      shows={{ theme, language }}
      events={{ light: () => onTheme('light'), portuguese: () => onLanguage('pt-BR') }}
    />
  ),
}));

vi.mock('../../../../src/experiences/manageProfile/interactions/RespondToInvitation', () => ({
  /**
   * Respond to Invitation's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  RespondToInvitation: ({ invitations, answering, onAnswer }: RespondToInvitationProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <Stub
      name="invitations"
      shows={{ ids: invitations.map((invitation) => invitation.id), answering }}
      events={{ accept: () => onAnswer('inv-rivera', 'accept') }}
    />
  ),
}));

/** A stub's props. */
interface StubProps {
  readonly name: string;
  /** Props worth asserting on, shown as JSON. */
  readonly shows?: unknown;
  /** Buttons that make a request and show its outcome. */
  readonly requests?: Readonly<Record<string, () => Promise<unknown>>>;
  /** Buttons that only emit. */
  readonly events?: Readonly<Record<string, () => void>>;
}

/**
 * Stands in for a Flow or Interaction: one button per request or event, and
 * the last outcome the Experience answered.
 *
 * @param props - The stub's name, what it shows and its buttons.
 * @returns The stub.
 */
function Stub({
  name, shows, requests = {}, events = {},
}: StubProps) {
  const [outcome, setOutcome] = useState<unknown>();
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
      <output data-testid={`${name}-outcome`}>{outcome ? JSON.stringify(outcome) : ''}</output>
    </div>
  );
}

/** A canned answer per `METHOD path`; a function so each call gets a fresh body. */
type Answers = Readonly<Record<string, () => Response | Promise<Response>>>;

const USER = {
  id: 'jane',
  email: 'jane.doe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: '2026-01-01T00:00:00Z',
  preferences: { theme: 'dark', language: 'en-US' },
};

const HOUSEHOLDS = [
  {
    id: 'doe', name: 'The Doe Household', createdAt: '2026-01-01T00:00:00Z', role: 'Owner',
  },
  {
    id: 'smith', name: 'The Smith Household', createdAt: '2026-02-01T00:00:00Z', role: 'Owner',
  },
  {
    id: 'rivera', name: 'The Rivera Household', createdAt: '2026-03-01T00:00:00Z', role: 'Member',
  },
];

const INVITATION = {
  id: 'inv-rivera',
  householdId: 'rivera',
  householdName: 'The Rivera Household',
  role: 'Member',
  invitedByUserId: 'alex',
  inviterFirstName: 'Alex',
  inviterLastName: 'Rivera',
  createdAt: '2026-10-01T12:00:00Z',
};

const SESSIONS = [{
  id: 's-1',
  deviceInfo: null,
  createdAt: '2026-10-01T12:00:00Z',
  lastUsedAt: '2026-10-15T12:00:00Z',
  current: true,
}];

/** Answers for a page that loads: Jane, her households, no invitations. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, USER),
  'GET /households': () => jsonResponse(200, { data: HOUSEHOLDS }),
  'GET /users/me/invitations': () => jsonResponse(200, { data: [] }),
};

/**
 * Builds a fake `fetch` answering each method and path from a table.
 *
 * @param answers - The answer per `METHOD path` (after `/api/v1`).
 * @returns The fake.
 */
const fakeFetch = (answers: Answers) => vi.fn<typeof fetch>(async (input) => {
  const request = input as Request;
  const route = `${request.method} ${new URL(request.url).pathname.replace('/api/v1', '')}`;
  const answer = answers[route];
  if (!answer) throw new Error(`No answer for ${route}`);
  return answer();
});

/**
 * Lists the calls `fetch` got, with their bodies.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each call's method, path and parsed body (if any).
 */
const sent = async (fetchFn: ReturnType<typeof fakeFetch>) => Promise.all(
  fetchFn.mock.calls.map(async ([input]) => {
    const request = input as Request;
    const text = await request.clone().text();
    return {
      route: `${request.method} ${new URL(request.url).pathname}`,
      body: text ? JSON.parse(text) as unknown : undefined,
    };
  }),
);

/**
 * Lets every answer `fetch` already has reach the page. The API client hands
 * each one on over a few turns of the event loop, and the store tells React
 * about RTK Query's answers only on the next animation frame (its default
 * auto-batching), so this waits for one.
 */
const settle = async () => {
  await act(async () => {
    await new Promise((done) => {
      requestAnimationFrame(() => setTimeout(done, 0));
    });
  });
};

/**
 * Sends a held response, then lets it reach the page.
 *
 * @param pending - The held response.
 * @param response - What it answers.
 */
const settleWith = async (pending: ReturnType<typeof deferred>, response: Response) => {
  pending.resolve(response);
  await settle();
};

/**
 * Renders the Experience over the real store, signed in with Doe active.
 *
 * @param answers - The API's answers, over the loaded page's.
 * @param loads - Whether to wait for the profile to show.
 * @returns The store and the fake `fetch`.
 */
const renderExperience = async (answers: Answers = {}, loads = true) => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <ManageProfileExperience />
    </AlertProvider>,
    store,
    { path: '/profile' },
  );
  if (loads) await screen.findByRole('heading', { level: 1 });
  await settle();
  return { store, fetchFn };
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
  await settle();
};

/**
 * Reads what a stub was given.
 *
 * @param name - The stub.
 * @returns Its shown props.
 */
const shownBy = (name: string) => (
  JSON.parse(screen.getByTestId(name).dataset.shows ?? 'null') as unknown
);

/**
 * Reads the last outcome a stub got.
 *
 * @param name - The stub.
 * @returns The outcome.
 */
const outcomeOf = (name: string) => (
  JSON.parse(screen.getByTestId(`${name}-outcome`).textContent ?? '') as unknown
);

/**
 * Builds a response the test sends when it chooses.
 *
 * @returns The response's promise and its resolver.
 */
const deferred = () => {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((answer) => {
    resolve = answer;
  });
  return { promise, resolve };
};

describe('ManageProfileExperience — the page', () => {
  it('shows a skeleton until the profile loads', async () => {
    const pending = deferred();
    await renderExperience({ 'GET /users/me': () => pending.promise }, false);

    expect(screen.getByRole('status', { name: 'Loading your profile' })).toBeTruthy();
    await settleWith(pending, jsonResponse(200, USER));
    expect(await screen.findByRole('heading', { level: 1, name: 'Jane Doe' })).toBeTruthy();
  });

  it('names the user, their email and their role in the active household', async () => {
    await renderExperience();

    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Jane Doe' })).toBeTruthy();
    expect(screen.getByText('jane.doe@example.com · Owner of The Doe Household')).toBeTruthy();
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('shows the email alone until the households load', async () => {
    const pending = deferred();
    await renderExperience({ 'GET /households': () => pending.promise });

    expect(screen.getByText('jane.doe@example.com')).toBeTruthy();
    expect(shownBy('deleteAccount')).toEqual({
      email: 'jane.doe@example.com', ownedHouseholds: [],
    });
  });

  it('offers a retry when the profile can’t load', async () => {
    let answer = () => jsonResponse(500, envelope('internal.unexpected'));
    await renderExperience({ 'GET /users/me': () => answer() }, false);
    expect(await screen.findByText("Couldn't load your profile.")).toBeTruthy();

    answer = () => jsonResponse(200, USER);
    await press('Try again');

    expect(await screen.findByRole('heading', { level: 1, name: 'Jane Doe' })).toBeTruthy();
  });
});

describe('ManageProfileExperience — personal info', () => {
  it('saves the names, toasts it and gives the panel the saved ones', async () => {
    const { fetchFn } = await renderExperience({
      'PATCH /users/me': () => jsonResponse(200, { ...USER, firstName: 'Janet' }),
    });
    expect(shownBy('personalInfo')).toEqual({
      saved: { firstName: 'Jane', lastName: 'Doe' }, email: 'jane.doe@example.com', busy: false,
    });

    await press('save');

    expect((await sent(fetchFn)).at(-1)).toEqual({
      route: 'PATCH /api/v1/users/me', body: { firstName: 'Janet', lastName: 'Doe' },
    });
    expect(screen.getByText('Profile saved.')).toBeTruthy();
    expect(shownBy('personalInfo')).toMatchObject({ saved: { firstName: 'Janet' } });
    expect(screen.getByRole('heading', { level: 1, name: 'Janet Doe' })).toBeTruthy();
  });

  it('is busy while the save is out', async () => {
    const pending = deferred();
    await renderExperience({ 'PATCH /users/me': () => pending.promise });

    await press('save');

    expect(shownBy('personalInfo')).toMatchObject({ busy: true });
    await settleWith(pending, jsonResponse(200, USER));
    expect(shownBy('personalInfo')).toMatchObject({ busy: false });
  });

  it('hands a refused save to the panel, keeping the names as saved', async () => {
    await renderExperience({
      'PATCH /users/me': () => jsonResponse(422, envelope('validation.failed', { details: [] })),
    });

    await press('save');

    expect(shownBy('personalInfo')).toMatchObject({
      saved: { firstName: 'Jane' }, alert: 'Some fields need your attention.',
    });
    expect(screen.queryByText('Profile saved.')).toBeNull();
  });
});

describe('ManageProfileExperience — preferences', () => {
  it('applies a picked theme at once and keeps it once saved', async () => {
    const pending = deferred();
    const { fetchFn } = await renderExperience({ 'PATCH /users/me': () => pending.promise });
    expect(shownBy('preferences')).toEqual({ theme: 'dark', language: 'en-US' });

    await press('light');

    expect(shownBy('preferences')).toEqual({ theme: 'light', language: 'en-US' });
    expect((await sent(fetchFn)).at(-1)).toEqual({
      route: 'PATCH /api/v1/users/me', body: { preferences: { theme: 'light' } },
    });
    await settleWith(pending, jsonResponse(200, {
      ...USER, preferences: { theme: 'light', language: 'en-US' },
    }));
    expect(shownBy('preferences')).toEqual({ theme: 'light', language: 'en-US' });
  });

  it('undoes a pick the API refuses, and toasts it', async () => {
    await renderExperience({
      'PATCH /users/me': () => jsonResponse(500, envelope('internal.unexpected')),
    });

    await press('portuguese');

    expect(shownBy('preferences')).toEqual({ theme: 'dark', language: 'en-US' });
    expect(screen.getByText("Your preference wasn't saved. Please try again.")).toBeTruthy();
  });

  it('shows the defaults when no preference is saved', async () => {
    await renderExperience({
      'GET /users/me': () => jsonResponse(200, { ...USER, preferences: {} }),
    });

    expect(shownBy('preferences')).toEqual({ theme: 'dark', language: 'en-US' });
  });
});

describe('ManageProfileExperience — security', () => {
  it('lists the sessions for the Flow', async () => {
    await renderExperience({
      'GET /users/me/sessions': () => jsonResponse(200, { data: SESSIONS }),
    });

    await press('load');

    expect(outcomeOf('security')).toEqual({ ok: true, sessions: SESSIONS });
  });

  it('reads an answer with no list as no sessions', async () => {
    await renderExperience({ 'GET /users/me/sessions': () => jsonResponse(200, {}) });

    await press('load');

    expect(outcomeOf('security')).toEqual({ ok: true, sessions: [] });
  });

  it('hands a failed load to the Flow', async () => {
    await renderExperience({
      'GET /users/me/sessions': () => jsonResponse(500, envelope('internal.unexpected')),
    });

    await press('load');

    expect(outcomeOf('security')).toMatchObject({
      ok: false, error: { code: 'internal.unexpected' },
    });
  });

  it('revokes one session, then all the others', async () => {
    const { fetchFn } = await renderExperience({
      'DELETE /users/me/sessions/s-2': () => jsonResponse(204),
      'DELETE /users/me/sessions': () => jsonResponse(204),
    });

    await press('revoke');
    expect(outcomeOf('security')).toEqual({ ok: true });
    await press('revokeOthers');

    expect((await sent(fetchFn)).slice(-2).map((call) => call.route)).toEqual([
      'DELETE /api/v1/users/me/sessions/s-2',
      'DELETE /api/v1/users/me/sessions',
    ]);
    expect(outcomeOf('security')).toEqual({ ok: true });
  });

  it('hands a revoke’s 404 to the Flow', async () => {
    await renderExperience({
      'DELETE /users/me/sessions/s-2': () => jsonResponse(404, envelope('session.not_found')),
    });

    await press('revoke');

    expect(outcomeOf('security')).toMatchObject({
      ok: false, error: { code: 'session.not_found' },
    });
  });

  it('changes the password', async () => {
    const { fetchFn } = await renderExperience({
      'POST /auth/change-password': () => jsonResponse(200),
    });

    await press('changePassword');

    expect((await sent(fetchFn)).at(-1)).toEqual({
      route: 'POST /api/v1/auth/change-password',
      body: { currentPassword: 'old-password-1', newPassword: 'velvet-orbit-cactus-71' },
    });
    expect(outcomeOf('security')).toEqual({ ok: true });
  });

  it('hands a wrong current password to the Flow', async () => {
    await renderExperience({
      'POST /auth/change-password': () => jsonResponse(401, envelope('password.current_incorrect')),
    });

    await press('changePassword');

    expect(outcomeOf('security')).toMatchObject({
      ok: false, error: { code: 'password.current_incorrect' },
    });
  });
});

describe('ManageProfileExperience — invitations', () => {
  it('shows no panel when nothing waits for an answer', async () => {
    await renderExperience();

    expect(screen.queryByTestId('invitations')).toBeNull();
  });

  it('reads an answer with no list as no invitations', async () => {
    await renderExperience({ 'GET /users/me/invitations': () => jsonResponse(200, {}) });

    expect(screen.queryByTestId('invitations')).toBeNull();
  });

  it('accepts one: busy while out, then toasted and the lists fetched again', async () => {
    const pending = deferred();
    let invitations = [INVITATION];
    const { fetchFn } = await renderExperience({
      'GET /users/me/invitations': () => jsonResponse(200, { data: invitations }),
      'POST /invitations/inv-rivera/accept': () => pending.promise,
    });
    expect(shownBy('invitations')).toEqual({ ids: ['inv-rivera'] });

    await press('accept');
    expect(shownBy('invitations')).toEqual({
      ids: ['inv-rivera'], answering: { invitationId: 'inv-rivera', answer: 'accept' },
    });
    invitations = [];
    await settleWith(pending, jsonResponse(200, {
      householdId: 'rivera', role: 'Member',
    }));

    expect(screen.getByText('You joined The Rivera Household.')).toBeTruthy();
    expect(screen.queryByTestId('invitations')).toBeNull();
    const routes = (await sent(fetchFn)).map((call) => call.route);
    expect(routes.filter((route) => route === 'GET /api/v1/households')).toHaveLength(2);
  });

  it('toasts an invitation no longer pending, and lets the user answer again', async () => {
    await renderExperience({
      'GET /users/me/invitations': () => jsonResponse(200, { data: [INVITATION] }),
      'POST /invitations/inv-rivera/accept': () => (
        jsonResponse(409, envelope('invitation.not_pending'))
      ),
    });

    await press('accept');

    expect(screen.getByText('This invitation is no longer pending.')).toBeTruthy();
    expect(shownBy('invitations')).toEqual({ ids: ['inv-rivera'] });
  });
});

describe('ManageProfileExperience — delete account', () => {
  it('gives the Flow the email and the households the user owns', async () => {
    await renderExperience();

    expect(shownBy('deleteAccount')).toEqual({
      email: 'jane.doe@example.com',
      ownedHouseholds: ['The Doe Household', 'The Smith Household'],
    });
  });

  it('deletes the account, toasts it and ends the session', async () => {
    const { store, fetchFn } = await renderExperience({
      'DELETE /users/me': () => jsonResponse(204),
    });

    await press('delete');

    expect((await sent(fetchFn)).map((call) => call.route)).toContain('DELETE /api/v1/users/me');
    expect(selectSession(store.getState())).toBe('signedOut');
    expect(screen.getByText('Your account was deleted.')).toBeTruthy();
  });

  it('hands a failed deletion to the Flow, still signed in', async () => {
    const { store } = await renderExperience({
      'DELETE /users/me': () => jsonResponse(500, envelope('internal.unexpected')),
    });

    await press('delete');

    expect(outcomeOf('deleteAccount')).toMatchObject({
      ok: false, error: { code: 'internal.unexpected' },
    });
    expect(selectSession(store.getState())).toBe('signedIn');
  });
});
