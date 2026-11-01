import type { HoldingRate } from '../accessors/investmentHoldingAccessor';
import type { ContractRate } from '../engines/investmentProduct';

// A fixed-term rate in its three shapes (OQ-205): as a request or a stored
// Holding carries it, as InvestmentProductEngine takes it, and as the Holding's
// row stores it. Shared by TransactionManager (record, edit) and
// InsightsManager (the Holdings' projections) — slice 3 review, A1.

/** A rate as a request carries it — the route checked its shape. */
export interface RequestRate {
  readonly type?: string | undefined;
  readonly value?: number | undefined;
  readonly spread?: number | null | undefined;
}

/**
 * The rate as the Engine takes it, a missing spread left out.
 *
 * @param rate - The rate, its type and value present.
 * @returns The Engine's contract rate.
 */
export const engineRateOf = (rate: RequestRate): ContractRate => ({
  type: rate.type! as ContractRate['type'],
  value: rate.value!,
  ...(rate.spread != null && { spread: rate.spread }),
});

/**
 * The Holding's terms as the row stores them, a missing spread as null.
 *
 * @param rate - The rate, its type and value present.
 * @returns The Holding's rate columns.
 */
export const holdingRateOf = (rate: RequestRate): HoldingRate => ({
  rateType: rate.type!, rateValue: rate.value!, rateSpread: rate.spread ?? null,
});
