import { expect, test } from '@playwright/test';
import {
  createAccount, createBudget, createGoal, listBudgets, listGoals, seededCategories,
} from '../support/accountApi';
import {
  accountTransactions, daysAgo, getAccount, isoDay, recordTransaction,
} from '../support/financeApi';
import {
  addMember, createHousehold, currentUser, listMembers, refreshStatus, registerUser,
  signInWithRecoveryCode,
} from '../support/identityApi';
import { exportAuditLog } from '../support/insightsApi';
import { indexRateValues, recordIndexRate } from '../support/investmentsApi';
import { submitCredentials, signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I13 — Core E2E journey #8, Delete User (GDPR; FR-1.17/1.18, OQ-240/246):
// the user deletes their own account through Manage Profile's Delete Account
// Flow (FL8). Each household they belong to is left first — the one they own
// passes to its other member — then their finances are erased and the user
// row goes. Shared rows stay, no longer naming them; the audit log keeps every
// entry that does. Personal rows are visible to no one else, so their
// deletion can't be seen through the API: the journey's personal Account,
// Budget and Goal prove only that none still names the user — a row that did
// would block the user row's delete (restrict foreign keys), a 500 the
// browser step would show — and the transfer from the personal account shows
// the pair undone (OQ-240). That they are deleted, not just unnamed, is M1D's
// integration suite's to prove. Preconditions are arranged through the API,
// the end state checked through it.

/** The audit export's range: a day either side, so a run across midnight still finds its lines. */
const AUDIT_RANGE = { startDate: isoDay(daysAgo(1)), endDate: isoDay(daysAgo(-1)) };

/** How long the audit poll waits: the audit sink retries a failed write after 1s, then 5s. */
const AUDIT_POLL_MS = 10_000;

/**
 * The lines of a CSV export, empty ones left out.
 *
 * @param csv - The export's body.
 * @returns Its lines.
 */
const linesOf = (csv: string): string[] => csv.split('\n').filter((line) => line !== '');

test('a user deletes their account: ownership passes on, shared data loses their name', {
  tag: '@core',
}, async ({ page, request }) => {
  const dana = await registerUser(request, { firstName: 'Dana', lastName: 'Departing' });
  const mo = await registerUser(request, { firstName: 'Mo', lastName: 'Member' });
  const olga = await registerUser(request, { firstName: 'Olga', lastName: 'Owner' });
  const danaId = (await currentUser(request, dana.accessToken)).id;
  const today = isoDay(new Date());

  // Home A, Dana's, Mo its other member; Home B, Olga's, Dana a member there.
  const homeA = await createHousehold(request, dana, 'Dana Home', 'none');
  await addMember(request, dana, homeA.id, { user: mo, role: 'Member' });
  const homeB = await createHousehold(request, olga, 'Olga Home');
  await addMember(request, olga, homeB.id, { user: dana, role: 'Member' });

  // Dana's finances in Home A: personal ones, and contributions to shared ones.
  const shared = await createAccount(request, dana, homeA.id, {
    name: 'Joint Checking', visibility: 'shared',
  });
  const personal = await createAccount(request, dana, homeA.id, {
    name: 'Dana Wallet', visibility: 'personal',
  });
  const [personalCategory, sharedCategory] = await seededCategories(request, dana, homeA.id);
  // Personal: each would block the delete if it still named her.
  await createBudget(request, dana, homeA.id, {
    name: 'Dana Fun', categoryIds: [personalCategory!.id], visibility: 'personal',
  });
  await createGoal(request, dana, homeA.id, {
    name: 'Dana Trip', targetAmount: 500_000, currency: 'BRL', visibility: 'personal',
  });
  // Shared: each must survive, unnamed.
  const sharedBudget = await createBudget(request, dana, homeA.id, {
    name: 'House Bills', categoryIds: [sharedCategory!.id],
  });
  const sharedGoal = await createGoal(request, dana, homeA.id, {
    name: 'New Roof', targetAmount: 900_000, currency: 'BRL',
  });
  const groceries = await recordTransaction(request, dana, homeA.id, {
    kind: 'withdrawal',
    accountId: shared.id,
    date: today,
    amount: 12_345,
    currency: 'BRL',
    description: 'Groceries',
  });
  await recordTransaction(request, dana, homeA.id, {
    kind: 'transfer_sent',
    accountId: personal.id,
    toAccountId: shared.id,
    date: today,
    amount: 50_000,
    currency: 'BRL',
    description: 'Rent share',
  });
  await recordIndexRate(request, dana, homeA.id, { index: 'cdi', value: 105_000, asOf: today });
  const otherDevice = await signInWithRecoveryCode(request, dana);
  const auditOf = async () => (await exportAuditLog(request, mo, homeA.id, AUDIT_RANGE)).body;
  // Mo may not export as a Member: read it as Dana, the Owner, before she goes.
  const auditBefore = linesOf((await exportAuditLog(request, dana, homeA.id, AUDIT_RANGE)).body);
  expect(auditBefore.join('\n')).toContain(`,${danaId},CreateHousehold,`);

  // In the browser: the danger zone names the household she owns — not the
  // one she's a member of — and only her email unlocks the confirm.
  await signInThroughUi(page, dana);
  await page.goto('/profile');
  const dangerZone = page.getByRole('region', { name: text('deleteAccount', 'title') });
  await expect(dangerZone.getByText(text('deleteAccount', 'ownership', { count: 1 })))
    .toBeVisible();
  await expect(dangerZone.getByRole('listitem')).toHaveText(['Dana Home']);
  await expect(page.getByText('Olga Home')).toHaveCount(0);
  await dangerZone.getByRole('button', { name: text('deleteAccount', 'continue') }).click();
  const confirmButton = dangerZone.getByRole('button', {
    name: text('deleteAccount', 'confirm.submit'),
  });
  const confirmation = dangerZone.getByLabel(text('deleteAccount', 'confirm.label', {
    email: dana.email,
  }));
  await expect(confirmButton).toBeDisabled();
  await confirmation.fill(dana.email.slice(0, -1));
  await expect(confirmButton).toBeDisabled();
  await confirmation.fill(dana.email);
  await confirmButton.click();

  // Signed out to Sign In, which no longer knows her.
  await expect(page.getByText(text('profile', 'deleted'))).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
  await submitCredentials(page, dana);
  await expect(page.getByText(text('errors', 'auth.invalid_credentials'))).toBeVisible();
  expect(await refreshStatus(request, otherDevice.refreshToken!)).toBe(401);

  // Home A passed to Mo, its only member and Owner; Home B is Olga's alone.
  expect(await listMembers(request, mo, homeA.id)).toEqual([
    expect.objectContaining({ email: mo.email, role: 'Owner' }),
  ]);
  expect(await listMembers(request, olga, homeB.id)).toEqual([
    expect.objectContaining({ email: olga.email, role: 'Owner' }),
  ]);

  // Shared data stays, naming no one.
  expect(await getAccount(request, mo, homeA.id, shared.id))
    .toMatchObject({ ownerUserId: null, visibility: 'shared' });
  expect((await listBudgets(request, mo, homeA.id)).find(({ id }) => id === sharedBudget.id))
    .toMatchObject({ name: 'House Bills', ownerUserId: null });
  expect((await listGoals(request, mo, homeA.id)).find(({ id }) => id === sharedGoal.id))
    .toMatchObject({ name: 'New Roof', ownerUserId: null });
  const sharedRows = await accountTransactions(request, mo, homeA.id, shared.id);
  expect(sharedRows).toHaveLength(2);
  expect(sharedRows.find((row) => row.id === groceries.id))
    .toMatchObject({ description: 'Groceries', createdByUserId: null });
  // The transfer's side on the shared account, its pair undone: a lone movement now.
  expect(sharedRows.find((row) => row.description === 'Rent share'))
    .toMatchObject({ effect: 'movement', transfer: null, createdByUserId: null });
  expect(await indexRateValues(request, mo, homeA.id, 'cdi'))
    .toEqual([expect.objectContaining({ value: 105_000, createdByUserId: null })]);

  // The audit log is untouched: every line from before is still there, and her
  // departure joins them (written after the response, so polled for).
  await expect.poll(auditOf, { timeout: AUDIT_POLL_MS })
    .toContain(`,${danaId},LeaveHousehold,`);
  expect(linesOf(await auditOf())).toEqual(expect.arrayContaining(auditBefore));
});
