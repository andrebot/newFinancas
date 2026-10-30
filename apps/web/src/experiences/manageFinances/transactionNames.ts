import type { Catalog } from '@financas/i18n';
import type { KindGroup } from '@financas/reference';
import { transactionKinds as settings } from '../../config/constants';
import type { IconName } from '../../kit/icons/Icon';
import type { Translator } from '../../utilities/i18n';

// The names Manage Finances' Flows share (FL15, FL16): a transaction kind's
// and a kind group's, from the `transactions` catalog section, and a kind's
// icon; a card's name is every page's (`experiences/cardNames.ts`). Kept at
// the Experience so neither Flow reads the other's texts (EBD: no sideways
// ties between sibling Flows).

/** A key of the shared `transactions` catalog section. */
type TransactionsKey = keyof Catalog['transactions'];

/**
 * Names a transaction kind.
 *
 * @param translator - The texts.
 * @param code - The kind's code, e.g. `pix_payment`.
 * @returns Its name in the interface language.
 */
export const kindName = (translator: Translator, code: string) => (
  translator.text('transactions', `kind.${code}` as TransactionsKey)
);

/**
 * Names a kind group.
 *
 * @param translator - The texts.
 * @param group - The group.
 * @returns Its name in the interface language.
 */
export const groupName = (translator: Translator, group: KindGroup) => (
  translator.text('transactions', `group.${group}`)
);

/**
 * Picks a transaction kind's icon.
 *
 * @param code - The kind's code.
 * @returns Its icon; an unknown kind's is the generic one.
 */
export const kindIcon = (code: string): IconName => (
  settings.kindIcons[code as keyof typeof settings.kindIcons] ?? 'payments-outline'
);
