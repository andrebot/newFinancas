import type { CSSProperties } from 'react';
import {
  CARD_NUMBER_FORMATS, detectCardNetwork, maxCardNumberLength, type CardNetwork,
} from '@financas/reference';
import { creditCard } from '../../config/constants';
import type { Mask } from '../maskedInput/useMaskedInput';

// The card number's mask and the preview's pieces (K48, OQ-187). The number
// is grouped the way its network writes it (Amex and Diners 4-6, the rest in
// fours) and stops at the network's longest length; both follow the network
// detected from the digits typed so far. The number never leaves the form:
// only the network and the last four digits are kept (NFR-SEC-7).

const PLACEHOLDER = '•';

/**
 * Inserts a space after each gap position that more digits follow.
 *
 * @param characters - The digits (or placeholders) to group.
 * @param gaps - The counts after which a space goes.
 * @returns The grouped text.
 */
export const groupCardDigits = (characters: string, gaps: readonly number[]): string => (
  Array.from(characters, (character, index) => (
    gaps.includes(index) ? ` ${character}` : character
  )).join('')
);

/**
 * Turns typed text into the card number's digits, at most as many as the
 * detected network allows.
 *
 * @param text - What the user typed or pasted.
 * @returns The digits.
 */
export const parseCardNumber = (text: string): string => {
  const digits = text.replace(/\D/g, '');
  return digits.slice(0, maxCardNumberLength(detectCardNetwork(digits)));
};

/**
 * Shows the card number grouped as its network writes it.
 *
 * @param digits - The card number's digits.
 * @returns The grouped number.
 */
export const formatCardNumber = (digits: string): string => (
  groupCardDigits(digits, CARD_NUMBER_FORMATS[detectCardNetwork(digits)].gaps)
);

/** The card number's mask, for `useMaskedInput`. */
export const cardNumberMask: Mask = { format: formatCardNumber, parse: parseCardNumber };

/** A run of the preview's number: digits the user knows, or placeholders still to come. */
export interface CardNumberPart {
  readonly text: string;
  readonly placeholder: boolean;
}

/**
 * Picks how many digits the preview draws: the placeholder length when the
 * network allows it, else its first length that holds what was typed.
 *
 * @param network - The card network.
 * @param typed - How many digits are known.
 * @returns The digit count to draw.
 */
export const previewLength = (network: CardNetwork, typed: number): number => {
  const { lengths } = CARD_NUMBER_FORMATS[network];
  const wanted = Math.max(typed, creditCard.placeholderLength);
  return lengths.find((length) => length >= wanted) ?? Math.max(typed, ...lengths);
};

/**
 * Splits the preview's number into what is known and placeholders: the
 * digits typed so far, then dots to the card's length; or, for a saved card
 * whose number is not typed, dots and its last four digits.
 *
 * @param network - The card network, which sets the groups and the length.
 * @param digits - The digits typed so far.
 * @param last4 - A saved card's last four digits, shown when nothing is typed.
 * @returns The parts, in order, without empty ones.
 */
export const cardNumberParts = (
  network: CardNetwork,
  digits: string,
  last4 = '',
): CardNumberPart[] => {
  const { gaps } = CARD_NUMBER_FORMATS[network];
  const known = digits || last4;
  const length = previewLength(network, known.length);
  const padding = PLACEHOLDER.repeat(length - known.length);
  const shown = groupCardDigits(digits ? digits + padding : padding + last4, gaps);
  const split = digits ? groupCardDigits(digits, gaps).length : shown.length - last4.length;
  const head = shown.slice(0, split);
  const tail = shown.slice(split);
  const parts: CardNumberPart[] = digits
    ? [{ text: head, placeholder: false }, { text: tail, placeholder: true }]
    : [{ text: head, placeholder: true }, { text: tail, placeholder: false }];
  return parts.filter(({ text }) => text !== '');
};

/**
 * The light badge a logo sits on. Logos keep their own colours, and some
 * (Visa's navy, Elo's black) vanish on a dark card; the dark theme's ink is
 * light, so the badge stands out on every network's colour.
 */
export const LOGO_BADGE = 'flex items-center justify-center rounded-md bg-ink px-1 text-bg';

/**
 * Builds a card's surface: its network's dark gradient.
 *
 * @param network - The card network.
 * @returns The inline style.
 */
export const cardSurfaceStyle = (network: CardNetwork): CSSProperties => {
  const [start, end] = creditCard.gradients[network];
  return { backgroundImage: `linear-gradient(135deg, ${start}, ${end})` };
};

/**
 * Builds the preview chip's gold.
 *
 * @returns The inline style.
 */
export const chipStyle = (): CSSProperties => {
  const [light, dark] = creditCard.chip;
  return { backgroundImage: `linear-gradient(135deg, ${light}, ${dark})` };
};
