import type { Catalog } from '@financas/i18n';
import type { MessageParams, Translator } from '../../../../utilities/i18n';

// The Record Transaction drawer's texts (FL15): its `recordTransaction`
// catalog section (the asset types' names and a rate's text are in
// `holdingNames.ts`). Many keys are
// built from reference data — `kind.<code>`, `rate.<type>`, … — so they are
// looked up through here, in one place; a key the catalog lacks shows itself,
// which the Flow's tests catch.

/** A key of the drawer's catalog section. */
export type RecordTextKey = keyof Catalog['recordTransaction'];

/**
 * Writes one of the drawer's texts.
 *
 * @param translator - The texts.
 * @param key - The key, possibly built from a code, e.g. `kind.pix_payment`.
 * @param params - Its ICU params.
 * @returns The text in the interface language.
 */
export const recordText = (translator: Translator, key: string, params?: MessageParams) => (
  translator.text('recordTransaction', key as RecordTextKey, params)
);
