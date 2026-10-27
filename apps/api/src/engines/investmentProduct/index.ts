import {
  findAssetType, type IndexCodeValue, type SCHEDULE_ENTRY_KINDS,
} from '@financas/reference';
import type { IndexRateAccessor } from '../../accessors/indexRateAccessor';
import type { InterestPayment } from '../../db/schema/values';
import { type ContractRate, interestFor } from './accrual';
import { daysBetween, followingBusinessDay, type Market } from './calendar';
import accrualPeriods from './coupons';
import { regressiveTax, type TaxRule, taxRuleOf } from './tax';

// InvestmentProductEngine (E1, VBD §2.2, FR-11, OQ-201, OQ-205): a fixed-term
// contract's cash events and what it is expected to pay. TransactionManager
// calls `schedule` on a buy and persists the entries (applySchedule);
// InsightsManager calls `project` to show a Holding. Both read the index's
// latest value themselves for an index-linked rate, so amounts are projections
// the user corrects once posted; with no value recorded yet both refuse
// (`index_missing`, OQ-205) — nothing is projected from a made-up rate.

export type { ContractRate } from './accrual';

/** What a buy contracted (FR-11.2) — the Manager's, from the transaction. */
export interface ContractTerms {
  /** One of FR-11.1's fixed-term types (OQ-79). */
  readonly assetType: string;
  /** Debentures only. */
  readonly incentivised: boolean | null;
  /** The purchase date, `YYYY-MM-DD`. */
  readonly date: string;
  /** The principal, positive minor units. */
  readonly amount: number;
  /** The maturity date, `YYYY-MM-DD`, after `date` — the Manager refuses otherwise (OQ-205). */
  readonly dueDate: string;
  readonly rate: ContractRate;
  readonly interestPayment: InterestPayment;
}

/** One cash event, as `InvestmentHoldingAccessor.applySchedule` takes it. */
export interface ScheduleEntry {
  readonly kind: (typeof SCHEDULE_ENTRY_KINDS)[number];
  /** Positive minor units. */
  readonly amount: number;
  /** The day it posts, `YYYY-MM-DD` — a business day. */
  readonly date: string;
}

/** What a Holding is expected to pay over its contract (FR-11.2, OQ-58). */
export interface Projection {
  /** The principal plus all gross interest (OQ-205). */
  readonly expectedPayout: number;
  /** The total tax; US instruments aren't estimated (OQ-79). */
  readonly expectedTaxes: | { readonly estimated: true; readonly amount: number }
    | { readonly estimated: false };
}

/** The index an index-linked rate tracks has no value recorded yet (OQ-205). */
export interface IndexMissing {
  readonly ok: false;
  readonly reason: 'index_missing';
  readonly indexCode: IndexCodeValue;
}

export type ScheduleResult = | { readonly ok: true; readonly entries: ScheduleEntry[] }
  | IndexMissing;

export type ProjectResult = | ({ readonly ok: true } & Projection) | IndexMissing;

/** What the Engine reaches: the index's latest value. */
export interface InvestmentProductEngineDeps {
  readonly latestIndexRate: IndexRateAccessor['latest'];
}

/** One payment of interest and the tax withheld on it. */
interface Payment {
  readonly date: string;
  readonly interest: number;
  readonly tax: number;
}

/** A contract's payments and how they are taxed. */
interface Payments {
  readonly rule: TaxRule;
  /** One per accrual period, oldest first — the last on the redemption's date. */
  readonly payments: Payment[];
}

/**
 * The market whose calendar and rules apply to a fixed-term type.
 *
 * @param assetType - An asset type code.
 * @returns The market.
 * @throws When the type isn't fixed-term — the Manager only sends those.
 */
const marketOf = (assetType: string): Market => {
  const market = findAssetType(assetType)?.market;
  if (!market) throw new Error(`Not a fixed-term asset type: ${assetType}`);
  return market;
};

/**
 * The tax withheld on one payment.
 *
 * @param rule - The instrument's tax rule.
 * @param interest - The payment's gross interest.
 * @param daysHeld - Calendar days from the purchase to the payment.
 * @returns Minor units; 0 when exempt or not estimated.
 */
const taxOn = (rule: TaxRule, interest: number, daysHeld: number): number => (
  rule === 'regressive' ? regressiveTax(interest, daysHeld) : 0
);

/**
 * Every payment of interest a contract makes, with its tax. A period whose
 * index fell pays nothing rather than a negative amount (OQ-205).
 *
 * @param terms - The contract.
 * @param indexValue - The index's value (percent × 10,000); 0 for a fixed rate.
 * @returns The tax rule and one payment per accrual period, oldest first.
 */
const paymentsOf = (terms: ContractTerms, indexValue: number): Payments => {
  const market = marketOf(terms.assetType);
  const rule = taxRuleOf(terms.assetType, market, terms.incentivised);
  const periods = accrualPeriods(terms.date, terms.dueDate, terms.interestPayment);
  const payments = periods.map((period) => {
    const date = followingBusinessDay(period.to, market);
    const interest = Math.max(interestFor(terms.amount, terms.rate, indexValue, period, market), 0);
    return { date, interest, tax: taxOn(rule, interest, daysBetween(terms.date, date)) };
  });
  return { rule, payments };
};

/**
 * The schedule entries of one payment: its interest and its tax, when positive.
 *
 * @param payment - The payment.
 * @returns Zero to two entries.
 */
const entriesOf = (payment: Payment): ScheduleEntry[] => [
  { kind: 'interest_payment' as const, amount: payment.interest, date: payment.date },
  { kind: 'tax' as const, amount: payment.tax, date: payment.date },
].filter((entry) => entry.amount > 0);

/**
 * Sums some minor-unit amounts.
 *
 * @param amounts - The amounts.
 * @returns Their total.
 */
const sum = (amounts: readonly number[]): number => (
  amounts.reduce((total, amount) => total + amount, 0)
);

/**
 * Creates the investment product engine.
 *
 * @param deps - The index's latest value.
 * @returns `schedule` and `project`.
 */
export const createInvestmentProductEngine = (deps: InvestmentProductEngineDeps) => {
  /**
   * A contract's payments, with the index's value read now.
   *
   * @param householdId - The household whose index rates apply (FR-11.6).
   * @param terms - The contract.
   * @returns The payments, or the missing index (OQ-205).
   */
  const paymentsFor = async (
    householdId: string,
    terms: ContractTerms,
  ): Promise<Payments | IndexMissing> => {
    const { rate } = terms;
    if (rate.type === 'fixed') return paymentsOf(terms, 0);
    const latest = await deps.latestIndexRate(householdId, rate.type);
    return latest
      ? paymentsOf(terms, latest.value)
      : { ok: false, reason: 'index_missing', indexCode: rate.type };
  };

  return {
    /**
     * A contract's cash events (FR-11.2): each interest payment and its tax,
     * then the redemption of the principal at maturity — three entries on one
     * date there, or two when no tax applies.
     *
     * @param householdId - The household whose index rates apply.
     * @param terms - The contract.
     * @returns The entries, by date, every amount positive; or the missing index.
     */
    schedule: async (householdId: string, terms: ContractTerms): Promise<ScheduleResult> => {
      const contract = await paymentsFor(householdId, terms);
      if ('reason' in contract) return contract;
      const { payments } = contract;
      const redemption: ScheduleEntry = {
        kind: 'redemption', amount: terms.amount, date: payments[payments.length - 1]!.date,
      };
      return { ok: true, entries: [...payments.flatMap(entriesOf), redemption] };
    },

    /**
     * What a contract is expected to pay (FR-11.2, OQ-58), with the index's
     * value read now.
     *
     * @param householdId - The household whose index rates apply.
     * @param terms - The contract.
     * @returns The expected payout and taxes, or the missing index.
     */
    project: async (householdId: string, terms: ContractTerms): Promise<ProjectResult> => {
      const contract = await paymentsFor(householdId, terms);
      if ('reason' in contract) return contract;
      const { rule, payments } = contract;
      const expectedPayout = terms.amount + sum(payments.map((payment) => payment.interest));
      const expectedTaxes = rule === 'not_estimated'
        ? { estimated: false as const }
        : { estimated: true as const, amount: sum(payments.map((payment) => payment.tax)) };
      return { ok: true, expectedPayout, expectedTaxes };
    },
  };
};

/** The InvestmentProductEngine's operations. */
export type InvestmentProductEngine = ReturnType<typeof createInvestmentProductEngine>;
