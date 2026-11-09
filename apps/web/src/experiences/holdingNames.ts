import type { InvestmentHolding } from '@financas/api-types';
import type { Catalog } from '@financas/i18n';
import { isFixedTerm } from '@financas/reference';
import { portfolio } from '../config/constants';
import type { Translator } from '../utilities/i18n';

// How the pages name a Holding's asset type and the family it belongs to
// (FL15, FL18, FL21; FR-5.1, OQ-79, OQ-233). Shared, since Record Transaction,
// the Investments overview and the Dashboard all name them the same way.

/** The families the payout selector groups Holdings by (mockup 50). */
export type AssetFamily = 'fii' | 'stock' | 'fixedIncome' | 'other';

/** The families, in the order the selector draws them. */
export const ASSET_FAMILIES: readonly AssetFamily[] = ['fii', 'stock', 'fixedIncome', 'other'];

/**
 * Reads a Holding's id, which the contract types as optional but every read sends.
 *
 * @param holding - The Holding.
 * @returns Its id; an empty one when missing.
 */
export const holdingIdOf = (holding: InvestmentHolding) => holding.id ?? '';

/**
 * Names an asset type (FR-5.1, OQ-79).
 *
 * @param translator - The texts.
 * @param code - The asset type's code; an unknown one is "Other".
 * @returns Its name in the interface language.
 */
export const assetTypeName = (translator: Translator, code: string | undefined) => (
  translator.text('assetTypes', (code ?? 'other') as keyof Catalog['assetTypes'])
);

/**
 * Tells which family an asset type belongs to: FIIs, stocks, every fixed-term
 * type as fixed income, and the rest as other.
 *
 * @param code - The asset type's code; none is other.
 * @returns The family.
 */
export const assetFamilyOf = (code: string | undefined): AssetFamily => {
  const kind = code ?? 'other';
  const { fii, stock }: Readonly<Record<string, readonly string[]>> = portfolio.payoutGroups;
  if (fii?.includes(kind)) return 'fii';
  if (stock?.includes(kind)) return 'stock';
  return isFixedTerm(kind) ? 'fixedIncome' : 'other';
};

/**
 * Names a family, as the selector's group and preset read it.
 *
 * @param translator - The texts.
 * @param family - The family.
 * @returns E.g. "FIIs", "Fixed income".
 */
export const familyName = (translator: Translator, family: AssetFamily) => (
  translator.text('holdingNames', `family.${family}`)
);
