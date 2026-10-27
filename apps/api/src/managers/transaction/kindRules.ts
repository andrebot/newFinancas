import { isFixedTerm, type TransactionKind } from '@financas/reference';
import type { FieldDetail } from '../../utilities/validation';

// The fields each transaction kind takes (FR-3.1, OQ-201): a missing required
// field and a field the kind has no use for are both 422 `validation.failed`
// details — the route's Zod schema checks shape only, so this is the Manager's
// ValidationUtility step.

/** The fields every request carries, whatever its kind. */
const ALWAYS_ALLOWED = new Set(['kind', 'date', 'amount', 'currency']);

/** Every kind may take a category (OQ-201) and a description. */
const COMMON_OPTIONAL: readonly string[] = ['categoryId', 'subcategoryId', 'description'];

interface KindFields {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

/** The fields each kind takes besides `kind`/`date`/`amount`/`currency`. */
const KIND_FIELDS: Record<string, KindFields> = {
  charge: { required: ['creditCardId'], optional: COMMON_OPTIONAL },
  refund: { required: ['creditCardId'], optional: COMMON_OPTIONAL },
  withdrawal: { required: ['accountId'], optional: COMMON_OPTIONAL },
  deposit: { required: ['accountId'], optional: COMMON_OPTIONAL },
  boleto_payment: { required: ['accountId'], optional: COMMON_OPTIONAL },
  pix_payment: { required: ['accountId'], optional: COMMON_OPTIONAL },
  pix_receipt: { required: ['accountId'], optional: COMMON_OPTIONAL },
  transfer_sent: { required: ['accountId'], optional: COMMON_OPTIONAL },
  transfer_received: { required: ['accountId'], optional: COMMON_OPTIONAL },
  credit_card_bill_payment: {
    required: ['accountId', 'creditCardId'], optional: COMMON_OPTIONAL,
  },
  investment_buy: {
    required: ['accountId', 'assetType', 'ticker'],
    optional: [...COMMON_OPTIONAL, 'quantity', 'allocations'],
  },
  investment_sell: {
    required: ['accountId', 'holdingId', 'quantity'],
    optional: [...COMMON_OPTIONAL, 'allocations'],
  },
  investment_redemption: {
    required: ['accountId', 'holdingId', 'quantity'],
    optional: [...COMMON_OPTIONAL, 'allocations'],
  },
  investment_dividend: { required: ['accountId', 'holdingId'], optional: COMMON_OPTIONAL },
  investment_interest: { required: ['accountId', 'holdingId'], optional: COMMON_OPTIONAL },
  investment_tax: { required: ['accountId', 'holdingId'], optional: COMMON_OPTIONAL },
};

/** A fixed-term buy's terms (OQ-50/OQ-201): its rate and maturity are the contract. */
const FIXED_TERM_FIELDS: KindFields = {
  required: ['rate', 'dueDate'],
  optional: ['interestPayment'],
};

/** The flag only a debenture carries (OQ-79). */
const DEBENTURE_FLAG = 'incentivised';

/**
 * The fields a kind's request takes, with which of them are required — a buy's
 * depend on its asset type: market-priced needs its quantity, fixed-term adds
 * its terms (OQ-50/OQ-201), and the debenture flag rides only a debenture.
 *
 * @param kind - The kind.
 * @param assetType - The buy's asset type; decides the extras.
 * @returns Its required and optional fields.
 */
export const fieldsForKind = (kind: TransactionKind, assetType?: string): KindFields => {
  if (kind.code !== 'investment_buy' || !assetType) return KIND_FIELDS[kind.code]!;
  const base = KIND_FIELDS.investment_buy!;
  if (!isFixedTerm(assetType)) {
    return { required: [...base.required, 'quantity'], optional: base.optional };
  }
  const terms = assetType === 'debenture'
    ? [...FIXED_TERM_FIELDS.optional, DEBENTURE_FLAG]
    : FIXED_TERM_FIELDS.optional;
  return {
    required: [...base.required, ...FIXED_TERM_FIELDS.required],
    optional: [...base.optional, ...terms],
  };
};

/** A create request, as far as per-kind validation reads it — the route checked its shape. */
export interface CreateRequestFields {
  readonly assetType?: string | undefined;
  readonly date?: string | undefined;
  readonly dueDate?: string | null | undefined;
  readonly rate?: {
    readonly type?: string | undefined;
    readonly value?: number | undefined;
    readonly spread?: number | null | undefined;
  } | null | undefined;
}

/**
 * The field problems of a create request for its kind (OQ-201): each missing
 * required field as `field.required`, each field the kind has no use for as an
 * unknown key.
 *
 * @param request - The request, as the route validated it.
 * @param kind - Its kind.
 * @returns The problems; empty when the fields fit the kind.
 */
export const createFieldProblems = (request: object, kind: TransactionKind): FieldDetail[] => {
  const record = request as Record<string, unknown>;
  const fields = fieldsForKind(kind, record.assetType as string | undefined);
  const allowed = new Set([...fields.required, ...fields.optional]);
  const missing = fields.required.filter((field) => record[field] == null);
  const unknown = Object.keys(record).filter(
    (key) => !ALWAYS_ALLOWED.has(key) && !allowed.has(key),
  );
  return [
    ...missing.map((field): FieldDetail => ({ field, code: 'field.required' })),
    ...unknown.map((field): FieldDetail => ({
      field, code: 'object.unknown_keys', params: { keys: [field] },
    })),
  ];
};

/** The rate types a spread may sit on (OQ-205): percent of the index plus spread. */
const SPREAD_TYPES = new Set(['cdi', 'selic']);

/** A `dueDate` not after the buy's `date` (OQ-205). */
const dueDateProblem = (request: CreateRequestFields): FieldDetail | undefined => {
  if (request.dueDate == null || request.date === undefined) return undefined;
  return request.dueDate <= request.date ? { field: 'dueDate', code: 'date.min' } : undefined;
};

/** A `rate.spread` on a type other than CDI/Selic (OQ-205). */
const spreadProblem = (request: CreateRequestFields): FieldDetail | undefined => {
  const { rate } = request;
  if (rate?.spread == null) return undefined;
  if (SPREAD_TYPES.has(rate.type ?? '')) return undefined;
  return { field: 'rate.spread', code: 'field.invalid' };
};

/**
 * A fixed-term buy's term problems (OQ-205): a `dueDate` not after the buy's
 * `date`, and a `rate.spread` on a type other than CDI/Selic.
 *
 * @param request - The request, as the route validated it.
 * @returns The problems; empty when the terms are sound.
 */
export const fixedTermProblems = (request: CreateRequestFields): FieldDetail[] => [
  dueDateProblem(request), spreadProblem(request),
].filter((problem): problem is FieldDetail => problem !== undefined);

/**
 * Every field problem of a create request for its kind — the per-kind fields,
 * plus the fixed-term terms when it is one (OQ-201/OQ-205).
 *
 * @param request - The request, as the route validated it.
 * @param kind - Its kind.
 * @returns The problems; empty when the request fits its kind.
 */
export const createProblems = (
  request: CreateRequestFields,
  kind: TransactionKind,
): FieldDetail[] => {
  if (kind.code !== 'investment_buy' || !isFixedTerm(request.assetType ?? '')) {
    return createFieldProblems(request, kind);
  }
  return [...createFieldProblems(request, kind), ...fixedTermProblems(request)];
};
