import type { IndexCodeValue } from '@financas/reference';
import {
  businessDaysBetween, daysBetween, type Market,
} from './calendar';

// InvestmentProductEngine — accrual (FR-11.2, OQ-201): the interest a principal
// earns over one period. Brazil accrues over business days (252 a year), the US
// over actual days / 365. Every period accrues from the principal alone, so
// nothing compounds across rounded amounts; each amount is rounded once,
// half-up, to whole minor units (OQ-87).

/** How a contract's rate is expressed (OQ-50, the contract's `rate`). */
export interface ContractRate {
  readonly type: 'fixed' | IndexCodeValue;
  /**
   * Percent × 10,000 (OQ-86). Fixed: the annual rate. CDI/Selic: percent of the
   * index (110% of CDI = 1,100,000). IPCA/IGP-M: the spread above the index.
   */
  readonly value: number;
}

/** One accrual period: from (included) to (excluded), both contract dates. */
export interface Period {
  readonly from: string;
  readonly to: string;
}

/** Percent × 10,000 → a fraction: 10.50% = 105,000 → 0.105. */
const RATE_SCALE = 1_000_000;

const DAYS_PER_YEAR: Record<Market, number> = { BR: 252, US: 365 };

/**
 * Counts the days a period accrues over in a market.
 *
 * @param period - The period.
 * @param market - The market.
 * @returns Business days in Brazil, calendar days in the US; never negative.
 */
const accrualDays = (period: Period, market: Market): number => (
  market === 'BR'
    ? businessDaysBetween(period.from, period.to, market)
    : Math.max(daysBetween(period.from, period.to), 0)
);

/** Growth over some accrual days, from the rate and the index as fractions. */
type GrowthRule = (rate: number, index: number, days: number, daysPerYear: number) => number;

// Percent of the index, applied to its daily rate and compounded daily (CDI, Selic).
const percentOfIndex: GrowthRule = (rate, index, days, daysPerYear) => (
  (1 + rate * ((1 + index) ** (1 / daysPerYear) - 1)) ** days
);

// The index plus a real spread above it (IPCA, IGP-M).
const indexPlusSpread: GrowthRule = (rate, index, days, daysPerYear) => (
  ((1 + index) * (1 + rate)) ** (days / daysPerYear)
);

const GROWTH: Record<ContractRate['type'], GrowthRule> = {
  fixed: (rate, _index, days, daysPerYear) => (1 + rate) ** (days / daysPerYear),
  cdi: percentOfIndex,
  selic: percentOfIndex,
  ipca: indexPlusSpread,
  igpm: indexPlusSpread,
};

/**
 * The interest a principal earns over one period.
 *
 * @param principal - Minor units.
 * @param rate - The contract's rate.
 * @param indexValue - The index's value (percent × 10,000); ignored for a fixed rate.
 * @param period - The period.
 * @param market - The market whose day count applies.
 * @returns Whole minor units, rounded half-up.
 */
export const interestFor = (
  principal: number,
  rate: ContractRate,
  indexValue: number,
  period: Period,
  market: Market,
): number => {
  const growth = GROWTH[rate.type](
    rate.value / RATE_SCALE,
    indexValue / RATE_SCALE,
    accrualDays(period, market),
    DAYS_PER_YEAR[market],
  );
  return Math.round(principal * (growth - 1));
};
