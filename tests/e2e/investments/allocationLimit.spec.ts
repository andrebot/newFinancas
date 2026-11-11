import { expect, test } from '@playwright/test';
import { createGoal } from '../support/accountApi';
import { pick } from '../support/controls';
import {
  UNIT, accountNamed, isoDay, recordTransaction,
} from '../support/financeApi';
import { addMember, createHousehold, registerUser } from '../support/identityApi';
import { holdingSplit } from '../support/investmentsApi';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I10 — Core E2E journey #10 (OQ-238): a Holding's Goal split past 100% is
// refused by the server, the share already there intact. The split editor
// (K47) never sends more than 100% of what it shows, so the browser reaches the
// 409 the one way the contract allows (OQ-178): a share it can't show. A Member
// buys a stock on the shared account with 60% to their own personal Goal; the
// Owner, who sees only the shared Goal, gives it 41% — the editor allows it,
// the server adds the hidden 60% and refuses (`goal.allocation_exceeds_100`).
// 40% then saves (uc-02's success, Full E2E's share of it).

test('a split past 100% with a share the editor can\'t show is refused, the first share intact', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Olga', lastName: 'Owner' });
  const member = await registerUser(request, { firstName: 'Mateo', lastName: 'Member' });
  const household = await createHousehold(request, owner, 'Split Home');
  await addMember(request, owner, household.id, { user: member, role: 'Member' });
  const account = await accountNamed(request, owner, household.id, 'Main Checking');
  const personal = await createGoal(request, member, household.id, {
    name: 'Mateo Car', targetAmount: 5_000_000, currency: 'BRL', visibility: 'personal',
  });
  const shared = await createGoal(request, owner, household.id, {
    name: 'Family Trip', targetAmount: 2_000_000, currency: 'BRL',
  });
  const buy = await recordTransaction(request, member, household.id, {
    kind: 'investment_buy',
    accountId: account.id,
    date: isoDay(new Date()),
    amount: 300_000,
    currency: 'BRL',
    assetType: 'stock',
    ticker: 'BBAS3',
    quantity: 100 * UNIT,
    allocations: [{ goalId: personal.id, percentage: 60 }],
  });
  const holdingId = buy.holdingId!;
  const memberShare = [{ goalId: personal.id, percentage: 60 }];
  expect(await holdingSplit(request, member, household.id, holdingId)).toEqual(memberShare);
  expect(await holdingSplit(request, owner, household.id, holdingId)).toEqual([]);

  await signInThroughUi(page, owner);
  await page.goto('/investments');
  await pick(
    page.locator('main'),
    text('trackInvestments', 'tabs.label'),
    text('trackInvestments', 'tab.holdings'),
  );
  await page.getByRole('button').filter({ hasText: 'BBAS3' }).click();
  const goals = page.getByRole('region', { name: /BBAS3/ }).locator('section', {
    has: page.getByRole('heading', { name: text('holdingMaintenance', 'goals.title') }),
  });
  await goals.getByRole('button', {
    name: text('allocationEditor', 'addNamed', { goal: 'Family Trip' }),
  }).click();
  const percent = goals.getByLabel(text('allocationEditor', 'percentOf', { goal: 'Family Trip' }));
  await percent.fill('41');
  await goals.getByRole('button', { name: text('holdingMaintenance', 'goals.save') }).click();

  // The editor showed 41%; the server counted the hidden 60% too.
  await expect(page.getByText(text('errors', 'goal.allocation_exceeds_100', { requested: 101 })))
    .toBeVisible();
  expect(await holdingSplit(request, member, household.id, holdingId)).toEqual(memberShare);
  expect(await holdingSplit(request, owner, household.id, holdingId)).toEqual([]);

  // The typed share is kept after the refusal; 40% fits beside the hidden 60%.
  await percent.fill('40');
  await goals.getByRole('button', { name: text('holdingMaintenance', 'goals.save') }).click();
  await expect(page.getByText(text('holdingMaintenance', 'goals.saved'))).toBeVisible();
  expect(await holdingSplit(request, owner, household.id, holdingId))
    .toEqual([{ goalId: shared.id, percentage: 40 }]);
  // The hidden share is written again with the new split, so their order is the server's.
  expect(await holdingSplit(request, member, household.id, holdingId)).toEqual(
    expect.arrayContaining([...memberShare, { goalId: shared.id, percentage: 40 }]),
  );
  expect(await holdingSplit(request, member, household.id, holdingId)).toHaveLength(2);
});
