import type { InvestmentHolding } from '@financas/api-types';
import { isAllocationValid } from '../../../../kit/allocationEditor/allocation';
import { KIND_SCALE } from '../../../../kit/numberInput/decimal';
import type { MessageParams, Translator } from '../../../../utilities/i18n';
import {
  firstError, isoDate, required, type FieldError,
} from '../../../../utilities/validation';
import {
  isBuy, isCardKind, isFixedTermBuy, isOwnTransfer, isTrade, namesCard, namesHolding,
  type TransactionForm,
} from './transactionForm';
import type { Editable } from './transactionRequest';
import { recordText } from './recordText';

/** One unit of a Holding, in the × 10⁸ fixed point quantities travel in (OQ-189). */
const UNIT = 10 ** KIND_SCALE.quantity;

// The Record Transaction form's checks (FL15; FR-3.1, OQ-201): what a kind
// needs before it is sent — its target, an amount, a date; a buy's asset type,
// ticker, units (optional on fixed-term, D11) and contract; a sell's or
// redemption's Holding and units, no more than it holds; a split each share at
// least 1% and at most 100% in all (OQ-218). Never stricter than the API. On
// an edit only what may change is checked: identity is the server's, kept.

/** A field the checks can refuse. */
export type CheckedField = 'account' | 'card' | 'amount' | 'date' | 'holding' | 'quantity'
  | 'assetType' | 'ticker' | 'rateValue' | 'dueDate' | 'allocations' | 'toAccount'
  | 'receivedAmount';

/** One refusal: a shared field rule's, or one of the drawer's own (`recordTransaction.error.*`). */
export type Problem = { readonly rule: FieldError }
  | { readonly code: string; readonly params?: MessageParams };

/** The form's refusals, by field. */
export type Problems = Partial<Record<CheckedField, Problem>>;

/** What the checks need besides the form. */
export interface CheckContext {
  /** The account's Holdings, for a sell's or redemption's units held. */
  readonly holdings: readonly InvestmentHolding[];
  /** On an edit, what may change; a new transaction checks everything. */
  readonly editable?: Editable | undefined;
  /** A transfer between own accounts reaches another currency: what arrived is asked (OQ-222). */
  readonly receivesOtherCurrency?: boolean | undefined;
}

/** A date's rule: required, and a real calendar date. */
const DATE_RULE = firstError(required, isoDate());

/**
 * Builds a field's refusal from one of the drawer's own codes.
 *
 * @param code - The code under `recordTransaction.error`.
 * @param params - Its ICU params.
 * @returns The refusal.
 */
const own = (code: string, params?: MessageParams): Problem => (
  params ? { code, params } : { code }
);

/**
 * Builds a field's refusal from a shared rule, if it fails.
 *
 * @param error - The rule's answer.
 * @returns The refusal, or nothing.
 */
const ruled = (error: FieldError | undefined): Problem | undefined => (
  error ? { rule: error } : undefined
);

/**
 * Checks the targets: a card where the kind names one, an account where it
 * takes one — a new transaction's only; an edit keeps its own.
 *
 * @param form - The form.
 * @returns The targets' refusals.
 */
const targetProblemsOf = (form: TransactionForm): Problems => ({
  ...(namesCard(form.kind) && form.creditCardId === undefined && { card: own('card') }),
  ...(!isCardKind(form.kind) && form.accountId === undefined && { account: own('account') }),
  ...(namesHolding(form.kind) && form.holdingId === undefined && { holding: own('holding') }),
});

/**
 * Checks a sell's or redemption's units: more than zero, no more than held.
 *
 * @param form - The form.
 * @param holdings - The account's Holdings.
 * @returns The refusal, if any.
 */
const soldQuantityProblemOf = (
  form: TransactionForm,
  holdings: readonly InvestmentHolding[],
): Problem | undefined => {
  if (form.quantity === null || form.quantity <= 0) return own('quantity');
  const held = holdings.find((holding) => holding.id === form.holdingId)?.quantity;
  if (held === undefined || form.quantity <= held) return undefined;
  return own('quantityHeld', { held: held / UNIT });
};

/**
 * Checks a buy's units: required on a market-priced buy, optional on a
 * fixed-term one (1 unit, OQ-201 D11) — more than zero when typed.
 *
 * @param form - The form.
 * @returns The refusal, if any.
 */
const boughtQuantityProblemOf = (form: TransactionForm): Problem | undefined => {
  if (form.quantity === null) return isFixedTermBuy(form) ? undefined : own('quantity');
  return form.quantity > 0 ? undefined : own('quantity');
};

/**
 * Checks a trade's units.
 *
 * @param form - The form.
 * @param holdings - The account's Holdings.
 * @returns The refusal, if any; none for a kind without units.
 */
const quantityProblemOf = (
  form: TransactionForm,
  holdings: readonly InvestmentHolding[],
): Problem | undefined => {
  if (!isTrade(form.kind)) return undefined;
  return isBuy(form.kind) ? boughtQuantityProblemOf(form) : soldQuantityProblemOf(form, holdings);
};

/**
 * Checks an edited trade's units: stored units can be changed, never cleared —
 * the edit has no way to send none, so a fixed-term buy's optional units are
 * required here too.
 *
 * @param form - The form.
 * @param holdings - The account's Holdings.
 * @returns The refusal, if any; none for a kind without units.
 */
const editedQuantityProblemOf = (
  form: TransactionForm,
  holdings: readonly InvestmentHolding[],
): Problem | undefined => (
  isTrade(form.kind) && form.quantity === null ? own('quantity') : quantityProblemOf(form, holdings)
);

/**
 * Checks a fixed-term contract: a rate, and a due date after the buy's date
 * (OQ-205).
 *
 * @param form - The form.
 * @returns The terms' refusals; none for any other kind.
 */
const termProblemsOf = (form: TransactionForm): Problems => {
  if (!isFixedTermBuy(form)) return {};
  const { rateValue, dueDate } = form.terms;
  const badDue = DATE_RULE(dueDate);
  return {
    ...(rateValue === null && { rateValue: own('rate') }),
    ...(badDue && { dueDate: { rule: badDue } }),
    ...(!badDue && dueDate <= form.date && { dueDate: own('dueDate') }),
  };
};

/**
 * Checks what a buy names: its asset type and ticker.
 *
 * @param form - The form.
 * @returns Their refusals; none for any other kind.
 */
const assetProblemsOf = (form: TransactionForm): Problems => {
  if (!isBuy(form.kind)) return {};
  return {
    ...(form.assetType === undefined && { assetType: own('assetType') }),
    ...(form.ticker.trim() === '' && { ticker: own('ticker') }),
  };
};

/**
 * Checks the split: each share at least 1%, at most 100% in all (OQ-218).
 *
 * @param form - The form.
 * @returns The refusal, if any.
 */
const splitProblemOf = (form: TransactionForm): Problem | undefined => (
  isAllocationValid(form.allocations) ? undefined : own('allocations')
);

/**
 * Drops an undefined refusal.
 *
 * @param field - The field.
 * @param problem - Its refusal, if any.
 * @returns `{[field]: problem}`, or nothing.
 */
const entry = (field: CheckedField, problem: Problem | undefined): Problems => (
  problem ? { [field]: problem } : {}
);

/**
 * Checks what a transfer between own accounts needs besides an account (OQ-222):
 * where it goes, and what arrived when that is another currency.
 *
 * @param form - The form.
 * @param receivesOtherCurrency - Whether the account it reaches has another currency.
 * @returns The problems; none for any other form.
 */
const ownTransferProblemsOf = (form: TransactionForm, receivesOtherCurrency: boolean): Problems => {
  if (!isOwnTransfer(form)) return {};
  const missingReceived = receivesOtherCurrency
    && (form.receivedAmount === null || form.receivedAmount < 1);
  return {
    ...entry('toAccount', form.toAccountId === undefined ? own('toAccount') : undefined),
    ...entry('receivedAmount', missingReceived ? own('receivedAmount') : undefined),
  };
};

/**
 * Checks the amount and the date: more than zero, a real calendar date.
 *
 * @param form - The form.
 * @returns Their refusals.
 */
const valueProblemsOf = (form: TransactionForm): Problems => ({
  ...entry('amount', form.amount === null || form.amount < 1 ? own('amount') : undefined),
  ...entry('date', ruled(DATE_RULE(form.date))),
});

/**
 * Checks everything a new transaction needs.
 *
 * @param form - The form.
 * @param holdings - The account's Holdings.
 * @returns The refusals by field.
 */
const newProblemsOf = (
  form: TransactionForm,
  holdings: readonly InvestmentHolding[],
  receivesOtherCurrency: boolean,
): Problems => ({
  ...targetProblemsOf(form),
  ...ownTransferProblemsOf(form, receivesOtherCurrency),
  ...assetProblemsOf(form),
  ...valueProblemsOf(form),
  ...entry('quantity', quantityProblemOf(form, holdings)),
  ...termProblemsOf(form),
  ...entry('allocations', splitProblemOf(form)),
});

/**
 * Checks only what an edit may change; its identity is the server's (OQ-201).
 *
 * @param form - The form.
 * @param holdings - The account's Holdings.
 * @param editable - What may change.
 * @returns The refusals by field.
 */
const editProblemsOf = (
  form: TransactionForm,
  holdings: readonly InvestmentHolding[],
  editable: Editable,
  receivesOtherCurrency: boolean,
): Problems => ({
  ...(editable.amountAndDate ? valueProblemsOf(form) : {}),
  ...(editable.amountAndDate ? ownTransferProblemsOf(form, receivesOtherCurrency) : {}),
  ...(editable.quantity ? entry('quantity', editedQuantityProblemOf(form, holdings)) : {}),
  ...(editable.terms ? termProblemsOf(form) : {}),
});

/**
 * Checks what a new transaction needs, or what an edit may change.
 *
 * @param form - The form.
 * @param context - The account's Holdings, and on an edit what may change.
 * @returns The refusals by field; empty when the form may be sent.
 */
export const problemsOf = (form: TransactionForm, context: CheckContext): Problems => (
  context.editable
    ? editProblemsOf(form, context.holdings, context.editable, !!context.receivesOtherCurrency)
    : newProblemsOf(form, context.holdings, !!context.receivesOtherCurrency)
);

/**
 * Tells whether a form has any refusal.
 *
 * @param problems - Its refusals.
 * @returns `true` when there is none.
 */
export const isClear = (problems: Problems) => Object.keys(problems).length === 0;

/**
 * Writes a refusal in the interface language.
 *
 * @param problem - The refusal, if any.
 * @param translator - The texts.
 * @returns Its message, or nothing.
 */
export const problemText = (problem: Problem | undefined, translator: Translator) => {
  if (problem === undefined) return undefined;
  if ('rule' in problem) return translator.field(problem.rule.code, problem.rule.params);
  return recordText(translator, `error.${problem.code}`, problem.params);
};
