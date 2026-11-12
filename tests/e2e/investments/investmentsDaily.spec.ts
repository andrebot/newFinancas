import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  UNIT, accountNamed, deleteTransaction, getHolding, holdingTransactions, recordTransaction,
  scheduleEntries,
} from '../support/financeApi';
import { createHousehold, currentUser, registerUser } from '../support/identityApi';
import runInvestmentsDaily, { aloneWithTheJob } from '../support/investmentsDaily';
import notificationsOf from '../support/notificationsDb';

// I6 — Core E2E journey #13 (OQ-237): the investmentsDaily trigger invoked
// directly (`pnpm investments:run --today`), the clock fixed on a day years
// before every other journey's data, so the run reaches only this journey's
// Holding (and those of any journey run alone with the job before it). A due
// fixed-term schedule is recorded once; a matured Holding still
// holding a position — its redemption deleted by its owner — notifies once.
// Accepting the notice's "Archive holding" through the bell waits for the
// inbox (X8) and the bell routing (I12, task 141).

/** The day the job runs as of: the day after the CDB matures. */
const RUN_DAY = '2020-07-02';

/** A day before any of the CDB's schedule falls due. */
const DAY_BEFORE_DUE = '2020-06-30';

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

test('investmentsDaily records a due schedule once and notifies a matured position once', {
  tag: '@core',
}, async ({ request }) => {
  // Alone with the job: no other journey that runs it — nor a copy of this one
  // under --repeat-each — runs beside it (R4 E2); waiting for them is slow.
  test.slow();
  await aloneWithTheJob(async () => {
    const owner = await registerUser(request, { firstName: 'Dai', lastName: 'Lee' });
    const { id: ownerId } = await currentUser(request, owner.accessToken);
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
    expect(await notificationsOf(ownerId, 'holding.matured')).toEqual([]);

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
        holdingId, assetType: 'cdb', ticker: 'CDB Daily', dueDate: '2020-07-01',
      },
    }];
    expect(await notificationsOf(ownerId, 'holding.matured')).toEqual(notices);

    // And again: still nothing new, still one notice.
    await runInvestmentsDaily(RUN_DAY);
    expect(await ledgerOf(request, owner, household.id, holdingId)).toEqual(kept);
    expect(await notificationsOf(ownerId, 'holding.matured')).toEqual(notices);
  });
});
