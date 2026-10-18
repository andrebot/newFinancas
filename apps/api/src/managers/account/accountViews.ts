import type { Account } from '../../accessors/accountAccessor';
import cycleOf from '../../accessors/billingCycle';
import { monthOf, type CalendarMonth } from '../../accessors/calendarMonth';
import type { CreditCard } from '../../accessors/creditCardAccessor';
import type { AccountStores } from './context';

// What an Account read answers with (OQ-175): the Account, its current balance
// and its Credit Cards, each with what it owes now — every number a stored month
// row, read as of today, never computed. A plain read of AccountManager's own
// entities (VBD §3 read-ownership rule), so one request fills the Accounts page.

/** A Credit Card with its outstanding balance now. */
export interface CreditCardView extends CreditCard {
  /** Minor units: the current billing cycle's ending balance (FR-2.10). */
  readonly outstandingBalance: number;
}

/** An Account with its balance now and its cards. */
export interface AccountView extends Account {
  /** Minor units: the balance as of today's month (FR-5.4). */
  readonly currentBalance: number;
  /** In the order attached. */
  readonly cards: readonly CreditCardView[];
}

/** Cards sharing a current billing cycle. */
interface CycleGroup {
  readonly cycle: CalendarMonth;
  readonly creditCardIds: string[];
}

/**
 * Groups cards by the billing cycle today falls in — this month's or the next,
 * by each card's closing day (OQ-170) — so each group is one balance read.
 *
 * @param cards - The cards.
 * @param today - `YYYY-MM-DD` in the app's time zone.
 * @returns One group per distinct cycle.
 */
export const groupByCurrentCycle = (
  cards: readonly CreditCard[],
  today: string,
): CycleGroup[] => {
  const groups = new Map<string, CycleGroup>();
  cards.forEach((card) => {
    const cycle = cycleOf(today, card.closingDay);
    const key = `${cycle.year}-${cycle.month}`;
    const group = groups.get(key) ?? { cycle, creditCardIds: [] };
    group.creditCardIds.push(card.id);
    groups.set(key, group);
  });
  return [...groups.values()];
};

/**
 * Reads what each card owes now: its latest cycle at or before the current one.
 *
 * @param creditCards - CreditCardAccessor.
 * @param cards - The cards.
 * @param today - `YYYY-MM-DD` in the app's time zone.
 * @returns Outstanding balance by card id; a card with no cycle yet is missing.
 */
const outstandingByCard = async (
  creditCards: AccountStores['creditCards'],
  cards: readonly CreditCard[],
  today: string,
): Promise<Map<string, number>> => {
  const reads = groupByCurrentCycle(cards, today).map(({ cycle, creditCardIds }) => (
    creditCards.balancesAsOf(creditCardIds, cycle)
  ));
  const balances = (await Promise.all(reads)).flat();
  return new Map(balances.map((row) => [row.creditCardId, row.endingOutstandingBalance]));
};

/**
 * Builds the views of some Accounts as they stand today.
 *
 * @param stores - AccountAccessor and CreditCardAccessor.
 * @param accounts - The Accounts, in the order to answer with.
 * @param today - `YYYY-MM-DD` in the app's time zone.
 * @returns The views, in the same order.
 */
export const viewAccounts = async (
  stores: Pick<AccountStores, 'accounts' | 'creditCards'>,
  accounts: readonly Account[],
  today: string,
): Promise<AccountView[]> => {
  const accountIds = accounts.map(({ id }) => id);
  const [balances, cards] = await Promise.all([
    stores.accounts.balancesAsOf(accountIds, monthOf(today)),
    stores.creditCards.listByAccounts(accountIds),
  ]);
  const outstanding = await outstandingByCard(stores.creditCards, cards, today);
  const balanceOf = new Map(balances.map((row) => [row.accountId, row.endingBalance]));
  return accounts.map((account) => ({
    ...account,
    currentBalance: balanceOf.get(account.id) ?? 0,
    cards: cards.filter((card) => card.accountId === account.id).map((card) => ({
      ...card, outstandingBalance: outstanding.get(card.id) ?? 0,
    })),
  }));
};
