import type { Catalog } from '@financas/i18n';
import type { MessageParams, Translator } from '../../../../utilities/i18n';

// The Record Transaction drawer's texts (FL15): its `recordTransaction`
// catalog section, and the asset types' names (`assetTypes`). Many keys are
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
