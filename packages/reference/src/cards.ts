// Credit card networks (FR-2.8): a plain reference list validated in code,
// extensible without a schema change (02-data-model.md).

export const CARD_NETWORKS = [
  'visa', 'mastercard', 'amex', 'elo', 'hipercard', 'diners', 'discover', 'jcb', 'unionpay',
  'other',
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

// Detecting the network from the number (K48, OQ-187). Each network's BIN
// ranges are data: a range is a pair of prefixes with the same count of
// digits, and a number matches once it has that many digits and they fall in
// the range. So a partial number is read as it is typed: `4` is already Visa,
// and `401178` turns it into Elo. The order matters where ranges overlap:
// Elo and Hipercard come before Visa, Discover and Diners. Elo and Hipercard
// follow the public BIN tables (Braintree's credit-card-type, Oct 2026); the
// Hiper BINs (637…) count as Hipercard, as both are Itaú's.

/** An inclusive range of number prefixes, both with the same count of digits. */
export type BinRange = readonly [first: string, last: string];

/** A network's BIN ranges. */
export interface CardNetworkRule {
  readonly network: Exclude<CardNetwork, 'other'>;
  readonly ranges: readonly BinRange[];
}

/**
 * Builds the ranges of single prefixes, e.g. `['34', '37']`.
 *
 * @param prefixes - Each a range of its own.
 * @returns One range per prefix.
 */
const exactly = (...prefixes: readonly string[]): BinRange[] => (
  prefixes.map((prefix): BinRange => [prefix, prefix])
);

/** Every network's BIN ranges, checked in this order; `other` is what none matches. */
export const CARD_NETWORK_RULES: readonly CardNetworkRule[] = [
  {
    network: 'elo',
    ranges: [
      ...exactly('401178', '401179', '431274', '438935', '451416', '457393', '457631', '457632'),
      ...exactly('504175', '627780', '636297', '636368'),
      ['506699', '506778'], ['509000', '509999'],
      ['650031', '650033'], ['650035', '650051'], ['650057', '650081'], ['650405', '650439'],
      ['650485', '650538'], ['650541', '650598'], ['650700', '650718'], ['650720', '650727'],
      ['650901', '650978'], ['651652', '651679'], ['651680', '651704'], ['655000', '655019'],
      ['655021', '655058'],
    ],
  },
  {
    network: 'hipercard',
    ranges: [
      ...exactly('606282', '384100', '384140', '384160'),
      ...exactly('637095', '637568', '637599', '637609', '637612', '63737423', '63743358'),
    ],
  },
  { network: 'amex', ranges: exactly('34', '37') },
  { network: 'diners', ranges: [['300', '305'], ...exactly('36', '38', '39')] },
  { network: 'discover', ranges: [['6011', '6011'], ['644', '649'], ['65', '65']] },
  { network: 'jcb', ranges: [['3528', '3589'], ...exactly('2131', '1800')] },
  { network: 'unionpay', ranges: [['62', '62'], ['8100', '8171']] },
  { network: 'mastercard', ranges: [['51', '55'], ['2221', '2720']] },
  { network: 'visa', ranges: exactly('4') },
];

/**
 * Tells whether a number falls in a range: it needs as many digits as the
 * range's prefixes, and its leading ones must sit between them.
 *
 * @param digits - The card number's digits, possibly only the first few.
 * @param range - The range.
 * @returns `true` when the number is in it.
 */
export const inBinRange = (digits: string, [first, last]: BinRange): boolean => {
  const prefix = digits.slice(0, first.length);
  return prefix.length === first.length && prefix >= first && prefix <= last;
};

/**
 * Detects a card's network from its number, even a partial one as it is typed.
 *
 * @param digits - The card number's digits, without separators.
 * @returns The first network whose ranges hold the number, or `other`.
 */
export const detectCardNetwork = (digits: string): CardNetwork => (
  CARD_NETWORK_RULES.find(({ ranges }) => ranges.some((range) => inBinRange(digits, range)))
    ?.network ?? 'other'
);

/** How a network's numbers are written: where the spaces go and how long they may be. */
export interface CardNumberFormat {
  /** The digit counts after which a space goes, e.g. `[4, 10]` → `3782 822463 10005`. */
  readonly gaps: readonly number[];
  /** The lengths a number may have, shortest first; the last is the most it may hold. */
  readonly lengths: readonly number[];
}

const FOURS = [4, 8, 12, 16] as const;

/** Each network's number format (K48, OQ-187). */
export const CARD_NUMBER_FORMATS: Readonly<Record<CardNetwork, CardNumberFormat>> = {
  visa: { gaps: FOURS, lengths: [13, 16, 19] },
  mastercard: { gaps: FOURS, lengths: [16] },
  amex: { gaps: [4, 10], lengths: [15] },
  elo: { gaps: FOURS, lengths: [16] },
  hipercard: { gaps: FOURS, lengths: [16, 19] },
  diners: { gaps: [4, 10], lengths: [14] },
  discover: { gaps: FOURS, lengths: [16, 19] },
  jcb: { gaps: FOURS, lengths: [16, 17, 18, 19] },
  unionpay: { gaps: FOURS, lengths: [16, 17, 18, 19] },
  other: { gaps: FOURS, lengths: [12, 13, 14, 15, 16, 17, 18, 19] },
};

/**
 * Finds the most digits a network's number may hold.
 *
 * @param network - The card network.
 * @returns Its longest length.
 */
export const maxCardNumberLength = (network: CardNetwork): number => (
  Math.max(...CARD_NUMBER_FORMATS[network].lengths)
);

/**
 * Runs the Luhn checksum every card number carries.
 *
 * @param digits - The card number's digits.
 * @returns `true` when the checksum holds.
 */
export const passesLuhn = (digits: string): boolean => {
  const sum = Array.from(digits).reverse().reduce((total, character, index) => {
    const digit = Number(character) * (index % 2 === 1 ? 2 : 1);
    return total + (digit > 9 ? digit - 9 : digit);
  }, 0);
  return sum % 10 === 0;
};

/**
 * Tells whether a whole card number is valid: only digits, a length its
 * network allows and a Luhn checksum that holds. It catches typos before the
 * last four digits are kept (the number itself never is, NFR-SEC-7).
 *
 * @param digits - The card number's digits, without separators.
 * @returns `true` when the number is valid.
 */
export const isValidCardNumber = (digits: string): boolean => (
  /^\d+$/.test(digits)
  && CARD_NUMBER_FORMATS[detectCardNetwork(digits)].lengths.includes(digits.length)
  && passesLuhn(digits)
);
