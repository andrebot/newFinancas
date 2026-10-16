import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { failureOf } from '../../api/outcome';
import type { NotificationHandler, HandlerOutcome } from '../../shell/notificationRouting';
import type { ThunkExtra } from '../../shell/shellState';
import type { RootState } from '../../store';
import type { Alerts } from '../../utilities/AlertProvider';
import type { Translator } from '../../utilities/i18n';
import { manageProfileApi } from './api';

// Respond to Invitation (X3, OQ-159; FR-1.10): the user accepts or declines an
// invitation to another household. Two places start it — the profile's
// invitations panel and the bell, whose `invitation.received` notification the
// App Shell routes here — so the request and its toast live in one thunk.
// Accepting doesn't switch households: the new one appears in the switcher.
// Either answer fetches the invitations again, so one no longer pending (409)
// or gone (404) leaves the list.

/** What the user answers. */
export type InvitationAnswer = 'accept' | 'decline';

/** How the thunk tells the user what happened: the page's toasts, in their language. */
export interface InvitationFeedback {
  readonly alerts: Alerts;
  readonly translator: Translator;
}

/** The Respond to Invitation thunk. */
type RespondThunk = ThunkAction<Promise<HandlerOutcome>, RootState, ThunkExtra, UnknownAction>;

const ANSWERS: readonly string[] = ['accept', 'decline'] satisfies InvitationAnswer[];

// Each answer's toast text key; `.unnamed` when the household isn't known.
const DONE_KEYS = {
  accept: 'invitations.accepted',
  decline: 'invitations.declined',
} as const satisfies Record<InvitationAnswer, string>;

const selectInvitations = manageProfileApi.endpoints.listMyInvitations.select();

/** The root state as Manage Profile's endpoints type it, with their tags. */
type ProfileApiState = Parameters<typeof selectInvitations>[0];

/**
 * Finds the household an invitation is for, among the invitations cached.
 *
 * @param state - The root state. The store's type knows the API's base
 *   endpoints only, not the tags this slice adds, hence the cast.
 * @param invitationId - The invitation.
 * @returns The household's name, or `undefined` when it isn't cached.
 */
const householdNameOf = (state: RootState, invitationId: string) => (
  selectInvitations(state as unknown as ProfileApiState).data
    ?.find((invitation) => invitation.id === invitationId)?.householdName
);

/**
 * Words the toast for a done answer.
 *
 * @param answer - What the user answered.
 * @param household - The household's name, if known.
 * @param translator - The current locale's translator.
 * @returns The toast's text.
 */
export const answeredText = (
  answer: InvitationAnswer,
  household: string | undefined,
  translator: Translator,
) => {
  const key = DONE_KEYS[answer];
  if (household === undefined) {
    return translator.text('profile', `${key}.unnamed`);
  }
  return translator.text('profile', key, { household });
};

/**
 * Accepts or declines an invitation and toasts the result.
 *
 * @param invitationId - The invitation.
 * @param answer - What the user answers.
 * @param feedback - The page's toasts and translator.
 * @returns The thunk; it resolves `done` once answered, else `failed`.
 */
export const respondToInvitation = (
  invitationId: string,
  answer: InvitationAnswer,
  feedback: InvitationFeedback,
): RespondThunk => async (dispatch, getState) => {
  const household = householdNameOf(getState(), invitationId);
  const { acceptInvitation, declineInvitation } = manageProfileApi.endpoints;
  const request = answer === 'accept'
    ? dispatch(acceptInvitation.initiate(invitationId))
    : dispatch(declineInvitation.initiate(invitationId));
  const result = await request;
  request.reset();
  if (result.error !== undefined) {
    const failure = failureOf(result.error);
    feedback.alerts.error(feedback.translator.error(failure.code, failure.params));
    return 'failed';
  }
  feedback.alerts.success(answeredText(answer, household, feedback.translator));
  return 'done';
};

/**
 * Builds the App Shell's route for `invitation.received`: the bell's Accept
 * or Decline, carrying the invitation's id in the notification's params.
 *
 * @param dispatch - The page's store dispatch.
 * @param feedback - The page's toasts and translator.
 * @returns The handler; an action it can't read is `failed`.
 */
export const invitationRoute = (
  dispatch: (thunk: RespondThunk) => Promise<HandlerOutcome>,
  feedback: InvitationFeedback,
): NotificationHandler => async (action) => {
  const { invitationId } = action.params;
  if (typeof invitationId !== 'string' || !ANSWERS.includes(action.action)) {
    return 'failed';
  }
  return dispatch(respondToInvitation(invitationId, action.action as InvitationAnswer, feedback));
};
