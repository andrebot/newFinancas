import { expect, test } from '@playwright/test';
import {
  createAccount, createBudget, createGoal, seededCategories,
} from '../support/accountApi';
import {
  accountTransactions, getAccount, isoDay, recordTransaction,
} from '../support/financeApi';
import {
  addMember, createHousehold, currentUser, listMembers, refreshStatus, registerUser,
  signInWithRecoveryCode,
} from '../support/identityApi';
import { exportAuditLog } from '../support/insightsApi';
import { indexRateValues, recordIndexRate } from '../support/investmentsApi';
import { submitCredentials, signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I13 — Core E2E journey #8, Delete User (GDPR; FR-1.17/1.18, OQ-240): the
// user deletes their own account through Manage Profile's Delete Account
// Flow (FL8). Each household they belong to is left first — the one they own
// passes to its other member — then their finances are erased and the user
// row goes. Personal rows are deleted; shared ones stay, no longer naming
// them; the audit log keeps every entry that does. A personal Account,
// Budget or Goal is visible to no one else, so the erasure shows through the
// API as a transfer from the personal account to a shared one turned into a
// lone movement (OQ-240); that personal Budgets and Goals go is M1D's
// integration suite's to prove. Preconditions are arranged through the API,
// the end state checked through it.

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
  const [category] = await seededCategories(request, dana, homeA.id);
  await createBudget(request, dana, homeA.id, {
    name: 'Dana Fun', categoryIds: [category!.id], visibility: 'personal',
  });
  await createGoal(request, dana, homeA.id, {
    name: 'Dana Trip', targetAmount: 500_000, currency: 'BRL', visibility: 'personal',
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

  // In the browser: the danger zone names the household she owns; her email
  // unlocks the confirm.
  await signInThroughUi(page, dana);
  await page.goto('/profile');
  await expect(page.getByText(text('deleteAccount', 'ownership', { count: 1 }))).toBeVisible();
  await expect(page.getByText('Dana Home', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: text('deleteAccount', 'continue') }).click();
  const confirmButton = page.getByRole('button', { name: text('deleteAccount', 'confirm.submit') });
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel(text('deleteAccount', 'confirm.label', { email: dana.email }))
    .fill(dana.email);
  await confirmButton.click();

  // Signed out to Sign In, which no longer knows her.
  await expect(page.getByText(text('profile', 'deleted'))).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
  await submitCredentials(page, dana);
  await expect(page.getByText(text('errors', 'auth.invalid_credentials'))).toBeVisible();
  expect(await refreshStatus(request, otherDevice.refreshToken!)).toBe(401);

  // Home A passed to Mo, its only member and Owner; Home B lost its member.
  expect(await listMembers(request, mo, homeA.id)).toEqual([
    expect.objectContaining({ email: mo.email, role: 'Owner' }),
  ]);
  expect((await listMembers(request, olga, homeB.id)).map((member) => member.userId))
    .not.toContain(danaId);

  // Shared data stays, naming no one.
  expect(await getAccount(request, mo, homeA.id, shared.id))
    .toMatchObject({ ownerUserId: null, visibility: 'shared' });
  const sharedRows = await accountTransactions(request, mo, homeA.id, shared.id);
  expect(sharedRows).toHaveLength(2);
  expect(sharedRows.find((row) => row.id === groceries.id))
    .toMatchObject({ description: 'Groceries', createdByUserId: null });
  // The transfer's side on the shared account, its partner gone with the
  // personal account: a lone movement now.
  expect(sharedRows.find((row) => row.description === 'Rent share'))
    .toMatchObject({ effect: 'movement', transfer: null, createdByUserId: null });
  expect(await indexRateValues(request, mo, homeA.id, 'cdi'))
    .toEqual([expect.objectContaining({ value: 105_000, createdByUserId: null })]);

  // The audit log is untouched: her entries keep her id, her departure among
  // them (written after the response, so polled for).
  const auditOfToday = async () => (
    await exportAuditLog(request, mo, homeA.id, { startDate: today, endDate: today })
  ).body;
  await expect.poll(auditOfToday).toContain(`,${danaId},LeaveHousehold,`);
  expect(await auditOfToday()).toContain(`,${danaId},CreateHousehold,`);
});
