import {
  describe, expect, it, vi,
} from 'vitest';
import { manageProfileApi } from '../../../../src/experiences/manageProfile/api';
import {
  answeredText, invitationRoute, respondToInvitation,
} from '../../../../src/experiences/manageProfile/respondToInvitation';
import type { NotificationAction } from '../../../../src/shell/notificationRouting';
import type { Alerts } from '../../../../src/utilities/AlertProvider';
import { createTranslator } from '../../../../src/utilities/i18n';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeStore } from '../../shell/shellFakes';

// Respond to Invitation's thunk (BDT: over the real store and API client; only
// `fetch` and the toasts — the page's sink — are fakes).

const translator = createTranslator('en-US');

const RIVERA = {
  id: 'inv-rivera',
  householdId: 'rivera',
  householdName: 'The Rivera Household',
  role: 'Member',
  invitedByUserId: 'alex',
  inviterFirstName: 'Alex',
  inviterLastName: 'Rivera',
  createdAt: '2026-10-01T12:00:00Z',
};

const SMITH = {
  ...RIVERA, id: 'inv-smith', householdId: 'smith', householdName: 'The Smith Household',
};

/**
 * Toasts that only record what they were asked to show.
 *
 * @returns The fake.
 */
const fakeAlerts = (): Alerts => ({
  success: vi.fn(() => 1),
  info: vi.fn(() => 1),
  warning: vi.fn(() => 1),
  error: vi.fn(() => 1),
  dismiss: vi.fn(),
});

/**
 * Builds the real store whose `fetch` answers each path from a table.
 *
 * @param answers - The answer per path (after `/api/v1`).
 * @returns The store, the fake `fetch` and the feedback the thunk gets.
 */
const setUp = (answers: Readonly<Record<string, () => Response>>) => {
  const fetchFn = vi.fn<typeof fetch>(async (input) => {
    const path = new URL((input as Request).url).pathname.replace('/api/v1', '');
    const answer = answers[path];
    if (!answer) throw new Error(`No answer for ${path}`);
    return answer();
  });
  const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
  return {
    store, fetchFn, feedback: { alerts: fakeAlerts(), translator },
  };
};

/**
 * Lists which paths were called, in order.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each call's method and path.
 */
const calls = (fetchFn: ReturnType<typeof vi.fn<typeof fetch>>) => fetchFn.mock.calls.map(
  ([input]) => `${(input as Request).method} ${new URL((input as Request).url).pathname}`,
);

describe('answeredText', () => {
  it('names the household when it is known', () => {
    expect(answeredText('accept', 'The Rivera Household', translator))
      .toBe('You joined The Rivera Household.');
    expect(answeredText('decline', 'The Rivera Household', translator))
      .toBe('You declined the invitation to The Rivera Household.');
  });

  it('says it plainly when it isn’t', () => {
    expect(answeredText('accept', undefined, translator)).toBe('You joined the household.');
    expect(answeredText('decline', undefined, translator)).toBe('Invitation declined.');
  });
});

describe('respondToInvitation', () => {
  it('accepts, toasts the household it joined and fetches the invitations again', async () => {
    const { store, fetchFn, feedback } = setUp({
      '/users/me/invitations': () => jsonResponse(200, { data: [SMITH, RIVERA] }),
      '/invitations/inv-rivera/accept': () => jsonResponse(200, {
        householdId: 'rivera', role: 'Member',
      }),
    });
    const subscription = store.dispatch(manageProfileApi.endpoints.listMyInvitations.initiate());
    await subscription;

    const outcome = await store.dispatch(respondToInvitation('inv-rivera', 'accept', feedback));

    expect(outcome).toBe('done');
    expect(feedback.alerts.success).toHaveBeenCalledWith('You joined The Rivera Household.');
    await vi.waitFor(() => expect(calls(fetchFn)).toEqual([
      'GET /api/v1/users/me/invitations',
      'POST /api/v1/invitations/inv-rivera/accept',
      'GET /api/v1/users/me/invitations',
    ]));
    subscription.unsubscribe();
  });

  it('declines, naming no household when the list isn’t cached', async () => {
    const { store, fetchFn, feedback } = setUp({
      '/invitations/inv-rivera/decline': () => jsonResponse(200),
    });

    const outcome = await store.dispatch(respondToInvitation('inv-rivera', 'decline', feedback));

    expect(outcome).toBe('done');
    expect(feedback.alerts.success).toHaveBeenCalledWith('Invitation declined.');
    expect(calls(fetchFn)).toEqual(['POST /api/v1/invitations/inv-rivera/decline']);
  });

  it.each([
    [409, 'invitation.not_pending', 'This invitation is no longer pending.'],
    [404, 'invitation.not_found', 'Invitation not found.'],
  ])('toasts a %i (%s) and fails', async (status, code, text) => {
    const { store, feedback } = setUp({
      '/invitations/inv-rivera/accept': () => jsonResponse(status, envelope(code)),
    });

    const outcome = await store.dispatch(respondToInvitation('inv-rivera', 'accept', feedback));

    expect(outcome).toBe('failed');
    expect(feedback.alerts.error).toHaveBeenCalledWith(text);
    expect(feedback.alerts.success).not.toHaveBeenCalled();
  });
});

describe('invitationRoute', () => {
  /**
   * Builds the bell's action on an invitation notification.
   *
   * @param action - What was picked.
   * @param params - The notification's params.
   * @returns The action.
   */
  const bellAction = (
    action: string,
    params: Record<string, unknown> = { invitationId: 'inv-rivera' },
  ): NotificationAction => ({
    notificationId: 'note-1', type: 'invitation.received', action, params,
  });

  it('answers the invitation the notification carries', async () => {
    const { store, fetchFn, feedback } = setUp({
      '/invitations/inv-rivera/accept': () => jsonResponse(200, {
        householdId: 'rivera', role: 'Member',
      }),
    });
    const route = invitationRoute(store.dispatch, feedback);

    expect(await route(bellAction('accept'))).toBe('done');
    expect(calls(fetchFn)).toEqual(['POST /api/v1/invitations/inv-rivera/accept']);
  });

  it('fails an action it can’t read, calling nothing', async () => {
    const { store, fetchFn, feedback } = setUp({});
    const route = invitationRoute(store.dispatch, feedback);

    expect(await route(bellAction('archive'))).toBe('failed');
    expect(await route(bellAction('accept', {}))).toBe('failed');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
