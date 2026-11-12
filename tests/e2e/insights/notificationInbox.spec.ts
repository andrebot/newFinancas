import { expect, test, type Page } from '@playwright/test';
import {
  createHousehold, inviteUser, registerUser, revokeInvitation,
} from '../support/identityApi';
import { notifications } from '../support/insightsApi';
import { startingWith } from '../support/locators';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I11 — the bell's inbox (X8; mockup 23; FR-6.10, uc-05 View Notification
// Inbox and uc-06 Delete Notification) against the real API, Full E2E: an
// invitation revoked before its invitee answered leaves a notice that says so,
// with only its delete (OQ-243). Opening the inbox marks it seen — "new" while
// that panel stays open, "Seen" the next time — and deleting it empties the
// inbox. Accepting through the bell, and the matured Holding's Archive, are
// the shell's routing (I12).

/**
 * Opens the bell's inbox.
 *
 * @param page - The browser page, signed in.
 * @returns The inbox panel.
 */
const openInbox = async (page: Page) => {
  const bell = text('shell', 'header.notifications');
  // Named by its label and, while there are any, the unseen count, e.g. `Notifications 1 unseen`.
  await page.getByRole('button', { name: startingWith(bell) }).click();
  return page.getByRole('dialog', { name: bell });
};

test('a revoked invitation\'s notice is marked seen and deleted from the bell', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Iris', lastName: 'Inviter' });
  const invitee = await registerUser(request, { firstName: 'Noah', lastName: 'Notified' });
  const household = await createHousehold(request, owner, 'Inbox Home');
  // A household of their own, so they land in the app, where the bell is.
  await createHousehold(request, invitee, 'Notified Home');
  const invitation = await inviteUser(request, owner, household.id, {
    email: invitee.email, role: 'Member',
  });
  await revokeInvitation(request, owner, household.id, invitation.id);
  // The notice is written by the notifications utility once the invite commits.
  await expect.poll(async () => (await notifications(request, invitee)).length).toBe(1);

  await signInThroughUi(page, invitee);
  const unseen = page.getByText(text('shell', 'header.unseen', { count: 1 }));
  await expect(unseen).toHaveCount(1);

  // Opened: the notice says the invitation is gone and offers only its delete.
  const inbox = await openInbox(page);
  await expect(inbox.getByText(text('inbox', 'stale'))).toBeVisible();
  await expect(inbox.getByText(text('inbox', 'newSeen', { count: 1 }))).toBeVisible();
  await expect(inbox.getByRole('button', { name: text('inbox', 'accept') })).toHaveCount(0);
  await expect(inbox.getByRole('button', { name: text('inbox', 'decline') })).toHaveCount(0);
  // Still there, one notice, now with the moment it was seen.
  await expect.poll(() => notifications(request, invitee))
    .toEqual([expect.objectContaining({ seenAt: expect.any(String) })]);

  // Closed and opened again: seen, the bell's count gone.
  await page.keyboard.press('Escape');
  await expect(unseen).toHaveCount(0);
  const reopened = await openInbox(page);
  const seen = text('inbox', 'seen', { time: '' }).trim();
  await expect(reopened.getByText(startingWith(seen))).toBeVisible();
  await expect(reopened.getByText(text('inbox', 'newSeen', { count: 1 }))).toHaveCount(0);

  // Deleted: the inbox is empty, here and on the server.
  await reopened.getByRole('button', { name: text('inbox', 'delete') }).click();
  await expect(reopened.getByText(text('inbox', 'empty'))).toBeVisible();
  expect(await notifications(request, invitee)).toEqual([]);
});
