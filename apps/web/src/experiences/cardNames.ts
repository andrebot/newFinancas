import type { CreditCard } from '@financas/api-types';
import type { Translator } from '../utilities/i18n';

// A credit card's name, as every page writes it (FL15, FL16, FL17): its
// network and last four digits, "Visa •••• 1111" — the only digits ever
// stored (NFR-SEC-7). Owned by no Experience, so Manage Finances' Flows and
// the month's rails (the Dashboard's too) name a card alike without reaching
// into one another.

/** What a card's name is made of. */
export type NamedCard = Pick<CreditCard, 'network' | 'last4'>;

/**
 * Names a credit card: "Visa •••• 1111".
 *
 * @param translator - The texts.
 * @param card - The card's network and last four digits.
 * @returns Its name in the interface language.
 */
export const cardName = (translator: Translator, card: NamedCard) => (
  translator.text('creditCard', 'name', {
    network: translator.text('cardNetworks', card.network),
    last4: card.last4,
  })
);
