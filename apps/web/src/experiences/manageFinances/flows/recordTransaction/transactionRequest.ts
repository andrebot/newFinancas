import type {
  Currency, InvestmentHolding, LedgerItem, TransactionCreateRequest, TransactionUpdateRequest,
} from '@financas/api-types';
import {
  EMPTY_TERMS, isBillPayment, isBuy, isCardKind, isFixedTermBuy, isDebentureBuy, isOwnTransfer,
  isTrade, namesHolding, takesSpread, type ContractTerms, type TransactionForm,
} from './transactionForm';

// What the Record Transaction form sends (FL15; FR-3.1/FR-3.2, OQ-201): the
// create request for its kind — only the fields the kind takes, since a field
// it has no use for is a 422 — and, on an edit, the form a ledger row opens
// with and the changes it sends. An edit changes values, never identity
// (OQ-201 D6): kind, account, card and Holding stay; a fixed-term buy whose
// schedule has started keeps its amount, date, quantity and terms (D8). A
// transfer between own accounts (OQ-222) is sent From → To, with what arrived
// when the currencies differ, and edits as one from either side: the form
// always shows it as sent.

/** What an edit may change, for its kind and whether its schedule has started. */
export interface Editable {
  /** Amount and date. */
  readonly amountAndDate: boolean;
  /** A trade's units. */
  readonly quantity: boolean;
  /** A fixed-term buy's contract. */
  readonly terms: boolean;
}

/** The rate a request carries. */
type RequestRate = NonNullable<TransactionCreateRequest['rate']>;

/**
 * Builds a one-field object when the value is set — a spread-in optional field.
 *
 * @param key - The field's name.
 * @param value - Its value, if any.
 * @returns `{[key]: value}`, or nothing for `undefined`.
 */
const fieldIf = <Key extends string, Value>(key: Key, value: Value | undefined) => (
  (value === undefined ? {} : { [key]: value }) as Partial<Record<Key, Value>>
);

/**
 * Builds a one-field change when it may change and did.
 *
 * @param key - The field's name.
 * @param before - As recorded.
 * @param after - As edited.
 * @param allowed - Whether the edit may change it.
 * @returns `{[key]: after}`, or nothing.
 */
const changeIf = <Key extends string, Value>(
  key: Key,
  before: Value,
  after: Value,
  allowed = true,
) => fieldIf(key, allowed && before !== after ? after : undefined);

/**
 * Builds the rate a fixed-term buy sends; the spread only where its type takes one.
 *
 * @param terms - The contract as typed.
 * @returns The request's rate.
 */
const rateOf = (terms: ContractTerms): RequestRate => ({
  type: terms.rateType,
  value: terms.rateValue ?? 0,
  ...fieldIf('spread', takesSpread(terms.rateType) ? terms.spread ?? undefined : undefined),
});

/**
 * Builds the shares a trade sends, as whole percents per Goal.
 *
 * @param form - The form.
 * @returns The allocations.
 */
const sharesOf = (form: TransactionForm) => form.allocations.map((row) => ({
  goalId: row.goalId, percentage: row.percent ?? 0,
}));

/**
 * Tells whether a trade sends its split: a buy when it has any share, a sell or
 * redemption only when the user changed its Holding's (the server keeps it otherwise).
 *
 * @param form - The form.
 * @returns `true` when `allocations` goes out.
 */
const sendsSplit = (form: TransactionForm) => (
  isBuy(form.kind) ? form.allocations.length > 0 : isTrade(form.kind) && form.allocationsEdited
);

/**
 * Builds where the transaction is recorded: a card kind's card; a bill
 * payment's paying account and card (OQ-219); every other kind's account.
 *
 * @param form - The form.
 * @returns The request's target fields.
 */
const targetOf = (form: TransactionForm): Partial<TransactionCreateRequest> => {
  const card = fieldIf('creditCardId', form.creditCardId);
  if (isCardKind(form.kind)) return card;
  const account = fieldIf('accountId', form.accountId);
  if (isOwnTransfer(form)) {
    return {
      ...account,
      ...fieldIf('toAccountId', form.toAccountId),
      ...fieldIf('receivedAmount', form.receivedAmount ?? undefined),
    };
  }
  return isBillPayment(form.kind) ? { ...account, ...card } : account;
};

/**
 * Builds a buy's own fields: its asset type and ticker, its units when typed
 * (optional on fixed-term, OQ-201 D11), a fixed-term contract's terms and a
 * debenture's flag.
 *
 * @param form - The form.
 * @returns The buy's fields.
 */
const buyFieldsOf = (form: TransactionForm): Partial<TransactionCreateRequest> => ({
  ...fieldIf('assetType', form.assetType),
  ticker: form.ticker.trim(),
  ...fieldIf('quantity', form.quantity ?? undefined),
  ...(isFixedTermBuy(form) ? {
    rate: rateOf(form.terms),
    dueDate: form.terms.dueDate,
    interestPayment: form.terms.interestPayment,
  } : {}),
  ...fieldIf('incentivised', isDebentureBuy(form) ? form.terms.incentivised : undefined),
});

/**
 * Builds an investment kind's own fields: a buy's, or the Holding picked and —
 * for a sell or redemption — the units.
 *
 * @param form - The form.
 * @returns The kind's fields; none for a non-investment kind.
 */
const investmentFieldsOf = (form: TransactionForm): Partial<TransactionCreateRequest> => {
  if (isBuy(form.kind)) return buyFieldsOf(form);
  if (!namesHolding(form.kind)) return {};
  return {
    ...fieldIf('holdingId', form.holdingId),
    ...fieldIf('quantity', isTrade(form.kind) ? form.quantity ?? undefined : undefined),
  };
};

/**
 * Builds the create request for a form that passed its checks.
 *
 * @param form - The form.
 * @param currency - The target's currency (FR-2.2).
 * @returns `POST …/transactions`'s body.
 */
export const createRequestOf = (
  form: TransactionForm,
  currency: Currency,
): TransactionCreateRequest => {
  const description = form.description.trim();
  return {
    kind: form.kind,
    date: form.date,
    amount: form.amount ?? 0,
    currency,
    ...targetOf(form),
    ...fieldIf('categoryId', form.categoryId),
    ...fieldIf('subcategoryId', form.subcategoryId),
    ...fieldIf('description', description || undefined),
    ...investmentFieldsOf(form),
    ...fieldIf('allocations', sendsSplit(form) ? sharesOf(form) : undefined),
  };
};

/** A Holding's rate, as the contract returns it. */
type HoldingRate = InvestmentHolding['rate'];

/**
 * Reads a Holding's rate into the form's terms.
 *
 * @param rate - The Holding's rate, if any.
 * @returns The rate type, value and spread.
 */
const rateTermsOf = (rate: HoldingRate) => ({
  rateType: rate?.type ?? EMPTY_TERMS.rateType,
  rateValue: rate?.value ?? null,
  spread: rate?.spread ?? null,
});

/**
 * Reads a Holding's contract into the form's terms (a fixed-term buy's edit).
 *
 * @param holding - The Holding the buy created, if read.
 * @returns Its terms, or the empty ones.
 */
const termsOf = (holding: InvestmentHolding | undefined): ContractTerms => {
  if (holding === undefined) return EMPTY_TERMS;
  return {
    ...rateTermsOf(holding.rate),
    dueDate: holding.dueDate ?? '',
    interestPayment: holding.interestPayment ?? EMPTY_TERMS.interestPayment,
    incentivised: holding.incentivised ?? false,
  };
};

/**
 * Reads what every ledger row has into the form.
 *
 * @param item - The transaction.
 * @returns Its kind, amount, date, category, subcategory and description.
 */
const commonFieldsOf = (item: LedgerItem) => ({
  kind: item.kind ?? '',
  amount: item.amount ?? null,
  date: item.date ?? '',
  categoryId: item.categoryId ?? undefined,
  subcategoryId: item.subcategoryId ?? undefined,
  description: item.description ?? '',
});

/**
 * Reads an account row's own targets and trade into the form.
 *
 * @param item - The account ledger's transaction.
 * @returns Its account, card, Holding, units, asset type and ticker.
 */
const accountFieldsOf = (item: LedgerItem & { readonly ledger: 'account' }) => ({
  accountId: item.accountId,
  creditCardId: item.creditCardId ?? undefined,
  holdingId: item.holdingId ?? undefined,
  quantity: item.quantity ?? null,
  assetType: item.holding?.assetType,
  ticker: item.holding?.ticker ?? '',
});

/** A ledger row on the Account ledger. */
type AccountItem = LedgerItem & { readonly ledger: 'account' };

/**
 * Turns either side of a transfer between own accounts into the form as sent
 * (OQ-222): From and To, the amount sent and — across currencies — what arrived.
 *
 * @param item - Either side, with its other side.
 * @param transfer - Its other side.
 * @returns The form's transfer fields.
 */
export const ownTransferFieldsOf = (
  item: AccountItem,
  transfer: NonNullable<AccountItem['transfer']>,
): Partial<TransactionForm> => {
  const sent = item.kind === 'transfer_sent';
  const own = { accountId: item.accountId, amount: item.amount, currency: item.currency };
  const other = {
    accountId: transfer.accountId ?? undefined,
    amount: transfer.amount,
    currency: transfer.currency,
  };
  const [from, to] = sent ? [own, other] : [other, own];
  return {
    kind: 'transfer_sent',
    ownTransfer: true,
    accountId: from.accountId,
    toAccountId: to.accountId,
    amount: from.amount ?? null,
    receivedAmount: from.currency === to.currency ? null : to.amount ?? null,
  };
};

/**
 * Builds the form a ledger row opens with on an edit: its values as recorded;
 * a buy's terms from the Holding it created; either side of a transfer
 * between own accounts as sent (OQ-222).
 *
 * @param item - The transaction, either ledger.
 * @param holding - A trade's Holding, when read.
 * @returns The pre-filled form.
 */
export const editFormOf = (
  item: LedgerItem,
  holding: InvestmentHolding | undefined,
): TransactionForm => {
  const targets = item.ledger === 'card'
    ? { creditCardId: item.creditCardId, quantity: null, ticker: '' }
    : accountFieldsOf(item);
  const transfer = item.ledger === 'account' ? item.transfer : undefined;
  return {
    ...commonFieldsOf(item),
    ...targets,
    terms: termsOf(holding),
    allocations: [],
    allocationsEdited: false,
    ownTransfer: false,
    receivedAmount: null,
    ...(transfer && ownTransferFieldsOf(item as AccountItem, transfer)),
  };
};

/**
 * Tells what an edit may change (OQ-201 D6, D8): amount and date unless the
 * schedule has started; a trade's units and a fixed-term buy's terms the same.
 *
 * @param form - The edit's form.
 * @param scheduleStarted - A fixed-term buy's schedule has posted an entry.
 * @returns What is editable.
 */
export const editableOf = (form: TransactionForm, scheduleStarted: boolean): Editable => ({
  amountAndDate: !scheduleStarted,
  quantity: isTrade(form.kind) && !scheduleStarted,
  terms: isFixedTermBuy(form) && !scheduleStarted,
});

/**
 * Tells whether two rates differ.
 *
 * @param before - The rate as recorded.
 * @param after - The rate as edited.
 * @returns `true` when the type, value or spread changed.
 */
const rateChanged = (before: ContractTerms, after: ContractTerms) => (
  before.rateType !== after.rateType || before.rateValue !== after.rateValue
  || (takesSpread(after.rateType) && before.spread !== after.spread)
);

/**
 * Builds the change an optional field sends: `null` clears it.
 *
 * @param key - The field's name.
 * @param before - As recorded.
 * @param after - As edited.
 * @returns `{[key]: after | null}`, or nothing when unchanged.
 */
const optionalChangeIf = <Key extends string>(
  key: Key,
  before: string | undefined,
  after: string | undefined,
) => fieldIf(key, before === after ? undefined : after ?? null);

/**
 * Builds a fixed-term buy's term changes: the rate as a whole, the due date,
 * the interest payment and a debenture's flag — each only when changed.
 *
 * @param before - The terms as recorded.
 * @param after - The terms as edited.
 * @param debenture - Whether the buy is of a debenture.
 * @returns The changed terms.
 */
const termChangesOf = (
  before: ContractTerms,
  after: ContractTerms,
  debenture: boolean,
): TransactionUpdateRequest => ({
  ...fieldIf('rate', rateChanged(before, after) ? rateOf(after) : undefined),
  ...changeIf('dueDate', before.dueDate, after.dueDate),
  ...changeIf('interestPayment', before.interestPayment, after.interestPayment),
  ...changeIf('incentivised', before.incentivised, after.incentivised, debenture),
});

/**
 * What arrived on the other account, when a transfer between own accounts
 * crosses currencies (OQ-222) — within one, the server sends the amount over.
 *
 * @param before - The form as it opened.
 * @param after - The form as it stands.
 * @param editable - What the edit may change.
 * @returns `receivedAmount` when it changed, or nothing.
 */
const receivedChangeOf = (
  before: TransactionForm,
  after: TransactionForm,
  editable: Editable,
) => changeIf(
  'receivedAmount',
  before.receivedAmount,
  after.receivedAmount ?? before.receivedAmount,
  editable.amountAndDate && before.receivedAmount !== null,
);

/**
 * Builds the changes an edit sends: only what changed and may change; a
 * cleared category, subcategory or description as `null`.
 *
 * @param before - The form as it opened.
 * @param after - The form as edited.
 * @param editable - What the edit may change.
 * @returns `PATCH …/transactions/:id`'s body; empty when nothing changed.
 */
export const changesOf = (
  before: TransactionForm,
  after: TransactionForm,
  editable: Editable,
): TransactionUpdateRequest => ({
  ...changeIf('date', before.date, after.date, editable.amountAndDate),
  ...changeIf('amount', before.amount, after.amount ?? before.amount, editable.amountAndDate),
  ...optionalChangeIf('categoryId', before.categoryId, after.categoryId),
  ...optionalChangeIf('subcategoryId', before.subcategoryId, after.subcategoryId),
  ...optionalChangeIf(
    'description',
    before.description || undefined,
    after.description.trim() || undefined,
  ),
  ...changeIf('quantity', before.quantity, after.quantity ?? before.quantity, editable.quantity),
  ...receivedChangeOf(before, after, editable),
  ...(editable.terms ? termChangesOf(before.terms, after.terms, isDebentureBuy(after)) : {}),
}) as TransactionUpdateRequest;
