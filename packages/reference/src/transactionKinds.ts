// Transaction kinds (FR-3.1): reference data, extensible without a schema change.
// Each kind says which ledger it targets, how it's grouped in the Record
// Transaction picker, which way money moves, and — for Account Transactions —
// the effect that dispatches the write and is persisted with it (EFFECT_BY_KIND).

/** Picker groups, in display order (EBD: Kind Group & Kind Selection). */
export const KIND_GROUPS = ['cash', 'transfer', 'credit_card', 'investment'] as const;
export type KindGroup = (typeof KIND_GROUPS)[number];

/** Which ledger a kind writes to. */
export type KindTarget = 'account' | 'card';

/** Money direction; stored amounts are always positive (OQ-98). */
export type Direction = 'in' | 'out';

/** Account-ledger write effect (02-data-model.md, "Why `effect` exists"). */
export type TransactionEffect = 'movement' | 'transfer' | 'bill_payment' | 'investment_trade';

/** One transaction kind. Card kinds have no effect (the card Accessor takes the kind). */
export interface TransactionKind {
  readonly code: string;
  readonly group: KindGroup;
  readonly target: KindTarget;
  readonly direction: Direction;
  readonly effect?: TransactionEffect;
}

/**
 * Builds a kind, keeping its code as a literal type.
 *
 * @param code - Stored kind code (snake_case, as in the API).
 * @param group - Picker group.
 * @param target - Ledger it writes to.
 * @param direction - Which way money moves.
 * @param effect - Account-ledger effect; omitted for card kinds.
 * @returns The kind.
 */
const defineKind = <const Code extends string>(
  code: Code,
  group: KindGroup,
  target: KindTarget,
  direction: Direction,
  effect?: TransactionEffect,
) => ({
  code, group, target, direction, ...(effect ? { effect } : {}),
}) as TransactionKind & { readonly code: Code };

export const TRANSACTION_KINDS = [
  defineKind('withdrawal', 'cash', 'account', 'out', 'movement'),
  defineKind('deposit', 'cash', 'account', 'in', 'movement'),
  defineKind('boleto_payment', 'cash', 'account', 'out', 'movement'),
  defineKind('pix_payment', 'cash', 'account', 'out', 'movement'),
  defineKind('pix_receipt', 'cash', 'account', 'in', 'movement'),
  defineKind('transfer_sent', 'transfer', 'account', 'out', 'transfer'),
  defineKind('transfer_received', 'transfer', 'account', 'in', 'transfer'),
  defineKind('credit_card_bill_payment', 'credit_card', 'account', 'out', 'bill_payment'),
  defineKind('charge', 'credit_card', 'card', 'out'),
  defineKind('refund', 'credit_card', 'card', 'in'),
  defineKind('investment_buy', 'investment', 'account', 'out', 'investment_trade'),
  defineKind('investment_sell', 'investment', 'account', 'in', 'investment_trade'),
  defineKind('investment_dividend', 'investment', 'account', 'in', 'movement'),
  defineKind('investment_interest', 'investment', 'account', 'in', 'movement'),
  defineKind('investment_redemption', 'investment', 'account', 'in', 'investment_trade'),
  defineKind('investment_tax', 'investment', 'account', 'out', 'movement'),
] as const;

export type TransactionKindCode = (typeof TRANSACTION_KINDS)[number]['code'];

/** Where a transaction is being recorded: an account (with its type) or a credit card. */
export type KindTargetContext = | { readonly target: 'account'; readonly accountType: string }
  | { readonly target: 'card' };

/**
 * Looks up a kind by code.
 *
 * @param code - A kind code, e.g. from a request.
 * @returns The kind, or `undefined` for an unknown code.
 */
export const findKind = (code: string): TransactionKind | undefined => (
  TRANSACTION_KINDS.find((kind) => kind.code === code)
);

/**
 * Tells whether a kind may be recorded against a target (FR-3.1, OQ-76): card
 * targets take only card kinds; investment kinds are refused on a
 * `credit_card_only` account.
 *
 * @param kind - The kind.
 * @param context - The target being recorded against.
 * @returns `true` when the combination is valid.
 */
export const isKindAllowed = (kind: TransactionKind, context: KindTargetContext): boolean => {
  if (kind.target !== context.target) return false;
  if (context.target === 'card') return true;
  return !(kind.group === 'investment' && context.accountType === 'credit_card_only');
};

/**
 * Lists the kinds a target offers, in picker order.
 *
 * @param context - The target being recorded against.
 * @returns The valid kinds.
 */
export const kindsFor = (context: KindTargetContext): TransactionKind[] => (
  TRANSACTION_KINDS.filter((kind) => isKindAllowed(kind, context))
);
