import type { Catalog } from '@financas/i18n';
import { useI18n } from '../../../../../utilities/I18nProvider';

// The Household Setup entry's texts: the catalog's `householdSetup` section.

/** A key of the catalog's `householdSetup` section. */
export type HouseholdSetupTextKey = keyof Catalog['householdSetup'];

/**
 * The `householdSetup` section of the current locale's catalog.
 *
 * @returns A function from a `householdSetup` key to its text.
 */
export const useHouseholdSetupText = () => {
  const translator = useI18n();
  return (key: HouseholdSetupTextKey) => translator.text('householdSetup', key);
};
