import type { Market } from './calendar';

// InvestmentProductEngine — tax (FR-11.2, OQ-79, OQ-205): the rules coded per
// instrument. Brazil's regressive income tax goes by the calendar days from the
// purchase to each payment, every coupon at its own bracket; LCI, LCA, CRA, CRI
// and incentivised debentures are exempt for individuals. US taxes depend on
// the user's bracket, which the app doesn't know: not estimated (OQ-79).

/** How an instrument's payments are taxed: regressively, not at all, or not estimated. */
export type TaxRule = 'regressive' | 'exempt' | 'not_estimated';

/** Up to `maxDays` held, the rate in per mille (22.5% = 225). */
interface Bracket {
  readonly maxDays: number;
  readonly perMille: number;
}

// Lei 11.033/2004, art. 1º — the regressive table for fixed income.
const REGRESSIVE_BRACKETS: readonly Bracket[] = [
  { maxDays: 180, perMille: 225 },
  { maxDays: 360, perMille: 200 },
  { maxDays: 720, perMille: 175 },
  { maxDays: Infinity, perMille: 150 },
];

const PER_MILLE = 1_000;

// Exempt for individuals whatever the flag (Lei 11.033/2004, art. 3º).
const EXEMPT_TYPES: ReadonlySet<string> = new Set(['lci', 'lca', 'cra', 'cri']);

/**
 * The tax rule of an instrument.
 *
 * @param assetType - A fixed-term asset type code.
 * @param market - Its market.
 * @param incentivised - Debentures only: incentivised ones are exempt.
 * @returns The rule.
 */
export const taxRuleOf = (
  assetType: string,
  market: Market,
  incentivised: boolean | null,
): TaxRule => {
  if (market === 'US') return 'not_estimated';
  const exempt = EXEMPT_TYPES.has(assetType)
    || (assetType === 'debenture' && incentivised === true);
  return exempt ? 'exempt' : 'regressive';
};

/**
 * The regressive income tax on a payment.
 *
 * @param interest - The payment's gross interest, minor units.
 * @param daysHeld - Calendar days from the purchase to the payment.
 * @returns Whole minor units, rounded half-up.
 */
export const regressiveTax = (interest: number, daysHeld: number): number => {
  const bracket = REGRESSIVE_BRACKETS.find((candidate) => daysHeld <= candidate.maxDays)!;
  return Math.round((interest * bracket.perMille) / PER_MILLE);
};
