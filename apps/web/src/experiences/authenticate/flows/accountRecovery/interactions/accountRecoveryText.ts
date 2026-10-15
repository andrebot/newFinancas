import type { Catalog } from '@financas/i18n';
import { useI18n } from '../../../../../utilities/I18nProvider';

// The Account Recovery entries' texts: the catalog's `accountRecovery` section.

/** A key of the catalog's `accountRecovery` section. */
export type AccountRecoveryTextKey = keyof Catalog['accountRecovery'];

/**
 * The `accountRecovery` section of the current locale's catalog.
 *
 * @returns A function from an `accountRecovery` key to its text.
 */
export const useAccountRecoveryText = () => {
  const translator = useI18n();
  return (key: AccountRecoveryTextKey) => translator.text('accountRecovery', key);
};
