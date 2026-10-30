import type { TransactionKind } from '@financas/reference';
import type { Account, Movement } from '../../accessors/accountAccessor';
import type { HoldingRate } from '../../accessors/investmentHoldingAccessor';
import type { ContractRate } from '../../engines/investmentProduct';
import { signedSpend } from '../budgetSpend';
import type { TransactionStores } from './context';

// The signed effects a transaction kind makes on its ledgers (OQ-201 D1/D4):
// Record applies them, Edit reverses the stored ones and reapplies new ones,
// Delete reverses them. One place decides the signs; each writer calls in.

/** A rate as a request carries it — the route checked its shape. */
export interface RequestRate {
  readonly type?: string | undefined;
  readonly value?: number | undefined;
  readonly spread?: number | null | undefined;
}

/** The rate as the Engine takes it (OQ-205). */
export const engineRateOf = (rate: RequestRate): ContractRate => ({
  type: rate.type! as ContractRate['type'],
  value: rate.value!,
  ...(rate.spread != null && { spread: rate.spread }),
});

/** The Holding's terms as the row stores them (OQ-205). */
export const holdingRateOf = (rate: RequestRate): HoldingRate => ({
  rateType: rate.type!, rateValue: rate.value!, rateSpread: rate.spread ?? null,
});

/** A transaction's values as far as its effects read them. */
export interface EffectValues {
  /** Positive minor units. */
  readonly amount: number;
  readonly currency: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
}

/**
 * The signed movement a kind makes on its Account: in raises it, out lowers it.
 *
 * @param kind - The kind.
 * @param values - Its amount, currency and date.
 * @returns Signed minor units with currency and date.
 */
export const accountMovementOf = (kind: TransactionKind, values: EffectValues): Movement => ({
  amount: (kind.direction === 'in' ? 1 : -1) * values.amount,
  currency: values.currency,
  date: values.date,
});

/**
 * The signed movement a card kind makes on its outstanding balance: a charge
 * raises it, a refund lowers it.
 *
 * @param kind - The kind (charge or refund).
 * @param values - Its amount, currency and date.
 * @returns Signed minor units with currency and date.
 */
export const cardMovementOf = (kind: TransactionKind, values: EffectValues): Movement => ({
  amount: (kind.direction === 'out' ? 1 : -1) * values.amount,
  currency: values.currency,
  date: values.date,
});

/** The Budget accrual a transaction makes — spend is out − in per category (OQ-201 D4). */
export interface BudgetAccrual {
  readonly scope: {
    readonly householdId: string;
    readonly visibility: 'shared' | 'personal';
    readonly ownerUserId: string | null;
  };
  readonly currency: string;
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
  /** Signed minor units. */
  readonly amount: number;
  readonly date: string;
}

/**
 * The accrual a kind makes against the Budget that claims its category — money
 * coming in reduces spend (OQ-201 D4); none when it names no category.
 *
 * @param account - The target Account, whose scope the spend takes.
 * @param kind - The kind; its direction signs the accrual.
 * @param values - Its amount and date.
 * @param categoryId - The Category it names, if any.
 * @param subcategoryId - The Subcategory it names, if any.
 * @returns The accrual, or `null` when there is nothing to count.
 */
export const budgetAccrualOf = (
  account: Account,
  kind: TransactionKind,
  values: EffectValues,
  categoryId: string | null,
  subcategoryId: string | null,
): BudgetAccrual | null => {
  if (!categoryId && !subcategoryId) return null;
  return {
    scope: {
      householdId: account.householdId,
      visibility: account.visibility,
      ownerUserId: account.ownerUserId,
    },
    currency: values.currency,
    categoryId,
    subcategoryId,
    amount: signedSpend(kind.direction, values.amount),
    date: values.date,
  };
};

/** Counts an accrual against the Budget that claims it; a no-op when there is none. */
export const accrueBudget = async (
  stores: TransactionStores,
  accrual: BudgetAccrual | null,
): Promise<void> => {
  if (accrual !== null) await stores.budgets.accrueIfClaimed(accrual);
};
