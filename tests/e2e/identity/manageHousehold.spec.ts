import {
  expect, test, type Browser, type Page,
} from '@playwright/test';
import {
  addMember, createHousehold, listMembers, registerUser, type TestUser,
} from '../support/identityApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I7 — Manage Household (X4), and Manage Profile's side of an invitation,
// against the real API. Invite → accept, Transfer Ownership and Leave as
// Owner are Core E2E journeys #2, #4 and #3 (BDT plan); the rest is Full E2E.

let owner: TestUser;
let householdId: string;

/**
 * A member's display name, as the members list shows it.
 *
 * @param user - The member.
 * @returns First and last name.
 */
const fullName = (user: TestUser) => `${user.firstName} ${user.lastName}`;

/**
 * Opens a second, separate browser session — another person on another
 * device — with the project's settings (base URL, locale).
 *
 * @param browser - The test's browser.
 * @returns The new session's page.
 */
const otherDevice = async (browser: Browser): Promise<Page> => {
  const { baseURL, locale } = test.info().project.use;
  const context = await browser.newContext({
    ...(baseURL ? { baseURL } : {}),
    ...(locale ? { locale } : {}),
  });
  return context.newPage();
};

test.beforeEach(async ({ page, request }) => {
  owner = await registerUser(request, { firstName: 'Olga', lastName: 'Owner' });
  householdId = (await createHousehold(request, owner, 'Shared Home')).id;
  await signInThroughUi(page, owner);
  await page.goto('/household');
});

test('an invited user accepts and joins with the invited role', { tag: '@core' }, async ({
  page, request, browser,
}) => {
  const invitee = await registerUser(request, { firstName: 'Ivan', lastName: 'Invitee' });
  await createHousehold(request, invitee, 'Ivan Home');

  await page.getByLabel(text('membership', 'invite.email')).fill(invitee.email);
  await page.getByRole('button', { name: text('membership', 'invite.submit') }).click();
  await expect(page.getByText(text('membership', 'invite.done', { email: invitee.email })))
    .toBeVisible();

  const inviteePage = await otherDevice(browser);
  await signInThroughUi(inviteePage, invitee);
  await inviteePage.goto('/profile');
  await inviteePage.getByRole('button', {
    name: text('profile', 'invitations.acceptLabel', { household: 'Shared Home' }),
  }).click();
  await expect(inviteePage.getByText(text('profile', 'invitations.accepted', {
    household: 'Shared Home',
  }))).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', {
    name: text('membership', 'members.rolePill', { name: fullName(invitee), role: 'Member' }),
  })).toBeVisible();
});

test('the Owner changes a member\'s role', async ({ page, request }) => {
  const member = await registerUser(request, { firstName: 'Mia', lastName: 'Member' });
  await addMember(request, owner, householdId, { user: member, role: 'Member' });
  await page.reload();

  await page.getByRole('button', {
    name: text('membership', 'members.rolePill', { name: fullName(member), role: 'Member' }),
  }).click();
  const adminOption = new RegExp(`^${text('membership', 'role.Admin')}`);
  await page.getByRole('menuitemradio', { name: adminOption }).click();
  await expect(page.getByText(text('membership', 'role.done', {
    name: fullName(member), role: 'Admin',
  }))).toBeVisible();

  const members = await listMembers(request, owner, householdId);
  expect(members.find((each) => each.email === member.email)?.role).toBe('Admin');
});

test('the Owner hands ownership over and becomes an Admin', { tag: '@core' }, async ({
  page, request,
}) => {
  const admin = await registerUser(request, { firstName: 'Ada', lastName: 'Admin' });
  await addMember(request, owner, householdId, { user: admin, role: 'Admin' });
  await page.reload();

  await page.getByRole('button', { name: text('membership', 'transfer.open') }).click();
  await page.getByRole('menuitem', { name: new RegExp(`^${fullName(admin)}`) }).click();
  await page.getByRole('button', { name: text('membership', 'transfer.confirm') }).last().click();
  await expect(page.getByText(text('membership', 'transfer.done', { name: fullName(admin) })))
    .toBeVisible();

  // Exactly one Owner, atomically: the swap never leaves zero or two.
  const roles = (await listMembers(request, admin, householdId))
    .map(({ email, role }) => ({ email, role }));
  expect(roles).toEqual(expect.arrayContaining([
    { email: admin.email, role: 'Owner' },
    { email: owner.email, role: 'Admin' },
  ]));
  expect(roles.filter(({ role }) => role === 'Owner')).toHaveLength(1);
});

test('an Owner who leaves hands the household to an Admin before a Member', {
  tag: '@core',
}, async ({ page, request }) => {
  const member = await registerUser(request, { firstName: 'Max', lastName: 'Member' });
  const admin = await registerUser(request, { firstName: 'Abe', lastName: 'Admin' });
  await addMember(request, owner, householdId, { user: member, role: 'Member' });
  await addMember(request, owner, householdId, { user: admin, role: 'Admin' });
  await page.reload();

  await expect(page.getByText(text('household', 'leave.successor', { name: fullName(admin) })))
    .toBeVisible();
  await page.getByRole('button', { name: text('household', 'leave.open') }).click();
  await page.getByRole('button', { name: text('household', 'leave.confirm'), exact: true }).click();

  // Their only household gone, they land on Household Setup.
  await expect(page).toHaveURL(/\/setup$/);
  const roles = (await listMembers(request, admin, householdId))
    .map(({ email, role }) => ({ email, role }));
  expect(roles).toEqual(expect.arrayContaining([
    { email: admin.email, role: 'Owner' },
    { email: member.email, role: 'Member' },
  ]));
  expect(roles).toHaveLength(2);
});

test('the Owner deletes the household after typing its name', async ({ page }) => {
  await page.getByRole('button', { name: text('householdDeletion', 'continue') }).click();
  const confirmLabel = text('householdDeletion', 'confirm.label', { householdName: 'Shared Home' });
  await page.getByLabel(confirmLabel).fill('Shared Home');
  await page.getByRole('button', { name: text('householdDeletion', 'confirm.submit') }).click();

  await expect(page).toHaveURL(/\/setup$/);
});
