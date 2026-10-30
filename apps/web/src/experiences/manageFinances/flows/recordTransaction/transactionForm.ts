import type {
  Account, CreditCard, Currency, InterestPayment, InvestmentHolding,
} from '@financas/api-types';
import {
  ASSET_TYPES, findAssetType, findKind, isFixedTerm, TRANSACTION_KINDS,
  type KindGroup, type TransactionKind,
} from '@financas/reference';
import type { AllocationRow } from '../../../../kit/allocationEditor/allocation';

// The Record Transaction form (FL15; FR-3.1, OQ-201, OQ-219): what the drawer
// holds while the user fills it in, and the pure transitions between its
// states, so the rules test without React. Which fields a kind takes follows
// from the kinds' reference data (`@financas/reference`), never a list of
// codes: a card kind names a card; a bill payment a card and the account that
// pays it — any open one but a credit-card-only one, in the card's currency
// (OQ-219); every other kind an account that isn't credit-card-only (OQ-201
// D5). A trade (buy, sell, redemption) moves units and carries a Goal split;
// every investment kind but a buy picks the account's Holding (OQ-201 D10).

/** How a fixed-term contract's rate is quoted (FR-11.1). */
export type RateType = 'fixed' | 'cdi' | 'ipca' | 'igpm' | 'selic';

/** The rate types, in the order mockup 32 offers them. */
export const RATE_TYPES: readonly RateType[] = ['fixed', 'cdi', 'ipca', 'igpm', 'selic'];

/** The rate types that take a spread on top of the percent of the index (OQ-205). */
const SPREAD_RATES: ReadonlySet<RateType> = new Set(['cdi', 'selic']);

/** When a fixed-term contract pays interest, in the order mockup 32 offers it. */
export const INTEREST_PAYMENTS: readonly InterestPayment[] = [
  'at_maturity', 'monthly', 'semiannual',
];

/** A fixed-term buy's contract (FR-11.1, OQ-201 D12, OQ-205). */
export interface ContractTerms {
  readonly rateType: RateType;
  /** Percent × 10,000, or `null` while empty. */
  readonly rateValue: number | null;
  /** CDI/Selic only: percent × 10,000 on top, or `null` for none. */
  readonly spread: number | null;
  /** `YYYY-MM-DD`, `''` while empty. */
  readonly dueDate: string;
  readonly interestPayment: InterestPayment;
  /** Debentures only (OQ-79). */
  readonly incentivised: boolean;
}

/** What the drawer holds while it is filled in. */
export interface TransactionForm {
  /** The kind's code (FR-3.1). */
  readonly kind: string;
  /** The account the kind is recorded on — a bill payment's paying account. */
  readonly accountId?: string | undefined;
  /** A card kind's card, or the card a bill payment pays. */
  readonly creditCardId?: string | undefined;
  /** Minor units, `null` while empty. */
  readonly amount: number | null;
  /** `YYYY-MM-DD`, as the Date input emits it. */
  readonly date: string;
  readonly categoryId?: string | undefined;
  readonly subcategoryId?: string | undefined;
  readonly description: string;
  /** Sell, redemption, dividend, interest and tax: the Holding picked. */
  readonly holdingId?: string | undefined;
  /** Units × 10⁸, `null` while empty. */
  readonly quantity: number | null;
  /** A buy's asset type (FR-5.1). */
  readonly assetType?: string | undefined;
  /** A buy's ticker or identifier. */
  readonly ticker: string;
  readonly terms: ContractTerms;
  /** A trade's Goal split. */
  readonly allocations: readonly AllocationRow[];
  /** The user changed the split: a sell sends it only then — the server keeps it otherwise. */
  readonly allocationsEdited: boolean;
}

/** A card with the account it sits on, whose currency is the card's. */
export interface CardEntry {
  readonly card: CreditCard;
  readonly account: Account;
}

const BUY = 'investment_buy';
const REDEMPTION = 'investment_redemption';

/** A fixed-term buy's terms before anything is typed. */
export const EMPTY_TERMS: ContractTerms = {
  rateType: 'fixed',
  rateValue: null,
  spread: null,
  dueDate: '',
  interestPayment: 'at_maturity',
  incentivised: false,
};

/**
 * Looks a kind up, for the rules below; an unknown code acts as a plain movement.
 *
 * @param code - The kind's code.
 * @returns The kind's reference data.
 */
const kindOf = (code: string): TransactionKind => findKind(code) ?? TRANSACTION_KINDS[0];

/**
 * Tells which picker group a kind sits in.
 *
 * @param code - The kind's code.
 * @returns Its group.
 */
export const groupOf = (code: string): KindGroup => kindOf(code).group;

/**
 * Lists a group's kinds in picker order.
 *
 * @param group - The group.
 * @returns Its kinds.
 */
export const kindsOfGroup = (group: KindGroup): readonly TransactionKind[] => (
  TRANSACTION_KINDS.filter((kind) => kind.group === group)
);

/**
 * Tells whether a kind is recorded on a card (a charge or a refund).
 *
 * @param code - The kind's code.
 * @returns `true` for the card ledger's kinds.
 */
export const isCardKind = (code: string) => kindOf(code).target === 'card';

/**
 * Tells whether a kind pays a card's bill (FR-3.7).
 *
 * @param code - The kind's code.
 * @returns `true` for a bill payment.
 */
export const isBillPayment = (code: string) => kindOf(code).effect === 'bill_payment';

/**
 * Tells whether a kind names a card: a card kind, or a bill payment.
 *
 * @param code - The kind's code.
 * @returns `true` when the form shows the card chips.
 */
export const namesCard = (code: string) => isCardKind(code) || isBillPayment(code);

/**
 * Tells whether a kind is an investment buy.
 *
 * @param code - The kind's code.
 * @returns `true` for a buy.
 */
export const isBuy = (code: string) => code === BUY;

/**
 * Tells whether a kind moves a Holding's units — a buy, a sell, a redemption —
 * and so takes a quantity and a Goal split.
 *
 * @param code - The kind's code.
 * @returns `true` for the trade kinds.
 */
export const isTrade = (code: string) => kindOf(code).effect === 'investment_trade';

/**
 * Tells whether a kind picks the account's Holding (OQ-201 D10): every
 * investment kind but a buy, which names its asset type and ticker.
 *
 * @param code - The kind's code.
 * @returns `true` for sell, redemption, dividend, interest and tax.
 */
export const namesHolding = (code: string) => kindOf(code).group === 'investment' && !isBuy(code);

/**
 * Tells which way a kind moves money, for the amount's sign.
 *
 * @param code - The kind's code.
 * @returns `in` or `out`.
 */
export const directionOf = (code: string) => kindOf(code).direction;

/**
 * Tells whether a rate type takes a spread (OQ-205).
 *
 * @param rateType - The rate type.
 * @returns `true` for CDI and Selic.
 */
export const takesSpread = (rateType: RateType) => SPREAD_RATES.has(rateType);

/**
 * Tells whether an account is still open.
 *
 * @param account - The account.
 * @returns `true` unless it is archived.
 */
const isOpen = (account: Account) => account.archivedAt === null;

/**
 * Lists every card on an open account, with its account.
 *
 * @param accounts - The accounts the user can see.
 * @returns The cards, in the accounts' order.
 */
export const cardEntriesOf = (accounts: readonly Account[]): CardEntry[] => (
  accounts.filter(isOpen).flatMap((account) => account.cards.map((card) => ({ card, account })))
);

/**
 * Finds a card with its account.
 *
 * @param accounts - The accounts the user can see.
 * @param creditCardId - The card, if one is chosen.
 * @returns It, or nothing.
 */
export const cardEntryOf = (accounts: readonly Account[], creditCardId: string | undefined) => (
  cardEntriesOf(accounts).find((entry) => entry.card.id === creditCardId)
);

/**
 * Lists the accounts a form's kind may be recorded on: open, not
 * credit-card-only (OQ-201 D5) — for a bill payment, in its card's currency
 * once the card is chosen (OQ-219). A card kind names no account.
 *
 * @param form - The form, for its kind and card.
 * @param accounts - The accounts the user can see.
 * @returns The accounts offered.
 */
export const accountChoicesOf = (form: TransactionForm, accounts: readonly Account[]) => {
  if (isCardKind(form.kind)) return [];
  const usable = accounts.filter(
    (account) => isOpen(account) && account.type !== 'credit_card_only',
  );
  const card = isBillPayment(form.kind) ? cardEntryOf(accounts, form.creditCardId) : undefined;
  return card ? usable.filter((account) => account.currency === card.account.currency) : usable;
};

/**
 * Tells which currency the amount is in: the card's account's for a card kind,
 * else the chosen account's — or the bill payment's card's while no payer is
 * chosen yet (FR-2.2: no conversion).
 *
 * @param form - The form, for its kind and targets.
 * @param accounts - The accounts the user can see.
 * @returns The currency, or nothing while no target is chosen.
 */
export const currencyOf = (
  form: TransactionForm,
  accounts: readonly Account[],
): Currency | undefined => {
  const account = isCardKind(form.kind)
    ? undefined
    : accounts.find((candidate) => candidate.id === form.accountId);
  return account?.currency ?? cardEntryOf(accounts, form.creditCardId)?.account.currency;
};

/**
 * Lists the asset types a buy may take on an account (OQ-219): every
 * market-priced type, and the fixed-term types of the account currency's
 * market — Brazil's for BRL, the US's for USD. Before an account is chosen,
 * all of them.
 *
 * @param currency - The account's currency, if chosen.
 * @returns The asset type codes, in reference order.
 */
export const assetTypesFor = (currency: Currency | undefined): string[] => {
  const market = currency === 'USD' ? 'US' : 'BR';
  return ASSET_TYPES
    .filter((type) => currency === undefined || type.pricing === 'market' || type.market === market)
    .map((type) => type.code);
};

/**
 * Tells whether a form's buy is of a fixed-term type, which takes a contract
 * (OQ-50) and an optional quantity (OQ-201 D11).
 *
 * @param form - The form.
 * @returns `true` for a fixed-term buy.
 */
export const isFixedTermBuy = (form: TransactionForm) => (
  isBuy(form.kind) && form.assetType !== undefined && isFixedTerm(form.assetType)
);

/**
 * Tells whether a form's buy is of a debenture, which takes the incentivised flag.
 *
 * @param form - The form.
 * @returns `true` for a debenture buy.
 */
export const isDebentureBuy = (form: TransactionForm) => (
  isBuy(form.kind) && findAssetType(form.assetType ?? '')?.code === 'debenture'
);

/**
 * Tells where a kind's Goal split comes from: a buy's is typed for the
 * purchase, a sell's or redemption's pre-filled from its Holding (OQ-206).
 *
 * @param code - The kind's code.
 * @returns `purchase`, `holding`, or nothing for a kind without a split.
 */
const splitSourceOf = (code: string) => {
  if (!isTrade(code)) return undefined;
  return isBuy(code) ? 'purchase' : 'holding';
};

/**
 * Keeps a lone choice chosen: with exactly one candidate, it is picked; a
 * choice no longer offered is dropped.
 *
 * @param chosen - The current choice, if any.
 * @param candidates - The ids offered.
 * @returns The choice to keep.
 */
const fittedChoice = (chosen: string | undefined, candidates: readonly string[]) => {
  if (chosen !== undefined && candidates.includes(chosen)) return chosen;
  return candidates.length === 1 ? candidates[0] : undefined;
};

/**
 * Fits a form's targets to its kind: a card where the kind names one, an
 * account where it takes one, each dropped when no longer offered and picked
 * when it is the only one; a Holding goes with its account.
 *
 * @param form - The form after a change.
 * @param accounts - The accounts the user can see.
 * @returns The form with fitting targets.
 */
export const withFittedTargets = (
  form: TransactionForm,
  accounts: readonly Account[],
): TransactionForm => {
  const cards = namesCard(form.kind) ? cardEntriesOf(accounts).map((entry) => entry.card.id) : [];
  const withCard = { ...form, creditCardId: fittedChoice(form.creditCardId, cards) };
  const accountIds = accountChoicesOf(withCard, accounts).map((account) => account.id);
  const accountId = fittedChoice(form.accountId, accountIds);
  const keepsHolding = accountId === form.accountId && namesHolding(form.kind);
  return {
    ...withCard,
    accountId,
    holdingId: keepsHolding ? form.holdingId : undefined,
  };
};

/**
 * Switches the form to another kind: amount, date, description and category
 * carry over; the Holding and the quantity stay only where the new kind takes
 * them, and the split only when it comes from the same place; the targets
 * are fitted to the new kind.
 *
 * @param form - The form.
 * @param kind - The new kind's code.
 * @param accounts - The accounts the user can see.
 * @returns The form for the new kind.
 */
export const withKind = (
  form: TransactionForm,
  kind: string,
  accounts: readonly Account[],
): TransactionForm => {
  const keepsSplit = splitSourceOf(form.kind) === splitSourceOf(kind);
  return withFittedTargets({
    ...form,
    kind,
    holdingId: namesHolding(kind) ? form.holdingId : undefined,
    quantity: isTrade(kind) ? form.quantity : null,
    allocations: keepsSplit ? form.allocations : [],
    allocationsEdited: keepsSplit && form.allocationsEdited,
  }, accounts);
};

/**
 * Switches the form to another group, on that group's first kind.
 *
 * @param form - The form.
 * @param group - The new group.
 * @param accounts - The accounts the user can see.
 * @returns The form on the group's first kind; as it was for its own group.
 */
export const withGroup = (
  form: TransactionForm,
  group: KindGroup,
  accounts: readonly Account[],
): TransactionForm => {
  const [first] = kindsOfGroup(group);
  if (first === undefined || groupOf(form.kind) === group) return form;
  return withKind(form, first.code, accounts);
};

/**
 * Keeps a buy's asset type where a currency still offers it (OQ-219).
 *
 * @param assetType - The type chosen, if any.
 * @param currency - The new account's currency, if known.
 * @returns The type, or nothing once it isn't offered.
 */
const assetTypeKept = (assetType: string | undefined, currency: Currency | undefined) => (
  assetType !== undefined && assetTypesFor(currency).includes(assetType) ? assetType : undefined
);

/**
 * Picks the account: a Holding and its pre-filled split go with the previous
 * one, and a buy's asset type when the new currency doesn't offer it.
 *
 * @param form - The form.
 * @param accountId - The account picked.
 * @param accounts - The accounts the user can see, for its currency.
 * @returns The form on that account.
 */
export const withAccount = (
  form: TransactionForm,
  accountId: string,
  accounts: readonly Account[],
): TransactionForm => {
  if (accountId === form.accountId) return form;
  const currency = accounts.find((account) => account.id === accountId)?.currency;
  const fromHolding = splitSourceOf(form.kind) === 'holding';
  return {
    ...form,
    accountId,
    holdingId: undefined,
    quantity: fromHolding ? null : form.quantity,
    assetType: assetTypeKept(form.assetType, currency),
    allocations: fromHolding ? [] : form.allocations,
    allocationsEdited: !fromHolding && form.allocationsEdited,
  };
};

/**
 * Picks the card; a bill payment's payer is fitted to its currency (OQ-219).
 *
 * @param form - The form.
 * @param creditCardId - The card picked.
 * @param accounts - The accounts the user can see.
 * @returns The form on that card.
 */
export const withCard = (
  form: TransactionForm,
  creditCardId: string,
  accounts: readonly Account[],
): TransactionForm => withFittedTargets({ ...form, creditCardId }, accounts);

/**
 * Picks the category — or none — and drops the subcategory, which belongs to
 * the one before (FR-3.4).
 *
 * @param form - The form.
 * @param categoryId - The category, or nothing for none.
 * @returns The form with the category.
 */
export const withCategory = (
  form: TransactionForm,
  categoryId: string | undefined,
): TransactionForm => (
  categoryId === form.categoryId ? form : { ...form, categoryId, subcategoryId: undefined }
);

/**
 * Picks the Holding: a redemption starts with its whole position, which it
 * usually closes (FR-3.8); a sell starts with none; the split waits for the
 * Holding's own (OQ-206).
 *
 * @param form - The form.
 * @param holding - The Holding picked.
 * @returns The form on that Holding.
 */
export const withHolding = (form: TransactionForm, holding: InvestmentHolding): TransactionForm => {
  if (holding.id === form.holdingId) return form;
  return {
    ...form,
    holdingId: holding.id,
    quantity: form.kind === REDEMPTION ? holding.quantity ?? null : null,
    allocations: [],
    allocationsEdited: false,
  };
};

/**
 * Fills a sell's or redemption's split with its Holding's, once read (OQ-206) —
 * unless the user has changed it meanwhile, or picked another Holding.
 *
 * @param form - The form.
 * @param holdingId - The Holding the split was read for.
 * @param rows - Its split, as the allocation editor shows it.
 * @returns The form with the pre-filled split.
 */
export const withHoldingSplit = (
  form: TransactionForm,
  holdingId: string,
  rows: readonly AllocationRow[],
): TransactionForm => (
  form.holdingId !== holdingId || form.allocationsEdited || !isTrade(form.kind)
    ? form
    : { ...form, allocations: rows }
);

/**
 * Sets the split as the user changed it.
 *
 * @param form - The form.
 * @param rows - The whole new split.
 * @returns The form with it, marked edited.
 */
export const withAllocations = (
  form: TransactionForm,
  rows: readonly AllocationRow[],
): TransactionForm => ({ ...form, allocations: rows, allocationsEdited: true });

/**
 * Builds the form a new transaction opens with (mockup 31): the Cash group's
 * first kind, today's date, the only account when there is one.
 *
 * @param accounts - The accounts the user can see.
 * @param today - Today, `YYYY-MM-DD`.
 * @returns The empty form.
 */
export const newFormOf = (accounts: readonly Account[], today: string): TransactionForm => (
  withFittedTargets({
    kind: TRANSACTION_KINDS[0].code,
    amount: null,
    date: today,
    description: '',
    quantity: null,
    ticker: '',
    terms: EMPTY_TERMS,
    allocations: [],
    allocationsEdited: false,
  }, accounts)
);
