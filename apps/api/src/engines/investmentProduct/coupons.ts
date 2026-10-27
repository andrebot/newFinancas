import type { InterestPayment } from '../../db/schema/values';
import type { Period } from './accrual';
import { monthsBefore } from './calendar';

// InvestmentProductEngine — coupons (FR-11.2, OQ-205): the contract's accrual
// periods. Coupon dates count back from the due date in whole steps, keeping its
// day of the month, so a short period falls first; every date is a contract
// date (rolling to a business day is the payment's, not the period's).

/** Months between coupons; at maturity there is a single period. */
const MONTHS_PER_COUPON: Record<InterestPayment, number | null> = {
  at_maturity: null,
  monthly: 1,
  semiannual: 6,
};

/**
 * The coupon dates after a purchase, counted back from the due date.
 *
 * @param date - The purchase date, `YYYY-MM-DD`.
 * @param dueDate - The due date, `YYYY-MM-DD`; always the last one.
 * @param step - Months between coupons.
 * @param back - Months back from the due date already counted.
 * @returns The dates after the purchase, oldest first.
 */
const couponDates = (date: string, dueDate: string, step: number, back = step): string[] => {
  const coupon = monthsBefore(dueDate, back);
  return coupon > date
    ? [...couponDates(date, dueDate, step, back + step), monthsBefore(dueDate, back - step)]
    : [monthsBefore(dueDate, back - step)];
};

/**
 * The accrual periods of a contract, purchase to due date.
 *
 * @param date - The purchase date, `YYYY-MM-DD`.
 * @param dueDate - The due date, `YYYY-MM-DD`.
 * @param interestPayment - When the contract pays interest.
 * @returns One period per payment, oldest first; the last ends on the due date.
 */
const accrualPeriods = (
  date: string,
  dueDate: string,
  interestPayment: InterestPayment,
): Period[] => {
  const step = MONTHS_PER_COUPON[interestPayment];
  const ends = step === null ? [dueDate] : couponDates(date, dueDate, step);
  return ends.map((to, position) => ({ from: ends[position - 1] ?? date, to }));
};

export default accrualPeriods;
