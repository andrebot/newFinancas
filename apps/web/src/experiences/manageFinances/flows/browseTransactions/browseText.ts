import type { Catalog } from '@financas/i18n';
import type { MessageParams, Translator } from '../../../../utilities/i18n';

// The Browse Transactions Flow's texts (FL16): its `browseTransactions`
// catalog section. Some keys are picked at run time — a detail's caption by
// the row's ledger — so they are looked up through here, in one place.

/** A key of the Flow's catalog section. */
export type BrowseTextKey = keyof Catalog['browseTransactions'];

/**
 * Writes one of the Flow's texts.
 *
 * @param translator - The texts.
 * @param key - The key.
 * @param params - Its ICU params.
 * @returns The text in the interface language.
 */
export const browseText = (translator: Translator, key: BrowseTextKey, params?: MessageParams) => (
  translator.text('browseTransactions', key, params)
);
