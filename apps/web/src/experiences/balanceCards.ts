import type { Account, Currency, MonthOverviewReport } from '@financas/api-types';
import type { PaletteToken } from '@financas/reference';
import { accounts as accountSettings } from '../config/constants';
import type { IconName } from '../kit/icons/Icon';
import type { Translator } from '../utilities/i18n';
import { pickByHash } from '../utilities/stableHash';
import { cardName } from './cardNames';

// What a Balance rail's cards show (FL17, OQ-215, OQ-221), read the same way
// by every page that draws one: Manage Finances' Month Overview and the
// Dashboard. The report sends ids and figures; the names come from the
// accounts the page already holds — an account's own, a card's "Visa ••••
// 1111". A credit-card-only account is one card: its name, captioned
// Outstanding, with what its cards owe summed (OQ-175, mockups 20, 30 — its
// own balance never moves). An account's glyph is its type's, a card's the
// card glyph; the colour is the one its id hashes to, so it never moves from
// month to month. Pure, and owned by no Experience, so neither reaches into
// the other.

/** A month-end figure, as the report sends it. */
export type MonthEndBalance = MonthOverviewReport['balances'][number];

/** One balance card, ready for the kit's `BalanceRailCard`. */
export interface BalanceCard {
  /** The account's id, or the card's: unique on the rail. */
  readonly key: string;
  readonly name: string;
  readonly icon: IconName;
  readonly color: PaletteToken;
  /** The balance, or the card's outstanding, in minor units. */
  readonly amount: number;
  readonly currency: Currency;
  /** A credit card's outstanding: the card shows its caption. */
  readonly outstanding: boolean;
}

/**
 * Names a month-end figure and picks its glyph from the accounts the page holds.
 *
 * @param balance - The figure: an account's, or one of its cards'.
 * @param account - The account it belongs to.
 * @param translator - The texts, for a card's name.
 * @returns Its name and glyph, or nothing when the card is no longer listed.
 */
const labelOf = (balance: MonthEndBalance, account: Account, translator: Translator) => {
  if (balance.creditCardId === null) {
    return { name: account.name, icon: accountSettings.typeIcons[account.type] };
  }
  const card = account.cards.find((item) => item.id === balance.creditCardId);
  return card && { name: cardName(translator, card), icon: accountSettings.cardIcon };
};

/**
 * Tells whether an account is only its cards (OQ-175): the rail shows it as one card.
 *
 * @param account - The account.
 * @returns Whether it is credit-card-only.
 */
const isCardOnly = (account: Account) => account.type === 'credit_card_only';

/**
 * Sums what each credit-card-only account's cards owe at the month's end.
 *
 * @param balances - The report's month-end figures.
 * @param byId - The accounts the page holds, by id.
 * @returns Each such account's total, by its id.
 */
const owedByCardOnly = (
  balances: readonly MonthEndBalance[],
  byId: ReadonlyMap<string, Account>,
) => balances.reduce((owed, balance) => {
  const account = byId.get(balance.accountId);
  if (!account || !isCardOnly(account) || balance.creditCardId === null) return owed;
  return owed.set(account.id, (owed.get(account.id) ?? 0) + balance.amount);
}, new Map<string, number>());

/**
 * Reads a figure's amount and whether it is owed.
 *
 * @param balance - The figure.
 * @param account - Its account.
 * @param owed - What each credit-card-only account's cards owe.
 * @returns The amount shown and whether it is an outstanding.
 */
const amountOf = (
  balance: MonthEndBalance,
  account: Account,
  owed: ReadonlyMap<string, number>,
) => (isCardOnly(account)
  ? { amount: owed.get(account.id) ?? 0, outstanding: true }
  : { amount: balance.amount, outstanding: balance.creditCardId !== null });

/**
 * Builds the Balance rail's cards, in the report's order.
 *
 * @param balances - The report's month-end figures.
 * @param accounts - The accounts the user can see, with their cards.
 * @param translator - The texts, for the cards' names.
 * @returns One card per figure whose account (and card) the page knows — a
 *   credit-card-only account's cards folded into its own; any other — one
 *   added since the accounts loaded — waits for their refetch.
 */
export const balanceCardsOf = (
  balances: readonly MonthEndBalance[],
  accounts: readonly Account[],
  translator: Translator,
): BalanceCard[] => {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const owed = owedByCardOnly(balances, byId);
  return balances.flatMap((balance) => {
    const account = byId.get(balance.accountId);
    if (!account || (isCardOnly(account) && balance.creditCardId !== null)) return [];
    const label = labelOf(balance, account, translator);
    if (!label) return [];
    const key = balance.creditCardId ?? balance.accountId;
    return [{
      key,
      ...label,
      color: pickByHash(key, accountSettings.balanceTones),
      ...amountOf(balance, account, owed),
      currency: balance.currency,
    }];
  });
};
