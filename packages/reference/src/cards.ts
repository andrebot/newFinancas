// Credit card networks (FR-2.8): a plain reference list validated in code,
// extensible without a schema change (02-data-model.md).

export const CARD_NETWORKS = [
  'visa', 'mastercard', 'amex', 'elo', 'hipercard', 'diners', 'discover', 'other',
] as const;

export type CardNetwork = (typeof CARD_NETWORKS)[number];

/**
 * Tells whether a code is a known card network.
 *
 * @param code - A network code.
 * @returns `true` when it is in the list.
 */
export const isCardNetwork = (code: string): code is CardNetwork => (
  (CARD_NETWORKS as readonly string[]).includes(code)
);
