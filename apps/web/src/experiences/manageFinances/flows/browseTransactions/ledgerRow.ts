import type {
  Account, Category, CreditCard, LedgerItem,
} from '@financas/api-types';
import { findKind } from '@financas/reference';
import type { KeyValueItem } from '../../../../kit/keyValueList/KeyValueList';
import type { Formatter } from '../../../../utilities/formatting';
import type { Translator } from '../../../../utilities/i18n';
import { mayManageRecorded, mayRecordOn } from '../../../ownership';
import { cardName } from '../../../cardNames';
import { kindIcon, kindName } from '../../transactionNames';
import { browseText } from './browseText';

// What a ledger row shows (FL16, mockups 30, 34; OQ-201, OQ-220): its title
// (the description, else the kind's name), a meta line — source · category
// · kind, a trade's ticker in the category's place — its signed amount and
// icon, the details its expanded panel lists, and whether that panel offers
// Edit and Delete. Pure: rows read the accounts, cards and categories from a
// lookup built once per render.

/** A card with the account it sits on. */
export interface CardOnAccount {
  readonly card: CreditCard;
  readonly account: Account;
}

/** The accounts, cards and categories a row names, by id. */
export interface LedgerLookup {
  readonly accounts: ReadonlyMap<string, Account>;
  readonly cards: ReadonlyMap<string, CardOnAccount>;
  readonly categories: ReadonlyMap<string, Category>;
}

/** A row's icon: its category's disc, or its kind's glyph when it has none. */
export type RowIcon = | { readonly category: Category }
  | { readonly kind: ReturnType<typeof kindIcon> };

/**
 * What the expanded row offers: Edit and Delete, a note that its account is
 * archived, or nothing — the user may not change it.
 */
export type RowAccess = 'manage' | 'archived' | 'none';

/** Who is looking: what decides a row's access. */
export interface Viewer {
  readonly selfUserId: string;
  /** Their role in the household. */
  readonly role: string | undefined;
}

/**
 * Indexes the accounts (archived ones too), their cards and the categories.
 *
 * @param accounts - The accounts the user can see, with their cards.
 * @param categories - The household's categories.
 * @returns The lookup.
 */
export const ledgerLookupOf = (
  accounts: readonly Account[],
  categories: readonly Category[],
): LedgerLookup => ({
  accounts: new Map(accounts.map((account) => [account.id, account])),
  cards: new Map(accounts.flatMap((account) => (account.cards ?? []).map(
    (card) => [card.id, { card, account }] as const,
  ))),
  categories: new Map(categories.map((category) => [category.id, category])),
});

/**
 * Signs a row's amount by its kind's direction — stored amounts are positive (OQ-98).
 *
 * @param item - The row.
 * @returns The amount, negative for money out.
 */
export const signedAmountOf = (item: LedgerItem) => {
  const amount = item.amount ?? 0;
  // `0 - amount`, not `-amount`: no −0 for an empty amount.
  return findKind(item.kind ?? '')?.direction === 'out' ? 0 - amount : amount;
};

/**
 * Reads a trade's ticker.
 *
 * @param item - The row.
 * @returns The Holding's ticker on an investment row; nothing otherwise.
 */
const tickerOf = (item: LedgerItem) => (
  item.ledger === 'account' ? item.holding?.ticker : undefined
);

/**
 * Names a row's kind, when the reference data knows it.
 *
 * @param item - The row.
 * @param translator - The texts.
 * @returns The kind's name; nothing for a missing or unknown kind.
 */
export const kindNameOf = (item: LedgerItem, translator: Translator) => (
  item.kind && findKind(item.kind) ? kindName(translator, item.kind) : undefined
);

/**
 * Tells whether a row has a description of its own.
 *
 * @param item - The row.
 * @returns `true` when its description has text.
 */
const isDescribed = (item: LedgerItem) => Boolean(item.description?.trim());

/**
 * Writes a row's title: its description, else its kind's name — a trade's
 * with its ticker — else "Transaction".
 *
 * @param item - The row.
 * @param translator - The texts.
 * @returns The title.
 */
export const rowTitleOf = (item: LedgerItem, translator: Translator) => {
  const { description } = item;
  if (description?.trim()) return description;
  const kind = kindNameOf(item, translator);
  if (!kind) return browseText(translator, 'title.unknown');
  const ticker = tickerOf(item);
  return ticker ? browseText(translator, 'title.trade', { kind, ticker }) : kind;
};

/**
 * Names a card by its id.
 *
 * @param lookup - The cards.
 * @param creditCardId - The card's id.
 * @param translator - The texts.
 * @returns "Visa •••• 1111"; empty when the user can't see it.
 */
const cardNameOf = (lookup: LedgerLookup, creditCardId: string, translator: Translator) => {
  const entry = lookup.cards.get(creditCardId);
  return entry ? cardName(translator, entry.card) : '';
};

/**
 * Names an account the user can see.
 *
 * @param lookup - The accounts.
 * @param accountId - The account, if any.
 * @returns Its name, or nothing for one they can't see.
 */
const accountNameOf = (lookup: LedgerLookup, accountId: string | null | undefined) => (
  accountId ? lookup.accounts.get(accountId)?.name : undefined
);

/**
 * Names where a transfer between own accounts went (OQ-222): "Checking →
 * Savings" on either side — "another account" for one the user can't see.
 *
 * @param item - Either side, with its other side.
 * @param lookup - The accounts.
 * @param translator - The texts.
 * @returns The route.
 */
const transferSourceOf = (
  item: LedgerItem & { readonly ledger: 'account' },
  lookup: LedgerLookup,
  translator: Translator,
) => {
  const own = accountNameOf(lookup, item.accountId) ?? '';
  const other = accountNameOf(lookup, item.transfer?.accountId)
    ?? browseText(translator, 'source.otherAccount');
  const [from, to] = item.kind === 'transfer_sent' ? [own, other] : [other, own];
  return browseText(translator, 'source.transfer', { from, to });
};

/**
 * Names an account row's source: its account, either side of a transfer
 * between own accounts, or a bill payment's payer and card — the payer alone
 * when the user can't see the card.
 *
 * @param item - The account row.
 * @param lookup - The accounts and cards.
 * @param translator - The texts.
 * @returns The source's name; empty when the user can't see the account.
 */
const accountSourceOf = (
  item: LedgerItem & { readonly ledger: 'account' },
  lookup: LedgerLookup,
  translator: Translator,
) => {
  if (item.transfer) return transferSourceOf(item, lookup, translator);
  const payer = lookup.accounts.get(item.accountId ?? '')?.name ?? '';
  const card = item.creditCardId ? cardNameOf(lookup, item.creditCardId, translator) : '';
  return card ? browseText(translator, 'source.billPayment', { payer, card }) : payer;
};

/**
 * Names where a row's money moved: its account, its card, or a bill payment's
 * payer and card — the payer alone when the user can't see the card.
 *
 * @param item - The row.
 * @param lookup - The accounts and cards.
 * @param translator - The texts.
 * @returns The source's name; empty when the user can't see it.
 */
export const sourceOf = (item: LedgerItem, lookup: LedgerLookup, translator: Translator) => (
  item.ledger === 'card'
    ? cardNameOf(lookup, item.creditCardId ?? '', translator)
    : accountSourceOf(item, lookup, translator)
);

/**
 * Names a row's category, with its subcategory when it has one.
 *
 * @param item - The row.
 * @param lookup - The categories.
 * @param translator - The texts.
 * @returns "Groceries › Market", "Groceries", or nothing when uncategorized.
 */
export const categoryNameOf = (item: LedgerItem, lookup: LedgerLookup, translator: Translator) => {
  const category = item.categoryId ? lookup.categories.get(item.categoryId) : undefined;
  if (!category) return undefined;
  const subcategory = category.subcategories.find(({ id }) => id === item.subcategoryId);
  if (!subcategory) return category.name;
  return browseText(translator, 'category.path', {
    category: category.name, subcategory: subcategory.name,
  });
};

/**
 * Writes a row's meta line: source · category · kind — a trade's ticker in
 * the category's place; what's missing is left out, and so are the kind and
 * ticker when the title already says them (a row with no description).
 *
 * @param item - The row.
 * @param lookup - The accounts, cards and categories.
 * @param translator - The texts.
 * @returns The meta line.
 */
export const rowMetaOf = (item: LedgerItem, lookup: LedgerLookup, translator: Translator) => {
  const described = isDescribed(item);
  return [
    sourceOf(item, lookup, translator),
    (described ? tickerOf(item) : undefined) ?? categoryNameOf(item, lookup, translator),
    described ? kindNameOf(item, translator) : undefined,
  ].filter(Boolean).join(' · ');
};

/**
 * Picks a row's icon.
 *
 * @param item - The row.
 * @param lookup - The categories.
 * @returns Its category's disc, or its kind's glyph.
 */
export const rowIconOf = (item: LedgerItem, lookup: LedgerLookup): RowIcon => {
  const category = item.categoryId ? lookup.categories.get(item.categoryId) : undefined;
  return category ? { category } : { kind: kindIcon(item.kind ?? '') };
};

/**
 * Picks the source's caption: Card, Payment (a bill payment) or Account.
 *
 * @param item - The row.
 * @returns The caption's key.
 */
const sourceLabelKey = (item: LedgerItem) => {
  if (item.ledger === 'card') return 'detail.card';
  return item.creditCardId ? 'detail.payment' : 'detail.account';
};

/**
 * Lists a trade's Holding and units.
 *
 * @param item - The row.
 * @param translator - The texts.
 * @returns The two facts on a trade; none otherwise.
 */
const tradeDetailsOf = (item: LedgerItem, translator: Translator): KeyValueItem[] => {
  if (item.ledger !== 'account' || !item.holding) return [];
  const units = item.quantity == null
    ? undefined
    : browseText(translator, 'detail.unitsValue', { units: item.quantity / 100_000_000 });
  return [
    { label: browseText(translator, 'detail.holding'), value: item.holding.ticker },
    { label: browseText(translator, 'detail.units'), value: units, numeric: true },
  ];
};

/**
 * Lists what the expanded row shows: kind, date, source, category; a trade's
 * Holding and units.
 *
 * @param item - The row.
 * @param lookup - The accounts, cards and categories.
 * @param translator - The texts.
 * @param formatter - Dates in the interface language.
 * @returns The facts, in reading order.
 */
export const rowDetailsOf = (
  item: LedgerItem,
  lookup: LedgerLookup,
  translator: Translator,
  formatter: Formatter,
): KeyValueItem[] => [
  { label: browseText(translator, 'detail.kind'), value: kindNameOf(item, translator) },
  {
    label: browseText(translator, 'detail.date'),
    value: formatter.date(item.date ?? '', 'numeric'),
    numeric: true,
  },
  {
    label: browseText(translator, sourceLabelKey(item)),
    value: sourceOf(item, lookup, translator),
  },
  {
    label: browseText(translator, 'detail.category'),
    value: categoryNameOf(item, lookup, translator),
  },
  ...tradeDetailsOf(item, translator),
];

/**
 * Lists the other accounts an account row's change touches: a transfer's
 * other side's — which edits and deletes with it (OQ-222) — or a bill
 * payment's card's (OQ-219).
 *
 * @param item - The account row.
 * @param lookup - The accounts and cards.
 * @returns Those accounts; `undefined` stands for one the user can't see.
 */
const otherAccountsOf = (
  item: LedgerItem & { readonly ledger: 'account' },
  lookup: LedgerLookup,
) => {
  if (item.transfer) return [lookup.accounts.get(item.transfer.accountId ?? '')];
  return item.creditCardId ? [lookup.cards.get(item.creditCardId)?.account] : [];
};

/**
 * Lists the accounts a change to the row touches: its own (a card's), a bill
 * payment's card's too (OQ-219), and a transfer's other side's (OQ-222).
 *
 * @param item - The row.
 * @param lookup - The accounts and cards.
 * @returns The accounts; `undefined` stands for one the user can't see.
 */
const touchedAccountsOf = (item: LedgerItem, lookup: LedgerLookup) => {
  if (item.ledger === 'card') return [lookup.cards.get(item.creditCardId ?? '')?.account];
  const own = lookup.accounts.get(item.accountId ?? '');
  return [own, ...otherAccountsOf(item, lookup)];
};

/**
 * Decides what the expanded row offers (OQ-111, OQ-220, OQ-223): Edit and
 * Delete when the user may manage the row on its own account — its recorder's
 * on a shared one, the owner's on a personal one — and may record on every
 * other account the change touches, and none is archived; a note when one is
 * archived; nothing when the user may not change it. The server checks again.
 *
 * @param item - The row.
 * @param lookup - The accounts and cards.
 * @param viewer - The user and their role.
 * @returns The row's access.
 */
export const rowAccessOf = (item: LedgerItem, lookup: LedgerLookup, viewer: Viewer): RowAccess => {
  const accounts = touchedAccountsOf(item, lookup);
  const [own, ...others] = accounts;
  const mayManage = own !== undefined
    && mayManageRecorded(own, item.createdByUserId, viewer.selfUserId, viewer.role)
    && others.every(
      (account) => account !== undefined && mayRecordOn(account, viewer.selfUserId, viewer.role),
    );
  if (!mayManage) return 'none';
  return accounts.some((account) => account?.archivedAt) ? 'archived' : 'manage';
};
