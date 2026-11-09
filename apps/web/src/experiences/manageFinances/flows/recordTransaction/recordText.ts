import type { Catalog } from '@financas/i18n';
import type { Formatter } from '../../../../utilities/formatting';
import type { MessageParams, Translator } from '../../../../utilities/i18n';

// The Record Transaction drawer's texts (FL15): its `recordTransaction`
// catalog section (the asset types' names are in `holdingNames.ts`). Many keys are
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

/** A contract's rate, as a Holding or the form holds it. */
export interface QuotedRate {
  /** `fixed` when unknown. */
  readonly type?: string | undefined;
  /** Percent × 10,000. */
  readonly value?: number | null | undefined;
  /** CDI/Selic only: percent × 10,000 on top (OQ-205). */
  readonly spread?: number | null | undefined;
}

/**
 * Writes a fixed-term rate the way the contract quotes it: "110% of CDI",
 * or "100% of Selic + 0.05%" with a spread.
 *
 * @param translator - The texts.
 * @param formatter - Numbers in the interface language.
 * @param rate - The rate.
 * @returns The rate's text.
 */
export const rateText = (translator: Translator, formatter: Formatter, rate: QuotedRate) => {
  const base = recordText(translator, `rate.${rate.type ?? 'fixed'}`, {
    rate: formatter.rate(rate.value ?? 0),
  });
  if (!rate.spread) return base;
  return recordText(translator, 'rate.withSpread', {
    rate: base, spread: formatter.rate(rate.spread),
  });
};
