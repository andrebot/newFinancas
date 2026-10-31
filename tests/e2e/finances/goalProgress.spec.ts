import { expect, test } from '@playwright/test';
import { createGoal } from '../support/accountApi';
import { choose, pick, typeDate } from '../support/controls';
import { goalProgress, isoDay } from '../support/financeApi';
import { createHousehold, registerUser } from '../support/identityApi';
import brl from '../support/money';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I9 / R3 phase 2 (E1) — Goal progress against the real API (Full E2E): a
// CDB bought in Record Transaction (FL15, in X6) with its whole split to a
// Goal funds it — the Month Overview's Goals rail (FL17) and the Goals tab
// (FL14, in X5) show the progress, and `goal-progress` (M4, ReportingEngine)
// agrees: a fixed-term Holding counts at its cost basis (OQ-206).

/**
 * A Record Transaction text, as the drawer shows it.
 *
 * @param key - The message key.
 * @returns The en-US text.
 */
const recordText = (key: Parameters<typeof text<'recordTransaction'>>[1]): string => (
  text('recordTransaction', key)
);

/** The Goal's target: R$ 100.000,00, in centavos. */
const TARGET = 10_000_000;

/** What the CDB costs: R$ 10.000,00 — a tenth of the target. */
const COST = 1_000_000;

test('a CDB bought with its split to a Goal shows as that Goal\'s progress', async ({
  page, request,
}) => {
  const owner = await registerUser(request, { firstName: 'Gil', lastName: 'Goalfund' });
  const household = await createHousehold(request, owner, 'Goal Fund Home');
  const goal = await createGoal(request, owner, household.id, {
    name: 'House', targetAmount: TARGET, currency: 'BRL',
  });
  const today = new Date();
  const due = new Date(today.getFullYear() + 2, today.getMonth(), 15);
  await signInThroughUi(page, owner);
  await page.goto('/transactions');

  await page.getByRole('button', { name: text('manageFinances', 'record') }).click();
  const record = page.getByRole('dialog', { name: recordText('record.title') });
  await pick(record, recordText('field.group'), text('transactions', 'group.investment'));
  await pick(record, recordText('field.kind'), text('transactions', 'kind.investment_buy'));
  await choose(page, record, recordText('field.assetType'), text('assetTypes', 'cdb'));
  await record.getByLabel(recordText('field.ticker')).fill('CDB Casa');
  await pick(record, recordText('field.rateType'), recordText('rateType.fixed'));
  await record.getByLabel(recordText('rateValue.fixed')).fill('11');
  await typeDate(record.getByLabel(recordText('field.dueDate')), isoDay(due));
  await pick(
    record,
    recordText('field.interestPayment'),
    recordText('interestPayment.at_maturity'),
  );
  await record.getByLabel(recordText('amount.invested')).pressSequentially(String(COST));
  // The one Goal there is: its add button names it.
  const addHouse = text('allocationEditor', 'addNamed', { goal: 'House' });
  await record.getByRole('button', { name: addHouse }).click();
  await record.getByLabel(text('allocationEditor', 'percentOf', { goal: 'House' })).fill('100');
  await record.getByRole('button', { name: recordText('record.submit') }).click();
  await expect(record).toBeHidden();
  await expect(page.getByText(recordText('recorded'))).toBeVisible();

  const toGo = brl(TARGET - COST);
  // The Goals rail wraps rather than scrolls (PR #145): no scroll region of its
  // own, so it is found as the section its heading ("Goals October/2026") opens.
  const goals = page.locator('section', {
    has: page.getByRole('heading', { name: new RegExp(`^${text('monthRails', 'goals')} `) }),
  });
  await expect(goals).toContainText(text('railCard', 'goal.toGo', { amount: toGo }));

  const [progress] = await goalProgress(request, owner, household.id);
  expect(progress).toMatchObject({
    id: goal.id,
    targetAmount: TARGET,
    targetCurrency: 'BRL',
    fundedBy: [{
      name: 'CDB Casa', percentage: 100, contribution: { currency: 'BRL', amount: COST },
    }],
  });

  await page.goto('/account-setup?tab=goals');
  const tabProgress = text('goalManagement', 'progress.toGo', { percent: 10, amount: toGo });
  await expect(page.getByText(tabProgress)).toBeVisible();
});
