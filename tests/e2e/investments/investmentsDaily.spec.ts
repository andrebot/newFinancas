import { expect, test, type APIRequestContext } from '@playwright/test';
import openInbox from '../support/bell';
import {
  UNIT, accountNamed, deleteTransaction, getHolding, holdingTransactions, recordTransaction,
  scheduleEntries,
} from '../support/financeApi';
import { createHousehold, registerUser, type TestUser } from '../support/identityApi';
import { notifications } from '../support/insightsApi';
import runInvestmentsDaily, { aloneWithTheJob } from '../support/investmentsDaily';
import { signInThroughUi } from '../support/signIn';
import text from '../support/text';

// I6 — Core E2E journey #13 (OQ-237): the investmentsDaily trigger invoked
// directly (`pnpm investments:run --today`), the clock fixed on a day years
// before every other journey's data, so the run reaches only this journey's
// Holding (and those of any journey run alone with the job before it). A due
// fixed-term schedule is recorded once; a matured Holding still
// holding a position — its redemption deleted by its owner — notifies once,
// read through the inbox's route; the owner accepts the notice's "Archive
// holding" through the bell, which the App Shell routes to Track Investments
// (I12, OQ-245): the Holding archived by `user`, the notice gone.

/** The day the job runs as of: the day after the CDB matures. */
const RUN_DAY = '2020-07-02';

/** A day before any of the CDB's schedule falls due. */
const DAY_BEFORE_DUE = '2020-06-30';

/** The CDB's matured notice, as the inbox's route lists it. */
interface MaturedNotice {
  readonly type: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/**
 * Lists a user's matured-Holding notices through the inbox's route.
 *
 * @param request - Playwright's API client.
 * @param user - The recipient.
 * @returns Their `holding.matured` notices, type and params only.
 */
const maturedNotices = async (
  request: APIRequestContext,
  user: TestUser,
): Promise<MaturedNotice[]> => (await notifications(request, user))
  .filter((notice) => notice.type === 'holding.matured')
  .map(({ type, params }) => ({ type, params }));

/** Schedule entry kind → the transaction kind the job records for it (FR-11.3). */
const POSTED_KIND: Readonly<Record<string, string>> = {
  interest_payment: 'investment_interest',
  tax: 'investment_tax',
  redemption: 'investment_redemption',
};

/** What a ledger row says, to compare a Holding's rows with what its schedule promised. */
interface LedgerLine {
  readonly kind: string;
  readonly date: string;
  readonly amount: number;
}

/**
 * Orders ledger lines by kind, then date, so two sets compare as multisets.
 *
 * @param lines - The lines.
 * @returns A sorted copy.
 */
const sorted = (lines: readonly LedgerLine[]): LedgerLine[] => [...lines].sort((first, second) => (
  first.kind.localeCompare(second.kind) || first.date.localeCompare(second.date)
));

/**
 * A Holding's transactions as kind, date and amount, sorted.
 *
 * @param request - Playwright's API client.
 * @param member - Who reads them.
 * @param householdId - The household.
 * @param holdingId - The Holding.
 * @returns Each transaction's line.
 */
const ledgerOf = async (
  request: APIRequestContext,
  member: { readonly accessToken: string },
  householdId: string,
  holdingId: string,
): Promise<LedgerLine[]> => sorted(
  (await holdingTransactions(request, member, householdId, holdingId)).map((transaction) => ({
    kind: transaction.kind!, date: transaction.date!, amount: transaction.amount!,
  })),
);

test('investmentsDaily posts a due schedule once; its matured notice archives it from the bell', {
  tag: '@core',
}, async ({ page, request }) => {
  // Alone with the job: no other journey that runs it — nor a copy of this one
  // under --repeat-each — runs beside it (R4 E2); waiting for them is slow.
  test.slow();
  // The job's part runs alone with it; the bell's needs no lock.
  const matured = await aloneWithTheJob(async () => {
    const owner = await registerUser(request, { firstName: 'Dai', lastName: 'Lee' });
    const household = await createHousehold(request, owner, 'Daily Home');
    const account = await accountNamed(request, owner, household.id, 'Main Checking');
    const buy = await recordTransaction(request, owner, household.id, {
      kind: 'investment_buy',
      accountId: account.id,
      date: '2020-01-02',
      amount: 100_000,
      currency: 'BRL',
      assetType: 'cdb',
      ticker: 'CDB Daily',
      rate: { type: 'fixed', value: 120_000 },
      dueDate: '2020-07-01',
      interestPayment: 'at_maturity',
    });
    const holdingId = buy.holdingId!;
    const schedule = await scheduleEntries(request, owner, household.id, holdingId);
    expect(schedule.map((entry) => entry.kind)).toContain('redemption');
    expect(schedule.every((entry) => entry.postedAt === null)).toBe(true);
    const bought: LedgerLine = { kind: 'investment_buy', date: '2020-01-02', amount: 100_000 };
    // Each entry recorded as its own transaction, its date and amount unchanged.
    const posted = schedule.map((entry) => ({
      kind: POSTED_KIND[entry.kind!]!, date: entry.date!, amount: entry.amount!,
    }));

    // As of the day before it falls due, the clock fixed there: nothing is due yet.
    await runInvestmentsDaily(DAY_BEFORE_DUE);
    expect(await ledgerOf(request, owner, household.id, holdingId)).toEqual([bought]);

    // The first run records every due entry, redemption last: the position closes.
    await runInvestmentsDaily(RUN_DAY);
    expect((await scheduleEntries(request, owner, household.id, holdingId))
      .every((entry) => entry.postedAt !== null)).toBe(true);
    expect(await ledgerOf(request, owner, household.id, holdingId))
      .toEqual(sorted([bought, ...posted]));
    expect(await getHolding(request, owner, household.id, holdingId)).toMatchObject({
      quantity: 0, archivedBy: 'system',
    });
    expect(await maturedNotices(request, owner)).toEqual([]);

    // The owner deletes the redemption (the bank hasn't paid): matured, still held.
    const redemption = (await holdingTransactions(request, owner, household.id, holdingId))
      .find((transaction) => transaction.kind === 'investment_redemption')!;
    await deleteTransaction(request, owner, household.id, redemption.id!);
    expect(await getHolding(request, owner, household.id, holdingId)).toMatchObject({
      quantity: UNIT, archivedAt: null,
    });
    const kept = await ledgerOf(request, owner, household.id, holdingId);

    // Re-running the same day records nothing new and notifies the owner once.
    await runInvestmentsDaily(RUN_DAY);
    expect(await ledgerOf(request, owner, household.id, holdingId)).toEqual(kept);
    const notices = [{
      type: 'holding.matured',
      params: {
        holdingId,
        householdId: household.id,
        assetType: 'cdb',
        ticker: 'CDB Daily',
        dueDate: '2020-07-01',
      },
    }];
    expect(await maturedNotices(request, owner)).toEqual(notices);

    // And again: still nothing new, still one notice.
    await runInvestmentsDaily(RUN_DAY);
    expect(await ledgerOf(request, owner, household.id, holdingId)).toEqual(kept);
    expect(await maturedNotices(request, owner)).toEqual(notices);
    return { owner, household, holdingId };
  });

  // The owner archives it from the bell: Track Investments archives it, as the
  // user, and the shell deletes the notice.
  const { owner, household, holdingId } = matured;
  await signInThroughUi(page, owner);
  const inbox = await openInbox(page);
  await expect(inbox.getByText(text('notifications', 'holding.matured', {
    name: 'CDB Daily', dueDate: '07/01/2020',
  }))).toBeVisible();
  await inbox.getByRole('button', { name: text('inbox', 'archive') }).click();
  await expect(page.getByText(text('trackInvestments', 'archive.done', { name: 'CDB Daily' })))
    .toBeVisible();
  await expect(inbox.getByText(text('inbox', 'empty'))).toBeVisible();
  expect(await getHolding(request, owner, household.id, holdingId)).toMatchObject({
    quantity: UNIT, archivedBy: 'user',
  });
  expect(await notifications(request, owner)).toEqual([]);
});
