// Investment reference data: asset types (FR-5.1/FR-11.1, OQ-79), index codes
// (FR-11.6, OQ-59) and schedule-entry kinds (FR-11.3). Extensible in code.

/** How a holding is valued: by recorded market value, or by its contract (OQ-51). */
export type Pricing = 'market' | 'fixed_term';

/** One asset type; fixed-term types carry the market whose rules (tax, …) apply. */
export interface AssetType {
  readonly code: string;
  readonly pricing: Pricing;
  readonly market?: 'BR' | 'US';
}

export const ASSET_TYPES = [
  { code: 'stock', pricing: 'market' },
  { code: 'fii', pricing: 'market' },
  { code: 'fund', pricing: 'market' },
  { code: 'mutual_fund', pricing: 'market' },
  { code: 'currency', pricing: 'market' },
  { code: 'crypto', pricing: 'market' },
  { code: 'real_estate', pricing: 'market' },
  { code: 'other', pricing: 'market' },
  { code: 'cdb', pricing: 'fixed_term', market: 'BR' },
  { code: 'lc', pricing: 'fixed_term', market: 'BR' },
  { code: 'lf', pricing: 'fixed_term', market: 'BR' },
  { code: 'lci', pricing: 'fixed_term', market: 'BR' },
  { code: 'lca', pricing: 'fixed_term', market: 'BR' },
  { code: 'cra', pricing: 'fixed_term', market: 'BR' },
  { code: 'cri', pricing: 'fixed_term', market: 'BR' },
  { code: 'debenture', pricing: 'fixed_term', market: 'BR' },
  { code: 'tesouro_direto', pricing: 'fixed_term', market: 'BR' },
  { code: 'cd', pricing: 'fixed_term', market: 'US' },
  { code: 'treasury', pricing: 'fixed_term', market: 'US' },
] as const satisfies readonly AssetType[];

export type AssetTypeCode = (typeof ASSET_TYPES)[number]['code'];

/** Index the user records values for; the unit follows from the code. */
export interface IndexCode {
  readonly code: string;
  readonly unit: 'annual_percent' | 'trailing_12m_percent';
}

export const INDEX_CODES = [
  { code: 'selic', unit: 'annual_percent' },
  { code: 'cdi', unit: 'annual_percent' },
  { code: 'ipca', unit: 'trailing_12m_percent' },
  { code: 'igpm', unit: 'trailing_12m_percent' },
] as const satisfies readonly IndexCode[];

export type IndexCodeValue = (typeof INDEX_CODES)[number]['code'];

/** Contractual cash events of a fixed-term holding. */
export const SCHEDULE_ENTRY_KINDS = ['interest_payment', 'redemption', 'tax'] as const;

/**
 * Looks up an asset type by code.
 *
 * @param code - An asset type code.
 * @returns The asset type, or `undefined` for an unknown code.
 */
export const findAssetType = (code: string): AssetType | undefined => (
  ASSET_TYPES.find((type) => type.code === code)
);

/**
 * Tells whether a holding of this type is valued by its contract rather than
 * by recorded market values (OQ-50/OQ-51).
 *
 * @param code - An asset type code.
 * @returns `true` for fixed-term types; `false` for market-priced or unknown ones.
 */
export const isFixedTerm = (code: string): boolean => findAssetType(code)?.pricing === 'fixed_term';

/**
 * Tells whether a code is a known index.
 *
 * @param code - An index code.
 * @returns `true` for selic, cdi, ipca and igpm.
 */
export const isIndexCode = (code: string): boolean => (
  INDEX_CODES.some((index) => index.code === code)
);
