import type { Currency, GoalWithProgress } from '@financas/api-types';
import { goals as goalSettings } from '../../../../config/constants';
import { KIND_SCALE } from '../../../../kit/numberInput/decimal';

// A Goal's progress as its card shows it (FL14; FR-8.4/8.5, FR-9, OQ-195):
// the progress read gives each funding Holding's contribution in its own
// currency, carried on each Holding funding it (OQ-206 — one the viewer can't
// see comes unnamed, its amount still counted); this reads them, adds
// up what is in the target's currency, and converts the rest at the rate the
// user typed — the only FX conversion in the app, kept in the browser and
// never sent (FR-9.1). A pair with no rate stays out of the total and is
// named so the card can ask for it. Pure, so it tests without React.

/** One currency pair, `1 base = rate quote` (OQ-195). */
export interface RatePair {
  readonly base: Currency;
  readonly quote: Currency;
}

/** The rates typed so far, × 10,000, by `pairKey`. */
export type EnteredRates = Readonly<Record<string, number>>;

/** One Holding funding a Goal, as its card lists it. */
export interface FundingRow {
  /** Null for a Holding in an Account the viewer can't see (OQ-206). */
  readonly holdingId: string | null;
  /** The Holding's ticker; null when it has none, or when hidden. */
  readonly name: string | null;
  /** Whole percent of the Holding given to this Goal (OQ-87). */
  readonly percentage: number;
  /** What it contributes, in its own currency; missing if the read lacks it. */
  readonly contribution?: { readonly currency: Currency; readonly amount: number } | undefined;
  /** Its contribution in the target's currency, when converted at a typed rate. */
  readonly converted?: number | undefined;
}

/** A Goal's progress, in its target's currency. */
export interface ProgressSummary {
  readonly rows: readonly FundingRow[];
  /** What is counted so far, in minor units of the target's currency. */
  readonly funded: number;
  /** `funded` against the target, as a whole percent (not held to 100). */
  readonly percent: number;
  /** What is left to reach the target; zero once it is reached. */
  readonly toGo: number;
  /** Some contribution is in another currency: the card shows the calculator. */
  readonly mixed: boolean;
  /** `funded` includes a converted amount: the card marks it with ≈. */
  readonly estimate: boolean;
  /** The pairs the foreign contributions need: one rate field each. */
  readonly pairs: readonly RatePair[];
  /** Those of them no rate is typed for yet. */
  readonly missingPairs: readonly RatePair[];
}

/** When a Goal is due, relative to today. */
export type DueIn = { readonly kind: 'overdue' }
  | { readonly kind: 'thisMonth' }
  | { readonly kind: 'ahead'; readonly years: number; readonly months: number };

/** A rate's fixed-point factor: the number input's `exchange` decimals. */
const RATE_SCALE = 10 ** KIND_SCALE.exchange;

/**
 * Orders a pair the way its rate is typed: the base is whichever of the two
 * comes first in `goals.rateBaseOrder` ("1 USD = 5.20 BRL").
 *
 * @param first - One currency.
 * @param second - The other.
 * @returns The pair, base first.
 */
export const ratePairOf = (first: Currency, second: Currency): RatePair => {
  const order: readonly Currency[] = goalSettings.rateBaseOrder;
  return order.indexOf(first) <= order.indexOf(second)
    ? { base: first, quote: second }
    : { base: second, quote: first };
};

/**
 * Builds the key a pair's rate is kept under.
 *
 * @param pair - The pair.
 * @returns E.g. `USD/BRL`.
 */
export const pairKey = ({ base, quote }: RatePair) => `${base}/${quote}`;

/**
 * Converts an amount at a typed rate, rounded half-up to the cent (OQ-87).
 *
 * @param amount - Minor units of `from`.
 * @param from - Its currency.
 * @param pair - The pair, its rate meaning `1 base = rate quote`.
 * @param rate - The rate, × 10,000.
 * @returns Minor units of the pair's other currency.
 */
export const convert = (amount: number, from: Currency, pair: RatePair, rate: number) => (
  from === pair.base
    ? Math.round((amount * rate) / RATE_SCALE)
    : Math.round((amount * RATE_SCALE) / rate)
);

/**
 * Reads a Goal's funding Holdings with their contributions, converting each
 * foreign one whose pair has a rate typed.
 *
 * @param goal - The Goal with its progress.
 * @param rates - The rates typed so far.
 * @returns One row per funding Holding, in the read's order.
 */
export const fundingRowsOf = (goal: GoalWithProgress, rates: EnteredRates): FundingRow[] => (
  goal.fundedBy.map((funder) => {
    const { contribution } = funder;
    const row = { holdingId: funder.holdingId, name: funder.name, percentage: funder.percentage };
    if (!contribution) return row;
    const own = { currency: contribution.currency, amount: contribution.amount };
    if (own.currency === goal.targetCurrency) return { ...row, contribution: own };
    const pair = ratePairOf(own.currency, goal.targetCurrency);
    const rate = rates[pairKey(pair)];
    const converted = rate ? convert(own.amount, own.currency, pair, rate) : undefined;
    return { ...row, contribution: own, converted };
  })
);

/**
 * Lists the pairs a Goal's foreign contributions need, each once.
 *
 * @param goal - The Goal with its progress.
 * @returns The pairs, in the contributions' order.
 */
const pairsOf = (goal: GoalWithProgress): RatePair[] => {
  const pairs = goal.fundedBy
    .flatMap((funder) => (funder.contribution ? [funder.contribution] : []))
    .filter((item) => item.currency !== goal.targetCurrency)
    .map((item) => ratePairOf(item.currency, goal.targetCurrency));
  return [...new Map(pairs.map((pair) => [pairKey(pair), pair])).values()];
};

/**
 * Tells what a row counts toward the target: its own amount in the target's
 * currency, its converted amount, or nothing without a rate.
 *
 * @param row - The funding row.
 * @param target - The Goal's currency.
 * @returns Minor units of the target's currency.
 */
const countedOf = (row: FundingRow, target: Currency) => {
  if (!row.contribution) return 0;
  if (row.contribution.currency === target) return row.contribution.amount;
  return row.converted ?? 0;
};

/**
 * Sums a Goal's progress in its target's currency (FR-8.5).
 *
 * @param goal - The Goal with its progress.
 * @param rates - The rates typed so far.
 * @returns The rows, what is counted, the percent, what is left and the flags.
 */
export const progressOf = (goal: GoalWithProgress, rates: EnteredRates): ProgressSummary => {
  const target = goal.targetCurrency;
  const rows = fundingRowsOf(goal, rates);
  const funded = rows.reduce((sum, row) => sum + countedOf(row, target), 0);
  const pairs = pairsOf(goal);
  return {
    rows,
    funded,
    percent: Math.round((funded * 100) / goal.targetAmount),
    toGo: Math.max(0, goal.targetAmount - funded),
    mixed: pairs.length > 0,
    estimate: rows.some((row) => row.converted !== undefined),
    pairs,
    missingPairs: pairs.filter((pair) => !rates[pairKey(pair)]),
  };
};

/**
 * Tells when a Goal is due, in calendar months from today: a due date in the
 * past is overdue (a display state, OQ-177); one in this calendar month is this
 * month, and one in the next is a month ahead, whatever its day.
 *
 * @param dueDate - The Goal's due date, `YYYY-MM-DD`.
 * @param today - Today, `YYYY-MM-DD`.
 * @returns Overdue, this month, or the years and months ahead.
 */
export const dueInOf = (dueDate: string, today: string): DueIn => {
  if (dueDate < today) return { kind: 'overdue' };
  const [dueYear, dueMonth] = dueDate.split('-').map(Number) as [number, number];
  const [year, month] = today.split('-').map(Number) as [number, number];
  const months = (dueYear - year) * 12 + (dueMonth - month);
  if (months === 0) return { kind: 'thisMonth' };
  return { kind: 'ahead', years: Math.floor(months / 12), months: months % 12 };
};
