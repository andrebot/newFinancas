import { expect, test } from '@playwright/test';
import openInbox from '../support/bell';
import {
  createHousehold, inviteUser, listHouseholds, registerUser, renameUser,
} from '../support/identityApi';
import { notifications } from '../support/insightsApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I12 — Core E2E journey #14 (OQ-245): invite → bell → accept, in the browser.
// The invitee's bell names the inviter by their *current* name — the notice
// carries ids, never names (OQ-82), so a rename after the invite shows — the
// accept is Manage Profile's Respond to Invitation, routed by the App Shell
// (OQ-156), and the notice is deleted once it succeeds. Preconditions are
// arranged through the API, the end state checked through it.

test('an invitee accepts through the bell, the inviter named as they are now', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Bea', lastName: 'Before' });
  const invitee = await registerUser(request, { firstName: 'Ike', lastName: 'Invitee' });
  const household = await createHousehold(request, owner, 'Bell Home');
  // A household of their own, so they land in the app, where the bell is.
  await createHousehold(request, invitee, 'Ike Home');
  await inviteUser(request, owner, household.id, { email: invitee.email, role: 'Member' });
  await expect.poll(async () => (await notifications(request, invitee)).length).toBe(1);
  // Renamed after the invitation was sent.
  await renameUser(request, owner, { firstName: 'Bea', lastName: 'After' });

  await signInThroughUi(page, invitee);
  const inbox = await openInbox(page);
  await expect(inbox.getByText(text('notifications', 'invitation.received', {
    inviterName: 'Bea After', householdName: 'Bell Home', role: 'Member',
  }))).toBeVisible();

  await inbox.getByRole('button', { name: text('inbox', 'accept') }).click();

  // Manage Profile answers it and says so; the shell then deletes the notice.
  await expect(page.getByText(text('profile', 'invitations.accepted', {
    household: 'Bell Home',
  }))).toBeVisible();
  await expect(inbox.getByText(text('inbox', 'empty'))).toBeVisible();
  expect(await notifications(request, invitee)).toEqual([]);
  expect(await listHouseholds(request, invitee)).toContainEqual(
    expect.objectContaining({ id: household.id, role: 'Member' }),
  );
});
